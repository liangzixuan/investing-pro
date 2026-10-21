# Watchlist filing review

This client workflow groups up to five exact listings from the current Watchlist
draft. It retains a separate Filings response for each chosen listing while the
owner inspects company research and writes cited notes. Source acceptance and
delivery are recorded in [Current work](CURRENT_WORK.md).

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
