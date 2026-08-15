# ADR 0005: Alert processing semantics

Status: accepted for Sprint 0

Alerts use at-least-once evaluation, deterministic event and dedupe keys, and idempotent internal state. The demo evaluates locally and sends nothing externally.

A production system may record provider attempts and receipts, measure duplicate-notification SLOs, and issue correction notices. It must never promise transport-level exactly-once delivery or retractability of an already delivered email/SMS.
