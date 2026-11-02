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


class Adb:
    def __init__(self, sdk):
        self.executable = sdk / "platform-tools/adb"

    def call(self, args, data=None, check=True):
        result = subprocess.run([str(self.executable), *args], input=data, capture_output=True,
                                timeout=8)
        require(len(result.stdout) <= 65536 and len(result.stderr) <= 65536, "Unexpected adb output size")
        if check and result.returncode:
            raise RuntimeError("adb failed: " + result.stderr.decode(errors="replace")[:1000])
        return result

    def devices(self):
        output = self.call(["devices"]).stdout.decode()
        return {row.split()[0]: row.split()[1] for row in output.splitlines()[1:] if len(row.split()) >= 2}

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
        avd_lines = self.call(["-s", serial, "emu", "avd", "name"]).stdout.decode().splitlines()
        require(len(avd_lines) == 2 and avd_lines[1] == "OK", "Invalid emulator AVD response")
        return {"serial": serial, "qemu": qemu, "api": api, "user": int(user), "bootId": boot,
                "avd": avd_lines[0]}

    def package_identities(self, identity):
        serial, user = identity["serial"], str(identity["user"])
        packages = {}
        for package in (TARGET, TEST_PACKAGE):
            # run-as authenticates that this exact installed package is debuggable.
            uid = self.shell(serial, ["run-as", package, "--user", user, "id", "-u"], check=False)
            if not uid.isdigit() or int(uid) // 100000 != identity["user"] or int(uid) % 100000 < 10000:
                return None
            paths = self.shell(serial, ["pm", "path", "--user", user, package]).splitlines()
            if not paths or not all(p.startswith("package:/data/app/") for p in paths):
                return None
            packages[package] = {"uid": int(uid), "paths": paths}
        components = self.shell(serial, ["ime", "list", "-a", "-s", "--user", user]).splitlines()
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

    def discover(self):
        if self.state.get("lease"):
            self.observe()
            return
        owned = self.processes()
        if not owned:
            return
        devices = self.adb.devices()
        for serial, status in devices.items():
            if serial in self.state["initialDevices"] or status != "device" or not re.fullmatch(r"emulator-[0-9]+", serial):
                continue
            if self.adb.shell(serial, ["getprop", "sys.boot_completed"], check=False) != "1":
                continue
            identity = self.adb.identity(serial)
            process = match_process(serial, identity["avd"], owned)
            packages = self.adb.package_identities(identity)
            if packages is None:
                continue
            lease = lease_for(identity, self.state["nonce"], self.state["sourceSha"], self.adb.settings(identity))
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

    def cleanup(self):
        if self.state.get("cleanup") in ("restored", "unchanged", "disposed", "not-leased"):
            return
        lease = self.state.get("lease")
        if not lease:
            self.state["cleanup"] = "not-leased"
            self.event("cleanup-not-leased")
            return
        devices = self.adb.devices()
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
    try:
        while child.poll() is None and not stopped:
            supervisor.discover()
            time.sleep(0.5)
    except Exception as failure:
        error = str(failure)
        on_signal(signal.SIGTERM, None)
    finally:
        try:
            child.wait(timeout=30)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=10)
        state["gradleExitCode"] = child.returncode
        state["hostError"] = error
        state["receivedSignals"] = stopped
        supervisor.event("gradle-closed")
        try:
            supervisor.cleanup()
        except Exception as failure:
            state["cleanupError"] = str(failure)
            supervisor.event("cleanup-refused")
            error = error or str(failure)
    # Preserve Gradle's original failure; successful Gradle cannot hide host failure.
    return child.returncode if child.returncode and child.returncode > 0 else (1 if error or stopped or child.returncode else 0)


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
