# Local owner login

The personal workspace can use one persistent local username and password.
Create the login once, then use **Sign in** at `http://127.0.0.1:3000/discover`.
Logout, session expiry and app restarts do not require a new password or an API
restart to sign in again. Your account file is separate from your research vault.

## Setup

Stop the local API. Choose an existing private directory outside the repository
and vault, and run this in an interactive terminal from the repository:

```powershell
pnpm --filter @research-cockpit/api owner-account --file "C:\absolute\private\owner-account.json"
```

Choose a username of 1–64 ASCII characters, starting with a letter or number;
letters, numbers, `.`, `_`, `@`, `+` and `-` are accepted after the first character.
Choose a password of 15–128 Unicode characters. Password input is hidden and
confirmed before saving; passwords are never accepted as command-line arguments.
The command refuses to overwrite an existing account during initial setup.

Set `RESEARCH_COCKPIT_OWNER_ACCOUNT_FILE` to that absolute file path in the API
environment and `RESEARCH_COCKPIT_WEB_AUTH=account` in the web environment. Keep
the existing `personal_workspace` modes, vault root, catalog and provider setup.
Remove `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`; configuring both methods fails
before the API listens. Restart the app and sign in normally. No account signup,
email service or cloud identity provider is involved.

The form uses standard username and current-password autocomplete fields. A
password-manager login should be associated with the exact local web address.
No changes to global password-manager protections are required by this feature.

## Password reset or change

Stop the configured API before resetting its account. Then run the same command
with `--reset`, choose the username and password, and restart the app:

```powershell
pnpm --filter @research-cockpit/api owner-account --file "C:\absolute\private\owner-account.json" --reset
```

The command checks the default API port 3100 on both loopback families. For a
different configured API port, pass `--port <port>`. This is an operator guard,
not a cross-process locking protocol: all processes using this account must be
stopped first. A running process retains its startup account until restarted.
Reset replaces only the account verifier; it does not recreate or change the
vault, its recovery key, the catalog, watchlists, or portfolios. Corrupt or
unsafe account files fail closed instead of being silently replaced.

## Behavior and protection

- The account file stores a random salt and a memory-hard scrypt verifier,
  never the password. File access is restricted to the local operating-system
  user; linked paths and malformed or oversized files are rejected.
- Login uses a small JSON POST with an explicit intent header. Existing exact
  loopback, Host, Origin and cookie protections remain enforced.
- Wrong username and wrong password receive the same generic response. Login
  attempts share a process-wide limit and only one password computation runs
  at a time. A throttled attempt receives a bounded retry interval.
- A successful sign-in replaces the previous session. Sessions still expire
  after 10 idle minutes or 60 absolute minutes; simply sign in again. Sessions
  themselves do not survive API restart. Passwords are cleared from the form
  on submission and do not enter application browser storage.
- Legacy bootstrap startup remains available for historical personal profiles
  and explicit compatibility use. It is not used by account-mode workspaces.

The verifier uses Node's asynchronous scrypt with `N=131072`, `r=8`, `p=1`, a
32-byte random salt and a 32-byte derived value. This follows the scrypt profile
in the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
This remains a local single-owner application. Remote deployment and resistance
to hostile processes under the same operating-system account are separate concerns.
