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
| **Green Bond** | Debut issuance placeholders: pricing build-up, use of proceeds, bridge-to-bond path | `DATA.greenBond` |
| **Covenants & Headroom** | LTV and ICR gauges against configurable thresholds, facility-level headroom table | `DATA.covenants` |

Everything outside the RCF tab is **placeholder sample data**, seeded from the
Q1 2026 report so the charts look realistic. Replace it in `assets/data.js`.

## Files

```
index.html          markup for all six sections; no logic
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

The "Live market data" panel reads one endpoint, `GET /api/market-data`, served
by `get_market_data()` in `app.py`. That function is the only thing to change:
point it at the internal feed (or set `MARKET_DATA_SOURCE=internal` and fill in
the branch) and keep the response shape:

```json
{
  "source": "M&G market data (internal)",
  "delayed": false,
  "asOf": "2026-03-31T17:00:00Z",
  "rates": [
    {"key": "eur_swap_5y", "label": "EUR swap 5Y", "value": 2.35, "unit": "%", "change": 0.04}
  ]
}
```

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
