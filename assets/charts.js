/* =========================================================================
   CHARTS — Chart.js theme + builders for every section except the RCF
   prototype (which keeps its own charts in assets/rcf.js).
   ========================================================================= */

const FONT = "'Inter','Infra',system-ui,sans-serif";
const REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------------------------- shared theme ---------------------------- */
Chart.defaults.font.family = FONT;
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#5F7C7E';
Chart.defaults.animation = REDUCED ? false : { duration: 600 };
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 12;
Chart.defaults.plugins.legend.labels.boxHeight = 7;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.legend.labels.font = { family: FONT, size: 11.5 };
Chart.defaults.plugins.tooltip.backgroundColor = '#0C5C60';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = { family: FONT, size: 12, weight: '600' };
Chart.defaults.plugins.tooltip.bodyFont = { family: FONT, size: 12 };

const AXIS = {
  grid:   { color:'#EAF1F2', drawTicks:false },
  border: { display:false },
  ticks:  { font:{ family:FONT, size:11 }, color:'#5F7C7E', padding:8 },
};
const AXIS_X = {
  grid:   { display:false },
  border: { color:'#D8E4E5' },
  ticks:  { font:{ family:FONT, size:11 }, color:'#5F7C7E', maxRotation:0, autoSkipPadding:10 },
};

const eurM   = n => '€' + Number(n).toLocaleString('en-GB', { maximumFractionDigits:1 }) + 'm';
const pct    = (n, d = 2) => Number(n).toFixed(d) + '%';
const charts = {};   // registry, keyed by canvas id

function mount(id, config){
  const el = document.getElementById(id);
  if (!el) return null;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el, config);
  return charts[id];
}

/* =========================== donut (debt mix) ========================== */
function buildDonut(id, slices, opts = {}){
  const live = slices.filter(s => s.value > 0);
  const total = live.reduce((a, s) => a + s.value, 0);
  return mount(id, {
    type: 'doughnut',
    data: {
      labels: live.map(s => s.label),
      datasets: [{
        data: live.map(s => s.value),
        backgroundColor: live.map(s => tone(s.color)),
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      layout: { padding: 4 },
      plugins: {
        legend: { position: 'bottom', labels: { boxHeight:7, padding:11, font:{ family:FONT, size:11 } } },
        tooltip: {
          callbacks: {
            label: c => {
              const v = c.parsed;
              return ` ${eurM(v)} · ${(v / total * 100).toFixed(1)}%`;
            },
          },
        },
      },
      ...opts,
    },
  });
}

/* ==================== stacked bar (maturity profile) =================== */
function buildMaturityChart(id, m){
  return mount(id, {
    type: 'bar',
    data: {
      labels: m.years,
      datasets: m.series.map(s => ({
        label: s.label,
        data: s.data,
        backgroundColor: tone(s.color),
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.66,
        categoryPercentage: 0.8,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: { ...AXIS_X, stacked:true },
        y: {
          ...AXIS, stacked:true, beginAtZero:true,
          ticks: { ...AXIS.ticks, callback: v => '€' + v + 'm' },
        },
      },
      plugins: {
        legend: { position:'bottom' },
        tooltip: {
          callbacks: {
            label: c => c.parsed.y ? ` ${c.dataset.label}: ${eurM(c.parsed.y)}` : null,
            footer: items => {
              const t = items.reduce((a, i) => a + i.parsed.y, 0);
              return t ? 'Total: ' + eurM(t) : '';
            },
          },
        },
      },
    },
  });
}

/* ============ combo, dual axis (LTV vs cost of debt over time) ========= */
function buildTrendChart(id, t){
  const dashFrom = t.forecastFrom;
  const splitDash = ctx => (ctx.p0DataIndex >= dashFrom - 1 ? [5, 4] : undefined);

  return mount(id, {
    type: 'bar',
    data: {
      labels: t.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Portfolio LTV (left)',
          data: t.ltv,
          yAxisID: 'y',
          backgroundColor: t.ltv.map((_, i) =>
            i >= dashFrom ? 'rgba(117,194,108,.42)' : tone('--c-green')),
          borderColor: tone('--c-green'),
          borderWidth: t.ltv.map((_, i) => (i >= dashFrom ? 1 : 0)),
          borderRadius: 3,
          barPercentage: 0.62,
          categoryPercentage: 0.8,
          order: 2,
        },
        {
          type: 'line',
          label: 'Wtd-avg cost of debt (right)',
          data: t.wacd,
          yAxisID: 'y1',
          borderColor: tone('--c-coral'),
          backgroundColor: tone('--c-coral'),
          borderWidth: 2.4,
          pointRadius: 3.5,
          pointHoverRadius: 5.5,
          tension: 0.25,
          fill: false,
          segment: { borderDash: splitDash },
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: AXIS_X,
        y: {
          ...AXIS, position:'left', beginAtZero:true,
          title: { display:true, text:'LTV (%)', font:{ family:FONT, size:11, weight:'600' }, color:'#5F7C7E' },
          ticks: { ...AXIS.ticks, callback: v => v + '%' },
        },
        y1: {
          position: 'right',
          grid: { display:false },
          border: { display:false },
          title: { display:true, text:'Cost of debt (%)', font:{ family:FONT, size:11, weight:'600' }, color:'#5F7C7E' },
          ticks: { ...AXIS.ticks, callback: v => v.toFixed(1) + '%' },
        },
      },
      plugins: {
        legend: { position:'bottom' },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label.replace(/ \((left|right)\)/, '')}: ${pct(c.parsed.y, 2)}`,
            afterBody: items => (items[0].dataIndex >= dashFrom ? 'Projected' : ''),
          },
        },
      },
    },
  });
}

/* ============== green bond: Z-spread since pricing (vs peer) ===========
   The series is stored at its finest granularity (4-hourly) and resampled
   for the coarser views, so only one series changes when a feed is wired
   in. The x axis is a category axis that thins its own labels, so the
   chart stays readable as the history since issuance grows.
   ====================================================================== */

/* last observation in each bucket, which is how a close is taken */
function resample(series, bucketHours){
  const step = series.stepHours || 4;
  const per = Math.max(1, Math.round(bucketHours / step));
  const t0 = Date.parse(series.start);
  const out = { t: [], langford: [], peer: [] };
  for (let i = per - 1; i < series.langfordZ.length; i += per){
    out.t.push(t0 + i * step * 3600000);
    out.langford.push(series.langfordZ[i]);
    out.peer.push(series.peerZ[i]);
  }
  const lastIdx = series.langfordZ.length - 1;
  if ((lastIdx - (per - 1)) % per !== 0){        // always keep the latest mark
    out.t.push(t0 + lastIdx * step * 3600000);
    out.langford.push(series.langfordZ[lastIdx]);
    out.peer.push(series.peerZ[lastIdx]);
  }
  return out;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function spreadLabel(ms, bucketHours){
  const d = new Date(ms);
  const day = `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  if (bucketHours < 24) return `${day} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
  if (bucketHours >= 168) return `w/c ${day}`;
  return day;
}

function buildSpreadChart(id, gb, timeframeKey){
  const sec = gb.secondary;
  const tf = (sec.timeframes || []).find(f => f.key === timeframeKey)
          || (sec.timeframes || [{ key:'1D', hours:24 }])[0];
  const r = resample(sec.series, tf.hours);
  const labels = r.t.map(ms => spreadLabel(ms, tf.hours));
  const reoffer = gb.terms.spreadToMs;

  const el = document.getElementById(id);
  const existing = el && Chart.getChart(el);
  if (existing){
    existing.data.labels = labels;
    existing.data.datasets[0].data = r.langford;
    existing.data.datasets[1].data = r.peer;
    existing.data.datasets[2].data = labels.map(() => reoffer);
    existing.options.elements.point.radius = labels.length > 40 ? 0 : 3;
    existing.update('none');
    return existing;
  }

  return mount(id, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Langford 4.000% 2031', data: r.langford,
          borderColor: tone('--c-teal'), backgroundColor: tone('--c-teal'),
          borderWidth: 2.4, pointHoverRadius: 5, tension: 0.2, fill: false },
        { label: gb.tradingView.comparison.peerLabel, data: r.peer,
          borderColor: tone('--c-orchid'), backgroundColor: tone('--c-orchid'),
          borderWidth: 2, pointHoverRadius: 5, tension: 0.2, fill: false },
        { label: 'Re-offer spread (+' + reoffer + 'bp)', data: labels.map(() => reoffer),
          borderColor: '#0C5C60', borderWidth: 1.3, borderDash: [5, 4],
          pointRadius: 0, pointHoverRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      elements: { point: { radius: labels.length > 40 ? 0 : 3 } },
      scales: {
        x: { ...AXIS_X, ticks: { ...AXIS_X.ticks, autoSkip: true, maxTicksLimit: 12 } },
        /* no forced zero: the axis tracks the data, so a few basis points
           of movement stay visible however long the history gets */
        y: { ...AXIS, ticks: { ...AXIS.ticks, callback: v => v + 'bp' } },
      },
      plugins: {
        legend: { position:'bottom' },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y}bp` } },
      },
    },
  });
}

/* ============================== gauges ================================= */
/* Covenant status for a reading against its threshold. */
function covenantStatus(cfg){
  const { actual, threshold, warning, direction } = cfg;
  if (direction === 'max'){
    if (actual > threshold) return 'breach';
    if (actual > warning)   return 'watch';
  } else {
    if (actual < threshold) return 'breach';
    if (actual < warning)   return 'watch';
  }
  return 'ok';
}

const STATUS_COLOR = { ok:'#4FA254', watch:'#FDB71E', breach:'#D9534F' };
const STATUS_LABEL = { ok:'Compliant', watch:'Tight headroom', breach:'Breach' };

/* Headroom expressed in the covenant's own units. */
function covenantHeadroom(cfg){
  return cfg.direction === 'max' ? cfg.threshold - cfg.actual : cfg.actual - cfg.threshold;
}

/* Draws the amber/red covenant bands and the threshold tick on a gauge. */
const gaugeBands = {
  id: 'gaugeBands',
  beforeDatasetsDraw(chart, _args, o){
    if (!o || !o.max) return;
    const meta = chart.getDatasetMeta(0);
    const arc  = meta.data && meta.data[0];
    if (!arc) return;

    const { x, y, innerRadius, outerRadius } = arc;
    const START = -Math.PI * 1.166667;              // matches rotation -210°
    const SWEEP =  Math.PI * 1.333333;              // matches circumference 240°
    const ang   = v => START + SWEEP * Math.min(Math.max(v / o.max, 0), 1);
    const ctx   = chart.ctx;
    const rIn   = outerRadius + 5;
    const rOut  = outerRadius + 11;

    const band = (from, to, color) => {
      if (to <= from) return;
      ctx.beginPath();
      ctx.arc(x, y, rOut, ang(from), ang(to));
      ctx.arc(x, y, rIn,  ang(to), ang(from), true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    ctx.save();
    if (o.direction === 'max'){
      band(0, o.warning, 'rgba(79,162,84,.20)');
      band(o.warning, o.threshold, 'rgba(253,183,30,.35)');
      band(o.threshold, o.max, 'rgba(217,83,79,.30)');
    } else {
      band(0, o.threshold, 'rgba(217,83,79,.30)');
      band(o.threshold, o.warning, 'rgba(253,183,30,.35)');
      band(o.warning, o.max, 'rgba(79,162,84,.20)');
    }

    /* covenant threshold tick, drawn across the full arc */
    const a = ang(o.threshold);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * innerRadius, y + Math.sin(a) * innerRadius);
    ctx.lineTo(x + Math.cos(a) * (rOut + 2),  y + Math.sin(a) * (rOut + 2));
    ctx.strokeStyle = '#0C5C60';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    /* threshold label, haloed so it reads over the bands */
    ctx.font = `600 10.5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lx = x + Math.cos(a) * (rOut + 18);
    const ly = y + Math.sin(a) * (rOut + 18);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(o.thresholdLabel, lx, ly);
    ctx.fillStyle = '#0C5C60';
    ctx.fillText(o.thresholdLabel, lx, ly);
    ctx.restore();
  },
};

function buildGauge(id, cfg){
  const status = covenantStatus(cfg);
  const shown  = Math.min(Math.max(cfg.actual, 0), cfg.max);
  return mount(id, {
    type: 'doughnut',
    data: {
      labels: [cfg.label, 'Remaining scale'],
      datasets: [{
        data: [shown, cfg.max - shown],
        backgroundColor: [STATUS_COLOR[status], '#EAF1F2'],
        borderWidth: 0,
        circumference: 240,
        rotation: -120,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      layout: { padding: { top:14, bottom:2, left:34, right:34 } },
      plugins: {
        legend: { display:false },
        tooltip: { enabled:false },
        gaugeBands: {
          max: cfg.max,
          threshold: cfg.threshold,
          warning: cfg.warning,
          direction: cfg.direction,
          thresholdLabel: cfg.thresholdLabel || String(cfg.threshold),
        },
      },
    },
    plugins: [gaugeBands],
  });
}
