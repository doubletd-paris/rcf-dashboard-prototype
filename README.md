# Fund debt stack — dashboard prototype

Internal treasury prototype for the M&G European Property Fund SICAV-FIS debt
stack. What was a single-page RCF utilisation view is now a tabbed application
covering the whole stack, styled to the M&G corporate visual system taken from
the quarterly report (31 March 2026).

## Sections

| Tab | What it shows | Data source |
| --- | --- | --- |
| **Overview** | KPI row (portfolio LTV, weighted-average cost of debt, fixed vs floating, credit rating, weighted-average maturity) and the live market data panel | `DATA.overview` · `app.py` |
| **Debt Mix** | Donuts by instrument type, by lender, by currency and jurisdiction | `DATA.debtMix` |
| **Maturity Profile** | Stacked bar of maturities by year and instrument, dual-axis LTV vs cost of debt, maturity ladder table | `DATA.maturity` |
| **RCF** | The original RCF prototype — ledger, capacity bar, balance and rate charts — unchanged | `assets/rcf.js` |
| **Green Bond** | Project Langford monitoring: executed term sheet, TradingView charts, spread since pricing, fund NAV and IFRS NAV mark-to-market | `DATA.greenBond` · `app.py` |
| **Covenants & Headroom** | LTV and ICR gauges against configurable thresholds, facility-level headroom, bond incurrence tests | `DATA.covenants` |
| **Market Dashboard** | Govvies, midswaps, credit indices, fund credit, commodities and equities with DoD / WoW / YTD moves | `app.py` · `DATA.marketBoard` |

`DATA.greenBond.terms` holds the **executed** Project Langford term sheet and is
factual. Everything else is **placeholder sample data**, seeded from the Q1 2026
report and recomputed to include the new issue. Replace it in `assets/data.js`.

### Green bond monitoring

The Green Bond tab is the monitoring view for the EUR 500m 4.000% green notes
due 2031 (ISIN XS3498808651, priced 3 September 2026).

TradingView is embedded through its **advanced-chart widget**, configured in
`DATA.greenBond.tradingView`. Two things to know:

- A saved TradingView layout (`tradingview.com/chart/<id>/`) **cannot be put in
  an iframe** — it needs a logged-in session and the site refuses to be framed.
  So the in-page chart uses the widget, and the saved layout is offered as an
  "Open in TradingView" link beside it.
- The widget resolves instruments as `EXCHANGE:TICKER`. A raw ISIN usually does
  **not** resolve. If a panel reports an unknown symbol, search the bond on
  TradingView, copy the symbol it shows, and paste it into
  `DATA.greenBond.tradingView.primary.symbol`. For the Hines overlay, add the
  peer to `comparison.compareSymbols` as
  `[{ symbol: "EXCHANGE:TICKER", position: "SameScale" }]`.

If the widget cannot load — blocked script or unknown symbol — the panel shows a
fallback card with the TradingView link rather than an empty box. The
Chart.js "spread since pricing" panel below it does not depend on TradingView.

**A live price cannot be read out of TradingView.** The widget is a
cross-origin iframe, so the page cannot reach into it. Live secondary levels
arrive through `get_market_data()` in `app.py` instead, in a `bond` block:
they fill the levels strip, the spread chart, and seed the default yield on
the mark-to-market section (a yield the user types always wins).

### Mark-to-market

`assets/mtm.js` prices the notes from a yield on Actual/Actual (ICMA) and
shows both carrying bases:

- **Fund NAV**, at fair value: cash raised less the dirty market value, with
  issue costs expensed on day one.
- **IFRS NAV**, at amortised cost: the effective interest rate is solved from
  the term sheet (the rate discounting the contractual flows to the net
  proceeds, 4.313%), giving the carrying amount, the unamortised issue costs
  and discount still on the balance sheet, and the P&L split between cash
  coupon and amortisation.

The pricer is validated against the deal itself: at the 4.233% re-offer yield
on the settlement date it returns a clean price of 98.9695 against the term
sheet's 98.969% issue price.

## Files

```
index.html          markup for all seven sections; no logic
app.py              Flask server + the market data hook (get_market_data)
assets/mg.css       M&G design system — palette, typography, components
assets/fonts.css    embedded webfont faces
assets/chart.umd.js Chart.js v4.4.1 (bundled, MIT)
assets/data.js      ALL placeholder figures — the file to edit
assets/charts.js    Chart.js theme and the chart builders
assets/rcf.js       the original RCF logic, carried over unchanged
assets/app.js       tab navigation and the section renderers
```

## Running it

```bash
pip install -r requirements.txt
python app.py            # http://localhost:8000
```

The front end is static, so opening `index.html` directly also works — the
market panel then falls back to `DATA.marketFallback` in `assets/data.js`.

## Connecting the market data feed

The Overview panel and the Market Dashboard tab both read one endpoint,
`GET /api/market-data`, served by `get_market_data()` in `app.py`. That
function is the only thing to change:
point it at the internal feed (or set `MARKET_DATA_SOURCE=internal` and fill in
the branch) and keep the response shape:

```json
{
  "source": "M&G market data (internal)",
  "delayed": false,
  "asOf": "2026-03-31T17:00:00Z",
  "rates": [
    {"key": "eur_swap_5y", "label": "EUR swap 5Y", "value": 3.15, "unit": "%", "change": 0.02}
  ],
  "board": [
    {"name": "Govvies", "unit": "bp", "dir": "rates", "rows": [
      {"label": "Bund 5-year", "today": "3.00%", "dod": 2, "wow": 2, "ytd": 56}
    ]}
  ]
}
```

`rates` feeds the Overview strip; `board` feeds the Market Dashboard. Each board
section sets `dir`, which picks the colour convention: `rates` and `risk` read as
a cost, so a rise shows red; `assets` reads as performance, so a rise shows
green.

The panel renders whatever rates it is given, in order, with no front-end
change. `delayed: true` keeps the amber **"Indicative, delayed data"** badge;
`delayed: false` switches it to a green "Live feed" badge. The source name and
timestamp are always shown in the caption beneath the panel.

## House style

Colours and type are sampled from the quarterly report: teal `#0C5C60` for copy,
green `#75C26C` for headings, rules and the primary data series, then coral
`#EB8175`, teal `#00B5AF`, amber `#FDB71E`, orchid `#E28ABA` and periwinkle
`#7377B8` for additional series. The report is set in Infra; the web build falls
back to Inter, which is close in structure, with tabular figures throughout.
All tokens live in `:root` in `assets/mg.css` — chart colours are read from
those variables, so restyling happens in one place.

## Adding a section

1. Add the markup as a `<section class="view" id="view-<name>">` block in `index.html`.
2. Add a `<button class="tab" data-section="<name>">` to the tab bar.
3. Add `<name>` to `SECTIONS` in `assets/app.js`, and build its charts in `buildSection()`.

Charts are built the first time a section is opened and resized when it becomes
visible, so hidden canvases never size to zero.
