// Trias Training Timer — v7
const screen = document.getElementById('screen');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const toggleLoop = document.getElementById('toggle-loop');
const progressEl = document.getElementById('progress');

const nowLabelEl = document.getElementById('now-label');
const nextLabelEl = document.getElementById('next-label');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const btnSettings = document.getElementById('btn-settings');
const btnClose = document.getElementById('btn-close');

const listEl = document.getElementById('list');
const totalTimeEl = document.getElementById('total-time');
const btnAddWork = document.getElementById('btn-add-work');
const btnAddRest = document.getElementById('btn-add-rest');
const btnAddTransition = document.getElementById('btn-add-transition');
const btnDemo = document.getElementById('btn-demo');
const btnClear = document.getElementById('btn-clear');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const toggleSound = document.getElementById('toggle-sound');

/* 7-seg digits mapping */
const SEGMENTS = {
  '0': [1,1,1,1,1,1,0],
  '1': [0,1,1,0,0,0,0],
  '2': [1,1,0,1,1,0,1],
  '3': [1,1,1,1,0,0,1],
  '4': [0,1,1,0,0,1,1],
  '5': [1,0,1,1,0,1,1],
  '6': [1,0,1,1,1,1,1],
  '7': [1,1,1,0,0,0,0],
  '8': [1,1,1,1,1,1,1],
  '9': [1,1,1,1,0,1,1],
};

/* Equal rectangular segments — no overlaps */
function createDigit() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 160 260');
  svg.classList.add('digit');

  const o = 8;
  const t = 36;
  const W = 160 - 2*o;
  const H = 260 - 2*o;

  const innerW = W - 2*t;
  const topY = o;
  const vertH = (H - 3*t)/2;
  const midY = o + t + vertH;
  const botY = o + H - t;
  const leftX = o;
  const rightX = o + W - t;
  const horizX = o + t;

  function rr(x,y,w,h){
    const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x', Math.round(x));
    r.setAttribute('y', Math.round(y));
    r.setAttribute('width', Math.round(w));
    r.setAttribute('height', Math.round(h));
    r.classList.add('segment');
    svg.appendChild(r);
    return r;
  }

  const segs = {
    a: rr(horizX, topY, innerW, t),
    g: rr(horizX, midY, innerW, t),
    d: rr(horizX, botY, innerW, t),
    f: rr(leftX,  topY + t, t, vertH),
    e: rr(leftX,  midY + t, t, vertH),
    b: rr(rightX, topY + t, t, vertH),
    c: rr(rightX, midY + t, t, vertH),
  };

  svg._segments = segs;
  svg._set = (digit) => {
    const on = SEGMENTS[digit] || [0,0,0,0,0,0,0];
    ['a','b','c','d','e','f','g'].forEach((k, i) => {
      if (on[i]) segs[k].classList.add('lit'); else segs[k].classList.remove('lit');
    });
  };
  svg._set('8');
  return svg;
}

function createColon() {
  const wrap = document.createElement('div');
  wrap.className = 'separator';
  const stack = document.createElement('div');
  stack.className = 'sep-colon';
  const t = document.createElement('div'); t.className = 'sep-circle';
  const b = document.createElement('div'); b.className = 'sep-circle';
  stack.appendChild(t); stack.appendChild(b);
  wrap.appendChild(stack);
  return wrap;
}

const digits = [];
function buildDisplay() {
  screen.innerHTML = '';
  const m1 = createDigit(); const m2 = createDigit();
  const s1 = createDigit(); const s2 = createDigit();
  digits.splice(0, digits.length, m1, m2, s1, s2);
  screen.appendChild(m1); screen.appendChild(m2);
  screen.appendChild(createColon());
  screen.appendChild(s1); screen.appendChild(s2);
}
buildDisplay();

function renderTwoDigits(value, d1, d2) {
  const str = String(value).padStart(2, '0');
  d1._set(str[0]); d2._set(str[1]);
}
function updateDisplay(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const s = Math.max(0, totalSeconds % 60);
  const m = Math.max(0, Math.floor(totalSeconds / 60));
  renderTwoDigits(m, digits[0], digits[1]);
  renderTwoDigits(s, digits[2], digits[3]);
}

/* Interval sequence */
let intervals = []; // empty by default
let currentIndex = 0;
let running = false;
let endTimeMs = 0;
let totalMsOfCurrent = 0;
let rafId = null;

function applyMode(type){
  document.body.classList.toggle('transition-mode', type === 'transition');
}

function rebuildList() {
  listEl.innerHTML = '';
  intervals.forEach((it, i) => addRow(it, i));
  refreshTotals();
}
function addRow(it, idx) {
  const li = document.createElement('li');
  li.className = 'row';

  const typeSel = document.createElement('select');
  typeSel.className = 'type-select';
  typeSel.innerHTML = `<option value="work">Oefening</option><option value="rest">Rust</option><option value="transition">Overgang</option>`;
  typeSel.value = it.type;

  const label = document.createElement('input'); label.type = 'text'; label.value = it.label || (it.type === 'work' ? 'Oefening' : it.type==='transition'?'Overgang':'Rust');
  const min = document.createElement('input'); min.type = 'number'; min.min = 0; min.step = 1; min.value = Math.floor(it.ms/60000);
  const sec = document.createElement('input'); sec.type = 'number'; sec.min = 0; sec.max = 59; sec.step = 1; sec.value = Math.floor(it.ms/1000)%60;
  const del = document.createElement('button'); del.className='iconbtn'; del.textContent='✕';

  li.append(typeSel, label, min, sec, del);
  listEl.appendChild(li);

  function recompute() {
    const m = Math.max(0, parseInt(min.value)||0);
    const s = Math.max(0, Math.min(59, parseInt(sec.value)||0));
    it.type = typeSel.value;
    it.label = label.value.trim();
    it.ms = m*60000 + s*1000;
    refreshTotals();
  }
  [typeSel,label,min,sec].forEach(el=>el.addEventListener('input', recompute));
  del.addEventListener('click', ()=>{ intervals.splice(idx,1); rebuildList(); });
}

function refreshTotals() {
  const total = intervals.reduce((sum, it) => sum + it.ms, 0);
  const min = Math.floor(total/60000);
  const sec = Math.floor(total/1000)%60;
  totalTimeEl.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  updateMeta();
}

function updateMeta() {
  const cur = intervals[currentIndex];
  nowLabelEl.textContent = cur?.label || '—';
  applyMode(cur?.type || 'work');
  const nxt = intervals[currentIndex+1] || (toggleLoop.checked ? intervals[0] : null);
  nextLabelEl.textContent = nxt ? `${nxt.label}` : '—';
}

/* Playback */
function playFrom(index) {
  if (!intervals.length) return;
  currentIndex = index;
  const cur = intervals[currentIndex];
  if (!cur) return;
  applyMode(cur.type);
  totalMsOfCurrent = cur.ms;
  endTimeMs = performance.now() + cur.ms;
  running = true;
  btnStart.disabled = true;
  loop();
  updateMeta();
}
function loop() {
  const now = performance.now();
  const remaining = Math.max(0, endTimeMs - now);
  updateDisplay(remaining);
  const pct = totalMsOfCurrent ? (1 - remaining/totalMsOfCurrent) * 100 : 0;
  progressEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (remaining <= 0) { advance(); return; }
  rafId = requestAnimationFrame(loop);
}
function advance() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  currentIndex += 1;
  if (currentIndex >= intervals.length) {
    if (toggleLoop.checked) currentIndex = 0;
    else { running = false; btnStart.disabled = false; updateDisplay(0); updateMeta(); return; }
  }
  playFrom(currentIndex);
}
function start() { if (!running && intervals.length) playFrom(currentIndex); }
function pause() {
  if (!running) return;
  running = false; btnStart.disabled = false;
  if (rafId) cancelAnimationFrame(rafId);
  const remaining = Math.max(0, endTimeMs - performance.now());
  intervals[currentIndex].ms = remaining;
}
function reset() {
  running = false; btnStart.disabled = false;
  if (rafId) cancelAnimationFrame(rafId); rafId = null;
  rebuildList(); currentIndex = 0;
  updateDisplay(intervals[0]?.ms || 0); progressEl.style.width = '0%'; updateMeta();
}

/* Events */
btnStart.addEventListener('click', start);
btnPause.addEventListener('click', pause);
btnReset.addEventListener('click', reset);
btnNext.addEventListener('click', () => advance());
btnPrev.addEventListener('click', () => { if (!intervals.length) return; currentIndex = Math.max(0, currentIndex - 1); playFrom(currentIndex); });

btnAddWork.addEventListener('click', () => { intervals.push({type:'work', label:'Nieuwe oefening', ms: 0}); rebuildList(); });
btnAddRest.addEventListener('click', () => { intervals.push({type:'rest', label:'Rust', ms: 0}); rebuildList(); });
btnAddTransition.addEventListener('click', () => { intervals.push({type:'transition', label:'Overgang', ms: 0}); rebuildList(); });
btnDemo.addEventListener('click', () => {
  intervals = [
    {type:'work', label:'Warming-up', ms: 2*60000},
    {type:'transition', label:'Overgang', ms: 15000},
    {type:'rest', label:'Rust', ms: 30000},
    {type:'work', label:'Oefening 1', ms: 3*60000},
    {type:'transition', label:'Overgang', ms: 15000},
    {type:'rest', label:'Rust', ms: 60000},
    {type:'work', label:'Oefening 2', ms: 3*60000},
    {type:'rest', label:'Rust', ms: 60000},
    {type:'work', label:'Cooling-down', ms: 2*60000},
  ];
  rebuildList(); currentIndex = 0; updateDisplay(intervals[0].ms); updateMeta();
});
btnClear.addEventListener('click', () => { intervals = []; rebuildList(); reset(); });

btnSave.addEventListener('click', () => { localStorage.setItem('trias-intervals-v7', JSON.stringify(intervals)); alert('Schema opgeslagen.'); });
btnLoad.addEventListener('click', () => {
  const raw = localStorage.getItem('trias-intervals-v7');
  if (!raw) return alert('Geen schema gevonden.');
  try { intervals = JSON.parse(raw) || []; } catch(e){ intervals = []; }
  rebuildList(); currentIndex = 0; updateDisplay(intervals[0]?.ms || 0); updateMeta();
});

/* Modal open/close */
function openModal(){ modal.hidden = false; modalBackdrop.hidden = false; }
function closeModal(){ modal.hidden = true; modalBackdrop.hidden = true; }
btnSettings.addEventListener('click', openModal);
btnClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && !modal.hidden) closeModal(); });

/* Init */
rebuildList(); currentIndex = 0; updateDisplay(0); updateMeta();
