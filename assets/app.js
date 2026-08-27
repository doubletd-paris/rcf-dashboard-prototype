/* =========================================================================
   APP — section navigation and the renderers for every section other than
   the RCF prototype. All figures come from assets/data.js; the live market
   panel comes from app.py (/api/market-data) with a local fallback.
   ========================================================================= */

/* ============================== navigation ============================= */
const SECTIONS = ['overview','debt-mix','maturity','rcf','green-bond','covenants'];
const built = {};                                   // sections whose charts exist

function showSection(id, push = true){
  if (!SECTIONS.includes(id)) id = SECTIONS[0];

  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id));
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.section === id;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });

  if (!built[id]){ buildSection(id); built[id] = true; }

  /* a canvas sized while hidden needs a nudge once it is on screen */
  document.querySelectorAll('#view-' + id + ' canvas').forEach(c => {
    const ch = Chart.getChart(c);
    if (ch) ch.resize();
  });

  if (push && location.hash.slice(2) !== id) history.replaceState(null, '', '#/' + id);
  window.scrollTo({ top:0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function initNav(){
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => showSection(t.dataset.section));
    t.addEventListener('keydown', e => {
      const i = SECTIONS.indexOf(t.dataset.section);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
        e.preventDefault();
        const next = SECTIONS[(i + (e.key === 'ArrowRight' ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
        showSection(next);
        document.querySelector(`.tab[data-section="${next}"]`).focus();
      }
    });
  });
  window.addEventListener('hashchange', () => showSection(location.hash.slice(2), false));
  showSection(location.hash.slice(2) || 'overview', false);
}

/* charts are built the first time their section is opened */
function buildSection(id){
  if (id === 'debt-mix'){
    buildDonut('mixInstrument', DATA.debtMix.byInstrument);
    buildDonut('mixLender',     DATA.debtMix.byLender);
    buildDonut('mixCurrency',   DATA.debtMix.byCurrency);
  }
  if (id === 'maturity'){
    buildMaturityChart('maturityChart', DATA.maturity);
    buildTrendChart('trendChart', DATA.maturity.trend);
  }
  if (id === 'green-bond'){
    buildPricingChart('bondPricing', DATA.greenBond.pricing);
    buildDonut('bondUseOfProceeds', DATA.greenBond.useOfProceeds);
    buildBridgeChart('bridgeChart', DATA.greenBond.bridge);
  }
  if (id === 'covenants') renderGauges();
}

/* ============================== overview =============================== */
function kpiCard(c){
  const val = typeof c.value === 'number'
    ? c.value.toLocaleString('en-GB', { maximumFractionDigits:2 })
    : c.value;
  return `
    <div class="kpi ${c.accent || ''}">
      <div class="label">${c.label}</div>
      <div class="val">${val}${c.unit ? `<span class="unit">${c.unit}</span>` : ''}</div>
      <div class="sub">${c.sub || ''}</div>
    </div>`;
}

function renderOverview(){
  document.getElementById('overviewKpis').innerHTML = DATA.overview.kpis.map(kpiCard).join('');

  const t = DATA.overview.totals;
  document.getElementById('overviewTotals').innerHTML = `
    <div class="gauge-meta totals-strip">
      <div><div class="l">Gross debt drawn</div><div class="v">${eurM(t.grossDebt)}</div></div>
      <div><div class="l">Undrawn committed</div><div class="v">${eurM(t.undrawnCommitted)}</div></div>
      <div><div class="l">Gross asset value</div><div class="v">€${(t.gav / 1000).toFixed(1)}bn</div></div>
      <div><div class="l">Net asset value</div><div class="v">€${(t.nav / 1000).toFixed(1)}bn</div></div>
    </div>`;
}

/* ------------------------- live market data panel ---------------------- */
/* Values are pulled from a single endpoint so the feed can be swapped in
   app.py (see get_market_data) without touching this layout.             */
async function renderMarket(){
  let feed = null;
  try {
    const res = await fetch('/api/market-data', { headers: { Accept:'application/json' } });
    if (res.ok) feed = await res.json();
  } catch (e) { /* static deployment or endpoint offline — fall back below */ }

  if (!feed || !Array.isArray(feed.rates)) feed = { ...DATA.marketFallback };
  const stamp = feed.asOf || new Date().toISOString();

  document.getElementById('marketRates').innerHTML = feed.rates.map(r => {
    const ch  = Number(r.change || 0);
    const dir = ch > 0 ? 'up' : ch < 0 ? 'dn' : 'flat';
    const arr = ch > 0 ? '▲' : ch < 0 ? '▼' : '–';
    const dec = r.unit === 'bps' ? 0 : 2;
    return `
      <div class="rate">
        <div class="l">${r.label}</div>
        <div class="v">${Number(r.value).toFixed(dec)}<span class="unit"> ${r.unit}</span></div>
        <div class="d ${dir}">${arr} ${Math.abs(ch).toFixed(dec)} ${r.unit} vs prior close</div>
      </div>`;
  }).join('');

  const badge = document.getElementById('marketBadge');
  badge.textContent = feed.delayed === false ? 'Live feed' : 'Indicative, delayed data';
  badge.classList.toggle('live', feed.delayed === false);

  document.getElementById('marketCaption').innerHTML =
    `<span>Source: <b>${feed.source || 'unknown'}</b> · indicative mid levels, not executable.</span>
     <span>As at <b>${fmtStamp(stamp)}</b></span>`;
}

function fmtStamp(iso){
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
  }) + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
}

/* ============================== debt mix =============================== */
function renderDebtMixTotals(){
  const total = DATA.debtMix.byInstrument.reduce((a, s) => a + s.value, 0);
  document.querySelectorAll('[data-mix-total]').forEach(el => { el.textContent = eurM(total) + ' drawn'; });
}

/* =========================== maturity profile ========================== */
function renderMaturityTable(){
  const m = DATA.maturity;
  const totals = m.years.map((_, i) => m.series.reduce((a, s) => a + s.data[i], 0));
  const grand  = totals.reduce((a, v) => a + v, 0);
  document.getElementById('maturityTable').innerHTML = `
    <thead><tr><th>Instrument</th>${m.years.map(y => `<th class="num">${y}</th>`).join('')}<th class="num">Total</th></tr></thead>
    <tbody>
      ${m.series.map(s => {
        const tot = s.data.reduce((a, v) => a + v, 0);
        return `<tr><td>${s.label}</td>${s.data.map(v => `<td class="num">${v ? v.toFixed(1) : '–'}</td>`).join('')}<td class="num"><b>${tot.toFixed(1)}</b></td></tr>`;
      }).join('')}
      <tr><td><b>Total (€m)</b></td>${totals.map(v => `<td class="num"><b>${v ? v.toFixed(1) : '–'}</b></td>`).join('')}<td class="num"><b>${grand.toFixed(1)}</b></td></tr>
    </tbody>`;
}

/* ============================= green bond ============================== */
function renderGreenBond(){
  document.getElementById('bondKpis').innerHTML = DATA.greenBond.kpis.map(kpiCard).join('');
  const total = DATA.greenBond.pricing.reduce((a, r) => a + r.value, 0);
  document.getElementById('bondPricingReadout').textContent =
    `${total}bps all-in · ${(total / 100).toFixed(2)}% indicative coupon`;
}

/* ========================= covenants & headroom ======================== */
function readCovenantInputs(){
  const c = DATA.covenants;
  const num = (id, fallback) => {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? fallback : v;
  };
  c.ltv.threshold = num('ltvCov', c.ltv.threshold);
  c.ltv.warning   = num('ltvWarn', c.ltv.warning);
  c.icr.threshold = num('icrCov', c.icr.threshold);
  c.icr.warning   = num('icrWarn', c.icr.warning);
}

function renderGauges(){
  const c = DATA.covenants;

  const paint = (canvasId, centreId, metaId, cfg, fmt) => {
    const status = covenantStatus(cfg);
    const head   = covenantHeadroom(cfg);
    buildGauge(canvasId, { ...cfg, thresholdLabel: fmt(cfg.threshold) });

    document.getElementById(centreId).innerHTML = `
      <div class="g-val" style="color:${STATUS_COLOR[status]}">${fmt(cfg.actual)}</div>
      <div class="g-lab">${cfg.label}</div>`;

    document.getElementById(metaId).innerHTML = `
      <div><div class="l">Covenant</div><div class="v">${fmt(cfg.threshold)}</div></div>
      <div><div class="l">Headroom</div><div class="v">${(head >= 0 ? '' : '−') + fmt(Math.abs(head))}</div></div>
      <div><div class="l">Status</div><div class="v"><span class="pill ${status}">${STATUS_LABEL[status]}</span></div></div>`;
  };

  paint('ltvGauge', 'ltvCentre', 'ltvMeta', c.ltv, v => v.toFixed(1) + '%');
  paint('icrGauge', 'icrCentre', 'icrMeta', c.icr, v => Math.round(v) + '%');
  renderCovenantTable();
}

function renderCovenantTable(){
  const rows = DATA.covenants.facilities.map(f => {
    const cell = (cov, act, dir) => {
      if (cov == null || act == null) return `<td class="num">–</td><td class="num">${act == null ? '–' : act.toFixed(act < 100 ? 2 : 0)}</td><td class="num">–</td>`;
      const cfg  = { actual:act, threshold:cov, warning: dir === 'max' ? cov * 0.85 : cov * 1.35, direction:dir };
      const st   = covenantStatus(cfg);
      const head = covenantHeadroom(cfg);
      return `<td class="num">${cov.toFixed(cov < 100 ? 2 : 0)}</td>
              <td class="num">${act.toFixed(act < 100 ? 2 : 0)}</td>
              <td class="num"><span class="pill ${st}">${head >= 0 ? '+' : '−'}${Math.abs(head).toFixed(1)}</span></td>`;
    };
    return `<tr>
      <td>${f.name}</td><td>${f.lender}</td><td>${f.maturity}</td>
      ${cell(f.ltvCov, f.ltv, 'max')}
      ${cell(f.icrCov, f.icr, 'min')}
    </tr>`;
  }).join('');

  document.getElementById('covenantTable').innerHTML = `
    <thead>
      <tr>
        <th>Facility</th><th>Lender</th><th>Maturity</th>
        <th class="num">LTV cov (%)</th><th class="num">LTV actual (%)</th><th class="num">LTV headroom</th>
        <th class="num">ICR cov (%)</th><th class="num">ICR actual (%)</th><th class="num">ICR headroom</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function initCovenantControls(){
  ['ltvCov','ltvWarn','icrCov','icrWarn'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { readCovenantInputs(); renderGauges(); });
  });
}

/* ================================ boot ================================= */
function boot(){
  document.getElementById('asOfStamp').innerHTML =
    `${DATA.asOf.fund}<br><b>${DATA.asOf.quarter} · ${DATA.asOf.label}</b>`;

  renderOverview();
  renderMarket();
  renderDebtMixTotals();
  renderMaturityTable();
  renderGreenBond();
  initCovenantControls();
  initNav();
}

boot();
