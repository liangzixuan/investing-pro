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
never assumes a serial or AVD name. It waits for a matching process and refuses
ambiguous ownership. A device name alone never permits a lease.

Before a lease, explicit transport closure, offline/not-found responses and the
existing eight-second read timeout can remain pending while the original Gradle
process runs. This applies only to the listed public read probes. Boot, package
installation and a disappearing setup emulator also leave discovery pending.
An empty nonzero response has no assumed cause: it remains a failure unless a
separate observation proves that the candidate process or device disappeared.
Permission failures, malformed identity and ownership conflicts still stop the
host. Nothing is written to a device until the complete lease proof succeeds.

Failed ADB commands record their arguments, exit code or timeout and at most
1,000 characters from each output stream. They do not record environment variables
or command input bodies. Pending discovery retains a count, the first and last
observations, and the first and last failed-command diagnostics. Later readiness
observations cannot erase those failures or grow the evidence without limit. It adds no retry
deadline or Gradle invocation. Once the lease is prepared, active-session transport,
write, readback and cleanup failures remain strict. The bounded managed-device
shutdown reconciliation below permits only provisional waiting until final proof.
An uncertain lease write is never retried as discovery.

A successful `adb emu avd name` command must still return exactly two decoded
lines, with `OK` as the second line. Before a lease, an exit-zero response with
exactly zero stdout and stderr bytes supplies no identity observation. Discovery
records this as pending and probes the complete identity again on its next pass.
It cannot read package settings or prepare or write a lease from the empty result.
This uses the existing Gradle step deadline and eight-second probe limit; external
cancellation and natural Gradle failure remain failures. No cause is inferred for
the empty response. After a lease, the same empty response remains a hard failure
and cannot enter shutdown reconciliation.

Whitespace, partial, malformed and non-UTF-8 responses remain hard identity
failures in every phase. Their `hostError` retains the exact command arguments, exit
code, original output byte lengths and at most 1,000 characters from each output
stream. Replacement characters are used only to record invalid UTF-8 safely;
they do not make the response valid. No environment values or input bodies are
recorded. The exact empty pre-lease observation is retained in the existing bounded
pending record; all other diagnostics remain failures.

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

GMD can close its emulator transport while the successful Gradle task finishes.
For an exact read-only transport failure, or an empty exit 255 from the exact
recovery-file read, the host first requires a completed lease write and the latest
authenticated recovery phase `restored`. Entry observations of Gradle and the
leased process are diagnostic: GMD can close its transport before either process
exits. The read failure remains unresolved during provisional waiting. The host
does not send SIGTERM for this eligible failure; it retains the child's natural
exit code. A still-live emulator or child that does not close within the bound
cannot pass, even after an earlier restoration.
Malformed records, permission errors, unknown commands and uncertain writes do
not enter shutdown reconciliation.

Reconciliation shares the existing 30-second Gradle closure budget. Each inventory
probe uses at most the remaining time and the existing eight-second probe limit.
The same bound covers normal exit 0 followed by a transient offline inventory.
Success requires natural Gradle exit 0, no received signal, the exact leased
PID/start identity gone, and a fresh valid ADB inventory with the serial absent.
An offline entry alone, a live process or a present/reused serial is insufficient.
Empty or malformed inventory output is not proof of absence. No mutation runs
during reconciliation, and failure does not start another probe window.

The record retains the failed command, prior restoration and current disposal
proof separately. It does not claim a fresh settings readback from a removed
device. A later observed `prepared`, `active` or `restoring` record supersedes an
earlier `restored` record. Original failed workflows remain failed evidence.
Final proof resolves the observation failure; it does not prove its cause at
entry or replace the separate native test and UTP result checks.

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

## Workflow time budgets

The native test step has a 45-minute limit inside a 55-minute shard job. Two
runs reached the former 30-minute limit while the suite was still advancing,
with no reported test failures. Comparing the completed prefixes with a passing
run projected about 31–33 minutes for the full run, including startup and
finalization. The bounded margin allows for hosted-runner timing variation.

This budget does not change a test assertion, editor deadline, ADB probe limit,
lease rule or cleanup requirement. Acceptance still requires the full native
test union from one attempt and both completed host cleanup records. A workflow
timeout remains a failure; an incomplete run cannot establish acceptance.

Tests:

```sh
python3 -B -m unittest discover -s scripts/android -p test_served_ime_host.py -v
```

The first hosted run still must establish actual AGP process/environment
inheritance, installation-to-lease timing, service lifecycle and exact restoration.
Simulated tests cannot establish those device results. No edit deadline is extended
to compensate for missing host ownership evidence.
