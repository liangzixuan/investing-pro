# ADR 0058: reusable local owner login

Status: implemented; release verification is recorded in the current handoff.

The single-use bootstrap from ADR 0053 requires a new process and secret after
expiry or logout. That boundary now obstructs ordinary use and password-manager
integration. The owner explicitly requested replacing it with username/password
login for the configured personal workspace.

The workspace accepts either an existing owner-account file or the legacy
bootstrap configuration, never both. Account setup and reset are offline,
interactive operations under the local operating-system user's authority.
There is no unauthenticated HTTP enrollment or reset endpoint. The account lives
outside the research vault and changing it must not initialize or replace a vault.

The account stores a bounded, versioned salted scrypt verifier. Login is an
asynchronous, rate-limited JSON operation with the existing local request
boundary and HttpOnly cookie. Password verification can create a new session
after logout or expiry without restarting the API. Successful login supersedes
an existing session; session lifetimes and origin binding remain unchanged.
Account credentials survive restarts; active sessions do not.

The normal browser form uses username and current-password autocomplete, with
credentials cleared on submission and invalidation. No credentials enter URLs,
application logs or browser storage. The web auth mode is explicit and invalid
mode values fail closed. The account method is currently integrated into the
combined `personal_workspace` entry; older isolated profiles retain their
historically verified bootstrap behavior.

This supersedes ADR 0053's no-persisted-credential decision only for the explicit
account mode. Its historical evidence remains unchanged. Setup, reset, limits
and hashing references are described in [Local owner login](../LOCAL_OWNER_LOGIN.md).
