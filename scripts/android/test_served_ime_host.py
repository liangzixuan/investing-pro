"""Invented host/device processes only. These tests never launch adb or Gradle."""

import copy
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from served_ime_contract import (COMPONENT, PREVIOUS_KEYS, PROCESS_HEADER, SETTING_KEYS, gradle_command,
                                 lease_for, recovery_commands, require_instrumentation_closed, validate_recovery)
from run_served_ime import Supervisor, emulator_processes, listening_ports, match_process, process_alive, runtime

NONCE = "a" * 64
SOURCE = "b" * 40
PREVIOUS = "com.example.keyboard/.Keyboard"
SETTINGS = dict(zip(SETTING_KEYS, (PREVIOUS, PREVIOUS + ";42:com.example.other/.Keyboard;7", "42")))
IDENTITY = {"serial": "emulator-5562", "qemu": "1", "api": "36", "user": 10,
            "bootId": "11111111-2222-3333-4444-555555555555", "avd": "observed-gmd-name"}
PROCESS = {"pid": 1234, "startTicks": "789", "exe": "/installed/sdk/emulator/qemu/linux-x86_64/qemu-system-x86_64",
           "avd": IDENTITY["avd"], "port": "5562"}


def recovery(lease, phase="active"):
    return {k: lease[k] for k in ("schema", "nonce", "serial", "user", "bootId", *PREVIOUS_KEYS)} | {
        "component": COMPONENT, "initiallyEnabled": False, "phase": phase}


class FakeAdb:
    def __init__(self):
        self.identity_value = copy.deepcopy(IDENTITY)
        self.devices_value = {IDENTITY["serial"]: "device"}
        self.settings_value = copy.deepcopy(SETTINGS)
        self.ready = True
        self.package_values = {"local.investment.personal": {"uid": 1010000, "paths": ["package:/data/app/target/base.apk"]},
                               "local.investment.personal.test": {"uid": 1010001, "paths": ["package:/data/app/test/base.apk"]}}
        self.booted = True
        self.lease = None
        self.recovery = None
        self.commands = []
        self.inspected = []
        self.instrumentation_active = False
        self.processes_absent = True

    def devices(self):
        return self.devices_value.copy()

    def identity(self, serial):
        self.inspected.append(serial)
        return self.identity_value.copy()

    def package_identities(self, _identity):
        return copy.deepcopy(self.package_values) if self.ready else None

    def settings(self, _lease):
        return self.settings_value.copy()

    def write_lease(self, lease):
        self.lease = lease.copy()

    def read_recovery(self, _lease):
        return copy.deepcopy(self.recovery)

    def process_absent(self, _lease, _package):
        return self.processes_absent

    def private(self, _lease, _args):
        return json.dumps(self.lease)

    def shell(self, _serial, command, check=True):
        if command == ["getprop", "sys.boot_completed"]:
            return "1" if self.booted else "0"
        if command == ["dumpsys", "activity", "-p", "local.investment.personal", "processes"]:
            return PROCESS_HEADER + ("\n  Active instrumentation:" if self.instrumentation_active else "\n  mForceBackgroundCheck=false")
        self.commands.append(command)
        if command[:2] == ["ime", "set"]:
            self.settings_value[SETTING_KEYS[0]] = command[-1]
        elif command[:2] == ["ime", "disable"]:
            self.settings_value[SETTING_KEYS[1]] = ":".join(
                r for r in self.settings_value[SETTING_KEYS[1]].split(":") if r.split(";", 1)[0] != COMPONENT)
        elif command[0] == "settings":
            self.settings_value[SETTING_KEYS[2]] = None if command[3] == "delete" else command[-1]
        elif command[:2] == ["am", "force-stop"]:
            if command[-1] not in ("local.investment.personal", "local.investment.personal.test"):
                raise AssertionError("Stopped a foreign package")
        else:
            raise AssertionError("Unexpected mutation: " + repr(command))
        return ""


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.lease = lease_for(IDENTITY, NONCE, SOURCE, SETTINGS)

    def test_existing_gradle_task_flags_and_shards_are_preserved(self):
        command = gradle_command(SOURCE, "1", NONCE)
        self.assertEqual([x for x in command if "servedEditorImeLease" not in x], [
            "bash", "./gradlew", "--no-daemon", "--console=plain", "-PinvestmentClientProfile=disconnected",
            "-Pandroid.testInstrumentationRunnerArguments.numShards=2",
            "-Pandroid.testInstrumentationRunnerArguments.shardIndex=1",
            "-Pandroid.testoptions.manageddevices.emulator.gpu=swiftshader_indirect",
            "-Pandroid.testInstrumentationRunnerArguments.expectedSourceSha=" + SOURCE,
            ":app:pixel2Api36DebugAndroidTest"])

    def test_real_shape_requires_emulator_api_user_boot_source_and_no_unowned_fixture(self):
        for key, value in [("serial", "physical123"), ("qemu", "0"), ("api", "35"),
                           ("user", True), ("bootId", "unknown")]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                lease_for(IDENTITY | {key: value}, NONCE, SOURCE, SETTINGS)
        with self.assertRaises(ValueError):
            lease_for(IDENTITY, NONCE, SOURCE, SETTINGS | {SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]] + ":" + COMPONENT})

    def test_wrong_recovery_identity_and_settings_never_authorize_cleanup(self):
        for key in ("nonce", "serial", "bootId", "component", *PREVIOUS_KEYS):
            record = recovery(self.lease)
            record[key] = "foreign"
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_recovery(record, self.lease)
        for change in ({"user": True}, {"schema": True}, {"phase": "invented"},
                       {"initiallyEnabled": True}, {"extra": "field"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_recovery(recovery(self.lease) | change, self.lease)

    def test_restore_exact_prior_selection_and_subtype_without_global_reset(self):
        current = SETTINGS | {SETTING_KEYS[0]: COMPONENT, SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]] + ":" + COMPONENT,
                              SETTING_KEYS[2]: "-1"}
        commands = recovery_commands(recovery(self.lease), self.lease, current)
        self.assertEqual(commands, [["ime", "set", "--user", "10", PREVIOUS],
                                   ["settings", "--user", "10", "put", "secure", SETTING_KEYS[2], "42"],
                                   ["ime", "disable", "--user", "10", COMPONENT]])

    def test_absent_subtype_is_deleted_not_string_null(self):
        lease = lease_for(IDENTITY, NONCE, SOURCE, SETTINGS | {SETTING_KEYS[2]: None})
        commands = recovery_commands(recovery(lease), lease, SETTINGS)
        self.assertEqual(commands, [["settings", "--user", "10", "delete", "secure", SETTING_KEYS[2]]])

    def test_foreign_selection_or_enabled_list_change_is_refused(self):
        for current in (SETTINGS | {SETTING_KEYS[0]: "com.example.other/.Keyboard"},
                        SETTINGS | {SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]] + ":com.foreign/.Keyboard"},
                        SETTINGS | {SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]].replace(";42", ";43")}):
            with self.assertRaises(ValueError):
                recovery_commands(recovery(self.lease), self.lease, current)

    def test_restored_record_does_not_hide_changed_current_settings(self):
        self.assertEqual(recovery_commands(recovery(self.lease, "restored"), self.lease, SETTINGS), [])
        with self.assertRaises(ValueError):
            recovery_commands(recovery(self.lease, "restored"), self.lease, SETTINGS | {SETTING_KEYS[2]: "7"})

    def test_process_match_requires_unique_actual_avd_and_matching_port(self):
        self.assertEqual(match_process(IDENTITY["serial"], IDENTITY["avd"], [PROCESS]), PROCESS)
        for rows in ([], [PROCESS, PROCESS], [PROCESS | {"port": "5554"}], [PROCESS | {"avd": "other"}],
                     [PROCESS | {"port": None}]):
            with self.assertRaises(ValueError):
                match_process(IDENTITY["serial"], IDENTITY["avd"], rows)
        self.assertEqual(match_process(IDENTITY["serial"], IDENTITY["avd"],
                                       [PROCESS | {"port": None, "listeningPorts": ["5562", "8000"]}]), PROCESS)

    def test_unknown_or_live_instrumentation_observation_refuses_cleanup(self):
        require_instrumentation_closed(PROCESS_HEADER + "\n  mForceBackgroundCheck=false")
        for text in ("", "Permission denied", "Unknown command", PROCESS_HEADER + "\n  Active instrumentation:"):
            with self.assertRaises(ValueError):
                require_instrumentation_closed(text)


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.adb = FakeAdb()
        self.processes = [PROCESS.copy()]
        self.state = {"initialDevices": {"owner-phone": "device"}, "nonce": NONCE, "sourceSha": SOURCE, "events": []}
        self.path = Path(self.temp.name) / "state.json"
        self.host = Supervisor(self.adb, self.state, self.path, lambda: self.processes.copy(),
                               lambda old: any(p["pid"] == old["pid"] and p["startTicks"] == old["startTicks"]
                                               for p in self.processes))

    def activate(self):
        self.host.discover()
        self.adb.recovery = recovery(self.adb.lease)
        self.adb.settings_value.update({SETTING_KEYS[0]: COMPONENT, SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]] + ":" + COMPONENT,
                                        SETTING_KEYS[2]: "-1"})

    def test_discovery_never_probes_initial_or_physical_devices(self):
        self.adb.devices_value = {"owner-phone": "device", "new-phone": "device", "emulator-5562": "device"}
        self.state["initialDevices"]["emulator-5562"] = "offline"
        self.host.discover()
        self.assertEqual(self.adb.inspected, [])
        self.assertIsNone(self.adb.lease)

    def test_discovery_waits_for_boot_packages_and_owned_process(self):
        self.processes.clear()
        self.host.discover()
        self.assertEqual(self.adb.inspected, [])
        self.processes.append(PROCESS.copy())
        self.adb.booted = False
        self.host.discover()
        self.assertEqual(self.adb.inspected, [])
        self.adb.booted = True
        self.adb.ready = False
        self.host.discover()
        self.assertIsNone(self.adb.lease)
        self.adb.ready = True
        self.host.discover()
        self.assertEqual(self.adb.lease, self.state["lease"])
        self.assertEqual(json.loads(self.path.read_text())["lease"], self.adb.lease)
        self.assertEqual(self.adb.commands, [])

    def test_native_success_cleanup_is_read_only_and_idempotent(self):
        self.host.discover()
        self.adb.recovery = recovery(self.adb.lease, "restored")
        self.host.observe()
        self.host.cleanup()
        self.host.cleanup()
        self.assertEqual(self.adb.commands, [])
        self.assertEqual(self.state["cleanup"], "unchanged")

    def test_crashed_session_restores_only_exact_settings_and_preserves_failed_record(self):
        self.activate()
        record = copy.deepcopy(self.adb.recovery)
        self.host.cleanup()
        self.assertEqual(self.adb.settings_value, SETTINGS)
        self.assertEqual(self.adb.recovery, record)
        self.assertEqual(self.state["cleanup"], "restored")
        self.assertEqual([c[-1] for c in self.adb.commands[:2]],
                         ["local.investment.personal", "local.investment.personal.test"])

    def test_missing_recovery_permits_only_unchanged_state(self):
        self.host.discover()
        self.host.cleanup()
        self.assertEqual(self.adb.commands, [])
        self.state.pop("cleanup")
        self.adb.settings_value[SETTING_KEYS[2]] = "-1"
        with self.assertRaises(ValueError):
            self.host.cleanup()

    def test_disposed_gmd_is_recorded_without_restoration_claim(self):
        self.activate()
        self.adb.devices_value.clear()
        self.processes.clear()
        self.host.cleanup()
        self.assertEqual(self.state["cleanup"], "disposed")
        self.assertFalse(self.state["events"][-1]["nativeRestorationVerified"])
        self.assertEqual(self.adb.commands, [])

    def test_disconnected_still_running_emulator_is_not_disposed(self):
        self.activate()
        self.adb.devices_value.clear()
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [])

    def test_reused_serial_boot_or_process_never_receives_cleanup(self):
        self.activate()
        for key, value in (("bootId", "22222222-2222-3333-4444-555555555555"), ("user", 11)):
            self.adb.identity_value[key] = value
            with self.assertRaises(ValueError):
                self.host.cleanup()
            self.adb.identity_value = IDENTITY.copy()
        self.processes[0]["startTicks"] = "999"
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [])

    def test_spoofed_lease_or_recovery_never_receives_cleanup(self):
        self.activate()
        self.adb.lease["nonce"] = "c" * 64
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.adb.lease = self.state["lease"].copy()
        self.adb.recovery["previousDefault"] = "com.foreign/.Keyboard"
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [])

    def test_changed_installed_package_cannot_receive_failed_session_stop(self):
        self.activate()
        self.adb.package_values["local.investment.personal"]["uid"] = 1010002
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [])

    def test_active_instrumentation_is_not_stopped_as_cleanup(self):
        self.activate()
        self.adb.instrumentation_active = True
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [])

    def test_failed_force_stop_readback_prevents_setting_mutation(self):
        self.activate()
        self.adb.processes_absent = False
        with self.assertRaises(ValueError):
            self.host.cleanup()
        self.assertEqual(self.adb.commands, [["am", "force-stop", "--user", "10", "local.investment.personal"]])


class ProcessTests(unittest.TestCase):
    def test_actual_socket_inode_joins_only_listeners_owned_by_this_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            process = Path(directory)
            (process / "fd").mkdir()
            (process / "fd/7").touch()
            (process / "net").mkdir()
            (process / "net/tcp").write_text("header\n0: 0100007F:15BA 00000000:0000 0A 0 0 0 0 0 123\n"
                                               "1: 0100007F:15BC 00000000:0000 0A 0 0 0 0 0 456\n"
                                               "2: 0100007F:15BE 00000000:0000 01 0 0 0 0 0 123\n")
            (process / "net/tcp6").write_text("header\n")
            with patch("run_served_ime.os.readlink", return_value="socket:[123]"):
                self.assertEqual(listening_ports(process), ["5562"])

    def test_permission_failure_is_not_reported_as_disposed_process(self):
        with patch("run_served_ime.Path.read_text", side_effect=PermissionError("denied")):
            with self.assertRaises(PermissionError):
                process_alive(PROCESS)
        with patch("run_served_ime.Path.read_text", side_effect=FileNotFoundError()):
            self.assertFalse(process_alive(PROCESS))

    def test_process_proof_requires_own_uid_sdk_executable_and_inherited_nonce(self):
        with tempfile.TemporaryDirectory() as directory:
            sdk = Path(directory)
            executable = sdk / "emulator/qemu-system-x86_64"
            executable.parent.mkdir()
            executable.touch()
            entry = MagicMock()
            entry.name = "1234"
            entry.stat.return_value = SimpleNamespace(st_uid=1000)
            fields = {name: MagicMock() for name in ("exe", "environ", "cmdline", "stat")}
            entry.__truediv__.side_effect = lambda name: fields[name]
            fields["exe"].resolve.return_value = executable
            fields["environ"].read_bytes.return_value = ("INVESTMENT_SERVED_IME_HOST_NONCE=" + NONCE + "\0").encode()
            fields["cmdline"].read_bytes.return_value = b"\0".join([b"qemu-system-x86_64", b"-avd", b"observed-gmd-name", b"-port", b"5562"])
            fields["stat"].read_text.return_value = "1234 (qemu-system-x86) " + " ".join(["S"] + ["0"] * 18 + ["789"])
            proc = MagicMock()
            proc.iterdir.return_value = [entry]
            with patch("run_served_ime.os.getuid", return_value=1000, create=True):
                self.assertEqual(emulator_processes(sdk, NONCE, proc)[0]["port"], "5562")
                self.assertEqual(emulator_processes(sdk, NONCE, proc)[0]["startTicks"], "789")
                fields["environ"].read_bytes.return_value = b"OTHER=value\0"
                self.assertEqual(emulator_processes(sdk, NONCE, proc), [])
                fields["environ"].read_bytes.return_value = ("INVESTMENT_SERVED_IME_HOST_NONCE=" + NONCE).encode()
                entry.stat.return_value = SimpleNamespace(st_uid=1001)
                self.assertEqual(emulator_processes(sdk, NONCE, proc), [])
                entry.stat.return_value = SimpleNamespace(st_uid=1000)
                fields["exe"].resolve.return_value = sdk / "foreign/qemu-system-x86_64"
                self.assertEqual(emulator_processes(sdk, NONCE, proc), [])

    def run_simulated(self, exit_code, foreign_cleanup=False):
        with tempfile.TemporaryDirectory() as directory:
            sdk = Path(directory) / "sdk"
            (sdk / "platform-tools").mkdir(parents=True)
            (sdk / "platform-tools/adb").touch()
            args = SimpleNamespace(sdk=str(sdk), source=SOURCE, shard="0", cleanup=False,
                                   state=str(Path(directory) / "state.json"))
            adb = FakeAdb()
            # The device is created only after the initial host inventory.
            adb.devices_value = {}
            child = MagicMock()
            child.pid = 123
            child.returncode = None
            polls = 0

            def poll():
                nonlocal polls
                polls += 1
                if polls == 1:
                    adb.devices_value = {IDENTITY["serial"]: "device"}
                    return None
                adb.recovery = recovery(adb.lease, "restored" if exit_code == 0 else "active")
                if exit_code:
                    adb.settings_value.update({SETTING_KEYS[0]: COMPONENT,
                                               SETTING_KEYS[1]: SETTINGS[SETTING_KEYS[1]] + ":" + COMPONENT,
                                               SETTING_KEYS[2]: "-1"})
                if foreign_cleanup:
                    adb.settings_value[SETTING_KEYS[0]] = "com.example.other/.Keyboard"
                child.returncode = exit_code
                return exit_code

            child.poll.side_effect = poll
            child.wait.return_value = exit_code
            environment = {"GITHUB_ACTIONS": "true", "GITHUB_RUN_ID": "100", "GITHUB_RUN_ATTEMPT": "2"}
            with patch("run_served_ime.sys.platform", "linux"), patch.dict("os.environ", environment), \
                 patch("run_served_ime.Adb", return_value=adb), \
                 patch("run_served_ime.emulator_processes", return_value=[PROCESS.copy()]), \
                 patch("run_served_ime.subprocess.Popen", return_value=child) as popen, \
                 patch("run_served_ime.signal.signal"), patch("run_served_ime.time.sleep"):
                result = runtime(args)
                state = json.loads(Path(args.state).read_text())
                self.assertEqual(popen.call_count, 1)
                self.assertEqual(popen.call_args.kwargs["env"]["INVESTMENT_SERVED_IME_HOST_NONCE"], state["nonce"])
                return result, state, adb.commands

    def test_successful_fake_gradle_is_not_replayed_and_restoration_is_read_only(self):
        result, state, commands = self.run_simulated(0)
        self.assertEqual(result, 0)
        self.assertEqual(state["gradleExitCode"], 0)
        self.assertEqual(state["cleanup"], "unchanged")
        self.assertEqual(commands, [])

    def test_failed_fake_gradle_exit_is_preserved_after_exact_recovery(self):
        result, state, commands = self.run_simulated(7)
        self.assertEqual(result, 7)
        self.assertEqual(state["gradleExitCode"], 7)
        self.assertEqual(state["cleanup"], "restored")
        self.assertEqual(len(commands), 5)

    def test_cleanup_refusal_cannot_hide_original_fake_gradle_failure(self):
        result, state, commands = self.run_simulated(7, foreign_cleanup=True)
        self.assertEqual(result, 7)
        self.assertIn("foreign IME", state["cleanupError"])
        self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
