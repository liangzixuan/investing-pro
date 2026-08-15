# ADR 0008: Public knowledge time and exact rights versions

Status: accepted for Cycle 1a

Financial reporting periods, source availability, public-knowledge intervals,
and database-system intervals are separate fields. Every interval is half-open
and every instant is UTC. A restatement closes the prior public-known version at
the exact boundary and creates a later database version; it does not rewrite
history.

Facts and evidence freeze both rights-policy ID and version. Evaluation checks
the requested purpose and channel together with synthetic classification,
demo-only territory, and expiry. Unknown dimensions fail closed. Exact omission
counts are optional because row-level security must not be bypassed to count
records the caller cannot see.
