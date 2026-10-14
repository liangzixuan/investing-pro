# easy-stock review and adoption

Reviewed October 14, 2026 at commit
[`71c0a0a`](https://github.com/jundizhou/easy-stock/tree/71c0a0aebfa6ea641436d4126e85e18db8350273).
This is a useful reference for the research workflow. InvestingPro's full feature
goal remains the product roadmap's benchmark. This review adds research ideas;
it does not establish feature parity or audited financial accuracy.

## What the code supports

The [research types](https://github.com/jundizhou/easy-stock/blob/71c0a0aebfa6ea641436d4126e85e18db8350273/backend/internal/stockanalysis/research_types.go)
separate claims and source references, supporting and opposing evidence,
conditions, invalidation and verification. The
[stage validator](https://github.com/jundizhou/easy-stock/blob/71c0a0aebfa6ea641436d4126e85e18db8350273/backend/internal/stockanalysis/research_stage_validation.go)
checks referenced sources and quoted text. These checks are useful boundaries;
they do not prove the model's judgment correct. The
[reuse module](https://github.com/jundizhou/easy-stock/blob/71c0a0aebfa6ea641436d4126e85e18db8350273/backend/internal/stockanalysis/research_reuse.go)
requires successful, reference-checked reports and measures age from completion,
so viewing a report does not renew its freshness. The
[frontend report model](https://github.com/jundizhou/easy-stock/blob/71c0a0aebfa6ea641436d4126e85e18db8350273/frontend/src/lib/stock-research.ts)
keeps source dates, missing evidence and condition status visible in reports.
This is a source review; upstream tests and live providers were not executed.

## Adoption order

| Idea                                     | Investing Pro application                                                                                            | Delivery boundary                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Thesis, counterevidence and invalidation | An authored thesis review with a preview, added to the current watchlist note                                        | Implemented candidate. Uses explicit whole-draft Save and current note limits; no automatic verdict or monitoring |
| Research purpose and horizon             | Distinguish an observation from a holding review when deeper research is added                                       | Next research layer; no inferred holdings or cost basis                                                           |
| Evidence-linked reports                  | Separate dated source facts, outside opinions and the owner's assessment in reproducible exports                     | Extend M4's admitted Annual, price and filing evidence; verify complete report provenance                         |
| Resume and freshness                     | Resume interrupted research only for matching identity, inputs and model configuration; keep original evidence dates | Extend existing cancellation/reconciliation boundaries when an eligible research runtime exists                   |
| Portfolio inspection                     | Explain concentration, dated returns and benchmark comparisons before proposing changes                              | M4; requires admitted holdings, corporate-action basis and explicit ledger input                                  |
| Daily research review                    | Show the next thesis check alongside relevant filing, earnings and calendar changes                                  | M3/M4; explicit checks first, monitoring requires a separate delivery boundary                                    |
| Multiple research depths                 | A loaded company snapshot brings existing Price and Annual evidence together before deeper research                  | M2 candidate; no automatic read or AI. Verify existing zero-additional-cost model access before AI integration    |

## Implementation and source rights

The thesis review is independently implemented in our managed browser/Android
feature layer. It keeps the original note, appends one labelled assessment and
uses the existing save coordinator. Optional evidence fields have no invented
content. Source links and dates are authored text, not automatically verified
citations. A required invalidation condition and next check make the review
actionable. A stale append cannot replace an intervening note edit. The preview
remains readable while editing is paused. Unadded review fields are temporary and
reset when the editor changes listing or unmounts.

Upstream's [license](https://github.com/jundizhou/easy-stock/blob/71c0a0aebfa6ea641436d4126e85e18db8350273/LICENSE)
uses PolyForm Noncommercial 1.0.0 and requires separate written permission for
commercial use. No upstream code, assets, prompts or dependencies were copied
into this project. A-share-specific formulas, browser article collection and
AI portfolio recommendations are not suitable direct integrations with our
current U.S. data coverage and source permissions. Each new source, model and
calculation needs its own eligibility and verification.
