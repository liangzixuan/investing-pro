# Watchlist filing review

This client workflow groups up to five exact listings from the current Watchlist
draft. It retains a separate Filings response for each chosen listing while the
owner inspects company research and writes cited notes. Source acceptance and
delivery are recorded in [Current work](CURRENT_WORK.md).

Android 1.32 provides this workflow from accepted source
`273f09dbeb056a6196c3c6b73dd37eb06432bb54`. Its guarded build, complete package
checks and source preservation passed. The website retains its earlier client.
Physical-device acceptance and sustained use remain open.

## Review a group of companies

1. Open **My Watchlist**, then **Review a group of watchlist companies**. Choose
   up to five listings and select **Start filing review**. Starting makes no
   source request and changes no note.
2. Choose a company in the review. **Load review filings** checks only that
   company's existing Filings source. **Refresh review filings** is another
   explicit check. Switching companies makes no request and cancels an unfinished
   check for the previous company.
3. Read the response summary and source details. Each listing keeps its own
   original request, retrieval and completion times, 90-UTC-date window, matching
   count, truncation and older-history qualifications. A response from another
   share class cannot stand in for this listing, even when both have the same CIK.
4. Select **Inspect filings and write note** to open the checked packet in company
   research without another request. The company receives an independently
   validated copy. Choose a filing reference, inspect its citation and append it
   through the existing note action. Review and Save the whole Watchlist draft
   separately. No review control saves the draft.
5. Return with Back to the same selected company and retained group. A company
   Refresh is independent and does not replace the group's response. To update
   the group, use its own explicit Refresh.
6. **Finish filing review** clears the temporary group and returns to company
   selection. Authored notes remain in the Watchlist draft.

The response count reports retained packets, not completed research or read
filings. Starting, choosing, switching and inspecting do not start a batch,
schedule a retry or set a saved reviewed flag. There is no automatic next-company
check. The review shares the existing checked SEC cooldown with company Annual,
Filings and other Watchlist checks.

## Keep a dated question from a filing

In company Filings, open **Keep a dated research question** beside an observed
filing. Write the whole question and a UTC due date. If Follow-ups has no loaded
draft, use **Load follow-ups for this question**. This reads only the separate
saved Follow-ups resource. Opening the disclosure makes no request, and a failed
initial Load keeps the authored question and date available for correction.
An existing draft cannot be replaced by this inline Load.

Choose **Preview dated question**. Read the whole proposed check, exact company
identity and due date before **Create follow-up draft**. The stored check includes
the complete question, form, accession, original filing date and filing index URL.
The complete text must fit the existing single-line 500-code-point limit; an
oversized or invalid candidate is refused as a whole. Nothing is clipped.
An existing check for the listing, including a completed check, and the 20-entry
limit also refuse creation. Review an existing check in Follow-ups separately.

The citation describes filing metadata. Filing contents are not fetched or read
by this action. The preview keeps the packet's original request, retrieval,
completion, window, truncation and retained-response qualifications visible.
The due date is an authored planning date; it does not refresh the evidence.
The saved check is a question with a citation, not a saved copy of the source packet.

Creation changes only the Follow-ups draft. Cancel, closing the disclosure or
editing the question/date retires its preview. A changed source, either draft,
Save/recovery state, catalog, route or session also retires it permanently.
Prepare a new preview after resolving the current state. Back retains the filing
review's selected company and packets. Open Follow-ups to review and **Save
follow-ups** explicitly. A fresh Load shows only saved checks. My Watchlist and
its note retain their separate Save.

This is a client source candidate. Current-source checks, hosted native
acceptance and delivery remain separate events.

## Cite a filing in an existing assessment

Open **Research company** from the exact check in Follow-ups, including a check
selected from Markets. Use **Record assessment** to write your assessment in that
same draft. In Filings, open **Cite a filing in this assessment**, then explicitly
choose one reference from the already loaded response. The choice starts empty.
A general company link does not select a private check.

**Preview complete assessment** shows the whole existing result and complete
qualified filing reference. The citation retains form, accession, filing and
report dates, index URL, exact listing, CIK, original request/window/retrieval/
completion times and retained, truncated or older-history limits. It states that
filing contents were not fetched and full window coverage is not established.
These source facts do not verify the authored assessment or refresh its evidence.

**Apply citation to assessment** changes only that existing entry's result once.
It preserves the question, due date, completion state, other checks and My
Watchlist. The full raw result and citation must fit the existing single-line
2,000-code-point limit. Invalid, empty or oversized assessments are refused as
a whole; nothing is clipped or changed. The complete citation cannot be added
twice. Cancel changes nothing.

Return with **Review follow-ups** or Back to the same selected check. Complete
the check explicitly and **Save follow-ups** separately. A fresh Load restores
the saved result; the existing Follow-ups HTML report includes it in full.
This action makes no source request and does not complete or save the check.

Changing the filing choice, either draft, packet or original row, catalog,
company visit, route, session or draft-file state retires the preview. Pending
Save and recovery pause the action. A retired preview cannot become current
again when earlier text or state returns. Prepare a new preview after resolving
the current state.

This is a client source candidate. Focused synthetic verification, current-head
native acceptance, client delivery and physical-device acceptance remain separate.

## Responses and limits

An unloaded listing, an available response with no matching filings, an unsupported
listing and a source refusal have separate messages. Source eligibility is shown
before Load. Catalog membership or Annual eligibility does not establish Filings
coverage.

The existing [Filings contract](MANAGED_SEC_FILINGS.md) remains authoritative.
Checks use only the bounded SEC current recent-filings object. They do not load
older continuation files, filing bodies or arbitrary URLs. A response is filing
metadata; it does not establish materiality, news coverage or the complete filing
history.

An accepted refresh can compare its accession numbers with that listing's previous
accepted list. **Compared loaded lists** retains both original sets of dates and
limits. Newly observed accessions were absent from the previous loaded list; this
does not establish their publication time or completeness.

Transient source failure, a checked cooldown or Cancel can retain an accepted
packet with a previous-response notice. A malformed or mismatched replacement
follows the existing refusal and clearing rules. A retained packet keeps its
original times; it never becomes current because another company was checked.

## Draft and visit boundaries

Note edits, ordering and ordinary Save preserve the review while the exact chosen
listings and catalog remain valid. Adding a Watchlist member does not add it to
an active group. Removing a chosen member or changing its identity clears the
group. A changed or unavailable catalog retires its evidence and openers.

During a save conflict, retained evidence can still be inspected. Source reads
and note writes remain subject to the existing draft restrictions. A changed
draft, navigation or retired session fences captured callbacks and late results.

Company research suspends the review and preserves its accepted packets for Back.
Leaving **My Watchlist**, finishing the review or ending the session clears the
temporary group and cancels pending work. Reload and process death do not restore
it. Watchlist draft files and saved-record recovery remain separate workflows.

## Isolated Android journey

The test fixture defines a group-review journey with two independently admitted
invented packets, a complete cited note, explicit Save, hardware Back, cancelled
refreshes, Finish and session retirement. Its API admits only the fixed sequence
and one exact complete Watchlist save in memory. Changed late packets must not
replace retained evidence or revive the retired group.

The original group-review increment added this journey to its 59-case baseline.
Later native cases retain that original contract. The dated-question candidate
adds one isolated journey that checks the complete question and citation,
consume-once creation, retained group Back, separate Follow-ups Save and fresh
Load, with no Watchlist Save or extra filing request. Its fixed invented resource
refuses changed payloads and unexpected operations.

The filing-assessment candidate adds one complete due-check journey: exact
company Research, explicit filing choice, whole-result refusal and preview,
one-use Apply, retained Review/Back, explicit completion, separate Save and fresh
Load, then complete passive HTML readback. It uses independent invented citation
and whole-resource expectations, preserving the other check and unsaved Watchlist.
Its original PR and actual-main gates passed all 108 synthetic native cases.
The root inspected the current preview's heading and start; full result and
passive HTML readback are covered by the native journey. Android 1.58 is provided
locally from `448ec000a50f3af5ea06048c8a317f4e3ffb18c6` after one guarded build
with the existing signer and all four APK checks. The limited frame view does
not establish whole-page or physical-device acceptance.

Source checks, a passing current-source hosted native run and client delivery
remain separate acceptance events. None establishes owner-account or physical-device
acceptance. See [Current work](CURRENT_WORK.md) for the accepted scope.
