# Filing evidence within a chosen review

This increment is in development. [Current work](CURRENT_WORK.md) records source,
automated acceptance and client delivery separately.

## Intended workflow

Load Portfolio and Follow-ups explicitly, inspect the complete current-holding
selection and start a chosen review. Start and Continue make no financial-source
request. Each exact check and share class owns its own temporary filing packet.

For the current check, use **Load review filings**. Read the full filing metadata,
original request, retrieval and completion times, 90-UTC-date window and source
qualifications. An unsupported listing, no loaded response, a verified empty
response and a refused request have different states. **Refresh review filings**
is another explicit request. Cancellation, a temporary source failure or a checked
cooldown preserves the prior accepted packet with its original source times and
retained-response warning. An invalid or foreign response clears the current
packet and cannot be inspected.

**Inspect filings and assess this check** opens the exact owned check in company
Filings using an independently validated copy. It makes no second financial
request. Use the existing assessment editor, choose a filing reference explicitly
and preview the whole result and citation before applying it once. The reference
describes filing metadata; filing contents are not fetched, and a loaded packet
does not establish that a filing answers the authored question.

Back returns to the same check and its retained packet. Complete or reopen the
check explicitly, then Continue or Finish. **Save follow-ups** saves the authored
resource separately. Fresh Load verifies the saved assessment and completion;
temporary review packets are not saved. Portfolio, Watchlist and valuation drafts
retain their own state and Save actions.

## Source ownership and limits

Only the existing admitted recent-filings source is used. Its coverage, parser,
checked cooldown and request budgets remain authoritative. Sharing a CIK does not
permit one share class's packet to be labelled as another. Starting, switching,
Inspect and Back never trigger an automatic request, batch or retry.

The complete assessment and citation must fit the existing 2,000-code-point result
limit. Invalid or oversized content is refused as a whole. Nothing is clipped.
Question and resource limits remain unchanged. Preview, Apply, Complete and Save
are separate actions with separate ownership.

Changes to the check's identity, question, due date, catalog, review scope,
Portfolio ownership, route, file/recovery state or session retire stale actions.
Restoring earlier values cannot revive them. Cancellation and late completion
cannot replace newer evidence or move focus. An owned assessment, completion or
Research/Back visit retains the intended review. The Watchlist filing-review
admission stays separate; a Follow-ups packet has its own typed source origin.

The workflow adds no provider, filing-body request, older continuation file,
arbitrary URL fetch, background monitoring, fee, API route or persistence resource.
Synthetic acceptance uses invented records and does not establish phone acceptance.
