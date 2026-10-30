# Prepared company research report

Company research has an initially closed **Research report** disclosure after the
loaded snapshot. Load the sources you need, then select **Prepare research report**.
At least one admitted source or a calculated [authored valuation](MANAGED_VALUATION_WORKBENCH.md),
and a verified current watchlist draft, are required.
Preparation is blocked while a company source load or watchlist operation is
pending, or the draft requires catalog/conflict review. An unavailable draft is
never described as a missing note. Preparation makes no data request or saved change.
Loaded Price studies use the existing decimal calculator and captured raw history.

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
`investment.company-research`, schema `5.0.0` in the current development source,
preparation time, exact listing and
catalog identity. Its authored-research section preserves the draft's full text,
including whitespace and Unicode. JSON escapes preserve that text when decoded;
they do not verify its claims or establish a saved version. A missing watchlist
note and an empty note remain different states.

Each loaded source contains its full admitted response, original source clocks,
origin and retained-previous/failed-attempt flags. Annual includes its complete canonical observation graph and per-concept scans
once. Separate statement cells and financial results keep their exact source
identifiers, independent refusals, comparative dates and original eligibility. Price keeps its raw closes and original
window, with versioned [raw close studies](MANAGED_PRICE_STUDIES.md) and each
result's sample and refusal. Filings keeps its recent-list window and incomplete-history limits.
These are the admitted packets, not provider bodies or complete issuer history.
Unavailable values remain unavailable, and a source that was never loaded stays
`not_loaded`. Inspection makes no source request and keeps the captured calculation.

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

Downloaded copies do not update after later edits. The local
[report revisit](#revisit-a-saved-report) reads a selected JSON copy separately.
There is no server-side report store or report-to-draft restore. If the complete
document exceeds its limit, it is refused without clipping. Report files have their own purpose, filename
and byte admission. Browser report and saved-watchlist delivery share only the
temporary Blob/anchor transport and cleanup; their document contracts stay
separate.

## Read the HTML copy offline

The managed browser offers **Download report (HTML)**. The Android source candidate
also offers **Save report (HTML)** through the system document picker. This delivers a
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

## Readable report capture on Android

The source candidate offers **Save report (HTML)** beside JSON. Prepare the report,
choose that action and select a destination in the system picker. After a
successful write, open the chosen file with a compatible HTML reader. The app
does not open it automatically. The file remains at the chosen destination and
does not update when the draft or source changes. Keep it private: it contains
the captured note and source packets.

Both buttons share one pending report operation. Cancel returns to the current
report and draft. A draft/evidence change, research exit or retired session fences
a late chosen destination. A cancelled or failed write can leave an empty or
partial file; inspect that destination before trying again. File capture does
not save the online Watchlist or request another source.

The native HTML policy fixes `text/html`, the report purpose, exact listing/time
filename, 8 MiB complete UTF-8 limit, versioned envelope, leading CSP and pinned
stylesheet hash. The existing formatter escapes authored text and produces the
passive report with its complete JSON appendix. Native envelope admission does
not sanitize arbitrary HTML or authenticate content supplied by compromised app
code. JSON retains its separate MIME/schema policy and existing byte limit.
Synthetic checks and source review are separate from client publication, file
opening on a physical device and sustained use.

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

## Record a comparison in a research check

The [report comparison check workflow](MANAGED_REPORT_COMPARISON_CHECK.md) is in
development. It extends the existing revisit flow with an explicit destination
for the current owned Follow-ups result, full preview and separate apply. The
existing Watchlist note action and source/date qualifications remain.

## Revisit a saved report

Android 1.38 adds an initially closed **Revisit a saved report**
disclosure inside **Research report**. Select a format 5 JSON report for the exact
current company. The file remains private to this visit. Closing either report
disclosure, leaving the company or retiring the session clears it.

The reader checks the advertised and actual UTF-8 byte counts, the complete
current envelope, duplicate decoded JSON keys, Unicode, listing identity and CIK.
It reuses the source packet validators, including Annual canonical hashes.
Unsupported, malformed, foreign-company and oversized files are refused without
changing a draft or loading a source. The complete file ceiling is 2,850,816 bytes.
An older catalog snapshot can remain visible beside the current one when every
listing field and CIK still match. This does not establish file authenticity.

Review the whole archived note and its original report preparation time. An
empty note and a company outside the Watchlist remain distinct. Price keeps its
original raw-close window and request/completion times. Annual keeps its cutoff,
canonical generation, target and source capture references. Filings keeps its
window, original times, accession identities and source references. Loaded,
missing, retained-previous and failed-attempt states remain visible separately.
URLs and HTML-looking text from the file remain plain text.

Use the existing explicit source controls, then select **Capture current report
for comparison**. This requires the same admitted evidence or calculated
valuation and verified Watchlist draft as normal report preparation. It makes no
new request. The current full note and source provenance appear beside the
archive, with each capture's own times. No financial delta or investment verdict
is inferred. File-reported Annual derived views, Price studies and valuation
fields stay in the **Unverified file appendix**; they do not enter live models,
calculations or current eligibility decisions.

Write **Your comparison assessment**, then select **Preview comparison note**.
The preview contains the whole current destination note followed by the dated
authored excerpt and capture references. The complete single-line note must fit
the existing 2,000-character limit. Invalid or oversized text is refused as a
whole, without clipping. Add a company to My Watchlist first if it has no note
destination.

**Append comparison to note draft** applies the preview once. It preserves other
notes and listing order. Use the existing Watchlist Review and Save separately;
the file does not restore or overwrite a saved draft. A source replacement,
whole-draft revision, catalog, company visit, navigation, recovery or session
change invalidates the captured comparison. An edit followed by identical-text
restoration does not revive it. Capture and preview again after a change.

This workflow is accepted at source
`8395bcffc230154497f461f99b87705229b435fd` and delivered in Android 1.38.0,
code 39. Original required source checks, the complete native 74-case gate and
APK verification passed. The owner reported "Installed and verified." on
October 23, without per-feature results or independent device inspection. The
live website and API are unchanged.
