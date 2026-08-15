# ADR 0001: TypeScript clean core

Status: accepted for Sprint 0

Use TypeScript for the web, REST API, domain modules, and contracts. Domain modules contain no framework or database imports. Python 3.12 is reserved for isolated filing workers beginning in a later sprint.

This resolves the earlier TypeScript-versus-Go ambiguity and keeps the first vertical slice buildable without local infrastructure.
