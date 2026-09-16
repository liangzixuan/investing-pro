# Company research workspace

Open a company from security search, catalog or financial-screen results,
My Watchlist, recent watchlist filings or holdings. The company research heading
keeps its symbol, issuer name, exchange and security name visible. A comparison
column's **Research** action opens that exact selected listing, including a
company retained from another result page.

Five sections organize the existing panels:

| Section      | Existing capabilities                                        |
| ------------ | ------------------------------------------------------------ |
| Price        | Quote, price history and market analytics                    |
| Financials   | Annual and quarterly statements, financial quality checks    |
| Valuation    | Valuation history, historical multiples, DCF and reverse DCF |
| Peers        | Manual peer selection and comparison                         |
| SEC evidence | Dated quarterly observations and primary-filing context      |

The sections retain their existing data availability and explicit Load actions.
Moving between sections does not request data or save anything. Loaded data and
DCF draft assumptions remain in active-session memory while sections are hidden.
Hidden panels stay mounted, but their controls are absent from keyboard and
accessibility navigation. Tabs support Left/Right arrows, Home and End.
DCF links to missing price or annual inputs reveal the target section before
moving focus to its heading.

**Back to…** returns to the originating control without clearing the company or
the original screen. If that control has disappeared, focus returns to its
section heading. Reopening the same admitted identity preserves loaded data and
drafts. **Clear company**, a different admitted identity, catalog invalidation or
workspace/session loss clears the company state under the existing rules.
Pending responses and old callbacks cannot revive data from another identity.

Financial screening criteria, selected watchlist listings, display columns,
results and comparison remain separate from company navigation. The comparison
Research action verifies the current query, scope, snapshots and retained row
before opening it; it does not perform a provider request or saved-data write.

This view does not add financial metrics, provider coverage, a new company URL,
browser storage or a saved layout. Local access and account behavior remain
unchanged. Explicit source requests retain their existing freshness and
availability limits; navigation is not a refresh.

## Acceptance

- Keep all five panels mounted with only the selected panel exposed. Verify
  tab relationships, keyboard wrapping and untouched ordinary/modified links.
- Preserve loaded results and model drafts across sections, Back and reopening
  the same full admitted identity; clear them on changed identity or workspace.
- Ignore stale row, comparison, company-action and delayed-focus callbacks.
  Cover identity changes during pending requests and missing return controls.
- Verify exact research identities from all six origins and off-page comparison
  rows. Confirm navigation performs no provider request or persistence.
- Check desktop and 390px Brave layout, focus after navigation and return,
  long names, source links and hidden-panel keyboard accessibility. Use isolated
  synthetic data for populated scenarios and preserve the owner's real data.

The workspace checkpoint records the actual accepted revision and validation;
this guide describes behavior and does not itself establish release acceptance.
