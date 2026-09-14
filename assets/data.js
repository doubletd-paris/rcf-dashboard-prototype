/* =========================================================================
   DATA — single source for every figure on the dashboard.

   Live, real terms: DATA.greenBond.terms is the executed Project Langford
   term sheet (EUR 500m 4.000% green notes due 2031, priced 3 Sep 2026).
   Everything else remains PLACEHOLDER sample data, seeded from the M&G
   European Property Fund SICAV-FIS quarterly report (31 March 2026) and
   recomputed to include the new issue. Replace it here; no other file needs
   to change.

   The RCF section keeps its own transaction ledger in assets/rcf.js — it is
   left exactly as it was in the original prototype.
   ========================================================================= */

const DATA = {

  /* ------------------------------------------------------------------
     Reporting stamp shown in the masthead.
     ------------------------------------------------------------------ */
  asOf: {
    label: '10 September 2026',
    quarter: 'Post-issuance',
    fund: 'M&G European Property Fund SICAV-FIS',
  },

  /* ------------------------------------------------------------------
     OVERVIEW — headline KPI cards.
     Aggregates below are computed from the placeholder stack plus the new
     bond: gross debt 236.6 + 500.0 = 736.6, property values 4,381
     (implied by the Q1 report's 5.4% LTV on 236.6), so LTV = 16.8%.
     Weighted-average cost = (236.6 x 2.73 + 500 x 4.00) / 736.6 = 3.59%.
     Fixed = 16.1 (Danske) + 500 (bond) = 516.1, i.e. 70.1% of the stack.
     ------------------------------------------------------------------ */
  overview: {
    kpis: [
      { key:'ltv',      label:'Portfolio LTV',            value:16.8,  unit:'%',   sub:'on property values · post-issuance', accent:'accent' },
      { key:'wacd',     label:'Wtd-avg cost of debt',     value:3.59,  unit:'%',   sub:'all-in, drawn balances',             accent:'accent-rate' },
      { key:'fixfloat', label:'Fixed vs floating',        value:'70.1 / 29.9', unit:'%', sub:'fixed 3.98% · floating 2.70%' },
      { key:'rating',   label:'Credit rating',            value:'A−',  unit:'',    sub:'stable outlook · Fitch' },
      { key:'wam',      label:'Wtd-avg debt maturity',    value:3.8,   unit:'yrs', sub:'extended by the 2031 issue' },
    ],
    totals: {
      grossDebt: 736.6,        // €m drawn across the stack
      propertyValues: 4381,    // €m, the LTV denominator
      gav: 5200,               // €m gross asset value
      nav: 4400,               // €m net asset value
      undrawnCommitted: 227.5, // €m undrawn RCF commitment
    },
  },

  /* ------------------------------------------------------------------
     DEBT MIX — three donuts. Values are €m of drawn principal.
     ------------------------------------------------------------------ */
  debtMix: {
    byInstrument: [
      { label:'Green bond 4.000% 2031',    value:500.0, color:'--c-teal'   },
      { label:'Revolving credit facility', value:107.5, color:'--c-amber'  },
      { label:'Secured senior loans',      value:129.1, color:'--c-green'  },
      { label:'Bridge-to-bond (planned)',  value:0,     color:'--c-periwinkle' },
    ],
    byLender: [
      { label:'Bondholders (Reg S, listed)',                  value:500.0, color:'--c-teal'   },
      { label:'ABN AMRO / BBVA / HSBC / ING (RCF syndicate)',  value:107.5, color:'--c-amber'  },
      { label:'Caixabank',                                     value:83.5,  color:'--c-green'  },
      { label:'ING / BayernLB',                                value:29.6,  color:'--c-coral'  },
      { label:'Danske Bank',                                   value:16.1,  color:'--c-orchid' },
    ],
    byCurrency: [
      { label:'EUR — Luxembourg (bond)', value:500.0, color:'--c-teal'   },
      { label:'EUR — Multi (RCF)',       value:107.5, color:'--c-amber'  },
      { label:'EUR — Spain',             value:83.5,  color:'--c-green'  },
      { label:'EUR — Italy',             value:29.6,  color:'--c-coral'  },
      { label:'DKK — Denmark',           value:16.1,  color:'--c-orchid' },
    ],
  },

  /* ------------------------------------------------------------------
     MATURITY PROFILE
     ------------------------------------------------------------------ */
  maturity: {
    years: ['2026','2027','2028','2029','2030','2031','2032'],
    // one series per instrument type, €m repayable in each year
    series: [
      { label:'Secured senior loans',     color:'--c-green',      data:[113.1, 0, 16.1, 0, 0, 0, 0] },
      { label:'Revolving credit facility',color:'--c-amber',      data:[0, 0, 107.5, 0, 0, 0, 0]    },
      { label:'Green bond 4.000% 2031',   color:'--c-teal',       data:[0, 0, 0, 0, 0, 500, 0]      },
      { label:'Bridge-to-bond (planned)', color:'--c-periwinkle', data:[0, 0, 0, 0, 0, 0, 0]        },
    ],
    // dual-axis combo: LTV (left, %) vs weighted-average cost of debt (right, %)
    trend: {
      labels: ['Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26','Q4 26e'],
      ltv:  [3.9, 4.2, 4.4, 4.8, 5.4, 6.3, 16.8, 17.2],
      wacd: [3.05, 2.98, 2.90, 2.81, 2.73, 2.78, 3.59, 3.62],
      forecastFrom: 7,   // index at which the series turns into a projection
    },
  },

  /* ------------------------------------------------------------------
     GREEN BOND — Project Langford. The `terms` block is the executed term
     sheet and is factual. Everything under `secondary` is placeholder
     monitoring data until a price feed is connected.
     ------------------------------------------------------------------ */
  greenBond: {
    status: 'Issued — settled 10 September 2026',

    /* --- executed terms, from the final term sheet (v4) --------------- */
    terms: {
      name: 'M&G European Property Fund SICAV-FIS 4.000% Green Notes due 2031',
      isin: 'XS3498808651',
      commonCode: '349880865',
      issuer: 'M&G European Property Fund SICAV-FIS',
      issuerLei: '549300FLN5QWVQGRGQ35',
      issuerRating: 'A− stable (Fitch)',
      issueRating: 'A (Fitch)',
      format: 'Reg S Bearer, New Global Note',
      status: 'Senior Unsecured, Green',
      currency: 'EUR',
      size: 500,                       // €m
      pricingDate: '3 September 2026',
      settlementDate: '10 September 2026 (T+5)',
      maturityDate: '10 September 2031',
      coupon: 4.000,                   // %
      couponBasis: 'Fixed, annual in arrear on 10 September, from 2027',
      reofferYield: 4.233,             // %
      midSwapRef: 3.233,               // %
      spreadToMs: 100,                 // bp
      benchmark: 'DBR 0% 08/15/2031 (DE0001102564)',
      benchmarkPrice: 86.186,          // %
      benchmarkYield: 3.057,           // %
      spreadToBenchmark: 117.6,        // bp
      issuePrice: 98.969,              // %
      redemptionPrice: 100,            // %
      grossProceeds: 494.845,          // €m
      baseFees: 0.30,                  // %
      discretionaryFees: 0.05,         // %
      allInPrice: 98.669,              // %
      netProceeds: 493.345,            // €m, excluding discretionary fee
      bookrunners: 'ABN AMRO, BBVA, HSBC, ING',
      billingDelivery: 'ING',
      principalPayingAgent: 'HSBC Bank plc',
      governingLaw: 'English Law',
      clearing: 'Euroclear / Clearstream Luxembourg',
      paymentBusinessDays: 'T2',
      dayCount: 'Actual/Actual (ICMA) · Following, unadjusted',
      listing: 'Global Exchange Market, Euronext Dublin',
      programme: '€3,000,000,000 EMTN Programme · Base Listing Particulars 26 August 2026',
      denominations: 'EUR 100,000 + EUR 1,000 increments',
      earlyRedemption: '3-month par call · make-whole (B+20bp) · clean-up call (75%) · tax call',
      changeOfControl: 'Put at 100% of principal plus accrued interest',
      useOfProceeds: 'Financing / refinancing Eligible Green Projects under the Green Finance Framework',
      secondPartyOpinion: 'Sustainable Fitch, 26 August 2026',
      sellingRestrictions: 'Reg S Cat 2 · TEFRA D',
      targetMarket: 'Eligible counterparties and professional clients only (MiFID II)',
    },

    /* --- mark-to-market inputs ------------------------------------------
       The Fund NAV carries the notes at full fair value; the IFRS NAV keeps
       them at amortised cost. Only the four values below need touching.

       netProceeds is the ALL-IN figure from the Pricing Supplement
       (EUR 493,095,000) — gross 494.845 less both the 0.30% base fee and
       the 0.05% discretionary fee. terms.netProceeds above is 493.345,
       which excludes the discretionary fee; the bridge uses the all-in
       number because that is the cash the fund actually received.
       -------------------------------------------------------------------- */
    mtm: {
      yieldPct: 4.500,                       // current yield to maturity, %
      valuationDate: '2026-09-14',
      netProceeds: 493.095,                  // €m, all-in cash received
      interestCommencement: '2026-09-10',
      maturity: '2031-09-10',
      sensitivity: [4.233, 4.250, 4.500, 4.750, 5.000],
      valuer: 'IHS Markit, quarterly, bid-side composite',
    },

    /* --- TradingView embeds -----------------------------------------------
       `symbol` values are passed straight to the TradingView advanced-chart
       widget. TradingView addresses instruments as EXCHANGE:TICKER — a raw
       ISIN usually does NOT resolve, so if a panel shows "invalid symbol",
       search the instrument on TradingView and paste its symbol here. The
       `layoutUrl` links open the saved chart layouts as-is; saved layouts
       cannot be embedded in an iframe, which is why the widget is used for
       the in-page chart and the link is offered alongside it.
       -------------------------------------------------------------------- */
    tradingView: {
      primary: {
        symbol: 'XS3498808651',
        title: 'Langford 4.000% 2031',
        layoutUrl: 'https://www.tradingview.com/chart/UEOcSm90/?symbol=XS3498808651',
      },
      comparison: {
        symbol: 'XS3498808651',
        compareSymbols: [],       // e.g. [{ symbol: 'XS2XXXXXXXXX', position: 'SameScale' }]
        peerLabel: 'Hines EUR benchmark (July 2026)',
        title: 'Langford vs Hines comparable',
        layoutUrl: 'https://www.tradingview.com/chart/UEOcSm90/',
      },
      interval: 'D',
      theme: 'light',
    },

    /* --- secondary monitoring: PLACEHOLDER until a feed is connected --- */
    secondary: {
      asOf: '10 September 2026 close',
      source: 'Placeholder (assets/data.js)',
      price: 99.15,              // % of par
      yield: 4.19,               // %
      zSpread: 96,               // bp
      spreadVsReoffer: -4,       // bp vs the +100bp re-offer spread
      priceVsReoffer: 0.181,     // points vs the 98.969 issue price
      // daily marks since pricing — Langford against the Hines comparable
      history: {
        labels: ['3 Sep','4 Sep','7 Sep','8 Sep','9 Sep','10 Sep'],
        langfordSpread: [100, 99, 98, 97, 97, 96],
        peerSpread:     [104, 103, 103, 102, 101, 101],
        langfordPrice:  [98.969, 99.02, 99.06, 99.11, 99.12, 99.15],
      },
    },

    /* --- use of proceeds allocation (placeholder split) ---------------- */
    useOfProceeds: [
      { label:'Green buildings (certified)', value:46, color:'--c-green'  },
      { label:'Energy efficiency retrofit',  value:24, color:'--c-teal'   },
      { label:'Renewable energy on-site',    value:14, color:'--c-amber'  },
      { label:'Clean transport / EV',        value:9,  color:'--c-orchid' },
      { label:'Sustainable water',           value:7,  color:'--c-periwinkle' },
    ],

    /* --- pricing build-up, as executed (bp) --------------------------- */
    pricing: [
      { label:'EUR 5Y mid-swap (3.233%)', value:323, color:'--c-teal'  },
      { label:'Spread to mid-swaps',      value:100, color:'--c-green' },
    ],

    /* --- bridge-to-bond: RCF build-up then take-out (placeholder) ------ */
    bridge: {
      labels: ['Q1 26','Q2 26','Q3 26','Q4 26e','Q1 27e'],
      rcfDrawn:    [107.5, 210, 340, 140, 165],
      bondOutstanding: [0, 0, 500, 500, 500],
      rcfCommitment: 300,
    },
  },

  /* ------------------------------------------------------------------
     COVENANTS & HEADROOM
     Fund-level thresholds are configurable on screen. The bond incurrence
     tests below are the financial covenants in the Langford term sheet.
     ------------------------------------------------------------------ */
  covenants: {
    ltv: {
      label:'Loan to value',
      actual:16.8,       // %
      threshold:50,      // covenant ceiling, %
      warning:40,        // amber band starts here, %
      max:60,            // gauge scale
      direction:'max',   // breach when actual > threshold
    },
    icr: {
      label:'Interest cover ratio',
      actual:340,        // %
      threshold:130,     // covenant floor, %
      warning:180,       // amber band below here
      max:600,           // gauge scale
      direction:'min',   // breach when actual < threshold
    },
    facilities: [
      { name:'Market Central Da Vinci', lender:'ING / BayernLB',           ltvCov:40,   ltv:23.97, icrCov:null, icr:null, maturity:'05.08.2026' },
      { name:'Rios Rosas 26',           lender:'Caixabank',                ltvCov:50,   ltv:38.20, icrCov:130,  icr:481,  maturity:'29.09.2026' },
      { name:'Vimmelskaftet 32-34',     lender:'Danske Bank',              ltvCov:null, ltv:74.17, icrCov:null, icr:null, maturity:'01.04.2028' },
      { name:'Revolving credit facility',lender:'ABN AMRO / BBVA / HSBC / ING', ltvCov:65, ltv:16.80, icrCov:150, icr:340, maturity:'16.12.2028' },
    ],

    /* Incurrence tests from the Langford term sheet. Tested pro forma on
       the incurrence of additional debt, not maintenance-tested. Actuals
       are placeholders until the reporting pack is wired in. */
    bondIncurrence: [
      { test:'Debt to total assets',                    actual:0.142, threshold:0.60, direction:'max', unit:'x' },
      { test:'Secured debt to total assets',            actual:0.025, threshold:0.40, direction:'max', unit:'x' },
      { test:'Fixed charge coverage ratio',             actual:3.40,  threshold:1.50, direction:'min', unit:'x' },
      { test:'Unencumbered assets to unsecured debt',   actual:2.15,  threshold:1.50, direction:'min', unit:'x' },
    ],
  },

  /* ------------------------------------------------------------------
     LIVE MARKET DATA — fallback only.
     The dashboard first asks app.py (GET /api/market-data). These values
     are used when that endpoint is unavailable (e.g. a static deployment),
     so the layout never renders empty.
     ------------------------------------------------------------------ */
  marketFallback: {
    source: 'Static fallback (assets/data.js)',
    delayed: true,
    asOf: null,          // filled in at render time when null
    rates: [
      { key:'eur_swap_5y', label:'EUR swap 5Y',   value:3.15, unit:'%',   change:0.02  },
      { key:'euribor_3m',  label:'3M EURIBOR',    value:1.95, unit:'%',   change:-0.02 },
      { key:'ecb_depo',    label:'ECB depo rate', value:2.00, unit:'%',   change:0.00  },
      { key:'langford_z',  label:'Langford Z-spread', value:96, unit:'bps', change:-1 },
    ],
  },

  /* ------------------------------------------------------------------
     EURO MARKET DASHBOARD — fallback only, same swappable source.
     `dir` sets the colour convention per section:
       'rates'  — a rise is a cost, so up is red and down is green
       'risk'   — same as rates (spreads widening is bad)
       'assets' — up is green and down is red (commodities, equities)
     ------------------------------------------------------------------ */
  marketBoard: {
    source: 'Static fallback (assets/data.js)',
    delayed: true,
    asOf: null,
    sections: [
      { name:'Govvies', unit:'bp', dir:'rates', rows:[
        { label:'UKT 5-year',  today:'4.60%', dod:3, wow:2,  ytd:55 },
        { label:'Bund 5-year', today:'3.00%', dod:2, wow:2,  ytd:56 },
        { label:'UST 5-year',  today:'4.40%', dod:0, wow:-2, ytd:68 },
      ]},
      { name:'EUR Midswaps', unit:'bp', dir:'rates', rows:[
        { label:'MS 3-year',  today:'3.11%', dod:2, wow:3, ytd:73 },
        { label:'MS 5-year',  today:'3.15%', dod:2, wow:3, ytd:58 },
        { label:'MS 6-year',  today:'3.18%', dod:2, wow:3, ytd:52 },
        { label:'MS 7-year',  today:'3.21%', dod:2, wow:3, ytd:47 },
        { label:'MS 10-year', today:'3.31%', dod:2, wow:3, ytd:38 },
      ]},
      { name:'Credit Indices', unit:'bp', dir:'risk', rows:[
        { label:'iTraxx Main (bps)',  today:'51',  dod:0, wow:-1, ytd:0 },
        { label:'iTraxx Xover (bps)', today:'247', dod:0, wow:-4, ytd:3 },
      ]},
      { name:'Fund Credit', unit:'bp', dir:'risk', rows:[
        { label:'Langford 4.000% 2031 Z-spread', today:'96',  dod:-1, wow:-4, ytd:null },
        { label:'Hines comparable Z-spread',     today:'101', dod:0,  wow:-3, ytd:null },
      ]},
      { name:'Commodities', unit:'%', dir:'assets', rows:[
        { label:'Brent', today:'90', dod:-0.2, wow:-5.1, ytd:47.2 },
        { label:'WTI',   today:'83', dod:-0.6, wow:-4.7, ytd:44.5 },
      ]},
      { name:'Equities', unit:'%', dir:'assets', rows:[
        { label:'FTSE 100',   today:'10,816', dod:0.2, wow:0.0, ytd:8.9 },
        { label:'EUROSTOXX',  today:'6,473',  dod:0.8, wow:0.2, ytd:11.8 },
        { label:'S&P',        today:'7,731',  dod:0.7, wow:1.2, ytd:12.9 },
      ]},
    ],
  },
};

/* Resolve a `--c-*` token from data into its computed hex value. */
function tone(token){
  if (!token) return '#75C26C';
  if (token[0] !== '-') return token;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#75C26C';
}
