# ADR 0004: Contract-first REST boundary

Status: accepted for Sprint 0

Use a language-neutral REST API between the web and modular backend. The first OpenAPI 3.1 document covers health, dossier, and evidence reads. Errors follow RFC 9457-shaped problem details.

This boundary supports later Python workers, data-operations tools, and generated clients without coupling the UI to backend implementation details.
