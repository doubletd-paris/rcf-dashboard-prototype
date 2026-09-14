/* =========================================================================
   MARK-TO-MARKET — Fund NAV impact of the Langford green bond.

   The Fund NAV carries the notes at full fair value (see the accounting
   memo, Property Fund Finance, 28 August 2026); the IFRS NAV carries them
   at amortised cost. The difference between the two is what this section
   makes visible: a market move on the clean price, less the issue costs
   that a fair-value NAV expenses on day one rather than amortising, less
   accrued coupon.

   Inputs live in DATA.greenBond.mtm. Everything else is derived from the
   executed term sheet in DATA.greenBond.terms, so a second tranche only
   needs its own terms block — no arithmetic changes here.
   ========================================================================= */

const MTM = (() => {
  const DAY = 86400000;

  /* ---------- date helpers (all UTC, no timezone drift) ---------- */
  const parseISO = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
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
    return { dirty, accrued, clean: dirty - accrued, accruedDays };
  }

  /* ---------- the full bridge ----------------------------------------
     Sign convention: a POSITIVE NAV impact adds to NAV. The notes are a
     liability, so a fall in their value is a gain.
     ------------------------------------------------------------------- */
  function bridge(yieldPct, settleMs){
    const t = DATA.greenBond.terms;
    const cfg = DATA.greenBond.mtm;

    const start = parseISO(cfg.interestCommencement);
    const bounds = schedule(start, parseISO(cfg.maturity));
    const p = priceAt(yieldPct, settleMs, bounds, t.coupon);

    const gross = t.size * t.issuePrice / 100;          // liability recognised at issue
    const net = cfg.netProceeds;                        // cash actually received
    const issueCost = gross - net;

    const cleanVal = p.clean * t.size / 100;
    const accVal = p.accrued * t.size / 100;
    const dirtyVal = p.dirty * t.size / 100;

    const market = gross - cleanVal;                    // the market move
    const nav = net - dirtyVal;                         // what NAV actually sees

    return {
      px: p, bounds, settleMs, yieldPct,
      gross, net, issueCost, cleanVal, accVal, dirtyVal,
      market, accrued: accVal, nav,
      steps: [
        { key:'cost',   label:'Issue costs',       sub:'expensed day one', value:-issueCost, kind:'delta',
          note:`Gross issue value €${gross.toFixed(3)}m less net proceeds €${net.toFixed(3)}m. A fair-value NAV does not capitalise these, so they land in full on day one.` },
        { key:'market', label:'Market movement',   sub:'clean price',      value:market,     kind:'delta',
          note:`Liability repriced from the ${t.issuePrice}% issue price to ${p.clean.toFixed(3)}%.` },
        { key:'accrual',label:'Accrued coupon',    sub:`${Math.round(p.accruedDays)} days`, value:-accVal, kind:'delta',
          note:`${t.coupon.toFixed(3)}% accrued on ${t.dayCount.split('·')[0].trim()} since ${fmtDate(start)}.` },
        { key:'nav',    label:'Net NAV movement',  sub:'since issue',      value:nav,        kind:'total',
          note:`Net proceeds €${net.toFixed(3)}m less the dirty liability of €${dirtyVal.toFixed(3)}m.` },
      ],
    };
  }

  return { bridge, priceAt, schedule, parseISO, fmtDate };
})();


/* =========================================================================
   Chart — waterfall, drawn with Chart.js floating bars so it inherits the
   dashboard's theme from assets/charts.js.
   ========================================================================= */

const MTM_COLOR = { gain:'#4FA254', loss:'#B4552F', total:'#0C5C60' };

/* signed value labels sit on every bar, which is also what makes the
   green/orange pair safe for colour-vision-deficient readers */
const mtmLabels = {
  id: 'mtmLabels',
  /* dashed step connectors, so the eye follows the running total */
  beforeDatasetsDraw(chart){
    const { ctx } = chart;
    const bars = chart.getDatasetMeta(0).data;
    const steps = chart.data.datasets[0].steps;
    ctx.save();
    ctx.strokeStyle = '#8AA3A5';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 1; i < bars.length; i++){
      const prev = bars[i - 1], cur = bars[i];
      const y = steps[i - 1].value >= 0 ? Math.min(prev.y, prev.base) : Math.max(prev.y, prev.base);
      ctx.beginPath();
      ctx.moveTo(prev.x + prev.width / 2, y);
      ctx.lineTo(cur.x - cur.width / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart){
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = "600 12px 'Inter','Infra',system-ui,sans-serif";
    ctx.textAlign = 'center';
    meta.data.forEach((bar, i) => {
      const s = chart.data.datasets[0].steps[i];
      const up = s.value >= 0;
      ctx.fillStyle = s.kind === 'total' ? MTM_COLOR.total : (up ? MTM_COLOR.gain : MTM_COLOR.loss);
      ctx.textBaseline = up ? 'bottom' : 'top';
      const y = up ? Math.min(bar.y, bar.base) - 6 : Math.max(bar.y, bar.base) + 6;
      ctx.fillText((s.value >= 0 ? '+' : '−') + Math.abs(s.value).toFixed(2), bar.x, y);
    });
    ctx.restore();
  },
};

function buildMtmChart(id, b){
  let run = 0;
  const bars = b.steps.map(s => {
    const from = s.kind === 'total' ? 0 : run;
    const to   = s.kind === 'total' ? s.value : run + s.value;
    if (s.kind !== 'total') run = to;
    return [from, to];
  });

  return mount(id, {
    type: 'bar',
    plugins: [mtmLabels],
    data: {
      labels: b.steps.map(s => [s.label, s.sub]),
      datasets: [{
        data: bars,
        steps: b.steps,
        backgroundColor: b.steps.map(s =>
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
          title: { display: true, text: '€m impact on fund NAV', color: '#5F7C7E', font: { size: 11 } },
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


/* =========================================================================
   Render — KPI cards, controls, reconciliation and sensitivity.
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

  function paint(){
    let y = parseFloat(yEl.value);
    if (!isFinite(y) || y <= 0) y = cfg.yieldPct;

    let settle = MTM.parseISO(dEl.value);
    const first = MTM.parseISO(cfg.interestCommencement);
    const last = MTM.parseISO(cfg.maturity) - 86400000;
    if (!isFinite(settle) || settle < first) settle = first;
    if (settle > last) settle = last;

    const b = MTM.bridge(y, settle);

    /* --- KPI cards, using the dashboard's own card markup --- */
    document.getElementById('mtmKpis').innerHTML = [
      { label:'Market movement', value:sgn(b.market, 2), unit:'€m',
        sub:`clean price ${t.issuePrice} → ${b.px.clean.toFixed(3)}`,
        accent: b.market >= 0 ? '' : 'accent-rate' },
      { label:'Net NAV movement', value:sgn(b.nav, 2), unit:'€m',
        sub:'cash raised less liability today', accent:'accent' },
      { label:'Difference', value:Math.abs(b.market - b.nav).toFixed(2), unit:'€m',
        sub:'issue costs and accrued coupon' },
    ].map(kpiCard).join('');

    /* --- reconciliation --- */
    document.getElementById('mtmRecon').innerHTML = `
      <thead><tr>
        <th>Line</th><th class="num">Price</th><th class="num">Value €m</th><th class="num">NAV impact €m</th>
      </tr></thead>
      <tbody>
        <tr><td>Cash received at issue</td><td class="num">${t.allInPrice}</td>
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
        <tr><td><b>Liability at valuation date, dirty</b></td><td class="num">${b.px.dirty.toFixed(3)}</td>
            <td class="num">${b.dirtyVal.toFixed(3)}</td><td class="num">—</td></tr>
        <tr><td><b>Net NAV movement since issue</b></td><td class="num">—</td><td class="num">—</td>
            <td class="num ${cls(b.nav)}"><b>${sgn(b.nav)}</b></td></tr>
      </tbody>`;

    /* --- sensitivity ladder --- */
    const ladder = cfg.sensitivity.slice();
    if (!ladder.some(v => Math.abs(v - y) < 1e-9)) ladder.push(y);
    document.getElementById('mtmSens').innerHTML = `
      <thead><tr>
        <th>Yield</th><th class="num">Clean price</th>
        <th class="num">Market movement €m</th><th class="num">Net NAV movement €m</th>
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

    /* buildSection() calls MTM.repaint() once the tab is visible, which
       rebuilds this at a real width — a canvas measured while hidden is 0×0 */
    buildMtmChart('mtmChart', b);
    return b;
  }

  yEl.addEventListener('input', () => { rEl.value = yEl.value; paint(); });
  rEl.addEventListener('input', () => { yEl.value = parseFloat(rEl.value).toFixed(3); paint(); });
  dEl.addEventListener('change', paint);
  document.getElementById('mtmPresets').addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    yEl.value = btn.dataset.y; rEl.value = btn.dataset.y; paint();
  });

  /* presets come from the sensitivity ladder so there is one list to edit */
  document.getElementById('mtmPresets').innerHTML = cfg.sensitivity.map(v =>
    `<button type="button" class="btn" data-y="${v}">${v.toFixed(3)}%${
      Math.abs(v - t.reofferYield) < 1e-9 ? ' re-offer' : ''}</button>`).join('');

  yEl.value = cfg.yieldPct.toFixed(3);
  rEl.value = cfg.yieldPct;
  dEl.value = cfg.valuationDate;
  dEl.min = cfg.interestCommencement;
  dEl.max = cfg.maturity;

  MTM.repaint = paint;
  paint();
}
