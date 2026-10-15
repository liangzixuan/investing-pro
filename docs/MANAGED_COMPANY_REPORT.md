# Prepared company research report

Company research has an initially closed **Research report** disclosure after the
loaded snapshot. Load the sources you need, then select **Prepare research report**.
At least one admitted source and a verified current watchlist draft are required.
Preparation is blocked while a company source load or watchlist operation is
pending, or the draft requires catalog/conflict review. An unavailable draft is
never described as a missing note. It starts no data request, calculation or saved change.

The preview separates the exact watchlist draft from loaded source evidence.
The note keeps its full text and whitespace. Claims and links in the authored
note are not checked by the report, and the preview does not establish that the
draft is saved. A company outside the watchlist and an empty note have distinct
messages. Preparation does not infer holdings or an investment verdict.

Price, Annual and Filings reuse the existing evidence displays. Each source keeps
its own original times, periods, revenue bases, availability, historical status
and coverage limits. Missing sources stay missing. A failed refresh can retain
an older response with its warning; preparing again does not remove that warning.
The report preparation time is separate from source dates and does not renew
freshness. Use the normal section actions to inspect full source details.

The prepared preview belongs to this exact company visit and source state. A note
edit, source refresh, cancellation, invalid replacement or identity change removes
its displayed content. Prepare it again after the change. Restoring the old note
does not silently restore the old preview. Closing the company or retiring the
session clears its evidence and preview. Clear report preview removes it explicitly.

## Inspect the report document

In a current prepared report, open **Inspect report document (JSON)**. The
read-only field contains a bounded UTF-8 document with purpose
`investment.company-research`, schema `1.0.0`, preparation time, exact listing and
catalog identity. Its authored-research section preserves the draft's full text,
including whitespace and Unicode. JSON escapes preserve that text when decoded;
they do not verify its claims or establish a saved version. A missing watchlist
note and an empty note remain different states.

Each loaded source contains its full admitted response, original source clocks,
origin and retained-previous/failed-attempt flags. Annual includes all admitted
observations, revenue bases, resolution and coverage details, cash-flow inputs,
liquidity inputs and filing references. Price keeps its raw closes and original
window; Filings keeps its recent-list window and incomplete-history limits.
These are the admitted packets, not provider bodies or complete issuer history.
Unavailable values remain unavailable, and a source that was never loaded stays
`not_loaded`. Inspection performs no financial calculation or source request.

The document is created only when its disclosure opens. It uses compact JSON to
keep the admitted packet bounds. If its output bound or note-character check
fails, it refuses the complete document without clipping or changing the draft.
The parent report's source, draft and visit checks also remove its document view.
No session, credential, pending operation or unrelated note is serialized.

This inspection is available in browser and Android. It does not download, save,
upload or restore a file. File delivery needs a separate report purpose and
appropriate browser/native adapters. The existing Android saved-watchlist writer
has a smaller byte bound and must not receive this report under that contract.

This is M4's report-document layer. Report export, durable report storage, verified
claim citations, outside opinions and AI analysis remain separate work. It has a
separate document purpose and state from saved-watchlist export; it does not use
or relax that export's validators or download adapters.
