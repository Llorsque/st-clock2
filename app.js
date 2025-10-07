// Interval Training Timer (Gymboss-style) — sequence of timers with auto-advance
const screen = document.getElementById('screen');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const toggleSound = document.getElementById('toggle-sound');
const toggleLoop = document.getElementById('toggle-loop');
const listEl = document.getElementById('list');
const totalTimeEl = document.getElementById('total-time');
const nowTypeEl = document.getElementById('now-type');
const nowLabelEl = document.getElementById('now-label');
const nextLabelEl = document.getElementById('next-label');
const progressEl = document.getElementById('progress');

const btnAddWork = document.getElementById('btn-add-work');
const btnAddRest = document.getElementById('btn-add-rest');
const btnClear = document.getElementById('btn-clear');
const btnDemo = document.getElementById('btn-demo');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const beepAudio = new Audio(); // simple beep placeholder

/* ==== 7-seg rectangular digits ==== */
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

function createDigit() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 140 220');
  svg.classList.add('digit');

  const t = 34, o = 14;
  const W = 140 - 2*o, H = 220 - 2*o, mid = o + H/2;

  function rrect(x,y,w,h){
    const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.classList.add('segment');
    svg.appendChild(r);
    return r;
  }

  const segs = {
    a: rrect(o, o, W, t),
    g: rrect(o, mid - t/2, W, t),
    d: rrect(o, o+H - t, W, t),
    f: rrect(o, o, t, H/2),
    e: rrect(o, mid, t, H/2),
    b: rrect(o+W - t, o, t, H/2),
    c: rrect(o+W - t, mid, t, H/2),
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
function createDot() {
  const wrap = document.createElement('div');
  wrap.className = 'separator';
  const stack = document.createElement('div');
  stack.className = 'sep-dot';
  const dot = document.createElement('div'); dot.className = 'dot-rect';
  stack.appendChild(dot);
  wrap.appendChild(stack);
  return wrap;
}

const digits = [];
function buildDisplay() {
  screen.innerHTML = '';
  const m1 = createDigit(); const m2 = createDigit();
  const s1 = createDigit(); const s2 = createDigit();
  const h1 = createDigit(); const h2 = createDigit();
  digits.splice(0, digits.length, m1, m2, s1, s2, h1, h2);

  screen.appendChild(m1); screen.appendChild(m2);
  screen.appendChild(createColon());
  screen.appendChild(s1); screen.appendChild(s2);
  screen.appendChild(createDot());
  screen.appendChild(h1); screen.appendChild(h2);
}
buildDisplay();

function renderTwoDigits(value, d1, d2) {
  const str = String(value).padStart(2, '0');
  d1._set(str[0]); d2._set(str[1]);
}
function updateDisplay(ms) {
  const h = Math.floor((ms % 1000) / 10);
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60);
  renderTwoDigits(m, digits[0], digits[1]);
  renderTwoDigits(s, digits[2], digits[3]);
  renderTwoDigits(h, digits[4], digits[5]);
}

/* ==== Interval sequence editor ==== */
let intervals = []; // {type: 'work'|'rest', label, ms}
let currentIndex = 0;
let running = false;
let endTimeMs = 0;
let totalMsOfCurrent = 0;
let rafId = null;

function addRow(it, idx) {
  const li = document.createElement('li');
  li.className = 'row';
  li.dataset.index = idx;

  const drag = document.createElement('div'); drag.className = 'drag'; drag.textContent = '≡';
  const type = document.createElement('div'); type.className = 'type ' + it.type; type.textContent = it.type === 'work' ? 'WORK' : 'REST';
  const label = document.createElement('input'); label.type = 'text'; label.value = it.label || (it.type === 'work' ? 'Oefening' : 'Rust');
  const min = document.createElement('input'); min.type = 'number'; min.min = 0; min.step = 1; min.value = Math.floor(it.ms/60000);
  const sec = document.createElement('input'); sec.type = 'number'; sec.min = 0; sec.max = 59; sec.step = 1; sec.value = Math.floor(it.ms/1000)%60;
  const hun = document.createElement('input'); hun.type = 'number'; hun.min = 0; hun.max = 99; hun.step = 1; hun.value = Math.floor(it.ms%1000/10);
  const actions = document.createElement('div'); actions.className = 'actions';
  const up = document.createElement('button'); up.className='iconbtn'; up.textContent='↑';
  const down = document.createElement('button'); down.className='iconbtn'; down.textContent='↓';
  const del = document.createElement('button'); del.className='iconbtn'; del.textContent='✕';

  li.append(drag, type, label, min, sec, hun, actions);
  actions.append(up, down, del);
  listEl.appendChild(li);

  function recompute() {
    const m = Math.max(0, parseInt(min.value)||0);
    const s = Math.max(0, Math.min(59, parseInt(sec.value)||0));
    const h = Math.max(0, Math.min(99, parseInt(hun.value)||0));
    it.label = label.value.trim();
    it.ms = m*60000 + s*1000 + h*10;
    refreshTotals();
  }
  label.addEventListener('input', recompute);
  min.addEventListener('input', recompute);
  sec.addEventListener('input', recompute);
  hun.addEventListener('input', recompute);

  up.addEventListener('click', ()=> moveRow(idx, -1));
  down.addEventListener('click', ()=> moveRow(idx, +1));
  del.addEventListener('click', ()=> removeRow(idx));
}

function rebuildList() {
  listEl.innerHTML = '';
  intervals.forEach((it, i) => addRow(it, i));
  refreshTotals();
}

function moveRow(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= intervals.length) return;
  const tmp = intervals[i];
  intervals[i] = intervals[j];
  intervals[j] = tmp;
  rebuildList();
}

function removeRow(i) {
  intervals.splice(i,1);
  rebuildList();
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
  nowTypeEl.textContent = cur ? (cur.type==='work'?'Oefening':'Rust') : '—';
  nowTypeEl.className = 'pill now-type';
  nowTypeEl.classList.add(cur && cur.type==='work' ? 'work' : 'rest');
  nowLabelEl.textContent = cur?.label || '—';
  const nxt = intervals[currentIndex+1] || (toggleLoop.checked ? intervals[0] : null);
  nextLabelEl.textContent = nxt ? `${nxt.type==='work'?'Oefening':'Rust'} — ${nxt.label}` : '—';
}

/* ==== Playback engine ==== */
function playFrom(index) {
  if (!intervals.length) return;
  currentIndex = index;
  const cur = intervals[currentIndex];
  if (!cur) return;
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

  if (remaining <= 0) {
    if (toggleSound.checked) { /* optional: could play a sound */ }
    advance();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

function advance() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  currentIndex += 1;
  if (currentIndex >= intervals.length) {
    if (toggleLoop.checked) currentIndex = 0;
    else {
      running = false;
      btnStart.disabled = false;
      updateDisplay(0);
      updateMeta();
      return;
    }
  }
  playFrom(currentIndex);
}

function start() {
  if (running) return;
  if (!intervals.length) return;
  playFrom(currentIndex);
}

function pause() {
  if (!running) return;
  running = false;
  btnStart.disabled = false;
  if (rafId) cancelAnimationFrame(rafId);
  const remaining = Math.max(0, endTimeMs - performance.now());
  intervals[currentIndex].ms = remaining;
}

function reset() {
  running = false;
  btnStart.disabled = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  rebuildList(); // recompute ms from inputs
  currentIndex = 0;
  updateDisplay(intervals[0]?.ms || 0);
  progressEl.style.width = '0%';
  updateMeta();
}

/* ==== UI event bindings ==== */
btnStart.addEventListener('click', start);
btnPause.addEventListener('click', pause);
btnReset.addEventListener('click', reset);
btnNext.addEventListener('click', () => advance());
btnPrev.addEventListener('click', () => {
  if (!intervals.length) return;
  currentIndex = Math.max(0, currentIndex - 1);
  playFrom(currentIndex);
});

btnAddWork.addEventListener('click', () => { intervals.push({type:'work', label:'Oefening', ms: 10*60000}); rebuildList(); });
btnAddRest.addEventListener('click', () => { intervals.push({type:'rest', label:'Rust', ms: 5*60000}); rebuildList(); });
btnClear.addEventListener('click', () => { intervals = []; rebuildList(); reset(); });

btnDemo.addEventListener('click', () => {
  intervals = [
    {type:'work', label:'Warming-up', ms: 2*60000},
    {type:'rest', label:'Rust', ms: 30*1000},
    {type:'work', label:'Oefening 1', ms: 3*60000},
    {type:'rest', label:'Rust', ms: 60*1000},
    {type:'work', label:'Oefening 2', ms: 3*60000},
    {type:'rest', label:'Rust', ms: 60*1000},
    {type:'work', label:'Cooling-down', ms: 2*60000},
  ];
  rebuildList();
  currentIndex = 0;
  updateDisplay(intervals[0].ms);
  updateMeta();
});

btnSave.addEventListener('click', () => {
  localStorage.setItem('intervals-v1', JSON.stringify(intervals));
  alert('Schema opgeslagen in je browser.');
});
btnLoad.addEventListener('click', () => {
  const raw = localStorage.getItem('intervals-v1');
  if (!raw) return alert('Geen schema gevonden.');
  try { intervals = JSON.parse(raw) || []; } catch(e){ intervals = []; }
  rebuildList();
  currentIndex = 0;
  updateDisplay(intervals[0]?.ms || 0);
  updateMeta();
});

intervals = [{type:'work', label:'Oefening', ms: 10*60000},{type:'rest', label:'Rust', ms:5*60000},{type:'work', label:'Volgende oefening', ms:10*60000}];
rebuildList();
currentIndex = 0;
updateDisplay(intervals[0].ms);
updateMeta();
