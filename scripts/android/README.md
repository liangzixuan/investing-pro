# Android release signing

These tools target `app.investingpro.android` and the native Windows owner. Run
them with Windows PowerShell 5.1 after reviewing the exact source and public
inputs. They do not obtain existing credentials, create a service registration,
install an APK or establish device acceptance automatically.

When automation launches Windows PowerShell 5.1 from another shell, set only
the child process's `PSModulePath` to
`C:/Windows/System32/WindowsPowerShell/v1.0/Modules`. This keeps inherited module
paths from selecting modules for a different PowerShell edition.

`Initialize-InvestmentAndroidSigning.ps1` accepts `OwnerSid`, `SigningDirectory`,
`JavaHome` and `EvidenceDirectory`. Both directories must be new, separate, and
have existing parents. The private directory must be outside the repository.
Setup verifies the native SID, restricts and reads back owner-only ACLs, creates
a random password protected by Windows DPAPI, and creates a new PKCS12 RSA3072
release key with the installed JDK. It never overwrites existing custody.
`identity.json` and the exported certificate contain public identity only.
DPAPI custody on one Windows installation is not a recoverable backup.

`Build-InvestmentAndroidRelease.ps1 -PublicConfiguration <absolute JSON path>`
requires exactly these string fields:

```json
{
  "ownerSid": "<native owner SID>",
  "repository": "<absolute clean repository path>",
  "javaHome": "<reviewed installed JDK root>",
  "javaUserHome": "<existing isolated Java build-home directory>",
  "androidHome": "<reviewed installed Android SDK root>",
  "androidUserHome": "<isolated Android user directory>",
  "gradleUserHome": "<isolated Gradle cache directory>",
  "nodePath": "<reviewed absolute node.exe path>",
  "gitPath": "<reviewed absolute git.exe path>",
  "signingDirectory": "<new accepted private custody directory>",
  "evidenceDirectory": "<new public output directory outside repository>",
  "sourceSha": "<exact accepted 40-character commit>",
  "certificateSha256": "<actual lowercase 64-character SHA256>",
  "versionCode": "1",
  "versionName": "1.0.0",
  "publishableKey": "<reviewed production pk_live public key>"
}
```

The example is deliberately non-executable. Bind actual public values before use.
The build verifies a clean exact commit and custody identity, builds the fixed
managed native profile, syncs Capacitor and calls the checked-in Gradle wrapper
main with `--no-daemon --offline`. It supplies `-Duser.home=<javaUserHome>` to
both the launcher JVM and Gradle's command line. The latter sets the build
property before settings and plugins load in a single-use daemon; it does not
assert the daemon's home at JVM startup. The Java build home must be an existing
ordinary directory, separate from the repository,
signing custody and evidence. Bind the existing isolated
`tmp/android-launch/toolchain/java-user` directory for this workspace.
It passes signing passwords only to Gradle's
existing process inputs. Gradle resolves dependencies from its offline cache.
The wrapper distribution must already be cached for the entire build to avoid
downloads; `--offline` applies after the wrapper starts Gradle.
Cache misses stop the build and need a separately reviewed toolchain action.
The packaged application/version, non-debuggable flag, APK signature and exact
release certificate must match. The final source tree must remain clean.
Before Vite, sync or Gradle runs, the build preserves existing managed assets,
synced Capacitor inputs and all prior APK outputs in its fresh evidence directory.
The fixed snapshot permits at most 4096 entries and 512 MiB, rejects reparse
points or target escape, and verifies every copied byte hash. It never moves or
deletes prior output. A limit or copy failure stops before the build.
The native Gradle profile owns the bundled asset/manifest validation; final
artifact review must still inspect the merged callbacks, permissions, backup
rules, notices and retained asset identities. This tool makes no service or
installed-device acceptance claim.

`Recover-InvestmentAndroidSigning.ps1` accepts mode `Backup` or `RestoreCheck`,
the native `OwnerSid`, `JavaHome`, actual `CertificateSha256`,
`RecoveryDirectory` and a new `EvidenceDirectory`. Backup also requires
`SigningDirectory`; RestoreCheck requires a new `RestoreDirectory`.
Private output directories need an existing parent and an ACL-capable filesystem.
The interactive native terminal hides the recovery passphrase; backup asks for
confirmation. No password argument or plaintext file is accepted. Backup exports
the same key into a separately encrypted PKCS12. RestoreCheck copies that backup
into a new protected directory and uses only the entered recovery passphrase.
Both modes match the exported certificate and generate then verify a certificate
request with the restored key. The retained JDK 21 `keytool -printcertreq`
constructs `PKCS10`, whose parser verifies the signature. This reuses JDK crypto.
Custody of an independent backup destination and recovery method remains an
owner-recorded fact; a local proof cannot establish it. RestoreCheck leaves its
protected encrypted copy for explicit later handling and stores no recovery
passphrase or DPAPI record for it.

Each child gets a fresh environment, bounded output and a deadline. Public
receipts contain executable hashes, non-secret arguments, supplied variable
names, exit state and stream hashes. They never serialize supplied environment
values. On timeout or output overflow only the retained direct process handle
is killed; possible uncollected children/streams are recorded and work stops.
Failures preserve partial material and forbid blind retry or replacement.
Managed runtime strings cannot be guaranteed erased from all process memory;
the scripts clear references/environments and release unmanaged secret buffers.

Source-only verification uses the PowerShell parser and
`Signing.Common.Tests.ps1`. The tests exercise pure paths, overlap, version,
fingerprint and Windows argument quoting. They never create a directory, read a
credential, invoke a signing tool, or exercise DPAPI/ACL/build/device behavior.
Actual custody, recovery, APK and Pixel checks require separate operation review.
