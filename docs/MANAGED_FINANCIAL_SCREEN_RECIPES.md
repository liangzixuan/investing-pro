# Portable financial-screen recipes

This workflow lets an owner reuse an Annual financial-screen definition
through a local JSON file. It keeps the current six fields, seven-clause limit
and defined cohort of 18 listings for 17 issuers. It adds no source coverage,
provider, cloud storage or automatic financial request.

## Capture the applied definition

Load the screening cohort, choose companies and apply valid criteria. Open
**Portable screen recipe**, enter a **Recipe name**, then select **Save screen
recipe file**. The name is at most 80 characters on one line. The file preserves
the applied criteria, exact decimal spellings, sort and selected listing order.
One listing per issuer and at most 17 selected issuers are allowed.

Partly entered criteria, a running screen, unavailable access or an unloaded
cohort block capture. A recipe contains no financial results, source packets,
notes, shortlist, account identifier or online Save base. Its capture time and
catalog digest are file claims; they do not prove financial freshness or identity.

The managed browser requests a JSON download. Android uses the system document
picker with a separate fixed JSON purpose and filename. Cancelling keeps the
current screen definition. A download request does not establish that a file
was stored at the intended destination.

## Open, review and apply

Use **Open screen recipe file** to select one file. Only the current versioned
format is admitted, within 64 KiB of strict UTF-8. Unknown or duplicate keys,
invalid names or timestamps, malformed criteria, duplicate listings or issuers,
and invalid identities refuse the entire file. No result is read or saved while
opening a recipe.

**Screen recipe review** shows the full file definition beside the current
definition, ordered companies and every old/current identity field. Current
catalog membership and Annual eligibility govern admission. A missing company,
changed stable identity or uncovered listing refuses the whole Apply. A change
to display metadata is shown for review; an accepted Apply uses the reviewed
current identity. No member is silently dropped or replaced by ticker.

**Apply recipe definition** replaces the criteria and selected company order
atomically. It consumes the review before notifying listeners and clears old
results, comparison and shortlist. It makes no source request or saved-record
change. **Keep current screen definition** cancels without replacing criteria,
including raw text that has not been applied.

File selection, reading, review and document delivery belong to the current
screen visit. A changed name, criteria, selection, run, catalog, membership,
route, access or session retires stale actions. A late file or picker result
cannot apply to the replacement screen. Select the file again after a change.

## Continue the research workflow

After Apply, select **Run screen** to load reports under the existing sequential
SEC admission, cooldown and cancellation rules. Results retain their original
dates and qualifications. Research and Back keep this run. Shortlist companies,
review their exact identities for My Watchlist, then append missing listings to
its draft. Watchlist Review and Save remain separate explicit actions.

Existing notes, Follow-ups and Portfolio drafts are independent. A definition
file cannot restore them or recover an account. Recipes can move between managed
sessions; current identities and source eligibility must be reviewed each time.

## Design and acceptance

The interaction follows the established saved-screen pattern of filters and
sorting described in [TradingView's custom-screen guide](https://www.tradingview.com/support/solutions/43000718804-how-to-create-save-and-update-a-custom-screen/).
Investment adds complete identity review and keeps Apply, source reads and
Watchlist Save separate. No upstream code or visual assets are copied.

Accepted main `73dc74af6d72141d60a5d749ef94133b1a361ec6` passed its original
required checks and hosted native 71-case gate. Android 1.35.0, code 36, provides
the workflow locally with the existing production signer after complete APK
verification. The API and website retain their prior releases. Phone file
picker, recipe and Back acceptance and sustained use remain separate owner
actions. Browser QA is paused; no new rendered browser acceptance is claimed.
See [Current work](CURRENT_WORK.md) for delivery status.
