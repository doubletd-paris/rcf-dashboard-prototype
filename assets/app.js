/* =========================================================================
   APP — section navigation and the renderers for every section other than
   the RCF prototype. All figures come from assets/data.js; the live market
   panel comes from app.py (/api/market-data) with a local fallback.
   ========================================================================= */

/* ============================== navigation ============================= */
const SECTIONS = ['overview','debt-mix','maturity','rcf','green-bond','covenants','market'];
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

  /* a canvas sized while hidden needs a nudge once it is on screen — once
     now, and once after layout has settled, since a container measured in
     the same frame as the display change can still report zero */
  const nudge = () => document.querySelectorAll('#view-' + id + ' canvas').forEach(c => {
    const ch = Chart.getChart(c);
    if (ch && c.clientWidth) ch.resize();
  });
  nudge();
  requestAnimationFrame(nudge);

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
    buildSpreadChart('spreadChart', DATA.greenBond, spreadTimeframe);
    if (MTM.repaint) MTM.repaint();
    mountTradingView('tvPrimary');
    mountTradingView('tvComparison');
  }
  if (id === 'rcf'){
    /* rcf.js builds these at load, while this section is still display:none,
       so the canvases measure 0×0 and Chart.js sizes to nothing. Rebuild them
       now the container has a real width instead of relying on a resize to
       rescue a zero-sized canvas. */
    buildBalanceChart();
    buildRateChart();
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
  const gb = DATA.greenBond, t = gb.terms;

  document.getElementById('bondKpis').innerHTML = [
    { label:'Size issued',      value:t.size,          unit:'€m',  sub:t.status, accent:'accent' },
    { label:'Coupon',           value:t.coupon.toFixed(3),       unit:'%',  sub:'fixed, annual' },
    { label:'Re-offer yield',   value:t.reofferYield.toFixed(3), unit:'%',  sub:'at ' + t.issuePrice + '% issue price', accent:'accent-rate' },
    { label:'Spread to swaps',  value:'+' + t.spreadToMs, unit:'bp', sub:'MS ' + t.midSwapRef + '% reference' },
    { label:'Maturity',         value:'2031',          unit:'',    sub:t.maturityDate },
    { label:'Net proceeds',     value:t.netProceeds.toFixed(1),  unit:'€m', sub:'after ' + t.baseFees + '% base fees' },
  ].map(kpiCard).join('');

  document.getElementById('tvPrimarySymbol').textContent = gb.tradingView.primary.symbol;

  /* --- term sheet, split across two panels --- */
  const rows = pairs => pairs.map(([k, v]) =>
    `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');

  document.getElementById('termsEconomics').innerHTML = `<tbody>${rows([
    ['Aggregate principal',    `EUR ${t.size.toLocaleString('en-GB')},000,000`],
    ['Coupon',                 `${t.coupon.toFixed(3)}% — ${t.couponBasis}`],
    ['Re-offer yield',         `${t.reofferYield}% annual`],
    ['Reference mid-swaps',    `${t.midSwapRef}%`],
    ['Spread to mid-swaps',    `+${t.spreadToMs}bp`],
    ['Reference benchmark',    t.benchmark],
    ['Benchmark price / yield',`${t.benchmarkPrice}% / ${t.benchmarkYield}%`],
    ['Spread to benchmark',    `+${t.spreadToBenchmark}bp`],
    ['Issue / re-offer price', `${t.issuePrice}%`],
    ['Redemption price',       `${t.redemptionPrice}%`],
    ['Gross proceeds',         `EUR ${t.grossProceeds.toFixed(3)}m`],
    ['Fees',                   `${t.baseFees}% base · ${t.discretionaryFees}% discretionary`],
    ['All-in price',           `${t.allInPrice}% (excl. discretionary fee)`],
    ['Net proceeds',           `EUR ${t.netProceeds.toFixed(3)}m`],
    ['Pricing date',           t.pricingDate],
    ['Settlement date',        t.settlementDate],
    ['Maturity date',          t.maturityDate],
  ])}</tbody>`;

  document.getElementById('termsStructure').innerHTML = `<tbody>${rows([
    ['Issuer',              t.issuer],
    ['Issuer LEI',          t.issuerLei],
    ['Issuer rating',       t.issuerRating],
    ['Issue rating',        t.issueRating],
    ['Status',              t.status],
    ['Format',              t.format],
    ['ISIN / common code',  `${t.isin} / ${t.commonCode}`],
    ['Programme',           t.programme],
    ['Listing',             t.listing],
    ['Bookrunners',         `${t.bookrunners} (B&amp;D: ${t.billingDelivery})`],
    ['Principal paying agent', t.principalPayingAgent],
    ['Clearing',            t.clearing],
    ['Governing law',       t.governingLaw],
    ['Day count / BD',      t.dayCount],
    ['Denominations',       t.denominations],
    ['Early redemption',    t.earlyRedemption],
    ['Change of control',   t.changeOfControl],
    ['Use of proceeds',     t.useOfProceeds],
    ['Second party opinion',t.secondPartyOpinion],
    ['Selling restrictions',t.sellingRestrictions],
    ['Target market',       t.targetMarket],
  ])}</tbody>`;

  renderSecondaryLevels();
  renderSpreadTimeframes();
}

/* ------------------- secondary levels, both bonds ---------------------- */
function renderSecondaryLevels(){
  const gb = DATA.greenBond, sec = gb.secondary;
  const vsReoffer = sec.langford.zSpread - gb.terms.spreadToMs;
  const row = (label, o) => `
    <div><div class="l">${label} price</div><div class="v">${Number(o.price).toFixed(3)}</div></div>
    <div><div class="l">${label} yield</div><div class="v">${Number(o.yield).toFixed(2)}%</div></div>
    <div><div class="l">${label} Z-spread</div><div class="v">${Math.round(o.zSpread)}bp</div></div>`;

  document.getElementById('secondaryStrip').innerHTML = `
    <div class="gauge-meta" style="grid-template-columns:repeat(3,1fr)">
      ${row('Langford', sec.langford)}
      ${row('Peer', sec.peer)}
      <div><div class="l">Langford vs re-offer</div>
        <div class="v"><span class="pill ${vsReoffer <= 0 ? 'ok' : 'watch'}">${vsReoffer > 0 ? '+' : ''}${Math.round(vsReoffer)}bp</span></div></div>
      <div><div class="l">Pick-up vs peer</div>
        <div class="v">${Math.round(sec.langford.zSpread - sec.peer.zSpread)}bp</div></div>
      <div><div class="l">As at</div><div class="v" style="font-size:12.5px">${sec.asOf}</div></div>
    </div>`;

  document.getElementById('secondaryCaption').innerHTML =
    `Peer is ${DATA.greenBond.tradingView.comparison.peerLabel}, ${DATA.greenBond.tradingView.comparison.peerIsin}.
     Source: <b>${sec.source}</b>. Indicative mid levels, not executable. TradingView cannot be read from this page —
     it is a cross-origin widget — so live levels arrive through <code>app.py → get_market_data()</code>.`;
}

/* ------------------- spread chart timeframe buttons -------------------- */
let spreadTimeframe = null;

function renderSpreadTimeframes(){
  const sec = DATA.greenBond.secondary;
  const host = document.getElementById('spreadTimeframes');
  if (!host) return;
  if (!spreadTimeframe) spreadTimeframe = sec.defaultTimeframe || (sec.timeframes[0] || {}).key;

  host.innerHTML = (sec.timeframes || []).map(f =>
    `<button type="button" class="btn ${f.key === spreadTimeframe ? 'primary' : ''}" data-tf="${f.key}">${f.label}</button>`).join('');

  if (!host.dataset.bound){
    host.dataset.bound = '1';
    host.addEventListener('click', e => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      spreadTimeframe = btn.dataset.tf;
      renderSpreadTimeframes();
      buildSpreadChart('spreadChart', DATA.greenBond, spreadTimeframe);
    });
  }
  const stamp = document.getElementById('spreadStamp');
  if (stamp){
    const f = (sec.timeframes || []).find(x => x.key === spreadTimeframe);
    stamp.textContent = `${f ? f.label : ''} · ${sec.series.langfordZ.length} marks since pricing`;
  }
}

/* --------------------------- live bond levels --------------------------
   One endpoint feeds the whole dashboard. When it returns a `bond` block,
   the secondary levels, the spread series and the mark-to-market default
   yield all come from it; otherwise the placeholders in data.js stand.
   ---------------------------------------------------------------------- */
async function loadBondFeed(){
  let bond = null;
  try {
    const res = await fetch('/api/market-data', { headers: { Accept:'application/json' } });
    if (res.ok){
      const j = await res.json();
      if (j && j.bond) bond = j.bond;
    }
  } catch (e) { /* static deployment — placeholders stand */ }
  if (!bond) return;

  const sec = DATA.greenBond.secondary;
  if (bond.langford) Object.assign(sec.langford, bond.langford);
  if (bond.peer) Object.assign(sec.peer, bond.peer);
  if (bond.series) sec.series = bond.series;
  if (bond.asOf) sec.asOf = bond.asOf;
  if (bond.source) sec.source = bond.source;

  renderSecondaryLevels();
  renderSpreadTimeframes();
  if (charts.spreadChart) buildSpreadChart('spreadChart', DATA.greenBond, spreadTimeframe);
  if (MTM.applyLive && bond.langford) MTM.applyLive(bond.langford);
}

/* ---------------------------- TradingView ------------------------------
   Saved TradingView chart layouts (/chart/<id>/) cannot be embedded in an
   iframe, so the in-page chart uses the advanced-chart widget with the
   symbol from DATA, and the layout URL is offered as a link beside it. If
   the widget script is blocked or the symbol does not resolve, the panel
   falls back to that link rather than leaving an empty box.
   --------------------------------------------------------------------- */
const TV_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

function mountTradingView(hostId){
  const host = document.getElementById(hostId);
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted = '1';

  const tv  = DATA.greenBond.tradingView;
  const cfg = tv[host.dataset.tv];

  host.innerHTML = `
    <div class="tv-head">
      <span class="tv-symbol">${cfg.title} · <b>${[cfg.symbol, ...(cfg.compareSymbols || []).map(c => c.symbol)].join('</b> vs <b>')}</b></span>
      <a class="btn" href="${cfg.layoutUrl}" target="_blank" rel="noopener noreferrer">Open in TradingView ↗</a>
    </div>
    <div class="tv-frame tradingview-widget-container">
      <div class="tradingview-widget-container__widget"></div>
    </div>
    <div class="tv-fallback" hidden>
      <p><b>The chart could not be embedded here.</b></p>
      <p>TradingView could not load in this page — most often because the symbol
         <code>${cfg.symbol}</code> is not one it publishes, or the script is blocked by the network.
         The saved layout still works in TradingView itself.</p>
      <p><a class="btn primary" href="${cfg.layoutUrl}" target="_blank" rel="noopener noreferrer">Open the chart in TradingView ↗</a></p>
      <p class="footnote">To fix the embed, search the instrument on TradingView, copy its
         EXCHANGE:TICKER symbol, and set it in <code>DATA.greenBond.tradingView</code>.</p>
    </div>`;

  const frame = host.querySelector('.tv-frame');
  const fail  = () => {
    host.querySelector('.tv-fallback').hidden = false;
    frame.hidden = true;
  };

  const script = document.createElement('script');
  script.src = TV_SRC;
  script.async = true;
  script.onerror = fail;
  script.text = JSON.stringify({
    autosize: true,
    symbol: cfg.symbol,
    interval: tv.interval,
    timezone: 'Europe/London',
    theme: tv.theme,
    style: '2',
    locale: 'en',
    hide_side_toolbar: true,
    allow_symbol_change: false,
    details: false,
    compareSymbols: cfg.compareSymbols || [],
    support_host: 'https://www.tradingview.com',
  });
  frame.appendChild(script);

  /* no iframe after a fair wait means the widget never came up */
  setTimeout(() => { if (!frame.querySelector('iframe')) fail(); }, 8000);
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

/* ======================= euro market dashboard ========================= */
/* Colour convention: 'rates' and 'risk' rows read as a cost, so a rise is
   red and a fall green; 'assets' rows read as performance, so a rise is
   green. Set per section via `dir` in the data.                          */
function moveCell(v, unit, dir){
  if (v === null || v === undefined) return '<td class="num muted">–</td>';
  const n = Number(v);
  const good = dir === 'assets' ? n > 0 : n < 0;
  const cls  = n === 0 ? 'flat' : good ? 'dn' : 'up';
  const txt  = unit === 'bp' ? Math.round(n).toString() : n.toFixed(1);
  return `<td class="num move ${cls}">${n > 0 ? '+' : ''}${txt}</td>`;
}

async function renderBoard(){
  let feed = null;
  try {
    const res = await fetch('/api/market-data', { headers: { Accept:'application/json' } });
    if (res.ok){
      const j = await res.json();
      if (j && Array.isArray(j.board)) feed = { ...j, sections: j.board };
    }
  } catch (e) { /* static deployment — fall back below */ }

  if (!feed || !Array.isArray(feed.sections)) feed = { ...DATA.marketBoard };

  document.getElementById('boardTable').innerHTML = `
    <thead>
      <tr><th></th><th class="num">Today</th><th class="num">Δ DoD</th><th class="num">Δ WoW</th><th class="num">Δ YTD</th></tr>
    </thead>
    <tbody>
      ${feed.sections.map(sec => `
        <tr class="band-row">
          <th scope="rowgroup">${sec.name}</th>
          <td class="num unit"></td>
          <td class="num unit">${sec.unit}</td>
          <td class="num unit">${sec.unit}</td>
          <td class="num unit">${sec.unit}</td>
        </tr>
        ${sec.rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td class="num strong">${r.today}</td>
            ${moveCell(r.dod, sec.unit, sec.dir)}
            ${moveCell(r.wow, sec.unit, sec.dir)}
            ${moveCell(r.ytd, sec.unit, sec.dir)}
          </tr>`).join('')}
      `).join('')}
    </tbody>`;

  const badge = document.getElementById('boardBadge');
  badge.textContent = feed.delayed === false ? 'Live feed' : 'Indicative, delayed data';
  badge.classList.toggle('live', feed.delayed === false);

  document.getElementById('boardCaption').innerHTML =
    `<span>Source: <b>${feed.source || 'unknown'}</b> · indicative mid levels, not executable.</span>
     <span>As at <b>${fmtStamp(feed.asOf || new Date().toISOString())}</b></span>`;
}

/* ==================== bond incurrence covenant table =================== */
function renderBondCovenants(){
  const rows = DATA.covenants.bondIncurrence.map(c => {
    const st   = covenantStatus({ ...c, warning: c.direction === 'max' ? c.threshold * 0.85 : c.threshold * 1.15 });
    const head = covenantHeadroom(c);
    return `<tr>
      <td>${c.test}</td>
      <td class="num">${c.direction === 'max' ? '≤ ' : '≥ '}${c.threshold.toFixed(2)}${c.unit}</td>
      <td class="num strong">${c.actual.toFixed(3)}${c.unit}</td>
      <td class="num"><span class="pill nocaps ${st}">${head >= 0 ? '+' : '−'}${Math.abs(head).toFixed(2)}${c.unit}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('bondCovenantTable').innerHTML = `
    <thead><tr><th>Incurrence test</th><th class="num">Covenant</th><th class="num">Pro forma</th><th class="num">Headroom</th></tr></thead>
    <tbody>${rows}</tbody>`;
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
  renderMtm();
  loadBondFeed();
  renderBondCovenants();
  renderBoard();
  initCovenantControls();
  initNav();
}

boot();
