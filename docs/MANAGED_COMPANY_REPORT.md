# Prepared company research report

Company research has an initially closed **Research report** disclosure after the
loaded snapshot. Load the sources you need, then select **Prepare research report**.
At least one admitted source or a calculated [authored valuation](MANAGED_VALUATION_WORKBENCH.md),
and a verified current watchlist draft, are required.
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
`investment.company-research`, schema `3.0.0` in the Annual 6 development source,
preparation time, exact listing and
catalog identity. Its authored-research section preserves the draft's full text,
including whitespace and Unicode. JSON escapes preserve that text when decoded;
they do not verify its claims or establish a saved version. A missing watchlist
note and an empty note remain different states.

Each loaded source contains its full admitted response, original source clocks,
origin and retained-previous/failed-attempt flags. Annual includes its complete canonical observation graph and per-concept scans
once. Separate statement cells and financial results keep their exact source
identifiers, independent refusals, comparative dates and original eligibility. Price keeps its raw closes and original
window; Filings keeps its recent-list window and incomplete-history limits.
These are the admitted packets, not provider bodies or complete issuer history.
Unavailable values remain unavailable, and a source that was never loaded stays
`not_loaded`. Inspection performs no financial calculation or source request.

The document is created only when its disclosure opens. It uses compact JSON to
keep the admitted packet bounds. If its output bound or note-character check
fails, it refuses the complete document without clipping or changing the draft.
The parent report's source, draft and visit checks also remove its document view.
No session, credential, pending operation or unrelated note is serialized.

When calculated, authored valuation is a separate field. Both models retain their
raw draft text, admitted inputs, versions, methods, scenarios, projections and
25-cell sensitivities with individual refusals. It does not renew source dates
or label an assumption as a reported fact. The field is bounded to 128 KiB; the
complete report byte bound includes that separate allowance. Editing an assumption
invalidates the preview and pending delivery. Watchlist revision checks keep a
report invalid after an edit followed by identical-text restoration.

This inspection is available in browser and Android. Opening it does not download,
Save, upload or restore a file.

## Download the prepared report

In the managed browser, select **Download report (JSON)** in a current prepared
report. You can download without opening the inspection field. The explicit
handoff contains the same complete UTF-8 JSON, including the exact authored draft
and unsaved edits. The filename identifies its ticker, exchange MIC and original
preparation time. The browser chooses its normal download destination or asks
for one, according to its settings.

The control checks the actual current draft, selected visit and source models
before handing off. Changes or session retirement refuse stale delivery. Closing
the report aborts pending cleanup and prevents late status messages. A download
already handed to the browser can remain at its destination; clearing the report
cannot remove that file. The status says **Download requested**, because the
application cannot establish that the file was saved or opened. There is no
automatic retry, source read, financial calculation or watchlist Save.

Downloaded copies do not update after later edits. No server-side report store,
backup, import or restore is added. If the complete document exceeds its limit,
it is refused without clipping. Report files have their own purpose, filename
and byte admission. Browser report and saved-watchlist delivery share only the
temporary Blob/anchor transport and cleanup; their document contracts stay
separate.

## Read the HTML copy offline

The managed browser also offers **Download report (HTML)**. This delivers a
self-contained reading copy of the same current prepared report. It keeps the
full company and share-class identity, exact authored note and original
preparation time. The Annual section shows five independent financial facts
with their own periods, eligibility, refusal reasons and input references.
Missing Annual evidence stays missing. Price and Filings keep their own loaded
status, source times and coverage limits.

Open **Complete captured JSON** in the file to inspect all captured source
packets. Decoding that appendix preserves the exact authored note, including
line endings. The reading view uses normal HTML line-ending rules. The report
checks no authored claim or link; HTML-looking text and URLs remain plain text.
Its source dates and qualifications do not change when the file is exported or
opened later.

The HTML copy includes its fixed stylesheet and needs no script, external font,
image or network request. Its light reading layout wraps long values and note
text on narrow screens and supports printing. The complete UTF-8 file has an
8 MiB limit. An oversized file is refused without clipping; the JSON action can
still be available under its separate bound.

Both browser formats share one pending operation and the same source, draft,
visit and session checks. Neither starts another source request or saves the
watchlist. **Download requested** confirms the browser handoff only. It does
not establish that the file was saved or opened. Android continues to offer its
JSON system save.

## Save from Android

In the managed Android app, select **Save report (JSON)**. The system file picker
lets you choose the destination. This uses Android's [Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files)
and needs no broad storage permission. The app writes only to the content handle
chosen for that one operation. It does not retain a destination permission or
restore an unfinished save after Activity recreation.

The report has a fixed native purpose, JSON schema, safe filename and complete
UTF-8 byte limit. Before opening output, the writer checks the embedded listing,
exchange and preparation time against the original filename suggestion. It does
not replace financial-source admission or import the file as account data. The
saved-watchlist writer keeps its separate version, filename and smaller byte cap;
only destination and lifecycle handling are shared.

Cancelling the picker writes no report. Editing the draft, changing sources,
clearing the report or retiring the session refuses a stale choice or pending
write. The writer rechecks cancellation after a provider finishes opening the
chosen stream. A file already created or written can remain, and an interrupted
provider write can leave a partial file. Check the chosen destination before
retrying; the app never retries automatically. Success confirms that the provider
write, flush and close completed. It does not establish later availability or
that another application opened the file.

Browser and Android file actions keep the same prepared-source and authored-note
scope. Disconnected clients do not receive either delivery capability. Durable
report storage, verified claim citations, outside opinions and AI analysis remain
separate M4 work.
