# ADR 0003: Temporal facts and rights enforcement

Status: accepted for Sprint 0

Facts use separate half-open public-known and database-system intervals plus explicit source-availability and reporting-period fields. Financial values are decimal strings. Facts and evidence freeze an exact rights-policy ID/version evaluated before DTO projection; the API receives only that filtered DTO.

The demo contains one intentionally restricted estimate. Its absence from every outward representation is a release test.
