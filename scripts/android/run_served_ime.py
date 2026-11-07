#!/usr/bin/env python3
"""Supervise the existing GMD test command and reconcile only its leased test IME."""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import signal
import subprocess
import sys
import time

from served_ime_contract import (COMPONENT, LEASE_PATH, NONCE_ENV, RECOVERY_PATH, SETTING_KEYS,
                                 TARGET, TEST_PACKAGE, baseline, gradle_command, lease_for,
                                 recovery_commands, require, require_instrumentation_closed, validate_recovery)


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def option(args, name):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None


def listening_ports(process):
    """Resolve this PID's listening sockets when the emulator chose its own console port."""
    sockets = set()
    for descriptor in (process / "fd").iterdir():
        try:
            target = os.readlink(descriptor)
            if target.startswith("socket:[") and target.endswith("]"):
                sockets.add(target[8:-1])
        except OSError:
            continue
    ports = set()
    for table in ("tcp", "tcp6"):
        for line in (process / "net" / table).read_text().splitlines()[1:]:
            fields = line.split()
            if len(fields) > 9 and fields[3] == "0A" and fields[9] in sockets:
                ports.add(str(int(fields[1].rsplit(":", 1)[1], 16)))
    return sorted(ports)


def emulator_processes(sdk, nonce, proc=Path("/proc")):
    """A nonce inherited from our Gradle child is required; names/ports alone grant nothing."""
    result = []
    for item in proc.iterdir():
        if not item.name.isdigit():
            continue
        try:
            if item.stat().st_uid != os.getuid():
                continue
            exe = (item / "exe").resolve(strict=True)
            if not exe.is_relative_to(sdk / "emulator") or not (exe.name == "emulator" or exe.name.startswith("qemu-system-")):
                continue
            env = (item / "environ").read_bytes().split(b"\0")
            if (NONCE_ENV + "=" + nonce).encode() not in env:
                continue
            args = (item / "cmdline").read_bytes().decode().rstrip("\0").split("\0")
            avd = option(args, "-avd") or next((x[1:] for x in args if x.startswith("@")), None)
            if not avd:
                continue
            stat = (item / "stat").read_text().rsplit(")", 1)[1].split()
            port = option(args, "-port") or option(args, "-ports")
            result.append({"pid": int(item.name), "startTicks": stat[19], "exe": str(exe),
                           "avd": avd, "port": None if port is None else port.split(",")[0],
                           "listeningPorts": listening_ports(item) if port is None else []})
        except (OSError, ValueError, IndexError):
            continue  # Processes can exit while /proc is being read.
    return result


def match_process(serial, avd, processes):
    console = serial.removeprefix("emulator-")
    matches = [p for p in processes if p["avd"] == avd
               and (p["port"] == console or (p["port"] is None and console in p.get("listeningPorts", [])))]
    require(len(matches) == 1, "Emulator is not uniquely owned by this Gradle nonce")
    return {k: matches[0][k] for k in ("pid", "startTicks", "exe", "avd")} | {"port": console}


def process_alive(process):
    try:
        fields = Path("/proc", str(process["pid"]), "stat").read_text().rsplit(")", 1)[1].split()
    except FileNotFoundError:
        return False
    # Permission or malformed data is uncertainty, not proof that GMD disposed of it.
    return fields[19] == process["startTicks"]


def discovery_read(args):
    """Only these public, read-only probes may wait for pre-lease readiness."""
    if args == ["devices"]:
        return True
    if len(args) < 4 or args[0] != "-s" or not re.fullmatch(r"emulator-[0-9]+", args[1]):
        return False
    if args[2:] == ["emu", "avd", "name"]:
        return True
    if len(args) != 5 or args[2:4] != ["shell", "-T"]:
        return False
    command = shlex.split(args[4])
    if command in (["getprop", "sys.boot_completed"], ["getprop", "ro.kernel.qemu"],
                   ["getprop", "ro.build.version.sdk"], ["am", "get-current-user"],
                   ["cat", "/proc/sys/kernel/random/boot_id"]):
        return True
    if len(command) == 6 and command[:1] == ["run-as"]:
        return command[1] in (TARGET, TEST_PACKAGE) and command[2] == "--user" \
            and command[3].isdigit() and command[4:] == ["id", "-u"]
    if len(command) == 5 and command[:3] == ["pm", "path", "--user"]:
        return command[3].isdigit() and command[4] in (TARGET, TEST_PACKAGE)
    if len(command) == 6 and command[:5] == ["ime", "list", "-a", "-s", "--user"]:
        return command[5].isdigit()
    return len(command) == 6 and command[:2] == ["settings", "--user"] \
        and command[2].isdigit() and command[3:5] == ["get", "secure"] and command[5] in SETTING_KEYS


class AdbFailure(RuntimeError):
    def __init__(self, args, code, stdout=b"", stderr=b"", timed_out=False, has_input=False, executable=None):
        self.args_vector = list(args)
        self.has_input = has_input
        self.empty_response = not stdout.strip() and not stderr.strip()
        self.read_probe = not has_input and discovery_read(self.args_vector)
        message = stderr.decode(errors="replace").strip()
        transport = re.fullmatch(
            r"(?:adb: )?(?:error: )?(?:closed|device offline|no devices/emulators found|"
            r"device '(emulator-[0-9]+)' not found|connection reset by peer)", message)
        self.transport_response = (timed_out and self.empty_response) or (not stdout.strip() and transport is not None)
        self.transport_pending = self.read_probe and self.transport_response
        # Streamed output does not establish that a shell exit packet completed.
        # Only pre-lease discovery may defer this; never broaden teardown transport.
        self.prelease_completion_unconfirmed = (
            self.read_probe and len(self.args_vector) == 5 and self.args_vector[2:4] == ["shell", "-T"]
            and code == 255 and not timed_out and stderr == b"")
        self.diagnostic = {"argv": ([str(executable)] if executable is not None else []) + self.args_vector,
                           "exitCode": code, "timedOut": timed_out,
                           "stdoutBytes": len(stdout), "stderrBytes": len(stderr),
                           "stdout": stdout.decode(errors="replace")[:1000],
                           "stderr": stderr.decode(errors="replace")[:1000]}
        super().__init__("adb command failed: " + json.dumps(self.diagnostic))


class EmptyAvdObservation(ValueError):
    """An exact successful console read supplied no identity observation."""
    def __init__(self, diagnostic):
        self.diagnostic = diagnostic
        super().__init__("Invalid emulator AVD response: " + json.dumps(diagnostic))


class Adb:
    def __init__(self, sdk):
        self.executable = sdk / "platform-tools/adb"

    def call(self, args, data=None, check=True, timeout=8):
        require(0 < timeout <= 8, "Invalid bounded adb timeout")
        try:
            result = subprocess.run([str(self.executable), *args], input=data, capture_output=True,
                                    timeout=timeout)
        except subprocess.TimeoutExpired as failure:
            require(len(failure.stdout or b"") <= 65536 and len(failure.stderr or b"") <= 65536,
                    "Unexpected adb output size")
            raise AdbFailure(args, None, failure.stdout or b"", failure.stderr or b"",
                             timed_out=True, has_input=data is not None, executable=self.executable) from failure
        require(len(result.stdout) <= 65536 and len(result.stderr) <= 65536, "Unexpected adb output size")
        if check and result.returncode:
            raise AdbFailure(args, result.returncode, result.stdout, result.stderr,
                             has_input=data is not None, executable=self.executable)
        return result

    def devices(self, timeout=8):
        output = self.call(["devices"], timeout=timeout).stdout.decode()
        lines = output.splitlines()
        require(lines and lines[0].strip() == "List of devices attached", "Invalid adb inventory header")
        devices = {}
        for row in lines[1:]:
            if not row.strip():
                continue
            fields = row.split()
            require(len(fields) == 2 and fields[0] not in devices, "Invalid or duplicate adb inventory row")
            require(fields[1] in ("device", "offline", "unauthorized", "bootloader", "recovery", "sideload", "rescue"),
                    "Unsupported adb inventory state")
            devices[fields[0]] = fields[1]
        return devices

    def shell(self, serial, args, data=None, check=True):
        # adb itself joins remote arguments. Quote each token for the Android shell.
        result = self.call(["-s", serial, "shell", "-T", shlex.join(args)], data, check)
        return result.stdout.decode().strip()

    def private(self, lease, args, data=None, check=True):
        return self.shell(lease["serial"], ["run-as", TARGET, "--user", str(lease["user"]), *args], data, check)

    def identity(self, serial):
        qemu = self.shell(serial, ["getprop", "ro.kernel.qemu"])
        api = self.shell(serial, ["getprop", "ro.build.version.sdk"])
        user = self.shell(serial, ["am", "get-current-user"])
        require(user.isdigit(), "Invalid current user")
        boot = self.shell(serial, ["cat", "/proc/sys/kernel/random/boot_id"])
        avd_args = ["-s", serial, "emu", "avd", "name"]
        avd_result = self.call(avd_args)
        try:
            avd_lines = avd_result.stdout.decode().splitlines()
        except UnicodeDecodeError:
            avd_lines = None
        if avd_lines is None or not (len(avd_lines) == 2 and avd_lines[1] == "OK"):
            diagnostic = {"argv": [str(self.executable), *avd_args],
                          "exitCode": avd_result.returncode,
                          "stdoutBytes": len(avd_result.stdout), "stderrBytes": len(avd_result.stderr),
                          "stdout": avd_result.stdout.decode(errors="replace")[:1000],
                          "stderr": avd_result.stderr.decode(errors="replace")[:1000]}
            if avd_result.returncode == 0 and avd_result.stdout == b"" and avd_result.stderr == b"":
                raise EmptyAvdObservation(diagnostic)
            # Malformed identity stays a hard failure, never pending transport.
            raise ValueError("Invalid emulator AVD response: " + json.dumps(diagnostic))
        return {"serial": serial, "qemu": qemu, "api": api, "user": int(user), "bootId": boot,
                "avd": avd_lines[0]}

    def package_identities(self, identity):
        serial, user = identity["serial"], str(identity["user"])
        packages = {}
        for package in (TARGET, TEST_PACKAGE):
            # run-as authenticates that this exact installed package is debuggable.
            args = ["-s", serial, "shell", "-T", shlex.join(["run-as", package, "--user", user, "id", "-u"])]
            result = self.call(args, check=False)
            if result.returncode and not result.stdout.strip() \
                    and result.stderr.decode().strip() == "run-as: unknown package: " + package:
                return None
            if result.returncode:
                raise AdbFailure(args, result.returncode, result.stdout, result.stderr, executable=self.executable)
            uid = result.stdout.decode().strip()
            require(uid.isdigit() and int(uid) // 100000 == identity["user"] and int(uid) % 100000 >= 10000,
                    "Invalid installed debug package UID")
            paths = self.shell(serial, ["pm", "path", "--user", user, package]).splitlines()
            if not paths:
                return None
            require(all(p.startswith("package:/data/app/") for p in paths), "Invalid installed package path")
            packages[package] = {"uid": int(uid), "paths": paths}
        components = self.shell(serial, ["ime", "list", "-a", "-s", "--user", user]).splitlines()
        require(all(re.fullmatch(r"[\w.]+/[\w.$]+", value) for value in components), "Invalid installed IME list")
        return packages if COMPONENT in components else None

    def settings(self, lease):
        result = {}
        for key in SETTING_KEYS:
            value = self.shell(lease["serial"], ["settings", "--user", str(lease["user"]), "get", "secure", key])
            result[key] = None if value == "null" else value
        return result

    def read_recovery(self, lease):
        text = self.private(lease, ["sh", "-c", "if [ -f " + RECOVERY_PATH + " ]; then cat " + RECOVERY_PATH + "; fi"])
        return json.loads(text) if text else None

    def process_absent(self, lease, package):
        result = self.call(["-s", lease["serial"], "shell", "-T", shlex.join(["pidof", package])], check=False)
        require(result.returncode in (0, 1) and not result.stderr, "Uncertain fixture process observation")
        return result.returncode == 1 and not result.stdout.strip()

    def write_lease(self, lease):
        require(not self.private(lease, ["sh", "-c", "if [ -e " + LEASE_PATH + " ]; then echo exists; fi"]),
                "Existing lease must not be overwritten")
        body = (json.dumps(lease) + "\n").encode()
        self.private(lease, ["sh", "-c", "umask 077; mkdir -p cache && cat > " + LEASE_PATH + ".tmp && mv "
                            + LEASE_PATH + ".tmp " + LEASE_PATH], body)
        require(json.loads(self.private(lease, ["cat", LEASE_PATH])) == lease, "Lease readback differs")


class Supervisor:
    def __init__(self, adb, state, path, processes, alive=process_alive):
        self.adb, self.state, self.path, self.processes = adb, state, path, processes
        self.alive = alive

    def event(self, kind, **fields):
        self.state["events"].append({"event": kind, "time": time.time(), **fields})
        atomic_json(self.path, self.state)

    def pending(self, reason, serial=None, failure=None):
        # Retain first/last observations and a count, not an unbounded polling log.
        observation = {"reason": reason, "serial": serial, "time": time.time()}
        if failure is not None:
            observation["command"] = failure.diagnostic
        previous = self.state.get("discoveryPending")
        pending = {"count": 1 if previous is None else previous["count"] + 1,
                   "first": observation if previous is None else previous["first"], "last": observation}
        if previous is not None and "firstFailure" in previous:
            pending.update(firstFailure=previous["firstFailure"], lastFailure=previous["lastFailure"])
        if failure is not None:
            pending.setdefault("firstFailure", observation)
            pending["lastFailure"] = observation
        self.state["discoveryPending"] = pending
        atomic_json(self.path, self.state)

    def discover(self):
        if self.state.get("lease"):
            self.observe()
            return
        owned = self.processes()
        if not owned:
            return
        try:
            devices = self.adb.devices()
        except AdbFailure as failure:
            if not failure.transport_pending:
                raise
            self.pending("transport-not-ready", failure=failure)
            return
        for serial, status in devices.items():
            if serial in self.state["initialDevices"] or status != "device" or not re.fullmatch(r"emulator-[0-9]+", serial):
                continue
            console = serial.removeprefix("emulator-")
            candidates = [p for p in owned if p["port"] == console
                          or (p["port"] is None and console in p.get("listeningPorts", []))]
            if not candidates:
                continue
            require(len(candidates) == 1, "Ambiguous owned emulator port")
            try:
                boot = self.adb.shell(serial, ["getprop", "sys.boot_completed"])
                require(boot in ("", "0", "1"), "Invalid boot-completed response")
                if boot != "1":
                    self.pending("boot-not-complete", serial)
                    continue
                identity = self.adb.identity(serial)
                process = match_process(serial, identity["avd"], owned)
                if not self.alive(process):
                    self.pending("candidate-process-exited", serial)
                    continue
                packages = self.adb.package_identities(identity)
                if packages is None:
                    self.pending("fixture-not-installed", serial)
                    continue
                lease = lease_for(identity, self.state["nonce"], self.state["sourceSha"], self.adb.settings(identity))
                if not self.alive(process) or self.adb.devices().get(serial) != "device":
                    self.pending("candidate-disappeared-before-lease", serial)
                    continue
            except EmptyAvdObservation as failure:
                # No identity is admitted. Only pre-lease discovery may wait for
                # a complete new observation within the unchanged Gradle budget.
                self.pending("prelease-avd-observation-empty", serial, failure)
                continue
            except AdbFailure as failure:
                if failure.transport_pending:
                    self.pending("transport-not-ready", serial, failure)
                    continue
                if failure.prelease_completion_unconfirmed:
                    self.pending("prelease-read-completion-unconfirmed", serial, failure)
                    continue
                # An empty failure alone has no diagnosis. A separate disappearance
                # observation can establish that this candidate is no longer ready.
                if failure.read_probe and failure.empty_response and (
                        not self.alive(candidates[0]) or self.adb.devices().get(serial) != "device"):
                    self.pending("unidentified-read-failure-candidate-disappeared", serial, failure)
                    continue
                raise
            # Persist recovery authority before any device write. Do not replace it after a reboot.
            self.state.update(lease=lease, emulator=process.copy(), packages=packages)
            self.event("lease-prepared", identity=identity)
            self.adb.write_lease(lease)
            self.event("lease-written")
            return

    def assert_device(self):
        lease = self.state["lease"]
        identity = self.adb.identity(lease["serial"])
        for key in ("serial", "user", "bootId"):
            require(identity[key] == lease[key], "Leased device identity changed: " + key)
        require(identity["qemu"] == "1" and identity["api"] == "36", "Leased device changed")
        process = match_process(lease["serial"], identity["avd"], self.processes())
        require(process == self.state["emulator"], "Leased emulator process changed")

    def observe(self):
        lease = self.state["lease"]
        if self.adb.devices().get(lease["serial"]) != "device":
            return
        self.assert_device()
        record = self.adb.read_recovery(lease)
        if record is not None:
            validate_recovery(record, lease)
            if record != self.state.get("lastRecovery"):
                self.state["lastRecovery"] = record
                self.event("native-recovery", record=record)

    def restored_lease(self):
        lease, record = self.state.get("lease"), self.state.get("lastRecovery")
        if lease is None or record is None or not any(e["event"] == "lease-written" for e in self.state["events"]):
            return False
        require(lease["nonce"] == self.state["nonce"] and lease["sourceSha"] == self.state["sourceSha"],
                "Finalization lease owner differs")
        validate_recovery(record, lease)
        return record["phase"] == "restored"

    def teardown_read(self, failure):
        if not isinstance(failure, AdbFailure) or failure.has_input:
            return False
        try:
            if not self.restored_lease():
                return False
        except (ValueError, KeyError, TypeError):
            return False  # The original error remains fatal; invalid evidence grants no wait.
        lease = self.state["lease"]
        args = failure.args_vector
        # Global devices or this exact leased serial only; never accept another target.
        if args != ["devices"] and args[:2] != ["-s", lease["serial"]]:
            return False
        recovery_read = ["-s", lease["serial"], "shell", "-T", shlex.join([
            "run-as", TARGET, "--user", str(lease["user"]), "sh", "-c",
            "if [ -f " + RECOVERY_PATH + " ]; then cat " + RECOVERY_PATH + "; fi"])]
        # GMD can close this identity read without a shell exit packet after
        # native restoration. This only permits bounded disposal proof, not success.
        current_user_read = ["-s", lease["serial"], "shell", "-T", "am get-current-user"]
        diagnostic = failure.diagnostic
        if args == current_user_read and diagnostic["exitCode"] == 255 \
                and not diagnostic["timedOut"] and diagnostic["stdoutBytes"] == 0 \
                and diagnostic["stderrBytes"] == 0:
            return True
        return failure.transport_pending or (args == recovery_read and (
            failure.transport_response or (failure.empty_response and failure.diagnostic["exitCode"] == 255)))

    def reconcile_disposal(self, deadline):
        require(self.state.get("gradleExitCode") == 0 and not self.state.get("receivedSignals")
                and not self.state.get("forcedTermination"),
                "Disposal requires natural successful Gradle closure")
        require(self.restored_lease(), "Disposal requires latest authenticated restoration")
        lease = self.state["lease"]
        while True:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "Managed-device finalization deadline expired")
            try:
                devices = self.adb.devices(timeout=min(8, remaining))
            except AdbFailure as failure:
                if not failure.transport_pending or failure.args_vector != ["devices"]:
                    raise
                self.state["finalizationLastReadFailure"] = failure.diagnostic
                atomic_json(self.path, self.state)
            else:
                alive = self.alive(self.state["emulator"])
                require(time.monotonic() < deadline, "Managed-device finalization deadline expired")
                self.state["finalizationObservation"] = {"devices": devices, "ownedProcessAlive": alive,
                                                         "process": self.state["emulator"], "at": time.time()}
                atomic_json(self.path, self.state)
                require(devices.get(lease["serial"]) in (None, "offline"),
                        "Present or unauthorized serial cannot establish disposal")
                if lease["serial"] not in devices and not alive:
                    self.state["cleanup"] = "disposed"
                    self.event("cleanup-disposed", nativeRestorationVerified=False,
                               priorNativeRestorationObserved=True, priorRecovery=self.state["lastRecovery"],
                               freshSettingsReadback=False, disposal=self.state["finalizationObservation"])
                    return
            remaining = deadline - time.monotonic()
            require(remaining > 0, "Managed-device finalization deadline expired")
            time.sleep(min(0.5, remaining))

    def cleanup(self, finalization_deadline=None):
        if self.state.get("cleanup") in ("restored", "unchanged", "disposed", "not-leased"):
            return
        lease = self.state.get("lease")
        if not lease:
            self.state["cleanup"] = "not-leased"
            self.event("cleanup-not-leased")
            return
        timeout = 8 if finalization_deadline is None else min(8, finalization_deadline - time.monotonic())
        require(timeout > 0, "Managed-device finalization deadline expired")
        try:
            devices = self.adb.devices(timeout=timeout)
        except AdbFailure as failure:
            if finalization_deadline is None or not self.teardown_read(failure):
                raise
            self.state["finalizationReadFailure"] = failure.diagnostic
            self.event("finalization-read-failed")
            self.reconcile_disposal(finalization_deadline)
            return
        if finalization_deadline is not None:
            require(time.monotonic() < finalization_deadline, "Managed-device finalization deadline expired")
        if finalization_deadline is not None and self.restored_lease() \
                and devices.get(lease["serial"]) in (None, "offline"):
            self.reconcile_disposal(finalization_deadline)
            return
        if lease["serial"] not in devices:
            require(not self.alive(self.state["emulator"]),
                    "Leased emulator still exists but adb is unavailable")
            self.state["cleanup"] = "disposed"
            self.event("cleanup-disposed", nativeRestorationVerified=False)
            return
        require(devices[lease["serial"]] == "device", "Leased emulator is offline; no cleanup mutation")
        self.assert_device()
        require(json.loads(self.adb.private(lease, ["cat", LEASE_PATH])) == lease, "Device lease differs")
        record = self.adb.read_recovery(lease)
        current = self.adb.settings(lease)
        if record is None:
            require(current == baseline(lease), "Changed IME without recovery record")
            commands = []
        else:
            commands = recovery_commands(record, lease, current)
        # Preserve the original native record, including failed/unfinished restoration.
        self.event("cleanup-plan", record=record, commands=commands)
        if record is not None and record["phase"] != "restored":
            # A dead instrumentation client can leave queued remote editing commands.
            # Stop only these two fixture processes, after all ownership checks above.
            observation = self.adb.shell(lease["serial"], ["dumpsys", "activity", "-p", TARGET, "processes"])
            require_instrumentation_closed(observation)
            self.event("instrumentation-closed", processObservation=observation)
            for package in (TARGET, TEST_PACKAGE):
                self.assert_device()
                require(self.adb.package_identities(lease) == self.state["packages"],
                        "Installed fixture packages changed; no process stop")
                self.adb.shell(lease["serial"], ["am", "force-stop", "--user", str(lease["user"]), package])
                self.event("failed-fixture-process-stopped", package=package)
                require(self.adb.process_absent(lease, package), "Stopped fixture process is still present")
            self.event("failed-fixture-processes-stopped")
            commands = recovery_commands(record, lease, self.adb.settings(lease))
        for command in commands:
            self.assert_device()
            fresh = self.adb.settings(lease)
            recovery_commands(record, lease, fresh)  # Recheck every setting before each mutation.
            self.adb.shell(lease["serial"], command)
        require(self.adb.settings(lease) == baseline(lease), "IME restoration readback differs")
        self.state["cleanup"] = "restored" if commands else "unchanged"
        self.event("cleanup-verified", nativeRecord=record)


def runtime(args):
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true",
            "This runner is only for the isolated Linux Actions managed-device job")
    path = Path(args.state).resolve()
    if args.cleanup and not path.exists():
        print("No served-IME host state was created; nothing to restore.")
        return 0
    sdk = Path(args.sdk).resolve(strict=True)
    require((sdk / "platform-tools/adb").is_file(), "Missing installed adb")
    adb = Adb(sdk)
    if args.cleanup:
        state = json.loads(path.read_text())
        require(state["sourceSha"] == args.source and state["shard"] == args.shard
                and state["runId"] == os.environ["GITHUB_RUN_ID"]
                and state["runAttempt"] == os.environ["GITHUB_RUN_ATTEMPT"], "Foreign cleanup state")
        require("gradleExitCode" in state or not Path("/proc", str(state.get("gradlePid", 0))).exists(),
                "Gradle has not closed; cleanup must not race the native run")
        Supervisor(adb, state, path, lambda: emulator_processes(sdk, state["nonce"])).cleanup()
        return 0
    require(not path.exists(), "Host state exists; reconcile it instead of replacing it")
    nonce = secrets.token_hex(32)
    command = gradle_command(args.source, args.shard, nonce)
    state = {"schema": 1, "sourceSha": args.source, "shard": args.shard, "nonce": nonce,
             "runId": os.environ["GITHUB_RUN_ID"], "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"],
             "initialDevices": adb.devices(), "command": command, "events": []}
    supervisor = Supervisor(adb, state, path, lambda: emulator_processes(sdk, nonce))
    supervisor.event("before-gradle")
    child = subprocess.Popen(command, env={**os.environ, NONCE_ENV: nonce}, start_new_session=True)
    state["gradlePid"] = child.pid
    supervisor.event("gradle-started")
    stopped = []

    def on_signal(number, _frame):
        stopped.append(number)
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)

    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number, on_signal)
    error = None
    pending_finalization = None
    try:
        while child.poll() is None and not stopped:
            supervisor.discover()
            time.sleep(0.5)
    except Exception as failure:
        eligible = False
        if not stopped and supervisor.teardown_read(failure):
            try:
                observed_exit = child.poll()
                observed_alive = supervisor.alive(state["emulator"])
                state["finalizationStartObservation"] = {"gradleExitCode": observed_exit,
                                                          "ownedProcessAlive": observed_alive, "at": time.time()}
                # These observations describe entry, not proof of final disposal.
                # GMD can close its transport before either process has exited.
                eligible = True
            except Exception as observation_failure:
                state["finalizationObservationError"] = str(observation_failure)
        if eligible:
            pending_finalization = failure
            error = str(failure)
            state["finalizationReadFailure"] = failure.diagnostic
            supervisor.event("finalization-read-failed")
        else:
            error = str(failure)
            on_signal(signal.SIGTERM, None)
    finally:
        finalization_deadline = time.monotonic() + 30
        try:
            child.wait(timeout=max(0, finalization_deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            state["forcedTermination"] = True
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=10)
        state["gradleExitCode"] = child.returncode
        state["receivedSignals"] = stopped
        if pending_finalization is not None:
            try:
                supervisor.reconcile_disposal(finalization_deadline)
                error = None  # Only complete final proof resolves the retained read failure.
            except Exception as failure:
                error = str(pending_finalization)
                state["finalizationError"] = str(failure)
        state["hostError"] = error
        supervisor.event("gradle-closed")
        try:
            if pending_finalization is not None and error is not None:
                # Reconciliation already spent its single budget. Do not start a
                # second probe window or mutate a device whose disposal is uncertain.
                raise ValueError(state["finalizationError"])
            supervisor.cleanup(finalization_deadline if child.returncode == 0 and not stopped
                               and not state.get("forcedTermination") and error is None else None)
        except Exception as failure:
            state["cleanupError"] = str(failure)
            supervisor.event("cleanup-refused")
            error = error or str(failure)
    # Preserve Gradle's original failure; successful Gradle cannot hide host failure.
    return child.returncode if child.returncode and child.returncode > 0 else (
        1 if error or stopped or child.returncode or state.get("forcedTermination") else 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--shard", required=True, choices=("0", "1"))
    parser.add_argument("--state", required=True)
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    try:
        return runtime(args)
    except Exception as failure:
        print("Served-IME host refusal: " + str(failure), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
