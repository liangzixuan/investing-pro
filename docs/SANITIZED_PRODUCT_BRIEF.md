# Sanitized Sprint 0 product brief

## User need

A self-directed investor needs to understand a company quickly, inspect where each number came from, test transparent valuation assumptions, record a thesis, and define a fact-based monitoring rule.

## Scope

Build one original, responsive research workspace for a fictional U.S. common stock. It must:

1. show a concise company dossier and ten versioned metrics;
2. demonstrate a correction/restatement using an URL-addressable “known at” date;
3. open an evidence passport from every metric;
4. calculate a five-year exit-multiple valuation from editable assumptions;
5. save a non-sensitive thesis locally in the browser;
6. save and evaluate one local metric threshold rule; and
7. disclose that all values are synthetic and hypothetical.

## Out of scope

Real market data, ETFs, portfolios, authentication, billing, external alerts, trading, personalized advice, LLM output, news, economic calendars, exports, mobile apps, and competitor-derived assets or UI structures.

## Original design direction

Use a quiet research-notebook metaphor: warm neutral canvas, ink/navy text, mint evidence accents, coral risk accents, generous whitespace, compact data typography, and a linear “Observe → Value → Commit → Monitor” workflow. Do not use competitor screenshots or UI observations as implementation references.

## Definition of done

- No external data/network dependency after packages are installed.
- Pre- and post-restatement URLs return reproducible different facts.
- A rights-denied synthetic estimate never reaches JSON, HTML, logs, chart data, or tests snapshots.
- Decimal calculations reproduce exactly and show formula/assumption versions.
- Keyboard, focus, contrast, reduced-motion, responsive, and semantic-table paths work.
