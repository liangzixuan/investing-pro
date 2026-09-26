# BEA agenda implementation plan

Use the existing React/Fastify/contracts layers and personal-workspace client.
The official JSON schedule supplies a small bounded series/time mapping, so no
calendar framework, ICS parser, new package or stored schema is needed.

## Boundaries

- Contracts own the exact source, canonical UTC window and event validator.
- The API adapter owns the fixed public request, deadline/body limits and source
  normalization. Its injected fetch/clock enable deterministic offline tests.
- The route owns existing authorization and request cancellation. Composition
  constructs and closes the provider without reading new private configuration.
- The web client admits the shared DTO. An isolated hook owns explicit acquisition
  and session/view guards; the agenda component owns grouping and Eastern display.
- Markets keeps the agenda mounted across Research/Back. A synchronous view-epoch
  callback retires starts/results before React commits navigation, while retained
  data follows the existing session lifetime rather than route visibility.

## Source and meaningful verification

The official BEA calendar links its public JSON endpoint. Preserve raw public
admission bytes outside Git. The known optional update metadata is validated as
uninterpreted local calendar text; event timestamps always require offsets.
Reject malformed feeds instead of quietly returning partial coverage.

Check normalization, duplicate/simultaneous events, boundaries, invalid dates,
limits and cancellation with fixtures. Exercise route authorization and client
admission independently. Test explicit loading, retained failed-refresh data,
session changes, stale starts/results, navigation and DST display. Read-only
offline admission against the retained public body connects tests to actual shape.

The fetch-owner guard admits only the reviewed adapter, refuses direct browser
source acquisition and retains official schedule links. Existing native-module,
credential, request and vault constraints remain unchanged.

## Release

Complete independent source review, affected page-mode checks, the production web
build and source-bound synthetic Brave QA. Then use the existing separate feature
and generated closure procedure, unchanged isolated native gate, exact required
hosted-job acceptance, guarded activation and limited live QA. Keep the accepted
app running until the candidate meets those gates. Preserve each failed attempt.

This small source-backed layer advances M3 while the independent M2 valuation
source remains unavailable. It neither replaces existing research nor changes
price/valuation formulas or owner data.
