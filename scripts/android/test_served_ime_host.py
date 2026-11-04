"""Invented host/device processes only. These tests never launch adb or Gradle."""

import copy
import json
from contextlib import ExitStack
from pathlib import Path
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import run_served_ime as runner

from served_ime_contract import (COMPONENT, PREVIOUS_KEYS, PROCESS_HEADER, SETTING_KEYS, gradle_command,
                                 lease_for, recovery_commands, require_instrumentation_closed, validate_recovery)
from run_served_ime import Adb, AdbFailure, Supervisor, discovery_read, emulator_processes, listening_ports, match_process, process_alive, runtime

NONCE = "a" * 64
SOURCE = "b" * 40
PREVIOUS = "com.example.keyboard/.Keyboard"
SETTINGS = dict(zip(SETTING_KEYS, (PREVIOUS, PREVIOUS + ";42:com.example.other/.Keyboard;7", "42")))
IDENTITY = {"serial": "emulator-5562", "qemu": "1", "api": "36", "user": 10,
            "bootId": "11111111-2222-3333-4444-555555555555", "avd": "observed-gmd-name"}
PROCESS = {"pid": 1234, "startTicks": "789", "exe": "/installed/sdk/emulator/qemu/linux-x86_64/qemu-system-x86_64",
           "avd": IDENTITY["avd"], "port": "5562"}
PROBE = ["-s", IDENTITY["serial"], "shell", "-T", "getprop ro.kernel.qemu"]


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

    def devices(self, timeout=8):
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

    def test_closed_transport_waits_then_leases_without_early_mutation(self):
        with patch.object(self.adb, "identity", side_effect=AdbFailure(PROBE, 1, stderr=b"error: closed\n")):
            self.host.discover()
        self.assertNotIn("lease", self.state)
        self.assertIsNone(self.adb.lease)
        self.assertEqual(self.adb.commands, [])
        self.assertEqual(self.state["discoveryPending"]["last"]["command"]["argv"], PROBE)
        self.host.discover()
        self.assertEqual(self.adb.lease, self.state["lease"])

    def test_transport_pending_record_is_bounded_and_preserves_first_last(self):
        with patch.object(self.adb, "devices", side_effect=AdbFailure(["devices"], None, timed_out=True)):
            for _ in range(100):
                self.host.discover()
        pending = self.state["discoveryPending"]
        self.assertEqual(set(pending), {"count", "first", "last", "firstFailure", "lastFailure"})
        self.assertEqual(pending["count"], 100)
        self.assertEqual(self.state["events"], [])
        self.assertLess(len(json.dumps(self.state)), 2000)
        self.assertNotIn("lease", self.state)

    def test_middle_transport_failures_survive_later_nonerror_readiness_observations(self):
        self.adb.booted = False
        self.host.discover()
        self.adb.booted = True
        for text in (b"error: closed", b"error: device offline"):
            with patch.object(self.adb, "identity", side_effect=AdbFailure(PROBE, 1, stderr=text)):
                self.host.discover()
        self.adb.ready = False
        self.host.discover()
        pending = self.state["discoveryPending"]
        self.assertEqual(pending["first"]["reason"], "boot-not-complete")
        self.assertEqual(pending["last"]["reason"], "fixture-not-installed")
        self.assertEqual(pending["firstFailure"]["command"]["stderr"], "error: closed")
        self.assertEqual(pending["lastFailure"]["command"]["stderr"], "error: device offline")
        self.assertEqual(pending["count"], 4)
        self.assertNotIn("lease", self.state)

    def test_disappearing_setup_emulator_waits_for_an_observed_new_process(self):
        self.host.alive = lambda _process: False
        self.host.discover()
        self.assertEqual(self.state["discoveryPending"]["last"]["reason"], "candidate-process-exited")
        self.assertNotIn("lease", self.state)
        self.processes[0] = PROCESS | {"pid": 2345, "startTicks": "900"}
        self.host.alive = lambda process: process["pid"] == 2345
        self.host.discover()
        self.assertEqual(self.state["emulator"]["pid"], 2345)

    def test_empty_unknown_read_failure_is_strict_until_disappearance_is_observed(self):
        failure = AdbFailure(PROBE, 1)
        with patch.object(self.adb, "identity", side_effect=failure):
            with self.assertRaises(AdbFailure):
                self.host.discover()
        self.assertNotIn("discoveryPending", self.state)
        with patch.object(self.adb, "identity", side_effect=failure), \
             patch.object(self.adb, "devices", side_effect=[{IDENTITY["serial"]: "device"}, {}]):
            self.host.discover()
        self.assertEqual(self.state["discoveryPending"]["last"]["reason"],
                         "unidentified-read-failure-candidate-disappeared")
        self.assertNotIn("lease", self.state)

    def test_permission_invalid_identity_ambiguity_and_nonprobe_failures_remain_strict(self):
        for failure in (AdbFailure(PROBE, 1, stderr=b"Permission denied"),
                        AdbFailure(PROBE, 1, stderr=b"error: closed\nPermission denied"),
                        AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "ime enable foreign/.Ime"],
                                   1, stderr=b"error: closed"), ValueError("Invalid current user")):
            with patch.object(self.adb, "identity", side_effect=failure), self.assertRaises(type(failure)):
                self.host.discover()
        self.adb.identity_value["qemu"] = "0"
        with self.assertRaises(ValueError):
            self.host.discover()
        self.adb.identity_value = IDENTITY.copy()
        self.processes.append(PROCESS.copy())
        with self.assertRaises(ValueError):
            self.host.discover()
        self.assertNotIn("lease", self.state)
        self.assertNotIn("discoveryPending", self.state)
        self.assertEqual(self.adb.commands, [])

    def test_postlease_transport_and_uncertain_lease_write_are_not_retried(self):
        failure = AdbFailure(PROBE, 1, stderr=b"error: closed")
        with patch.object(self.adb, "write_lease", side_effect=failure) as write:
            with self.assertRaises(AdbFailure):
                self.host.discover()
            self.assertEqual(write.call_count, 1)
        self.assertIn("lease", self.state)
        with patch.object(self.adb, "identity", side_effect=failure), \
             patch.object(self.adb, "write_lease") as write:
            with self.assertRaises(AdbFailure):
                self.host.discover()
            with self.assertRaises(AdbFailure):
                self.host.cleanup()
            write.assert_not_called()
        self.assertNotIn("discoveryPending", self.state)


    def test_unconfirmed_shell_completion_discards_partial_identity_then_reprobes(self):
        probe = ["-s", IDENTITY["serial"], "shell", "-T", "getprop ro.build.version.sdk"]
        failure = AdbFailure(probe, 255, stdout=b"36\n")
        with patch.object(self.adb, "identity", side_effect=failure), \
             patch.object(self.adb, "write_lease") as write:
            self.host.discover()
            write.assert_not_called()
        self.assertNotIn("lease", self.state)
        self.assertIsNone(self.adb.lease)
        self.assertEqual(self.adb.commands, [])
        pending = self.state["discoveryPending"]["last"]
        self.assertEqual(pending["reason"], "prelease-read-completion-unconfirmed")
        self.assertEqual(pending["command"]["exitCode"], 255)
        self.assertEqual(pending["command"]["stdout"], "36\n")
        with patch.object(self.adb, "identity", wraps=self.adb.identity) as identity, \
             patch.object(self.adb, "package_identities", wraps=self.adb.package_identities) as packages, \
             patch.object(self.adb, "settings", wraps=self.adb.settings) as settings, \
             patch.object(self.adb, "devices", wraps=self.adb.devices) as devices:
            self.host.discover()
            identity.assert_called_once_with(IDENTITY["serial"])
            packages.assert_called_once_with(IDENTITY)
            settings.assert_called_once_with(IDENTITY)
            self.assertEqual(devices.call_count, 2)
        self.assertEqual(self.state["lease"], self.adb.lease)
        self.assertEqual(self.adb.commands, [])

    def test_unconfirmed_shell_read_diagnostics_remain_bounded(self):
        with patch.object(self.adb, "identity", side_effect=AdbFailure(PROBE, 255, stdout=b"partial")):
            for _ in range(100):
                self.host.discover()
        pending = self.state["discoveryPending"]
        self.assertEqual(pending["count"], 100)
        self.assertEqual(set(pending), {"count", "first", "last", "firstFailure", "lastFailure"})
        self.assertLess(len(json.dumps(self.state)), 2400)
        self.assertNotIn("lease", self.state)
        self.assertEqual(self.adb.commands, [])

    def test_successful_wrong_identity_after_unconfirmed_read_still_refuses(self):
        with patch.object(self.adb, "identity", side_effect=AdbFailure(PROBE, 255, stdout=b"1")):
            self.host.discover()
        self.adb.identity_value["api"] = "35"
        with self.assertRaises(ValueError):
            self.host.discover()
        self.assertNotIn("lease", self.state)
        self.assertIsNone(self.adb.lease)

    def test_unconfirmed_read_never_defers_uncertain_lease_write(self):
        failure = AdbFailure(PROBE, 255, stdout=b"1\n")
        with patch.object(self.adb, "write_lease", side_effect=failure) as write:
            with self.assertRaises(AdbFailure):
                self.host.discover()
            write.assert_called_once()
        self.assertIn("lease", self.state)
        self.assertNotIn("discoveryPending", self.state)
        self.assertFalse(self.host.restored_lease())
        self.assertFalse(self.host.teardown_read(failure))
        self.assertEqual(self.adb.commands, [])

    def test_unconfirmed_read_stays_strict_after_authenticated_active_and_restored_recovery(self):
        self.host.discover()
        self.assertTrue(any(e["event"] == "lease-written" for e in self.state["events"]))
        failure = AdbFailure(PROBE, 255, stdout=b"1\n")
        for phase in ("active", "restored"):
            self.adb.recovery = recovery(self.state["lease"], phase)
            self.host.observe()
            self.assertEqual(self.state["lastRecovery"], self.adb.recovery)
            self.assertEqual(self.state["events"][-1]["event"], "native-recovery")
            self.assertEqual(self.host.restored_lease(), phase == "restored")
            with self.subTest(phase=phase), patch.object(self.adb, "identity", side_effect=failure):
                with self.assertRaises(AdbFailure):
                    self.host.discover()
                with self.assertRaises(AdbFailure):
                    self.host.cleanup()
                self.assertFalse(self.host.teardown_read(failure))
        self.assertEqual(self.adb.commands, [])


class AdbTests(unittest.TestCase):
    def test_failed_command_diagnostics_include_exact_args_exit_and_bounded_outputs(self):
        adb = Adb(Path("/installed/sdk"))
        result = subprocess.CompletedProcess(PROBE, 17, b"o" * 2000, b"e" * 2000)
        with patch("run_served_ime.subprocess.run", return_value=result), self.assertRaises(AdbFailure) as caught:
            adb.call(PROBE, data=b"input-must-not-be-logged")
        diagnostic = caught.exception.diagnostic
        self.assertEqual(diagnostic["argv"], [str(adb.executable), *PROBE])
        self.assertEqual(diagnostic["exitCode"], 17)
        self.assertEqual(len(diagnostic["stdout"]), 1000)
        self.assertEqual(len(diagnostic["stderr"]), 1000)
        self.assertNotIn("input-must-not-be-logged", str(caught.exception))
        self.assertFalse(caught.exception.transport_pending)

    def test_timeout_is_typed_but_only_discovery_read_probes_can_wait(self):
        adb = Adb(Path("/installed/sdk"))
        with patch("run_served_ime.subprocess.run", side_effect=subprocess.TimeoutExpired(PROBE, 8)), \
             self.assertRaises(AdbFailure) as caught:
            adb.call(PROBE)
        self.assertTrue(caught.exception.transport_pending)
        self.assertTrue(caught.exception.diagnostic["timedOut"])
        self.assertFalse(AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "ime reset"],
                                    None, timed_out=True).transport_pending)
        self.assertFalse(AdbFailure(PROBE, None, timed_out=True, has_input=True).transport_pending)
        self.assertFalse(AdbFailure(PROBE, None, stderr=b"Permission denied", timed_out=True).transport_pending)
        with patch("run_served_ime.subprocess.run", side_effect=subprocess.TimeoutExpired(PROBE, 8, output=b"x" * 65537)), \
             self.assertRaisesRegex(ValueError, "output size"):
            adb.call(PROBE)

    def test_only_explicit_missing_package_is_readiness_not_permission_or_malformed_uid(self):
        adb = Adb(Path("/installed/sdk"))
        missing = subprocess.CompletedProcess([], 1, b"", b"run-as: unknown package: local.investment.personal\n")
        with patch.object(adb, "call", return_value=missing):
            self.assertIsNone(adb.package_identities(IDENTITY))
        for result, expected in ((subprocess.CompletedProcess([], 1, b"", b"run-as: package not debuggable"), AdbFailure),
                                 (subprocess.CompletedProcess([], 1, b"", b"permission denied"), AdbFailure),
                                 (subprocess.CompletedProcess([], 1, b"", b""), AdbFailure),
                                 (subprocess.CompletedProcess([], 0, b"0", b""), ValueError)):
            with patch.object(adb, "call", return_value=result), self.assertRaises(expected):
                adb.package_identities(IDENTITY)

    def test_discovery_read_allowlist_excludes_private_data_and_all_mutations(self):
        for command in ("run-as local.investment.personal --user 10 id -u", "pm path --user 10 local.investment.personal.test",
                        "ime list -a -s --user 10", "settings --user 10 get secure default_input_method"):
            self.assertTrue(discovery_read(["-s", IDENTITY["serial"], "shell", "-T", command]))
        for command in ("run-as local.investment.personal --user 10 cat cache/private.json", "ime enable foreign/.Ime",
                        "settings --user 10 put secure default_input_method foreign/.Ime", "am force-stop foreign"):
            self.assertFalse(discovery_read(["-s", IDENTITY["serial"], "shell", "-T", command]))


    def test_failed_shell_stdout_is_not_successful_identity(self):
        probe = ["-s", IDENTITY["serial"], "shell", "-T", "getprop ro.build.version.sdk"]
        adb = Adb(Path("/installed/sdk"))
        result = subprocess.CompletedProcess(probe, 255, b"36\n", b"")
        with patch("run_served_ime.subprocess.run", return_value=result), self.assertRaises(AdbFailure) as caught:
            adb.shell(IDENTITY["serial"], ["getprop", "ro.build.version.sdk"])
        self.assertTrue(caught.exception.prelease_completion_unconfirmed)
        self.assertFalse(caught.exception.transport_pending)
        self.assertFalse(caught.exception.transport_response)
        self.assertEqual(caught.exception.diagnostic["stdout"], "36\n")

    def test_unconfirmed_completion_is_only_allowlisted_empty_stderr_shell_reads(self):
        for stdout in (b"", b"36\n", b"partial-public-read"):
            self.assertTrue(AdbFailure(PROBE, 255, stdout=stdout).prelease_completion_unconfirmed)
        exclusions = [
            AdbFailure(PROBE, 1, stdout=b"1"),
            AdbFailure(PROBE, 255, stdout=b"1", stderr=b"Permission denied"),
            AdbFailure(PROBE, 255, stdout=b"1", stderr=b" "),
            AdbFailure(PROBE, 255, stdout=b"1", timed_out=True),
            AdbFailure(PROBE, 255, stdout=b"1", has_input=True),
            AdbFailure(["devices"], 255),
            AdbFailure(["-s", IDENTITY["serial"], "emu", "avd", "name"], 255),
            AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "ime reset"], 255),
            AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "run-as local.investment.personal --user 10 cat files/served-editor-ime-recovery.json"], 255),
            AdbFailure(["-s", "physical123", "shell", "-T", "getprop ro.build.version.sdk"], 255),
        ]
        for failure in exclusions:
            with self.subTest(command=failure.diagnostic):
                self.assertFalse(failure.prelease_completion_unconfirmed)


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

    def run_simulated(self, exit_code, foreign_cleanup=False, discovery_failure=None):
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
                if adb.lease is not None:
                    adb.recovery = recovery(adb.lease, "restored" if exit_code == 0 else "active")
                if exit_code and adb.lease is not None:
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
                 patch.object(adb, "identity", side_effect=discovery_failure, wraps=adb.identity), \
                 patch("run_served_ime.Supervisor", side_effect=lambda a, s, p, processes:
                       Supervisor(a, s, p, processes, alive=lambda _process: True)), \
                 patch("run_served_ime.emulator_processes", return_value=[PROCESS.copy()]), \
                 patch("run_served_ime.subprocess.Popen", return_value=child) as popen, \
                 patch("run_served_ime.os.killpg", create=True) as kill, \
                 patch("run_served_ime.signal.signal"), patch("run_served_ime.time.sleep"):
                result = runtime(args)
                state = json.loads(Path(args.state).read_text())
                self.assertEqual(popen.call_count, 1)
                kill.assert_not_called()
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

    def test_prelease_transport_never_terminates_gradle_and_keeps_natural_failure(self):
        result, state, commands = self.run_simulated(7, discovery_failure=AdbFailure(PROBE, 1, stderr=b"error: closed\n"))
        self.assertEqual(result, 7)
        self.assertEqual(state["gradleExitCode"], 7)
        self.assertIsNone(state["hostError"])
        self.assertEqual(state["receivedSignals"], [])
        self.assertEqual(state["cleanup"], "not-leased")
        self.assertNotIn("lease", state)
        self.assertEqual(commands, [])


    def test_prelease_unconfirmed_completion_keeps_natural_gradle_failure(self):
        result, state, commands = self.run_simulated(7, discovery_failure=AdbFailure(PROBE, 255, stdout=b"1\n"))
        self.assertEqual(result, 7)
        self.assertEqual(state["gradleExitCode"], 7)
        self.assertIsNone(state["hostError"])
        self.assertEqual(state["receivedSignals"], [])
        self.assertEqual(state["cleanup"], "not-leased")
        self.assertNotIn("lease", state)
        self.assertEqual(commands, [])
        self.assertEqual(state["discoveryPending"]["last"]["reason"], "prelease-read-completion-unconfirmed")


class Clock:
    def __init__(self):
        self.now = 0

    def sleep(self, seconds):
        self.now += seconds


def simulated_finalization(module=runner, *, failure_kind="closed", entry_exit=0, process_alive_at_entry=False,
                           terminal=0, statuses=("offline", None), phase="restored", written=True,
                           wait_seconds=0, wait_timeout=False, external_signal=False, mutate=None,
                           process_alive_after_wait=None):
    """Run the real supervisor/runtime against invented processes, never adb/Gradle."""
    with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
        sdk = Path(directory) / "sdk"
        (sdk / "platform-tools").mkdir(parents=True)
        (sdk / "platform-tools/adb").touch()
        args = SimpleNamespace(sdk=str(sdk), source=SOURCE, shard="0", cleanup=False,
                               state=str(Path(directory) / "state.json"))
        clock, adb, child = Clock(), FakeAdb(), MagicMock()
        child.pid, child.returncode = 456, None
        state = {}
        polls, closing, failed, waits = 0, False, False, 0
        probes, kills, handlers = [], [], {}
        statuses = list(statuses)
        original_supervisor = module.Supervisor
        original_recovery = adb.read_recovery

        def devices(timeout=8):
            probes.append({"at": clock.now, "timeout": timeout, "closing": closing})
            if polls == 0:
                return {}
            if not closing:
                return {IDENTITY["serial"]: "device"}
            value = statuses.pop(0) if len(statuses) > 1 else statuses[0]
            if isinstance(value, Exception):
                raise value
            return {} if value is None else {IDENTITY["serial"]: value}

        def read_recovery(lease):
            nonlocal closing, failed
            if polls >= 3 and failure_kind is not None:
                closing, failed = True, True
                if failure_kind == "json":
                    raise ValueError("Malformed recovery JSON")
                if failure_kind == "empty":
                    command = module.shlex.join(["run-as", "local.investment.personal", "--user", "10", "sh", "-c",
                                                 "if [ -f " + module.RECOVERY_PATH + " ]; then cat "
                                                 + module.RECOVERY_PATH + "; fi"])
                    raise module.AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", command], 255)
                raise module.AdbFailure(PROBE, 1, stderr=b"Permission denied" if failure_kind == "permission" else b"error: closed")
            return original_recovery(lease)

        def poll():
            nonlocal polls, closing
            if failed:
                child.returncode = entry_exit
                return entry_exit
            polls += 1
            if polls == 2:
                adb.recovery = recovery(adb.lease, "restored")
            if polls == 3:
                if phase != "restored":
                    state["lastRecovery"] = recovery(adb.lease, phase)
                if not written:
                    state["events"] = [e for e in state["events"] if e["event"] != "lease-written"]
                if mutate:
                    mutate(state)
                if external_signal:
                    child.returncode = terminal
                    handlers[module.signal.SIGTERM](module.signal.SIGTERM, None)
                    closing = True
                    return terminal
                if failure_kind is None:
                    closing, child.returncode = True, terminal
                    return terminal
            return None

        def wait(timeout):
            nonlocal waits
            waits += 1
            if wait_timeout and waits == 1:
                clock.sleep(timeout)
                raise subprocess.TimeoutExpired("invented Gradle", timeout)
            clock.sleep(wait_seconds if waits == 1 else 0)
            if not kills:
                child.returncode = terminal
            return child.returncode

        def kill(_pid, number):
            kills.append(number)
            child.returncode = -number

        def supervisor(a, s, p, processes):
            nonlocal state
            state = s
            return original_supervisor(a, s, p, processes,
                                       alive=lambda _p: (process_alive_after_wait if waits and process_alive_after_wait is not None
                                                         else process_alive_at_entry) if closing else True)

        child.poll.side_effect, child.wait.side_effect = poll, wait
        adb.devices, adb.read_recovery = devices, read_recovery
        stack.enter_context(patch.object(module.sys, "platform", "linux"))
        stack.enter_context(patch.dict("os.environ", {"GITHUB_ACTIONS": "true", "GITHUB_RUN_ID": "100", "GITHUB_RUN_ATTEMPT": "1"}))
        stack.enter_context(patch.object(module, "Adb", return_value=adb))
        stack.enter_context(patch.object(module, "Supervisor", side_effect=supervisor))
        stack.enter_context(patch.object(module, "emulator_processes", return_value=[PROCESS.copy()]))
        popen = stack.enter_context(patch.object(module.subprocess, "Popen", return_value=child))
        stack.enter_context(patch.object(module.os, "killpg", side_effect=kill, create=True))
        stack.enter_context(patch.object(module.signal, "SIGKILL", 9, create=True))
        stack.enter_context(patch.object(module.signal, "signal", side_effect=lambda n, f: handlers.update({n: f})))
        stack.enter_context(patch.object(module.time, "monotonic", side_effect=lambda: clock.now))
        stack.enter_context(patch.object(module.time, "sleep", side_effect=clock.sleep))
        result = module.runtime(args)
        return {"result": result, "state": json.loads(Path(args.state).read_text()), "commands": adb.commands,
                "probes": probes, "kills": kills, "elapsed": clock.now, "gradleStarts": popen.call_count}


class FinalizationTests(unittest.TestCase):
    def test_both_observed_read_failures_require_natural_zero_and_fresh_disposal(self):
        for kind in ("closed", "empty"):
            with self.subTest(kind=kind):
                result = simulated_finalization(failure_kind=kind)
                self.assertEqual(result["result"], 0)
                self.assertEqual(result["gradleStarts"], 1)
                self.assertEqual(result["kills"], [])
                self.assertEqual(result["commands"], [])
                state = result["state"]
                self.assertEqual(state["cleanup"], "disposed")
                self.assertEqual(state["receivedSignals"], [])
                self.assertIsNone(state["hostError"])
                self.assertIn("finalizationReadFailure", state)
                event = next(e for e in state["events"] if e["event"] == "cleanup-disposed")
                self.assertFalse(event["nativeRestorationVerified"])
                self.assertFalse(event["freshSettingsReadback"])
                self.assertTrue(event["priorNativeRestorationObserved"])
                self.assertEqual(event["disposal"]["devices"], {})
                self.assertFalse(event["disposal"]["ownedProcessAlive"])

    def test_process_gone_can_establish_teardown_entry_before_natural_child_zero(self):
        result = simulated_finalization(entry_exit=None)
        self.assertEqual(result["result"], 0)
        self.assertEqual(result["kills"], [])
        self.assertIsNone(result["state"]["finalizationStartObservation"]["gradleExitCode"])

    def test_no_observe_failure_normal_zero_still_reconciles_offline_to_absent(self):
        result = simulated_finalization(failure_kind=None)
        self.assertEqual(result["result"], 0)
        self.assertEqual(result["state"]["cleanup"], "disposed")
        self.assertNotIn("finalizationReadFailure", result["state"])
        self.assertEqual(result["commands"], [])

    def test_initial_cleanup_transport_uses_same_remaining_budget(self):
        failure = AdbFailure(["devices"], 1, stderr=b"error: closed")
        result = simulated_finalization(failure_kind=None, wait_seconds=29, statuses=(failure, "offline", None))
        self.assertEqual(result["result"], 0)
        for probe in result["probes"]:
            if probe["closing"]:
                self.assertGreater(probe["timeout"], 0)
                self.assertLessEqual(probe["timeout"], 31 - probe["at"])
        self.assertLess(result["elapsed"], 31)

    def test_active_child_and_live_emulator_cannot_borrow_earlier_restoration(self):
        result = simulated_finalization(entry_exit=None, process_alive_at_entry=True)
        self.assertEqual(result["result"], 1)
        # Entry is provisional. Natural child closure cannot hide a still-live device.
        self.assertEqual(result["kills"], [])
        self.assertIn("hostError", result["state"])
        self.assertIn("finalizationReadFailure", result["state"])
        self.assertIn("deadline", result["state"]["finalizationError"])

    def test_nonzero_external_signal_and_forced_termination_remain_failures(self):
        for options in ({"entry_exit": 7, "terminal": 7}, {"terminal": 7},
                        {"failure_kind": None, "external_signal": True},
                        {"entry_exit": None, "wait_timeout": True}):
            with self.subTest(options=options):
                result = simulated_finalization(**options)
                self.assertNotEqual(result["result"], 0)
                self.assertNotEqual(result["state"].get("cleanup"), "disposed")
                self.assertEqual(result["commands"], [])
                if options.get("wait_timeout"):
                    self.assertTrue(result["state"]["forcedTermination"])

    def test_disposal_never_accepts_live_process_or_present_serial(self):
        for options in ({"statuses": (None,), "process_alive_at_entry": True},
                        {"statuses": ("offline",)}, {"statuses": ("device",)},
                        {"statuses": ("unauthorized",)}):
            with self.subTest(options=options):
                result = simulated_finalization(**options)
                self.assertNotEqual(result["result"], 0)
                self.assertNotEqual(result["state"].get("cleanup"), "disposed")
                self.assertLessEqual(result["elapsed"], 31)
                self.assertEqual(result["commands"], [])

    def test_unfinished_or_tampered_latest_evidence_never_grants_finalization(self):
        for options in ({"phase": "prepared"}, {"phase": "active"}, {"phase": "restoring"},
                        {"written": False},
                        {"mutate": lambda s: s["lastRecovery"].update(nonce="c" * 64)},
                        {"mutate": lambda s: s["lastRecovery"].update(previousSubtype="77")}):
            with self.subTest(options=options):
                result = simulated_finalization(**options)
                self.assertNotEqual(result["result"], 0)
                self.assertNotIn("finalizationReadFailure", result["state"])

    def test_permission_and_invalid_record_errors_are_not_teardown(self):
        for kind in ("permission", "json"):
            result = simulated_finalization(failure_kind=kind)
            self.assertNotEqual(result["result"], 0)
            self.assertNotIn("finalizationReadFailure", result["state"])
            self.assertEqual(result["commands"], [])

    def test_expired_shared_budget_has_no_second_cleanup_probe_window(self):
        result = simulated_finalization(wait_seconds=29, statuses=("offline",))
        self.assertEqual(result["result"], 1)
        self.assertEqual(result["elapsed"], 31)
        self.assertTrue(all(p["at"] < 31 for p in result["probes"]))
        self.assertIn("deadline", result["state"]["cleanupError"])

    def test_inventory_requires_real_header_and_unique_complete_rows(self):
        adb = Adb(Path("/installed/sdk"))
        for text, expected in (("List of devices attached\n\n", {}),
                               ("List of devices attached\nemulator-5562\toffline\n", {"emulator-5562": "offline"})):
            with patch.object(adb, "call", return_value=subprocess.CompletedProcess([], 0, text.encode(), b"")):
                self.assertEqual(adb.devices(), expected)
        for text in ("", "Permission denied\n", "List of devices attached\nemulator-5562\n",
                     "List of devices attached\nemulator-5562 device\nemulator-5562 offline\n",
                     "List of devices attached\nerror: closed\n",
                     "List of devices attached\nemulator-5562 invented\n",
                     "List of devices attached\nemulator-5562 device unexpected\n"):
            with patch.object(adb, "call", return_value=subprocess.CompletedProcess([], 0, text.encode(), b"")), \
                 self.assertRaises(ValueError):
                adb.devices()

    def test_private_read_and_write_scope_cannot_be_spoofed(self):
        with tempfile.TemporaryDirectory() as directory:
            lease = lease_for(IDENTITY, NONCE, SOURCE, SETTINGS)
            state = {"nonce": NONCE, "sourceSha": SOURCE, "lease": lease,
                     "lastRecovery": recovery(lease, "restored"), "events": [{"event": "lease-written"}]}
            host = Supervisor(FakeAdb(), state, Path(directory) / "state.json", lambda: [])
            for failure in (AdbFailure(PROBE, 255),
                            AdbFailure(PROBE, 1, stderr=b"error: closed", has_input=True),
                            AdbFailure(["-s", "emulator-9999", *PROBE[2:]], 1, stderr=b"error: closed"),
                            AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "ime reset"], 255),
                            AdbFailure(["-s", IDENTITY["serial"], "shell", "-T", "run-as foreign cat private"], 255)):
                self.assertFalse(host.teardown_read(failure))

    def test_inventory_probe_cannot_finish_after_deadline_and_claim_absence(self):
        with tempfile.TemporaryDirectory() as directory:
            lease = lease_for(IDENTITY, NONCE, SOURCE, SETTINGS)
            state = {"nonce": NONCE, "sourceSha": SOURCE, "lease": lease, "emulator": PROCESS,
                     "lastRecovery": recovery(lease, "restored"), "events": [{"event": "lease-written"}],
                     "gradleExitCode": 0, "receivedSignals": []}
            clock, adb = Clock(), FakeAdb()
            host = Supervisor(adb, state, Path(directory) / "state.json", lambda: [], alive=lambda _p: False)

            def late_inventory(timeout=8):
                self.assertEqual(timeout, 0.25)
                clock.sleep(timeout)
                return {}

            with patch.object(adb, "devices", side_effect=late_inventory) as probe, \
                 patch.object(runner.time, "monotonic", side_effect=lambda: clock.now), \
                 self.assertRaisesRegex(ValueError, "deadline"):
                host.cleanup(0.25)
            self.assertEqual(probe.call_count, 1)
            self.assertNotIn("cleanup", state)

    def test_normal_cleanup_inventory_permission_or_unknown_failure_stays_strict(self):
        for failure in (AdbFailure(["devices"], 1, stderr=b"Permission denied"),
                        AdbFailure(["devices"], 255), ValueError("Malformed adb inventory")):
            result = simulated_finalization(failure_kind=None, statuses=(failure, None))
            self.assertEqual(result["result"], 1)
            self.assertNotIn("finalizationReadFailure", result["state"])
            self.assertNotEqual(result["state"].get("cleanup"), "disposed")

    def test_pending_live_entry_can_close_naturally_and_prove_disposal(self):
        for kind in ("closed", "empty"):
            with self.subTest(kind=kind):
                result = simulated_finalization(failure_kind=kind, entry_exit=None,
                                                process_alive_at_entry=True, process_alive_after_wait=False)
                self.assertEqual(result["result"], 0)
                self.assertEqual(result["kills"], [])
                self.assertEqual(result["commands"], [])
                self.assertEqual(result["gradleStarts"], 1)
                state = result["state"]
                self.assertIsNone(state["finalizationStartObservation"]["gradleExitCode"])
                self.assertTrue(state["finalizationStartObservation"]["ownedProcessAlive"])
                self.assertEqual(state["gradleExitCode"], 0)
                self.assertEqual(state["receivedSignals"], [])
                self.assertEqual(state["cleanup"], "disposed")
                self.assertIn("finalizationReadFailure", state)
                self.assertIsNone(state["hostError"])

    def test_pending_live_native_failure_preserves_natural_exit_without_sigterm(self):
        result = simulated_finalization(failure_kind="empty", entry_exit=None, terminal=7,
                                        process_alive_at_entry=True, process_alive_after_wait=False)
        self.assertEqual(result["result"], 7)
        self.assertEqual(result["state"]["gradleExitCode"], 7)
        self.assertEqual(result["state"]["receivedSignals"], [])
        self.assertEqual(result["kills"], [])
        self.assertEqual(result["commands"], [])
        self.assertIsNotNone(result["state"]["hostError"])
        self.assertNotEqual(result["state"].get("cleanup"), "disposed")

    def test_pending_active_child_never_finishes_is_bounded_failure(self):
        result = simulated_finalization(entry_exit=None, process_alive_at_entry=True, wait_timeout=True)
        self.assertEqual(result["result"], 1)
        self.assertEqual(result["kills"], [9])
        self.assertTrue(result["state"]["forcedTermination"])
        self.assertLessEqual(result["elapsed"], 31)
        self.assertNotEqual(result["state"].get("cleanup"), "disposed")


if __name__ == "__main__":
    unittest.main()
