/* =========================================================================
   RCF UTILISATION — the original prototype logic, unchanged.
   Ledger, capacity bar, balance/rate charts and the draw/repay modal all
   behave exactly as they did before the dashboard was split into sections.
   ========================================================================= */

/* ---------------- state ---------------- */
const BASE = 300, ACCORDION = 100, TOTAL = BASE + ACCORDION;
let uid = 100;

let txns = [
  {id:++uid, date:'2026-01-22', type:'draw', amount:60, euribor:2.15, margin:1.20, note:'Asset A — logistics'},
  {id:++uid, date:'2026-02-12', type:'draw', amount:50, euribor:2.10, margin:1.20, note:'Asset B — residential'},
  {id:++uid, date:'2026-03-18', type:'repay', amount:30, note:'Capital call proceeds'},
  {id:++uid, date:'2026-04-08', type:'draw', amount:70, euribor:2.05, margin:1.25, note:'Asset C — residential'},
  {id:++uid, date:'2026-05-14', type:'draw', amount:40, euribor:2.00, margin:1.25, note:'Asset D — residential (forward)'},
  {id:++uid, date:'2026-06-11', type:'repay', amount:50, note:'Capital call proceeds'},
  {id:++uid, date:'2026-06-26', type:'draw', amount:30, euribor:1.95, margin:1.25, note:'Working-capital bridge'},
];

/* ---------------- helpers ---------------- */
const sorted = () => [...txns].sort((a,b)=> a.date<b.date?-1: a.date>b.date?1: a.id-b.id);
const eur = n => '€'+ n.toLocaleString('en-GB',{maximumFractionDigits:1}) +'m';
const fmtDate = d => { const [y,m,day]=d.split('-'); return day+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]+' '+y.slice(2); };

/* running balance series */
function series(){
  const s = sorted();
  let bal=0; const pts=[];
  // seed at start of year
  pts.push({label:'01 Jan 26', bal:0, seed:true});
  s.forEach(t=>{
    bal += t.type==='draw'? t.amount : -t.amount;
    pts.push({label:fmtDate(t.date), bal:+bal.toFixed(1), t});
  });
  return pts;
}

/* current outstanding */
function outstanding(){
  return sorted().reduce((a,t)=> a + (t.type==='draw'? t.amount : -t.amount), 0);
}

/* FIFO weighted-average all-in on current outstanding */
function wavg(){
  const tranches=[];
  sorted().forEach(t=>{
    if(t.type==='draw') tranches.push({amt:t.amount, rate:t.euribor+t.margin});
    else{ let r=t.amount;
      while(r>1e-9 && tranches.length){
        const cut=Math.min(r, tranches[0].amt);
        tranches[0].amt-=cut; r-=cut;
        if(tranches[0].amt<=1e-9) tranches.shift();
      }
    }
  });
  const out=tranches.reduce((a,x)=>a+x.amt,0);
  if(out<=0) return {rate:0, out:0};
  return {rate: tranches.reduce((a,x)=>a+x.amt*x.rate,0)/out, out};
}

/* ---------------- render: KPIs ---------------- */
function renderKPIs(){
  const drawn = outstanding();
  const w = wavg();
  const headBase = BASE - drawn;
  const utilCommitted = drawn/BASE*100;
  const utilTotal = drawn/TOTAL*100;
  const lastEuribor = [...sorted()].reverse().find(t=>t.type==='draw');
  const cards = [
    {label:'Currently drawn', val:eur(drawn), sub:utilCommitted.toFixed(0)+'% of committed', cls:'accent'},
    {label:'Headroom to €300m', val:eur(headBase), sub:'committed undrawn'},
    {label:'Accordion capacity', val:eur(ACCORDION), sub:'uncommitted option'},
    {label:'Total available', val:eur(TOTAL-drawn), sub:utilTotal.toFixed(0)+'% of €400m used'},
    {label:'Wtd-avg all-in', val:w.rate.toFixed(2), unit:'%', sub:'on drawn balance', cls:'accent-rate'},
    {label:'Last EURIBOR fix', val:lastEuribor?lastEuribor.euribor.toFixed(2):'—', unit:'%', sub:'3M reference'},
  ];
  document.getElementById('kpis').innerHTML = cards.map(c=>`
    <div class="kpi ${c.cls||''}">
      <div class="label">${c.label}</div>
      <div class="val">${c.val}${c.unit?`<span class="unit">${c.unit}</span>`:''}</div>
      <div class="sub">${c.sub}</div>
    </div>`).join('');
}

/* ---------------- render: capacity bar ---------------- */
function renderCapacity(){
  const drawn = outstanding();
  const undrawnCommitted = Math.max(0, BASE - drawn);
  const drawnPct = drawn/TOTAL*100;
  const undrawnPct = undrawnCommitted/TOTAL*100;
  const accordPct = ACCORDION/TOTAL*100;
  document.getElementById('capBar').innerHTML = `
    <div class="seg drawn" style="width:${drawnPct}%">${drawn>=30?eur(drawn):''}</div>
    <div class="seg undrawn" style="width:${undrawnPct}%">${undrawnCommitted>=40?eur(undrawnCommitted):''}</div>
    <div class="seg accord" style="width:${accordPct}%">+€100m</div>`;
  document.getElementById('capReadout').textContent =
    `${eur(drawn)} drawn · ${eur(undrawnCommitted)} committed headroom · ${eur(ACCORDION)} accordion`;
}

/* ---------------- render: ledger ---------------- */
function renderLedger(){
  const s = sorted(); let bal=0;
  document.getElementById('ledgerBody').innerHTML = s.map(t=>{
    bal += t.type==='draw'? t.amount : -t.amount;
    const isDraw = t.type==='draw';
    const allin = isDraw ? (t.euribor+t.margin).toFixed(2)+'%' : '—';
    return `<tr>
      <td>${fmtDate(t.date)}</td>
      <td><span class="pill ${t.type}">${isDraw?'Draw':'Repay'}</span></td>
      <td class="num ${isDraw?'amt-draw':'amt-repay'}">${isDraw?'+':'−'}${eur(t.amount)}</td>
      <td class="num muted">${isDraw?t.euribor.toFixed(2)+'%':'—'}</td>
      <td class="num muted">${isDraw?t.margin.toFixed(2)+'%':'—'}</td>
      <td class="num" style="color:var(--rate)">${allin}</td>
      <td class="num">${eur(bal)}</td>
      <td><button class="del" title="Remove" onclick="removeTxn(${t.id})">×</button></td>
    </tr>`;
  }).join('');
}

/* ---------------- render: cost strip ---------------- */
function renderCost(){
  const drawn = outstanding();
  const w = wavg();
  const commBps = parseFloat(document.getElementById('commFee').value)||0;
  const interest = drawn * w.rate/100;                 // €m per annum
  const undrawnCommitted = Math.max(0, BASE - drawn);
  const commFee = undrawnCommitted * commBps/10000;    // €m per annum
  const total = interest + commFee;
  document.getElementById('costStrip').innerHTML = `
    <div class="c"><div class="l">Interest run-rate</div><div class="v">€${interest.toFixed(2)}m <small>/yr</small></div></div>
    <div class="c"><div class="l">Commitment fee</div><div class="v">€${commFee.toFixed(2)}m <small>/yr</small></div></div>
    <div class="c"><div class="l">All-in carry</div><div class="v">€${total.toFixed(2)}m <small>/yr</small></div></div>`;
}

/* ---------------- charts ---------------- */
let balanceChart, rateChart;
const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

/* faint shading of the accordion zone (300–400) */
const accordionZone = {
  id:'accordionZone',
  beforeDatasetsDraw(chart){
    const {ctx, chartArea:a, scales:{y}} = chart;
    if(!y) return;
    const yTop = y.getPixelForValue(TOTAL);
    const yBot = y.getPixelForValue(BASE);
    ctx.save();
    ctx.fillStyle='rgba(117,194,108,.10)';
    ctx.fillRect(a.left, yTop, a.right-a.left, yBot-yTop);
    ctx.restore();
  }
};

function buildBalanceChart(){
  const pts = series();
  const labels = pts.map(p=>p.label);
  const data = pts.map(p=>p.bal);
  const ctx = document.getElementById('balanceChart');
  if(balanceChart) balanceChart.destroy();
  balanceChart = new Chart(ctx,{
    type:'line',
    data:{ labels, datasets:[
      { label:'€400m ceiling (with accordion)', data:labels.map(()=>TOTAL),
        borderColor:'#75C26C', borderWidth:1.3, borderDash:[3,4], pointRadius:0, fill:false, tension:0 },
      { label:'€300m committed', data:labels.map(()=>BASE),
        borderColor:'#FDB71E', borderWidth:1.3, borderDash:[6,4], pointRadius:0, fill:false, tension:0 },
      { label:'Outstanding drawn', data,
        borderColor:'#0C5C60', borderWidth:2.4, stepped:true,
        fill:true, backgroundColor:'rgba(12,92,96,.10)',
        pointRadius:pts.map(p=>p.seed?0:3.5), pointBackgroundColor:'#0C5C60',
        pointHoverRadius:5 },
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      animation: reduceMotion? false : {duration:600},
      interaction:{mode:'nearest', intersect:false},
      scales:{
        y:{ min:0, max:420, ticks:{callback:v=>'€'+v+'m', font:{family:'Inter', size:11}, color:'#5F7C7E'},
            grid:{color:'#EAF1F2'}, border:{display:false} },
        x:{ ticks:{font:{family:'Inter', size:10}, color:'#5F7C7E', maxRotation:0, autoSkipPadding:12},
            grid:{display:false}, border:{color:'#D8E4E5'} }
      },
      plugins:{
        legend:{ position:'bottom', labels:{font:{family:'Inter', size:11.5}, color:'#5F7C7E', usePointStyle:true, pointStyleWidth:26, padding:16, boxHeight:6} },
        tooltip:{
          backgroundColor:'#0C5C60', padding:11, cornerRadius:8, titleFont:{family:'Inter', size:12},
          bodyFont:{family:'Inter', size:12}, displayColors:false,
          callbacks:{
            label:c=>{
              if(c.datasetIndex!==2) return c.dataset.label;
              const p=series()[c.dataIndex];
              let out=['Outstanding: '+eur(c.parsed.y)];
              if(p.t) out.push((p.t.type==='draw'?'Draw ':'Repay ')+eur(p.t.amount)+' — '+p.t.note);
              return out;
            }
          }
        }
      }
    },
    plugins:[accordionZone]
  });
}

function buildRateChart(){
  const draws = sorted().filter(t=>t.type==='draw');
  const labels = draws.map(t=>fmtDate(t.date));
  const allin = draws.map(t=>+(t.euribor+t.margin).toFixed(2));
  const eurib = draws.map(t=>t.euribor);
  const ctx = document.getElementById('rateChart');
  if(rateChart) rateChart.destroy();
  rateChart = new Chart(ctx,{
    type:'line',
    data:{ labels, datasets:[
      { label:'All-in secured', data:allin, borderColor:'#EB8175', borderWidth:2.2,
        pointRadius:4, pointBackgroundColor:'#EB8175', tension:.15, fill:false },
      { label:'3M EURIBOR', data:eurib, borderColor:'#8AA3A5', borderWidth:1.6,
        borderDash:[4,4], pointRadius:3, pointBackgroundColor:'#8AA3A5', tension:.15, fill:false },
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      animation: reduceMotion? false : {duration:600},
      interaction:{mode:'index', intersect:false},
      scales:{
        y:{ ticks:{callback:v=>v.toFixed(1)+'%', font:{family:'Inter', size:11}, color:'#5F7C7E'},
            grid:{color:'#EAF1F2'}, border:{display:false} },
        x:{ ticks:{font:{family:'Inter', size:10}, color:'#5F7C7E', maxRotation:0, autoSkipPadding:10},
            grid:{display:false}, border:{color:'#D8E4E5'} }
      },
      plugins:{
        legend:{ position:'bottom', labels:{font:{family:'Inter', size:11.5}, color:'#5F7C7E', usePointStyle:true, pointStyleWidth:22, padding:16, boxHeight:6} },
        tooltip:{ backgroundColor:'#0C5C60', padding:10, cornerRadius:8, bodyFont:{family:'Inter', size:12},
          titleFont:{family:'Inter', size:12},
          callbacks:{ label:c=> c.dataset.label+': '+c.parsed.y.toFixed(2)+'%' } }
      }
    }
  });
}

/* ---------------- orchestration ---------------- */
function renderAll(){
  renderKPIs(); renderCapacity(); renderLedger(); renderCost();
  buildBalanceChart(); buildRateChart();
}

function removeTxn(id){ txns = txns.filter(t=>t.id!==id); renderAll(); }
document.getElementById('commFee').addEventListener('input', renderCost);

/* ---------------- modal ---------------- */
let modalType='draw';
function openModal(type){
  modalType=type;
  document.getElementById('mTitle').textContent = type==='draw'?'Add drawdown':'Add repayment';
  document.getElementById('mSub').textContent = type==='draw'
    ? 'Fix a new tranche against the facility.'
    : 'Reduce outstanding balance (FIFO against earliest draws).';
  document.getElementById('rateFields').classList.toggle('hidden', type!=='draw');
  document.getElementById('mSave').textContent = type==='draw'?'Add drawdown':'Add repayment';
  document.getElementById('fDate').value = '2026-07-01';
  document.getElementById('fAmt').value='';
  document.getElementById('fEuribor').value= type==='draw'?'1.95':'';
  document.getElementById('fMargin').value= type==='draw'?'1.25':'';
  document.getElementById('fNote').value='';
  updateAllin();
  document.getElementById('overlay').classList.add('on');
  setTimeout(()=>document.getElementById('fAmt').focus(),50);
}
function closeModal(){ document.getElementById('overlay').classList.remove('on'); }
function updateAllin(){
  const e=parseFloat(document.getElementById('fEuribor').value);
  const m=parseFloat(document.getElementById('fMargin').value);
  document.getElementById('allinPreview').innerHTML = (!isNaN(e)&&!isNaN(m))
    ? `All-in: <b>${(e+m).toFixed(2)}%</b>` : 'All-in: <b>—</b>';
}
['fEuribor','fMargin'].forEach(id=>document.getElementById(id).addEventListener('input',updateAllin));
function saveEvent(){
  const date=document.getElementById('fDate').value;
  const amt=parseFloat(document.getElementById('fAmt').value);
  const note=document.getElementById('fNote').value.trim()||(modalType==='draw'?'Drawdown':'Repayment');
  if(!date||isNaN(amt)||amt<=0){ alert('Enter a date and a positive amount.'); return; }
  if(modalType==='draw'){
    const e=parseFloat(document.getElementById('fEuribor').value);
    const m=parseFloat(document.getElementById('fMargin').value);
    if(isNaN(e)||isNaN(m)){ alert('Enter EURIBOR and margin for a drawdown.'); return; }
    txns.push({id:++uid, date, type:'draw', amount:amt, euribor:e, margin:m, note});
  } else {
    txns.push({id:++uid, date, type:'repay', amount:amt, note});
  }
  closeModal(); renderAll();
}
document.getElementById('overlay').addEventListener('click',e=>{ if(e.target.id==='overlay') closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

/* go */
renderAll();
