/* =========================================================================
   MARK-TO-MARKET — Langford green bond, fund NAV and IFRS NAV.

   The fund NAV carries the notes at full fair value; the IFRS NAV carries
   them at amortised cost under the effective interest method. This section
   shows both and the bridge between them:

     fund NAV   — cash raised less the dirty fair value of the liability
     IFRS NAV   — cash raised less the amortised cost carrying amount
     difference — fair value against carrying amount at the valuation date

   Issue costs are expensed on day one in a fair-value NAV; under IFRS they
   are capitalised into the initial carrying amount and released to P&L over
   the life of the notes through the effective interest rate.

   Inputs live in DATA.greenBond.mtm; everything else is derived from the
   executed term sheet in DATA.greenBond.terms.
   ========================================================================= */

const MTM = (() => {
  const DAY = 86400000;

  /* ---------- date helpers (all UTC, no timezone drift) ---------- */
  const parseISO = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDate = ms => {
    const d = new Date(ms);
    return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  /* ---------- coupon schedule ----------------------------------------
     Annual coupons stepped back from maturity to the interest commencement
     date. Returns period boundaries: [accrual start, c1, c2, ... maturity].
     ------------------------------------------------------------------- */
  function schedule(startMs, maturityMs){
    const out = [];
    const m = new Date(maturityMs);
    let y = m.getUTCFullYear();
    for (;;){
      const t = Date.UTC(y, m.getUTCMonth(), m.getUTCDate());
      if (t <= startMs) break;
      out.unshift(t);
      y -= 1;
    }
    return [startMs, ...out];
  }

  /* ---------- price from yield, Actual/Actual (ICMA), annual ---------- */
  function priceAt(yieldPct, settleMs, bounds, couponPct){
    const y = yieldPct / 100;
    let i = 0;
    while (i < bounds.length - 2 && settleMs >= bounds[i + 1]) i++;

    const periodDays = (bounds[i + 1] - bounds[i]) / DAY;
    const f = (bounds[i + 1] - settleMs) / DAY / periodDays;   // fraction of period to next coupon
    const n = bounds.length - 1 - i;                           // coupons remaining

    let dirty = 0;
    for (let k = 0; k < n; k++){
      const cf = couponPct + (k === n - 1 ? 100 : 0);
      dirty += cf / Math.pow(1 + y, f + k);
    }
    const accruedDays = (settleMs - bounds[i]) / DAY;
    const accrued = couponPct * accruedDays / periodDays;
    return { dirty, accrued, clean: dirty - accrued, accruedDays, couponsPaid: i };
  }

  /* ---------- config, resolved once per call ---------- */
  function ctx(){
    const t = DATA.greenBond.terms;
    const cfg = DATA.greenBond.mtm;
    const start = parseISO(cfg.interestCommencement);
    return { t, cfg, start, bounds: schedule(start, parseISO(cfg.maturity)) };
  }

  /* ---------- effective interest rate --------------------------------
     The rate that discounts the contractual cash flows back to the cash
     actually received, net of every issue cost. Solved by bisection; the
     pricer is monotonic in yield so this always converges.
     ------------------------------------------------------------------- */
  function eir(){
    const { t, cfg, start, bounds } = ctx();
    const target = cfg.netProceeds / t.size * 100;      // initial carrying amount, as a price
    let lo = 0.01, hi = 30;
    for (let i = 0; i < 200; i++){
      const mid = (lo + hi) / 2;
      if (priceAt(mid, start, bounds, t.coupon).clean > target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- amortised cost at a date -------------------------------
     Carrying amount under the effective interest method, plus the P&L
     split between cash coupon and the amortisation of issue costs and
     issue discount.
     ------------------------------------------------------------------- */
  function amortised(settleMs, eirPct){
    const { t, cfg, bounds } = ctx();
    const r = eirPct === undefined ? eir() : eirPct;
    const p = priceAt(r, settleMs, bounds, t.coupon);

    const carryClean = p.clean * t.size / 100;
    const carryAccrued = p.accrued * t.size / 100;
    const carryDirty = p.dirty * t.size / 100;

    const couponsPaid = p.couponsPaid * t.coupon * t.size / 100;
    const interestToDate = carryDirty - cfg.netProceeds + couponsPaid;   // P&L charge since issue
    const cashCouponToDate = couponsPaid + carryAccrued;
    const amortisationToDate = interestToDate - cashCouponToDate;

    return {
      eir: r, px: p, carryClean, carryAccrued, carryDirty, couponsPaid,
      interestToDate, cashCouponToDate, amortisationToDate,
      unamortised: t.size - carryClean,      // issue costs + discount still to release
      totalToAmortise: t.size - cfg.netProceeds,
    };
  }

  /* ---------- yield implied by a clean price -------------------------
     The pricer is monotonic in yield, so the inverse is a bisection. Used
     when the feed carries a price but no yield.
     ------------------------------------------------------------------- */
  function yieldFromPrice(cleanPrice, settleMs){
    const { t, bounds } = ctx();
    let lo = 0.01, hi = 40;
    for (let i = 0; i < 200; i++){
      const mid = (lo + hi) / 2;
      if (priceAt(mid, settleMs, bounds, t.coupon).clean > cleanPrice) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- P&L interest expense between two dates -------------------
     The increase in the liability plus any cash paid, split between the
     cash coupon and the amortisation of issue costs and issue discount.
     ------------------------------------------------------------------- */
  function expenseBetween(aMs, bMs){
    const r = eir();
    const A = amortised(aMs, r), B = amortised(bMs, r);
    const liabA = A.carryDirty + A.couponsPaid;
    const liabB = B.carryDirty + B.couponsPaid;
    const expense = liabB - liabA;
    const coupon = (B.carryAccrued + B.couponsPaid) - (A.carryAccrued + A.couponsPaid);
    return { expense, coupon, amortisation: expense - coupon, from: aMs, to: bMs };
  }

  /* ---------- annual P&L charge, one row per coupon period ---------- */
  function annualExpense(){
    const { bounds } = ctx();
    const out = [];
    for (let i = 0; i < bounds.length - 1; i++){
      const e = expenseBetween(bounds[i], bounds[i + 1]);
      out.push({ label: String(new Date(bounds[i + 1]).getUTCFullYear()), ...e });
    }
    return out;
  }

  /* ---------- amortisation schedule, one row per coupon period ---------- */
  function amortisationSchedule(){
    const { bounds } = ctx();
    const r = eir();
    return bounds.map(ms => {
      const a = amortised(ms, r);
      return { ms, label: String(new Date(ms).getUTCFullYear()), unamortised: a.unamortised, carrying: a.carryClean };
    });
  }

  /* ---------- the full bridge ----------------------------------------
     Sign convention: a POSITIVE NAV impact adds to NAV. The notes are a
     liability, so a fall in their value is a gain.
     ------------------------------------------------------------------- */
  function bridge(yieldPct, settleMs){
    const { t, cfg, start, bounds } = ctx();
    const p = priceAt(yieldPct, settleMs, bounds, t.coupon);

    const gross = t.size * t.issuePrice / 100;          // liability recognised at issue
    const net = cfg.netProceeds;                        // cash actually received
    const issueCost = gross - net;

    const cleanVal = p.clean * t.size / 100;
    const accVal = p.accrued * t.size / 100;
    const dirtyVal = p.dirty * t.size / 100;
    const couponsPaid = p.couponsPaid * t.coupon * t.size / 100;

    const market = gross - cleanVal;                    // the market move
    const nav = net - dirtyVal - couponsPaid;           // what fund NAV actually sees

    const am = amortised(settleMs);
    const ifrsNav = -am.interestToDate;                 // P&L charge since issue
    const navGap = am.carryDirty - dirtyVal;            // amortised cost less fair value

    return {
      px: p, bounds, settleMs, yieldPct,
      gross, net, issueCost, cleanVal, accVal, dirtyVal, couponsPaid,
      market, accrued: accVal, nav, am, ifrsNav, navGap,

      /* the same period on the IFRS basis: issue costs and the issue
         discount are released over the life, so this block moves with the
         valuation date rather than landing in full on day one */
      pnlSteps: [
        { key:'amort', label:'Costs & discount', sub:'amortised to date', value:-am.amortisationToDate, kind:'delta',
          note:`€${am.amortisationToDate.toFixed(3)}m of the €${am.totalToAmortise.toFixed(3)}m raised at issue has been released to P&L; €${am.unamortised.toFixed(3)}m is still carried on the balance sheet.` },
        { key:'coupon', label:'Coupon', sub:'accrued and paid', value:-am.cashCouponToDate, kind:'delta',
          note:`${t.coupon.toFixed(3)}% on ${t.dayCount.split('·')[0].trim()}${am.couponsPaid ? `, including €${am.couponsPaid.toFixed(3)}m paid` : ''}.` },
        { key:'expense', label:'Interest expense', sub:'since issue', value:-am.interestToDate, kind:'total',
          note:`Effective interest at ${am.eir.toFixed(3)}% on the carrying amount.` },
      ],

      steps: [
        { key:'cost',   label:'Issue costs',       sub:'expensed day one', value:-issueCost, kind:'delta',
          note:`Gross issue value €${gross.toFixed(3)}m less net proceeds €${net.toFixed(3)}m. A fair-value NAV does not capitalise these, so they land in full on day one.` },
        { key:'market', label:'Market movement',   sub:'clean price',      value:market,     kind:'delta',
          note:`Liability repriced from the ${t.issuePrice}% issue price to ${p.clean.toFixed(3)}%.` },
        { key:'accrual',label:'Accrued coupon',    sub:`${Math.round(p.accruedDays)} days`, value:-accVal - couponsPaid, kind:'delta',
          note:`${t.coupon.toFixed(3)}% on ${t.dayCount.split('·')[0].trim()} since ${fmtDate(start)}${couponsPaid ? `, including €${couponsPaid.toFixed(3)}m of coupons paid` : ''}.` },
        { key:'nav',    label:'Net NAV movement',  sub:'since issue',      value:nav,        kind:'total',
          note:`Net proceeds €${net.toFixed(3)}m less the dirty liability of €${dirtyVal.toFixed(3)}m${couponsPaid ? ` and €${couponsPaid.toFixed(3)}m of coupons paid` : ''}.` },
      ],
    };
  }

  return { bridge, priceAt, schedule, parseISO, fmtDate, eir, amortised, amortisationSchedule,
           yieldFromPrice, expenseBetween, annualExpense, ctx };
})();


/* =========================================================================
   Charts — waterfall and amortisation schedule.

   Both update in place rather than being destroyed and rebuilt, so dragging
   the yield slider does not churn through a Chart.js instance per event.
   ========================================================================= */

const MTM_COLOR = { gain:'#4FA254', loss:'#B4552F', total:'#0C5C60' };

/* Signed value labels sit on every bar, which is also what makes the
   green/orange pair safe for colour-vision-deficient readers. The whole
   plugin is guarded: a throw inside a draw hook would stop Chart.js's
   shared animation loop and blank every chart on the page. */
const mtmLabels = {
  id: 'mtmLabels',
  beforeDatasetsDraw(chart){
    try {
      const bars = chart.getDatasetMeta(0).data;
      const steps = chart.data.datasets[0].steps;
      if (!steps || bars.length < 2) return;
      const { ctx } = chart;
      ctx.save();
      ctx.strokeStyle = '#8AA3A5';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (let i = 1; i < bars.length; i++){
        const prev = bars[i - 1], cur = bars[i];
        if (!prev || !cur || !isFinite(prev.y) || !isFinite(prev.base)) continue;
        const y = steps[i - 1].value >= 0 ? Math.min(prev.y, prev.base) : Math.max(prev.y, prev.base);
        ctx.beginPath();
        ctx.moveTo(prev.x + prev.width / 2, y);
        ctx.lineTo(cur.x - cur.width / 2, y);
        ctx.stroke();
      }
      ctx.restore();
    } catch (e) { /* never let a label break the render loop */ }
  },
  afterDatasetsDraw(chart){
    try {
      const meta = chart.getDatasetMeta(0);
      const steps = chart.data.datasets[0].steps;
      if (!steps) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = "600 12px 'Inter','Infra',system-ui,sans-serif";
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i) => {
        const s = steps[i];
        if (!s || !isFinite(bar.y) || !isFinite(bar.base)) return;
        const up = s.value >= 0;
        ctx.fillStyle = s.kind === 'total' ? MTM_COLOR.total : (up ? MTM_COLOR.gain : MTM_COLOR.loss);
        ctx.textBaseline = up ? 'bottom' : 'top';
        const y = up ? Math.min(bar.y, bar.base) - 6 : Math.max(bar.y, bar.base) + 6;
        ctx.fillText((s.value >= 0 ? '+' : '−') + Math.abs(s.value).toFixed(2), bar.x, y);
      });
      ctx.restore();
    } catch (e) { /* as above */ }
  },
};

function mtmBars(steps){
  let run = 0;
  return steps.map(s => {
    const from = s.kind === 'total' ? 0 : run;
    const to   = s.kind === 'total' ? s.value : run + s.value;
    if (s.kind !== 'total') run = to;
    return [from, to];
  });
}

function buildMtmChart(id, steps, axisTitle){
  const el = document.getElementById(id);
  if (!el) return null;
  const existing = Chart.getChart(el);

  /* repricing only changes numbers, so update the live chart in place */
  if (existing && existing.data.datasets[0].steps){
    const ds = existing.data.datasets[0];
    ds.data = mtmBars(steps);
    ds.steps = steps;
    ds.backgroundColor = steps.map(s =>
      s.kind === 'total' ? MTM_COLOR.total : (s.value >= 0 ? MTM_COLOR.gain : MTM_COLOR.loss));
    existing.data.labels = steps.map(s => [s.label, s.sub]);
    existing.options.scales.y.title.text = axisTitle;
    existing.update('none');
    return existing;
  }

  return mount(id, {
    type: 'bar',
    plugins: [mtmLabels],
    data: {
      labels: steps.map(s => [s.label, s.sub]),
      datasets: [{
        data: mtmBars(steps),
        steps,
        backgroundColor: steps.map(s =>
          s.kind === 'total' ? MTM_COLOR.total : (s.value >= 0 ? MTM_COLOR.gain : MTM_COLOR.loss)),
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.62,
        categoryPercentage: 0.86,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 22, bottom: 4 } },
      scales: {
        x: { ...AXIS_X, ticks: { ...AXIS_X.ticks, autoSkip: false } },
        y: {
          ...AXIS,
          title: { display: true, text: axisTitle, color: '#5F7C7E', font: { size: 11 } },
          ticks: { ...AXIS.ticks, callback: v => Number(v).toFixed(1) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: c => c[0].dataset.steps[c[0].dataIndex].label,
            label: c => {
              const s = c.dataset.steps[c.dataIndex];
              return (s.value >= 0 ? '+' : '−') + '€' + Math.abs(s.value).toFixed(3) + 'm';
            },
            afterLabel: c => c.dataset.steps[c.dataIndex].note,
          },
        },
      },
    },
  });
}

/* --------- unamortised issue costs and discount, over the life --------- */
function buildAmortChart(id, rows, markMs){
  const el = document.getElementById(id);
  if (!el) return null;
  const labels = rows.map(r => r.label);
  const data = rows.map(r => r.unamortised);
  const existing = Chart.getChart(el);
  if (existing){
    existing.data.labels = labels;
    existing.data.datasets[0].data = data;
    existing.update('none');
    return existing;
  }
  return mount(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Unamortised issue costs and discount',
        data,
        backgroundColor: tone('--c-teal'),
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: AXIS_X,
        y: { ...AXIS, beginAtZero: true, ticks: { ...AXIS.ticks, callback: v => '€' + Number(v).toFixed(1) + 'm' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` €${c.parsed.y.toFixed(3)}m still to release to P&L` } },
      },
    },
  });
}


/* ---------- annual P&L charge: coupon against amortisation ---------- */
function buildPnlChart(id, rows){
  const el = document.getElementById(id);
  if (!el) return null;
  const labels = rows.map(r => r.label);
  const existing = Chart.getChart(el);
  if (existing){
    existing.data.labels = labels;
    existing.data.datasets[0].data = rows.map(r => r.coupon);
    existing.data.datasets[1].data = rows.map(r => r.amortisation);
    existing.update('none');
    return existing;
  }
  return mount(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Cash coupon', data: rows.map(r => r.coupon),
          backgroundColor: tone('--c-teal'), borderRadius:3, borderSkipped:false, barPercentage:0.62 },
        { label:'Amortisation of costs and discount', data: rows.map(r => r.amortisation),
          backgroundColor: tone('--c-amber'), borderRadius:3, borderSkipped:false, barPercentage:0.62 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: { ...AXIS_X, stacked:true },
        y: { ...AXIS, stacked:true, beginAtZero:true,
             ticks:{ ...AXIS.ticks, callback: v => '€' + Number(v).toFixed(0) + 'm' } },
      },
      plugins: {
        legend: { position:'bottom' },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: €${c.parsed.y.toFixed(3)}m`,
            footer: items => 'Interest expense: €' + items.reduce((a, i) => a + i.parsed.y, 0).toFixed(3) + 'm',
          },
        },
      },
    },
  });
}


/* =========================================================================
   Render — controls, KPI cards, reconciliation, sensitivity, amortisation.
   ========================================================================= */

function renderMtm(){
  const cfg = DATA.greenBond.mtm;
  const t = DATA.greenBond.terms;
  const sgn = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  const cls = v => (v >= 0 ? 'gain' : 'loss');

  const yEl = document.getElementById('mtmYield');
  const rEl = document.getElementById('mtmRange');
  const dEl = document.getElementById('mtmDate');
  if (!yEl) return;

  let userSetYield = false;     // a live default must not overwrite a typed value
  let queued = false;           // coalesce a drag into one repaint per frame
  let basis = 'nav';            // 'nav' = fair value, 'pnl' = amortised cost
  let liveYield = null;         // latest level from the feed, if one arrived

  /* the default position: latest level available, valued today */
  function defaults(){
    const sec = DATA.greenBond.secondary || {};
    const y = liveYield
           ?? (sec.langford && Number(sec.langford.yield))
           ?? cfg.yieldPct;
    const first = MTM.parseISO(cfg.interestCommencement);
    const last = MTM.parseISO(cfg.maturity) - 86400000;
    const now = Date.now();
    const d = new Date(Math.min(Math.max(MTM.parseISO(cfg.valuationDate) || now, first), last));
    return { yieldPct: Number(y), dateISO: d.toISOString().slice(0, 10) };
  }

  function applyDefaults(){
    const d = defaults();
    yEl.value = d.yieldPct.toFixed(3);
    rEl.value = d.yieldPct;
    dEl.value = d.dateISO;
    userSetYield = false;
    paint();
  }

  function paint(){
    let y = parseFloat(yEl.value);
    if (!isFinite(y) || y <= 0) y = cfg.yieldPct;

    let settle = MTM.parseISO(dEl.value);
    const first = MTM.parseISO(cfg.interestCommencement);
    const last = MTM.parseISO(cfg.maturity) - 86400000;
    if (!isFinite(settle) || settle < first) settle = first;
    if (settle > last) settle = last;

    const b = MTM.bridge(y, settle);
    const am = b.am;

    /* --- KPI cards, using the dashboard's own card markup --- */
    document.getElementById('mtmKpis').innerHTML = [
      { label:'Market movement', value:sgn(b.market, 2), unit:'€m',
        sub:`clean price ${t.issuePrice} → ${b.px.clean.toFixed(3)}`,
        accent: b.market >= 0 ? '' : 'accent-rate' },
      { label:'Fund NAV movement', value:sgn(b.nav, 2), unit:'€m',
        sub:'fair value, since issue', accent:'accent' },
      { label:'IFRS NAV movement', value:sgn(b.ifrsNav, 2), unit:'€m',
        sub:'amortised cost, P&L charge' },
      { label:'Difference', value:sgn(b.navGap, 2), unit:'€m',
        sub:'carrying amount less fair value' },
    ].map(kpiCard).join('');

    /* --- reconciliation --- */
    document.getElementById('mtmRecon').innerHTML = `
      <thead><tr>
        <th>Line</th><th class="num">Price</th><th class="num">Value €m</th><th class="num">NAV impact €m</th>
      </tr></thead>
      <tbody>
        <tr><td>Cash received at issue <small>all-in, after both fees</small></td>
            <td class="num">${(b.net / t.size * 100).toFixed(3)}</td>
            <td class="num">${b.net.toFixed(3)}</td><td class="num">—</td></tr>
        <tr><td>Liability recognised at issue</td><td class="num">${t.issuePrice.toFixed(3)}</td>
            <td class="num">${b.gross.toFixed(3)}</td><td class="num">—</td></tr>
        <tr><td><b>Issue costs expensed day one</b></td><td class="num">—</td>
            <td class="num">${b.issueCost.toFixed(3)}</td>
            <td class="num loss">−${b.issueCost.toFixed(3)}</td></tr>
        <tr><td>Liability at valuation date, clean <small>at ${b.yieldPct.toFixed(3)}%</small></td>
            <td class="num">${b.px.clean.toFixed(3)}</td><td class="num">${b.cleanVal.toFixed(3)}</td>
            <td class="num ${cls(b.market)}">${sgn(b.market)}</td></tr>
        <tr><td>Accrued coupon <small>${Math.round(b.px.accruedDays)} days</small></td>
            <td class="num">${b.px.accrued.toFixed(3)}</td><td class="num">${b.accrued.toFixed(3)}</td>
            <td class="num loss">−${b.accrued.toFixed(3)}</td></tr>
        ${b.couponsPaid ? `<tr><td>Coupons paid</td><td class="num">—</td>
            <td class="num">${b.couponsPaid.toFixed(3)}</td>
            <td class="num loss">−${b.couponsPaid.toFixed(3)}</td></tr>` : ''}
        <tr><td><b>Liability at valuation date, dirty</b></td><td class="num">${b.px.dirty.toFixed(3)}</td>
            <td class="num">${b.dirtyVal.toFixed(3)}</td><td class="num">—</td></tr>
        <tr><td><b>Fund NAV movement since issue</b></td><td class="num">—</td><td class="num">—</td>
            <td class="num ${cls(b.nav)}"><b>${sgn(b.nav)}</b></td></tr>
      </tbody>`;

    /* --- amortised cost, the IFRS side --- */
    document.getElementById('mtmAmort').innerHTML = `
      <thead><tr><th>Line</th><th class="num">€m</th></tr></thead>
      <tbody>
        <tr><td>Effective interest rate <small>discounts the cash flows to the net proceeds</small></td>
            <td class="num strong">${am.eir.toFixed(3)}%</td></tr>
        <tr><td>Total to amortise at issue <small>costs and discount</small></td>
            <td class="num">${am.totalToAmortise.toFixed(3)}</td></tr>
        <tr><td>Released to P&amp;L to date</td>
            <td class="num">${am.amortisationToDate.toFixed(3)}</td></tr>
        <tr><td><b>Unamortised, carried on the balance sheet</b></td>
            <td class="num"><b>${am.unamortised.toFixed(3)}</b></td></tr>
        <tr><td>Carrying amount, clean</td><td class="num">${am.carryClean.toFixed(3)}</td></tr>
        <tr><td>Accrued coupon</td><td class="num">${am.carryAccrued.toFixed(3)}</td></tr>
        <tr><td><b>Carrying amount, dirty</b></td><td class="num"><b>${am.carryDirty.toFixed(3)}</b></td></tr>
        <tr><td>P&amp;L interest expense since issue <small>coupon ${am.cashCouponToDate.toFixed(3)} + amortisation ${am.amortisationToDate.toFixed(3)}</small></td>
            <td class="num loss">${am.interestToDate.toFixed(3)}</td></tr>
        <tr><td><b>Fair value less carrying amount</b> <small>fund NAV against IFRS NAV</small></td>
            <td class="num ${cls(b.navGap)}"><b>${sgn(b.navGap)}</b></td></tr>
      </tbody>`;

    /* --- sensitivity ladder --- */
    const ladder = cfg.sensitivity.slice();
    if (!ladder.some(v => Math.abs(v - y) < 1e-9)) ladder.push(y);
    document.getElementById('mtmSens').innerHTML = `
      <thead><tr>
        <th>Yield</th><th class="num">Clean price</th>
        <th class="num">Market movement €m</th><th class="num">Fund NAV movement €m</th>
      </tr></thead>
      <tbody>${ladder.sort((a, c) => a - c).map(r => {
        const c = MTM.bridge(r, settle);
        const on = Math.abs(r - y) < 1e-9;
        const tag = Math.abs(r - t.reofferYield) < 1e-9 ? ' <small>re-offer</small>'
                  : (on ? ' <small>current</small>' : '');
        return `<tr>
          <td>${on ? '<b>' : ''}${r.toFixed(3)}%${on ? '</b>' : ''}${tag}</td>
          <td class="num">${c.px.clean.toFixed(3)}</td>
          <td class="num ${cls(c.market)}">${sgn(c.market, 2)}</td>
          <td class="num ${cls(c.nav)}">${sgn(c.nav, 2)}</td>
        </tr>`;
      }).join('')}</tbody>`;

    document.getElementById('mtmStamp').textContent =
      `${y.toFixed(3)}% · ${MTM.fmtDate(settle)}`;

    document.querySelectorAll('#mtmPresets .btn').forEach(btn => {
      btn.classList.toggle('primary', Math.abs(parseFloat(btn.dataset.y) - y) < 1e-9);
    });

    /* --- P&L for the period, the amortised-cost view --- */
    const fyStart = Math.max(MTM.parseISO(cfg.interestCommencement),
                             Date.UTC(new Date(settle).getUTCFullYear(), 0, 1));
    const fy = MTM.expenseBetween(fyStart, settle);
    document.getElementById('mtmPnl').innerHTML = `
      <thead><tr><th>P&amp;L charge</th><th class="num">Since issue €m</th><th class="num">Year to date €m</th></tr></thead>
      <tbody>
        <tr><td>Cash coupon <small>accrued and paid</small></td>
            <td class="num">${am.cashCouponToDate.toFixed(3)}</td>
            <td class="num">${fy.coupon.toFixed(3)}</td></tr>
        <tr><td>Amortisation of issue costs and discount</td>
            <td class="num">${am.amortisationToDate.toFixed(3)}</td>
            <td class="num">${fy.amortisation.toFixed(3)}</td></tr>
        <tr><td><b>Interest expense</b> <small>effective interest at ${am.eir.toFixed(3)}%</small></td>
            <td class="num loss"><b>${am.interestToDate.toFixed(3)}</b></td>
            <td class="num loss"><b>${fy.expense.toFixed(3)}</b></td></tr>
        <tr><td>Unamortised balance still on the balance sheet</td>
            <td class="num strong">${am.unamortised.toFixed(3)}</td>
            <td class="num muted">—</td></tr>
      </tbody>`;
    const fyNote = document.getElementById('mtmPnlNote');
    if (fyNote) fyNote.textContent =
      `Year to date runs from ${MTM.fmtDate(fyStart)} to ${MTM.fmtDate(settle)}.`;

    /* --- waterfall, on the selected basis --- */
    document.querySelectorAll('#mtmBasis .btn').forEach(btn =>
      btn.classList.toggle('primary', btn.dataset.basis === basis));
    const useP = basis === 'pnl';
    buildMtmChart('mtmChart', useP ? b.pnlSteps : b.steps,
                  useP ? '€m charged to P&L' : '€m impact on fund NAV');
    document.getElementById('mtmChartTitle').textContent =
      useP ? 'Interest expense since issue' : 'From market move to fund NAV';
    document.getElementById('mtmChartNote').innerHTML = useP
      ? `On the amortised-cost basis the issue costs and the issue discount are released over the life of the
         notes, so this block grows with the valuation date rather than landing in full on day one. At this date
         <b>€${am.amortisationToDate.toFixed(3)}m</b> of the <b>€${am.totalToAmortise.toFixed(3)}m</b> has been
         charged and <b>€${am.unamortised.toFixed(3)}m</b> is still carried.`
      : `Each block is an impact on fund NAV, built up from zero. Green adds to NAV, orange reduces it, teal is the
         net position. Fair value expenses the issue costs on day one; switch to the P&amp;L basis to see the
         unamortised balance instead.`;

    buildAmortChart('mtmAmortChart', MTM.amortisationSchedule(), settle);
    buildPnlChart('mtmPnlChart', MTM.annualExpense());
    return b;
  }

  /* one repaint per animation frame, however fast the slider fires */
  function schedulePaint(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }

  yEl.addEventListener('input', () => { userSetYield = true; rEl.value = yEl.value; schedulePaint(); });
  rEl.addEventListener('input', () => { userSetYield = true; yEl.value = parseFloat(rEl.value).toFixed(3); schedulePaint(); });
  dEl.addEventListener('change', schedulePaint);
  document.getElementById('mtmPresets').addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    userSetYield = true;
    yEl.value = btn.dataset.y; rEl.value = btn.dataset.y; schedulePaint();
  });

  const resetBtn = document.getElementById('mtmReset');
  if (resetBtn) resetBtn.addEventListener('click', applyDefaults);

  const basisEl = document.getElementById('mtmBasis');
  if (basisEl) basisEl.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    basis = btn.dataset.basis;
    paint();
  });

  /* presets come from the sensitivity ladder so there is one list to edit */
  document.getElementById('mtmPresets').innerHTML = cfg.sensitivity.map(v =>
    `<button type="button" class="btn" data-y="${v}">${v.toFixed(3)}%${
      Math.abs(v - t.reofferYield) < 1e-9 ? ' re-offer' : ''}</button>`).join('');

  dEl.min = cfg.interestCommencement;
  dEl.max = cfg.maturity;
  const d0 = defaults();
  yEl.value = d0.yieldPct.toFixed(3);
  rEl.value = d0.yieldPct;
  dEl.value = d0.dateISO;

  /* a live yield from the feed seeds the default, unless the user has
     already typed one */
  MTM.applyLive = live => {
    if (!live) return;
    const settle = MTM.parseISO(dEl.value) || MTM.parseISO(defaults().dateISO);
    const y = isFinite(live.yield) ? Number(live.yield)
            : (isFinite(live.price) ? MTM.yieldFromPrice(Number(live.price), settle) : NaN);
    if (!isFinite(y)) return;
    liveYield = y;
    const el = document.getElementById('mtmLiveNote');
    if (el) el.textContent = `Default is the latest level, ${y.toFixed(3)}%` +
      (isFinite(live.yield) ? '.' : ` (implied by the ${Number(live.price).toFixed(3)} price).`);
    if (userSetYield) return;          // a typed yield stands until Reset
    yEl.value = y.toFixed(3);
    rEl.value = y;
    paint();
  };

  MTM.repaint = paint;
  MTM.reset = applyDefaults;
  paint();
}
