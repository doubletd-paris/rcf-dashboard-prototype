/* =========================================================================
   DATA — single source for every figure on the dashboard.
   Everything below is PLACEHOLDER sample data seeded from the M&G European
   Property Fund SICAV-FIS quarterly report (31 March 2026). Replace the
   objects in this file with live feeds; no other file needs to change.

   The RCF section keeps its own transaction ledger in assets/rcf.js — it is
   left exactly as it was in the original prototype.
   ========================================================================= */

const DATA = {

  /* ------------------------------------------------------------------
     Reporting stamp shown in the masthead.
     ------------------------------------------------------------------ */
  asOf: {
    label: '31 March 2026',
    quarter: 'Q1 2026',
    fund: 'M&G European Property Fund SICAV-FIS',
  },

  /* ------------------------------------------------------------------
     OVERVIEW — headline KPI cards.
     ------------------------------------------------------------------ */
  overview: {
    kpis: [
      { key:'ltv',      label:'Portfolio LTV',            value:5.4,   unit:'%',   sub:'on property values · 4.59% of GAV', accent:'accent' },
      { key:'wacd',     label:'Wtd-avg cost of debt',     value:2.73,  unit:'%',   sub:'all-in, drawn balances',            accent:'accent-rate' },
      { key:'fixfloat', label:'Fixed vs floating',        value:'6.8 / 93.2', unit:'%', sub:'fixed 3.30% · floating 2.70%' },
      { key:'rating',   label:'Credit rating',            value:'A−',  unit:'',    sub:'stable outlook · indicative' },
      { key:'wam',      label:'Wtd-avg debt maturity',    value:1.6,   unit:'yrs', sub:'1.59 yrs weighted by principal' },
    ],
    totals: {
      grossDebt: 236.6,        // €m drawn across the stack
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
      { label:'Revolving credit facility', value:107.5, color:'--c-amber'  },
      { label:'Secured senior loans',      value:129.1, color:'--c-green'  },
      { label:'Green bond (planned)',      value:0,     color:'--c-teal'   },
      { label:'Bridge-to-bond (planned)',  value:0,     color:'--c-periwinkle' },
    ],
    byLender: [
      { label:'ABN AMRO / BBVA / HSBC / ING (RCF syndicate)', value:107.5, color:'--c-amber'  },
      { label:'Caixabank',                                    value:83.5,  color:'--c-green'  },
      { label:'ING / BayernLB',                               value:29.6,  color:'--c-coral'  },
      { label:'Danske Bank',                                  value:16.1,  color:'--c-teal'   },
    ],
    byCurrency: [
      { label:'EUR — Spain',       value:83.5,  color:'--c-green'      },
      { label:'EUR — Multi (RCF)', value:107.5, color:'--c-amber'      },
      { label:'EUR — Italy',       value:29.6,  color:'--c-coral'      },
      { label:'DKK — Denmark',     value:16.1,  color:'--c-teal'       },
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
      { label:'Green bond (planned)',     color:'--c-teal',       data:[0, 0, 0, 0, 0, 500, 0]      },
      { label:'Bridge-to-bond (planned)', color:'--c-periwinkle', data:[0, 150, 0, 0, 0, 0, 0]      },
    ],
    // dual-axis combo: LTV (left, %) vs weighted-average cost of debt (right, %)
    trend: {
      labels: ['Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26e','Q3 26e','Q4 26e'],
      ltv:  [3.9, 4.2, 4.4, 4.8, 5.4, 6.3, 8.1, 9.4],
      wacd: [3.05, 2.98, 2.90, 2.81, 2.73, 2.78, 3.05, 3.20],
      forecastFrom: 5,   // index at which the series turns into a projection
    },
  },

  /* ------------------------------------------------------------------
     GREEN BOND — debut issuance workstream (all indicative placeholders).
     ------------------------------------------------------------------ */
  greenBond: {
    status: 'In preparation',
    kpis: [
      { label:'Indicative size',        value:500,  unit:'€m',  sub:'benchmark debut issue' },
      { label:'Target tenor',           value:5,    unit:'yrs', sub:'bullet, senior unsecured' },
      { label:'Indicative coupon',      value:3.55, unit:'%',   sub:'mid-swap + 120bps', accent:'accent-rate' },
      { label:'Expected issuance',      value:'Q3 26', unit:'', sub:'subject to market conditions' },
      { label:'Eligible green assets',  value:1.9,  unit:'€bn', sub:'per use-of-proceeds framework' },
    ],
    // indicative pricing build-up, bps
    pricing: [
      { label:'EUR 5Y mid-swap',        value:235, color:'--c-teal'   },
      { label:'Credit spread',          value:105, color:'--c-green'  },
      { label:'New issue premium',      value:15,  color:'--c-amber'  },
    ],
    useOfProceeds: [
      { label:'Green buildings (certified)', value:46, color:'--c-green'  },
      { label:'Energy efficiency retrofit',  value:24, color:'--c-teal'   },
      { label:'Renewable energy on-site',    value:14, color:'--c-amber'  },
      { label:'Clean transport / EV',        value:9,  color:'--c-orchid' },
      { label:'Sustainable water',           value:7,  color:'--c-periwinkle' },
    ],
    // bridge-to-bond: RCF build-up then take-out at issuance (€m)
    bridge: {
      labels: ['Q1 26','Q2 26','Q3 26','Q4 26','Q1 27'],
      rcfDrawn:    [107.5, 210, 340, 140, 165],
      bondOutstanding: [0, 0, 0, 500, 500],
      rcfCommitment: 300,
    },
  },

  /* ------------------------------------------------------------------
     COVENANTS & HEADROOM
     Thresholds are configurable — edit here or via the on-screen controls.
     ------------------------------------------------------------------ */
  covenants: {
    ltv: {
      label:'Loan to value',
      actual:5.4,        // %
      threshold:50,      // covenant ceiling, %
      warning:40,        // amber band starts here, %
      max:60,            // gauge scale
      direction:'max',   // breach when actual > threshold
    },
    icr: {
      label:'Interest cover ratio',
      actual:481,        // %
      threshold:130,     // covenant floor, %
      warning:180,       // amber band below here
      max:600,           // gauge scale
      direction:'min',   // breach when actual < threshold
    },
    facilities: [
      { name:'Market Central Da Vinci', lender:'ING / BayernLB',           ltvCov:40,   ltv:23.97, icrCov:null, icr:null, maturity:'05.08.2026' },
      { name:'Rios Rosas 26',           lender:'Caixabank',                ltvCov:50,   ltv:38.20, icrCov:130,  icr:481,  maturity:'29.09.2026' },
      { name:'Vimmelskaftet 32-34',     lender:'Danske Bank',              ltvCov:null, ltv:74.17, icrCov:null, icr:null, maturity:'01.04.2028' },
      { name:'Revolving credit facility',lender:'ABN AMRO / BBVA / HSBC / ING', ltvCov:65, ltv:5.40, icrCov:150, icr:481, maturity:'16.12.2028' },
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
      { key:'eur_swap_5y', label:'EUR swap 5Y',   value:2.35, unit:'%',   change:0.04  },
      { key:'euribor_3m',  label:'3M EURIBOR',    value:1.95, unit:'%',   change:-0.02 },
      { key:'ecb_depo',    label:'ECB depo rate', value:2.00, unit:'%',   change:0.00  },
      { key:'re_spread',   label:'€ RE credit spread', value:118, unit:'bps', change:-3 },
    ],
  },
};

/* Resolve a `--c-*` token from data into its computed hex value. */
function tone(token){
  if (!token) return '#75C26C';
  if (token[0] !== '-') return token;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#75C26C';
}
