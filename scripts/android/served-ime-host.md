# Managed-device test IME host contract

`run_served_ime.py` supervises the existing disconnected `pixel2Api36DebugAndroidTest`
command. It adds one instrumentation argument, `servedEditorImeLease`, while
retaining the existing shard, source, GPU, task and Gradle flags. It runs only in
the Linux GitHub Actions job. Local unit tests substitute every adb/Gradle process.

The host observes devices before starting Gradle. It cannot lease any of those
devices or a physical device. A new emulator must match a current-user SDK emulator
process which inherited the random host nonce, its observed AVD and console port.
The port must match an explicit process argument or a listening socket owned by
that PID. The host also verifies API 36, qemu, current user and boot ID. It
never assumes a serial or AVD name. A missing or ambiguous process proof refuses
the run; it does not fall back to a device-name guess.

After both exact packages support `run-as` and the test IME is installed, the host
captures the original IME settings and atomically writes this target-private file:

`local.investment.personal/cache/served-editor-ime-host-lease.json`

The file has exactly these fields:

```text
schema: 1
nonce: 64 lowercase hexadecimal characters
serial: observed emulator serial
user: actual Android user number
bootId: current /proc/sys/kernel/random/boot_id
sourceSha: expectedSourceSha instrumentation argument
previousDefault: exact original selected IME string
previousEnabled: exact raw enabled_input_methods string or null
previousSubtype: exact raw selected_input_method_subtype string or null
```

Native code verifies the lease and its own observations before activating
`local.investment.personal.test/local.investment.personal.ServedEditorIme`.
The separate provider is
`local.investment.personal.test.served-editor-control`. Its caller/session checks
remain in the test APK. The host does not call that provider or enable the IME.

Before any IME mutation, native code atomically writes
`cache/served-editor-ime-recovery.json` in the same target-private directory.
It contains `schema`, `nonce`, `serial`, `user`, `bootId`, `component`, the three
`previous*` fields, `initiallyEnabled: false` and a `phase` of `prepared`, `active`,
`restoring` or `restored`. The host refuses an already enabled fixture IME rather
than claiming a previous session. Two tests may use the same host lease only after
the previous native session restored the exact baseline.

The wrapper records lifecycle observations in
`app/build/outputs/androidTest-results/served-ime-host/state.json`, retained by the
existing artifact upload. It preserves Gradle's exit code and any original native
recovery record. Successful normal restoration needs no host mutation.

If a failed session leaves the device alive, cleanup verifies the same lease,
process, boot, user, original settings and recovery record. It refuses a foreign
IME selection or changes to other enabled IMEs. For an outstanding native session,
it force-stops only the two fixture packages to fence queued edits, then restores
the exact prior IME/subtype and disables only the fixture. Every mutation rechecks
ownership; final settings must equal the original snapshot. Cleanup never uses
`ime reset`, edits unrelated settings or stops an emulator. If GMD already removed
both device and process, the record says `disposed`, not `native restored`.

The workflow has an `always()` cleanup step for wrapper termination. It requires
the same source, run, attempt and shard and refuses while the Gradle PID remains
live without a recorded exit. A changed boot ID or reused serial never receives
cleanup. An unavailable but still-running emulator is an unresolved cleanup
failure, not proof of disposal. Do not hide that result or retry the native tests
as cleanup.

Before failed-session process stops, the host also requires a recognized,
package-filtered Activity Manager process dump with no active instrumentation.
It rechecks each installed debug package's UID/APK paths, records the exact package
stopped and verifies process absence before changing settings. The API 36 dump
contract is defined in AOSP's
[ProcessList](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android16-release/services/core/java/com/android/server/am/ProcessList.java)
and
[ActivityManagerService](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android16-release/services/core/java/com/android/server/am/ActivityManagerService.java).
An active instrumentation or uncertain dump refuses cleanup.

Tests:

```sh
python3 -B -m unittest discover -s scripts/android -p test_served_ime_host.py -v
```

The first hosted run still must establish actual AGP process/environment
inheritance, installation-to-lease timing, service lifecycle and exact restoration.
Simulated tests cannot establish those device results. No edit deadline is extended
to compensate for missing host ownership evidence.
