'use strict';
/* 歸化口試 237: a level-based course for Taiwan's naturalization oral test.
   Items grow from seed to planted over a learn session, then come back for review
   on a widening schedule. Progress lives in localStorage on this device. */

const D = window.DATA;
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const REVIEW_INT = [0, 4 * HOUR, 12 * HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY, 120 * DAY];
const LONG_TERM = 4;         // review box at which an item counts as in long-term memory
const LEARN_BATCH = 5;       // new items per learn session
const REVIEW_BATCH = 25;     // items per review session
const PASS_SCORE = 70;     // score the household registration office requires for naturalization
const POINTS = {present: 10, mc: 50, listen: 75, rev: 75, tiles: 100, self: 50};
const STORE_KEY = 'naturalization-oral-237-v2';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const stripPunct = s => s.replace(/[。，、；：．.,\s（）()「」『』…]/g, '');
const CAT_EN = Object.fromEntries(D.cats.map(c => [c.zh, c.en]));

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  spk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5.5v13a1 1 0 0 1-1.5.86L9 12.86a1 1 0 0 1 0-1.72l9.5-6.5A1 1 0 0 1 20 5.5z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5.5v13a1 1 0 0 0 1.5.86L15 12.86a1 1 0 0 0 0-1.72L5.5 4.64A1 1 0 0 0 4 5.5z"/></svg>',
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c3.5 4.4 6.5 8.1 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.6 8.5 6.9 12 2.5z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.5 2c.5 3.2-1 5-2.6 6.8C8.3 10.6 7 12.3 7 14.8A5 5 0 0 0 12 20a5 5 0 0 0 5-5.2c0-1.8-.7-3.2-1.6-4.4-.2 1.3-.8 2.3-1.9 2.9.4-3.9-.6-7.6-1-11.3z"/></svg>',
  seed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 19c0-7 5-12 14-13-1 9-6 14-13 14H5v-1zm2-1c4-1 7-4 9-9-3 2-6 5-9 9z"/></svg>',
};

/* ---------- course structure ---------- */
const ITEMS = {};
const LEVELS = [];
(function buildCourse() {
  const vocabBy = {}, qBy = {};
  for (const v of D.vocab) (vocabBy[v.cat] = vocabBy[v.cat] || []).push(v);
  for (const q of D.qs) (qBy[q.cat] = qBy[q.cat] || []).push(q);
  const addLevel = (kind, cat, list) => {
    if (!list || !list.length) return;
    const n = LEVELS.length + 1, ids = [];
    for (const x of list) {
      const id = kind === 'v' ? 'v:' + x.zh : 'q:' + x.id;
      ITEMS[id] = kind === 'v'
        ? {id, kind, level: n, cat, zh: x.zh, pa: x.pa, p: x.p, en: x.en, refs: x.ids}
        : {id, kind, level: n, cat, num: x.id, q: x.q, qp: x.qp, qe: x.qe, key: x.key, kp: x.kp, ke: x.ke, a: x.a, ap: x.ap, ae: x.ae, tip: x.tip, own: x.own};
      ids.push(id);
    }
    LEVELS.push({n, kind, cat, ids});
  };
  for (const c of D.cats) {
    addLevel('v', c.zh, vocabBy[c.zh]);
    if (c.zh !== '題型') addLevel('q', c.zh, qBy[c.zh]);
  }
})();
const ALL_IDS = LEVELS.flatMap(l => l.ids);
const Q_IDS = ALL_IDS.filter(id => ITEMS[id].kind === 'q');
const levelTitle = l => l.cat === '題型' ? '題型' : l.cat.replace(/類$/, '');
const levelSub = l => (CAT_EN[l.cat] || '') + (l.kind === 'v' ? ' · words' : ' · questions');

/* ---------- state ---------- */
const defaults = () => ({
  v: 2, items: {}, days: {}, exams: [],
  settings: {goal: 1500, rate: 1, pinyin: true, english: true, autoplay: true, commutePause: 5, commuteEnglish: false},
});
let S = defaults();
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) { const p = JSON.parse(raw); S = {...defaults(), ...p, settings: {...defaults().settings, ...(p.settings || {})}}; }
} catch (e) { /* private mode: start fresh */ }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('Could not save progress on this device.'); } }
const st = id => S.items[id] || {g: 0};
const setSt = (id, patch) => { S.items[id] = {...st(id), ...patch}; };
const planted = id => st(id).g >= 6;
const isDue = (id, now = Date.now()) => planted(id) && !st(id).ign && st(id).due <= now;
const ignored = id => !!st(id).ign;
function addPoints(n) { const k = dayKey(); S.days[k] = (S.days[k] || 0) + n; }
function streak() {
  let n = 0, t = Date.now();
  if ((S.days[dayKey(t)] || 0) < S.settings.goal) t -= DAY; // today still in progress
  while ((S.days[dayKey(t)] || 0) >= S.settings.goal) { n++; t -= DAY; }
  return n;
}

/* ---------- speech ----------
   Mobile browsers are picky about the Web Speech API:
   - voices load late (iOS often never fires voiceschanged), so re-check before each utterance
   - iOS only allows speech that starts from a tap until it has been "unlocked" by one
   - cancel() immediately followed by speak() can drop the new utterance, so only cancel when busy
   - Chrome can leave the queue paused, and garbage-collects utterances before onend fires */
let zhVoice = null, enVoice = null, voiceCount = 0, lastSpeechError = '', speechUnlocked = false, currentUtterance = null;
function pickVoices() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  voiceCount = vs.length;
  zhVoice = vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /zh[-_](Hant|HK)/i.test(v.lang)) || vs.find(v => /^(zh|cmn)/i.test(v.lang)) || null;
  enVoice = vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
// a tiny silent WAV, played from the first tap so iOS lets later clips start from timers
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let playerUnlocked = false;
function unlockPlayer() {
  if (playerUnlocked) return;
  playerUnlocked = true;
  try { player.src = SILENCE; const p = player.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
if (!window.speechSynthesis) document.addEventListener('pointerdown', unlockPlayer, {once: true, capture: true});
if (window.speechSynthesis) {
  pickVoices();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoices);
  let polls = 0; const poll = setInterval(() => { pickVoices(); if (zhVoice || ++polls > 20) clearInterval(poll); }, 500);
  const unlock = () => {
    if (speechUnlocked) return;
    speechUnlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
    unlockPlayer();
  };
  document.addEventListener('pointerdown', unlock, {once: true, capture: true});
  document.addEventListener('keydown', unlock, {once: true, capture: true});
}
const spoken = t => t.replace(/（答對\s*1\s*個即可）/g, '，答對一個即可').replace(/[（(]\d[)）]/g, '');
// Recorded clips (Sources/audio) play even when an iPhone is in Silent mode; the browser voice is the fallback.
const AUDIO = D.audio || {};
const player = new Audio();
player.preload = 'auto';
let playerToken = 0;
function playClip(file, text, lang, onend) {
  const token = ++playerToken;
  let done = false;
  const fin = () => { if (!done && token === playerToken) { done = true; onend && onend(); } };
  player.onended = fin;
  player.onerror = () => { if (token === playerToken && !done) { done = true; speakVoice(text, {lang, onend}); } };
  player.src = 'audio/' + file;
  player.defaultPlaybackRate = player.playbackRate = lang === 'zh' ? S.settings.rate : 1;
  const p = player.play();
  if (p && p.catch) p.catch(err => { if (token === playerToken && !done && err && err.name !== 'AbortError') { done = true; speakVoice(text, {lang, onend}); } });
}
function speak(text, {lang = 'zh', onend} = {}) {
  stopSpeech();
  const file = AUDIO[lang + ':' + text];
  if (file) playClip(file, text, lang, onend);
  else speakVoice(text, {lang, onend});
}
function speakVoice(text, {lang = 'zh', onend} = {}) {
  if (!window.speechSynthesis) { onend && setTimeout(onend, 1200); return; }
  const synth = speechSynthesis;
  if (!zhVoice || !voiceCount) pickVoices();
  if (synth.speaking || synth.pending) synth.cancel();
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance(lang === 'zh' ? spoken(text) : text);
  const v = lang === 'zh' ? zhVoice : enVoice;
  u.lang = v ? v.lang : (lang === 'zh' ? 'zh-TW' : 'en-US');
  if (v) u.voice = v;
  u.rate = lang === 'zh' ? Math.min(1.2, S.settings.rate * 0.9) : 1;
  let done = false;
  const fin = () => { if (!done) { done = true; if (currentUtterance === u) currentUtterance = null; onend && onend(); } };
  u.onend = fin;
  u.onerror = e => { if (e && e.error && e.error !== 'interrupted' && e.error !== 'canceled') lastSpeechError = e.error; fin(); };
  u.onstart = () => { lastSpeechError = ''; };
  currentUtterance = u; // keep a reference so the browser doesn't drop it mid-sentence
  synth.speak(u);
}
function stopSpeech() {
  playerToken++;
  try { player.pause(); } catch (e) {}
  if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}
const speakItem = it => speak(it.kind === 'q' ? it.q : it.zh);
const speakAnswer = it => speak(it.kind === 'q' ? it.key : it.zh);

/* ---------- small renderers ---------- */
function ruby(text, py) {
  let out = '';
  for (let i = 0; i < text.length; i++) out += py && py[i] ? `<ruby>${esc(text[i])}<rt>${esc(py[i])}</rt></ruby>` : esc(text[i]);
  return out;
}
function flower(id) {
  const s = st(id), g = Math.min(6, s.g || 0);
  const petals = [0, 60, 120, 180, 240, 300].map((a, i) => {
    const on = g >= 6 || i < g;
    return `<ellipse cx="12" cy="6.2" rx="3.3" ry="4.6" transform="rotate(${a} 12 12)" fill="${on ? 'var(--sun)' : 'none'}" stroke="${on ? 'var(--sun)' : 'var(--line-2)'}" stroke-width="1.3"/>`;
  }).join('');
  const center = `<circle cx="12" cy="12" r="3.1" fill="${g >= 6 ? 'var(--leaf)' : g ? 'var(--sun-ink)' : 'var(--line-2)'}"/>`;
  const due = isDue(id) ? `<circle cx="19.5" cy="19.5" r="4.2" fill="var(--water)"/><path d="M19.5 16.8c1.3 1.6 2.2 2.7 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-.9.9-2 2.2-3.6z" fill="#fff"/>` : '';
  const label = s.ign ? 'ignored' : g === 0 ? 'not started' : g < 6 ? `growing, stage ${g} of 6` : isDue(id) ? 'needs review' : 'planted';
  return `<svg class="flower" viewBox="0 0 24 24" role="img" aria-label="${label}">${petals}${center}${due}</svg>`;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function applySettings() {
  document.body.classList.toggle('no-py', !S.settings.pinyin);
  document.body.classList.toggle('no-en', !S.settings.english);
}
function renderBar() {
  const s = streak(), today = S.days[dayKey()] || 0, goal = S.settings.goal, f = Math.min(1, today / goal);
  $('#streak').className = 'streak' + (s ? '' : ' cold');
  $('#streak').innerHTML = `${ICON.flame}<b>${s}</b>`;
  const r = 10, c = 2 * Math.PI * r;
  $('#goal').innerHTML = `<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--bar-2)" stroke-width="4"/><circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--sun)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 13 13)"/></svg><b>${today}</b><span>/ ${goal}</span>`;
}

/* ---------- stats ---------- */
function levelStats(l, now = Date.now()) {
  let plantedN = 0, due = 0, started = 0, active = 0;
  for (const id of l.ids) {
    if (ignored(id)) continue;
    active++;
    const s = st(id);
    if (s.g > 0) started++;
    if (s.g >= 6) { plantedN++; if (s.due <= now) due++; }
  }
  return {total: active, planted: plantedN, due, started};
}
function courseStats() {
  const now = Date.now(); let learned = 0, due = 0, longTerm = 0, total = 0;
  for (const id of ALL_IDS) {
    if (ignored(id)) continue; total++;
    const s = st(id);
    if (s.g >= 6) { learned++; if (s.due <= now) due++; if ((s.b || 0) >= LONG_TERM) longTerm++; }
  }
  return {learned, due, longTerm, total};
}
const nextLearnLevel = () => LEVELS.find(l => l.ids.some(id => !ignored(id) && !planted(id)));

/* ---------- router ---------- */
const app = $('#app');
let route = '';
window.addEventListener('hashchange', onRoute);
function go(hash) { if (location.hash === hash) onRoute(); else location.hash = hash; }
function onRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (SES && !h.startsWith('session')) endSession(false);
  if (commute.on && h !== 'commute') stopCommute();
  stopSpeech();
  route = h;
  const [page, arg] = h.split('/');
  renderBar();
  if (page === 'level') renderLevel(+arg);
  else if (page === 'session' && SES) renderStep();
  else if (page === 'settings') renderSettings();
  else if (page === 'commute') renderCommute();
  else if (page === 'exam') renderExam();
  else renderHome();
  window.scrollTo(0, 0);
}

/* ---------- home ---------- */
function renderHome() {
  const cs = courseStats(), nxt = nextLearnLevel();
  app.innerHTML = `
    <section class="course">
      <div class="course-top">
        <div class="cover"><img src="icons/icon.svg" alt=""></div>
        <div>
          <h1>歸化口試 237<small>Taiwan naturalization oral test · official question bank, ${esc(D.version)}</small></h1>
          <div class="meter"><div class="bar"><i style="width:${cs.total ? cs.learned / cs.total * 100 : 0}%"></i></div>${cs.learned} / ${cs.total} learned</div>
        </div>
      </div>
      <div class="course-stats">
        <div><b>${cs.learned}</b><span>Planted</span></div>
        <div><b>${cs.due}</b><span>Need review</span></div>
        <div><b>${cs.longTerm}</b><span>Long-term</span></div>
      </div>
      <div class="actions">
        <button class="btn learn" id="aLearn" ${nxt ? '' : 'disabled'}>${ICON.seed} ${cs.learned ? 'Keep learning' : 'Start learning'}</button>
        <button class="btn water" id="aReview">${ICON.drop} ${cs.due ? `Review <small>${cs.due}</small>` : 'Practice'}</button>
        <a class="btn" href="#/commute">${ICON.spk} Commute mode</a>
        <a class="btn sun" href="#/exam">口試 Mock exam</a>
      </div>
      ${nxt ? `<div class="next-up">Next up: Level ${nxt.n} · <span class="zh">${esc(levelTitle(nxt))}</span> ${esc(levelSub(nxt))}</div>` : `<div class="next-up">You've planted every item. Keep reviewing to move them into long-term memory.</div>`}
    </section>
    <h2 class="section">Levels</h2>
    <div class="levels">${LEVELS.map(levelTile).join('')}</div>
    ${voiceNote()}`;
  $('#aLearn').onclick = () => nxt && startLearn(nxt.n);
  $('#aReview').onclick = () => cs.due ? startReview() : startPractice();
}
function levelTile(l) {
  const s = levelStats(l);
  return `<a class="level ${s.planted === s.total && s.total ? 'done' : ''}" href="#/level/${l.n}">
    <div class="level-num">Level ${l.n} <span class="kind ${l.kind}">${l.kind === 'v' ? 'Words' : 'Questions'}</span></div>
    <div class="level-title">${esc(levelTitle(l))}<small>${esc(CAT_EN[l.cat] || '')}</small></div>
    <div class="level-foot"><div class="bar ${s.planted === s.total && s.total ? 'leaf' : ''}"><i style="width:${s.total ? s.planted / s.total * 100 : 0}%"></i></div>${s.planted}/${s.total}${s.due ? ` <span class="badge">${ICON.drop}${s.due}</span>` : ''}</div>
  </a>`;
}
function voiceNote() {
  if (window.speechSynthesis && zhVoice) return '';
  return `<div class="note" style="margin-top:16px">No Chinese voice found on this device yet, so audio may not play. Settings → Test voice shows what your phone reports. iPhone, iPad and Mac include one. On Windows, add <b>Chinese (Traditional, Taiwan)</b> in Settings → Time &amp; language → Speech. On Android, install Chinese (Taiwan) in Google text-to-speech settings.</div>`;
}

/* ---------- level page ---------- */
function renderLevel(n) {
  const l = LEVELS[n - 1]; if (!l) return go('#/');
  const s = levelStats(l);
  app.innerHTML = `
    <div class="crumbs"><a href="#/">← All levels</a></div>
    <section class="level-head">
      <div class="level-num" style="display:flex;gap:8px;align-items:center;font-size:12px;font-weight:800;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em">Level ${l.n} of ${LEVELS.length} <span class="kind ${l.kind}">${l.kind === 'v' ? 'Words' : 'Questions'}</span></div>
      <h1>${esc(l.cat)}<small>${esc(levelSub(l))}</small></h1>
      <div class="meter"><div class="bar"><i style="width:${s.total ? s.planted / s.total * 100 : 0}%"></i></div>${s.planted} / ${s.total} planted</div>
      <div class="row">
        <button class="btn learn" id="lLearn" ${s.planted < s.total ? '' : 'disabled'}>${ICON.seed} Learn this level</button>
        <button class="btn water" id="lReview" ${s.planted ? '' : 'disabled'}>${ICON.drop} ${s.due ? `Review <small>${s.due}</small>` : 'Practice this level'}</button>
        ${l.n > 1 ? `<a class="btn ghost" href="#/level/${l.n - 1}">← Level ${l.n - 1}</a>` : ''}
        ${l.n < LEVELS.length ? `<a class="btn ghost" href="#/level/${l.n + 1}">Level ${l.n + 1} →</a>` : ''}
      </div>
    </section>
    <div class="things">${l.ids.map(thingRow).join('')}</div>`;
  $('#lLearn').onclick = () => startLearn(l.n);
  $('#lReview').onclick = () => s.due ? startReview(l.n) : startPractice(l.n);
  $$('[data-ign]').forEach(cb => cb.onchange = () => { setSt(cb.dataset.ign, {ign: cb.checked}); save(); renderLevel(n); });
  $$('[data-say]').forEach(b => b.onclick = () => speakItem(ITEMS[b.dataset.say]));
}
function thingRow(id) {
  const it = ITEMS[id];
  const a = it.kind === 'v'
    ? `<div class="col-a">${ruby(it.zh, it.pa)}</div><div class="col-b">${esc(it.en)}</div>`
    : `<div class="col-a"><span style="color:var(--ink-3);font-family:var(--ui);font-size:13px;font-weight:800">${it.num}.</span> ${ruby(it.q, it.qp)}<br><span class="ans">${ruby(it.key, it.kp)}</span></div><div class="col-b en">${esc(it.qe)} → <b>${esc(it.ke)}</b></div>`;
  return `<div class="thing ${ignored(id) ? 'ignored' : ''}">${flower(id)}<div>${a}</div>
    <div class="tools"><button class="say" data-say="${esc(id)}" aria-label="Play">${ICON.spk}</button>
    <label class="ignore"><input type="checkbox" data-ign="${esc(id)}" ${ignored(id) ? 'checked' : ''}> Ignore</label></div></div>`;
}

/* ---------- answer options ---------- */
// yes/no style answers: offer the opposite, never a synonym of the right answer
const FAMILIES = [['是', ['不是', '否']], ['可以', ['不可以']], ['合法', ['不合法']], ['會', ['不會']], ['有', ['沒有']], ['需要', ['不需要']], ['應該', ['不應該']], ['能', ['不能']], ['對', ['不對']]];
const family = k => { const x = stripPunct(k); return FAMILIES.find(([yes, nos]) => x === yes || nos.includes(x)); };
const opposites = k => { const x = stripPunct(k), [yes, nos] = family(k); return x === yes ? [nos[0]] : [yes]; };
function pickSimilar(correct, pool, n) {
  const seen = new Set([stripPunct(correct)]), out = [];
  const scored = shuffle(pool).map(p => ({p, d: Math.abs(p.length - correct.length)})).sort((a, b) => a.d - b.d);
  for (const {p} of scored) { const k = stripPunct(p); if (!k || seen.has(k)) continue; seen.add(k); out.push(p); if (out.length >= n) break; }
  return out;
}
function numericOptions(key) {
  const m = key.match(/^(\d+)(\D{0,4})$/);
  if (!m) return null;
  const n = +m[1], unit = m[2];
  const cands = new Set();
  for (const id of Q_IDS) { const k = ITEMS[id].key.match(/^(\d+)(\D{0,4})$/); if (k && k[2] === unit && +k[1] !== n) cands.add(+k[1]); }
  for (const x of [n - 2, n - 1, n + 1, n + 2, n * 2, Math.round(n / 2), n + 5, n + 10]) if (x > 0 && x !== n) cands.add(x);
  const near = [...cands].sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, 6);
  return shuffle(near).slice(0, 3).map(x => x + unit);
}
function optionsFor(it, mode) {
  // returns [{zh?, py?, text, correct}]
  if (it.kind === 'v') {
    if (mode === 'rev') {
      const pool = ALL_IDS.filter(i => ITEMS[i].kind === 'v' && i !== it.id);
      const same = pool.filter(i => ITEMS[i].cat === it.cat).map(i => ITEMS[i].zh);
      const alts = pickSimilar(it.zh, same.length >= 3 ? same : pool.map(i => ITEMS[i].zh), 3);
      return shuffle([it.zh, ...alts]).map(z => { const v = ITEMS['v:' + z]; return {zh: z, py: v ? v.pa : null, correct: z === it.zh}; });
    }
    const pool = ALL_IDS.filter(i => ITEMS[i].kind === 'v' && i !== it.id);
    const same = pool.filter(i => ITEMS[i].cat === it.cat).map(i => ITEMS[i].en);
    const alts = pickSimilar(it.en, same.length >= 3 ? same : pool.map(i => ITEMS[i].en), 3);
    return shuffle([it.en, ...alts]).map(t => ({text: t, correct: t === it.en}));
  }
  const fam = family(it.key);
  let alts;
  if (fam) alts = opposites(it.key);
  else {
    alts = numericOptions(it.key);
    if (!alts || alts.length < 3) {
      const others = Q_IDS.filter(i => i !== it.id && !family(ITEMS[i].key) && !ITEMS[i].own);
      const same = others.filter(i => ITEMS[i].cat === it.cat).map(i => ITEMS[i].key);
      alts = pickSimilar(it.key, same.length >= 3 ? same : others.map(i => ITEMS[i].key), 3);
    }
  }
  const byKey = Object.fromEntries(Q_IDS.map(i => [ITEMS[i].key, ITEMS[i]]));
  return shuffle([it.key, ...alts]).map(k => ({zh: k, py: k === it.key ? it.kp : (byKey[k] ? byKey[k].kp : null), correct: k === it.key}));
}
function tilesFor(it) {
  const target = stripPunct(it.kind === 'v' ? it.zh : it.key);
  const pyOf = it.kind === 'v' ? it.pa : it.kp, src = it.kind === 'v' ? it.zh : it.key;
  // map characters of target back to pinyin
  const pys = []; for (let i = 0; i < src.length; i++) if (stripPunct(src[i])) pys.push(pyOf ? pyOf[i] : '');
  const chars = [...target];
  let chunks = [];
  const size = chars.length <= 8 ? 1 : chars.length <= 14 ? 2 : 3;
  for (let i = 0; i < chars.length;) {
    if (/\d/.test(chars[i])) { let j = i; while (j < chars.length && /[\d\-%]/.test(chars[j])) j++; chunks.push({t: chars.slice(i, j).join(''), p: ''}); i = j; continue; }
    let j = i; const c = [];
    while (j < chars.length && c.length < size && !/\d/.test(chars[j])) { c.push(j); j++; }
    chunks.push({t: c.map(k => chars[k]).join(''), p: c.map(k => pys[k] || '').join(' ')});
    i = j;
  }
  // distractors: characters from similar items
  const pool = (it.kind === 'v' ? ALL_IDS.filter(i => ITEMS[i].kind === 'v') : Q_IDS).filter(i => i !== it.id && ITEMS[i].cat === it.cat);
  const extra = [];
  for (const i of shuffle(pool)) {
    const o = ITEMS[i], s = it.kind === 'v' ? o.zh : o.key, p = it.kind === 'v' ? o.pa : o.kp;
    for (let k = 0; k + size <= s.length && extra.length < 3; k += size) {
      const t = s.slice(k, k + size);
      if (stripPunct(t).length === size && !/\d/.test(t) && !target.includes(t) && !extra.some(e => e.t === t)) { extra.push({t, p: p ? p.slice(k, k + size).join(' ') : ''}); break; }
    }
    if (extra.length >= 3) break;
  }
  return {target, chunks, pool: shuffle([...chunks.map((c, i) => ({...c, i})), ...extra.map((c, i) => ({...c, i: 'x' + i}))])};
}
function testModesFor(it) {
  if (it.kind === 'v') return ['mc', 'rev', 'tiles'];
  if (it.own) return ['self', 'self', 'self'];
  const key = stripPunct(it.key);
  const tilesOk = key.length <= 16 && /[\u3400-\u9fff]{2,}/.test(key) && !family(it.key);
  return ['mc', 'listen', tilesOk ? 'tiles' : 'listen'];
}

/* ---------- sessions ---------- */
let SES = null;
function startLearn(levelN) {
  const src = levelN ? LEVELS[levelN - 1].ids : ALL_IDS;
  const growing = src.filter(id => !ignored(id) && st(id).g > 0 && st(id).g < 6);
  const fresh = src.filter(id => !ignored(id) && !st(id).g);
  const pick = [...growing, ...fresh].slice(0, LEARN_BATCH);
  if (!pick.length) { toast('Everything in this level is planted.'); return; }
  SES = {type: 'learn', level: levelN || null, pending: pick.slice(), active: [], ids: pick, points: 0, step: null, n: 0, results: {}};
  nextStep(); go('#/session');
}
function startReview(levelN) {
  const now = Date.now(), src = levelN ? LEVELS[levelN - 1].ids : ALL_IDS;
  const due = src.filter(id => isDue(id, now)).sort((a, b) => st(a).due - st(b).due).slice(0, REVIEW_BATCH);
  if (!due.length) return startPractice(levelN);
  SES = {type: 'review', level: levelN || null, queue: shuffle(due).map(id => ({id, retest: false})), ids: due, total: due.length, answered: 0, points: 0, step: null, n: 0, results: {}};
  nextStep(); go('#/session');
}
function startPractice(levelN) {
  const src = (levelN ? LEVELS[levelN - 1].ids : ALL_IDS).filter(id => planted(id) && !ignored(id));
  if (!src.length) { toast('Learn a few items first, then you can practice them.'); return; }
  const pick = shuffle(src).slice(0, 15);
  SES = {type: 'practice', level: levelN || null, queue: pick.map(id => ({id, retest: false})), ids: pick, total: pick.length, answered: 0, points: 0, step: null, n: 0, results: {}};
  nextStep(); go('#/session');
}
function nextStep() {
  const s = SES; s.n++;
  if (s.type === 'learn') {
    const inProgress = s.active.filter(a => st(a.id).g < 6);
    if (s.pending.length && (inProgress.length < 2 || inProgress.every(a => a.tests > 0) && inProgress.length < 3)) {
      const id = s.pending.shift(); s.active.push({id, tests: 0, last: s.n});
      if (st(id).g > 0) { s.step = testStep(id); } else s.step = {mode: 'present', id};
      return;
    }
    const cands = inProgress.filter(a => a.last < s.n - 1 || inProgress.length === 1).sort((a, b) => a.last - b.last);
    const a = cands[0];
    if (!a) { if (s.pending.length) { const id = s.pending.shift(); s.active.push({id, tests: 0, last: s.n}); s.step = st(id).g > 0 ? testStep(id) : {mode: 'present', id}; return; } s.step = null; return; }
    a.last = s.n; a.tests++;
    s.step = testStep(a.id);
    return;
  }
  const q = s.queue.shift();
  if (!q) { s.step = null; return; }
  const it = ITEMS[q.id], modes = testModesFor(it);
  s.step = {...testStep(q.id, modes[Math.floor(Math.random() * modes.length)]), retest: q.retest};
}
function testStep(id, forced) {
  const it = ITEMS[id], g = st(id).g || 1, modes = testModesFor(it);
  const mode = forced || (g < 3 ? modes[0] : g < 5 ? modes[1] : modes[2]);
  const step = {mode, id, answered: false};
  if (mode === 'mc' || mode === 'listen' || mode === 'rev') step.opts = optionsFor(it, mode);
  if (mode === 'tiles') { step.tiles = tilesFor(it); step.built = []; }
  if (mode === 'listen') step.showText = false;
  if (mode === 'self') step.revealed = false;
  return step;
}
function sessionProgress() {
  const s = SES;
  if (s.type === 'learn') return s.ids.reduce((sum, id) => sum + Math.min(6, st(id).g || 0), 0) / (s.ids.length * 6);
  return s.answered / s.total;
}
function answer(correct) {
  const s = SES, step = s.step, id = step.id, now = Date.now();
  if (step.answered) return;
  step.answered = true; step.correct = correct;
  const pts = correct ? (step.mode === 'listen' && step.showText ? POINTS.mc : POINTS[step.mode]) : 0;
  s.points += pts; addPoints(pts);
  const r = s.results[id] = s.results[id] || {ok: 0, bad: 0}; correct ? r.ok++ : r.bad++;
  const cur = st(id);
  if (s.type === 'learn') {
    let g = correct ? Math.min(6, (cur.g || 1) + 2) : Math.max(1, (cur.g || 1) - 1);
    const patch = {g};
    if (g >= 6 && (cur.g || 0) < 6) { patch.b = 1; patch.due = now + REVIEW_INT[1]; patch.planted = now; }
    setSt(id, patch);
  } else if (s.type === 'review') {
    if (!step.retest) {
      s.answered++;
      if (correct) { const b = Math.min((cur.b || 1) + 1, REVIEW_INT.length - 1); setSt(id, {b, due: now + REVIEW_INT[b], last: now}); }
      else { setSt(id, {b: 1, due: now + REVIEW_INT[1], lapses: (cur.lapses || 0) + 1, last: now}); s.queue.splice(Math.min(3, s.queue.length), 0, {id, retest: true}); }
    } else if (!correct) s.queue.splice(Math.min(3, s.queue.length), 0, {id, retest: true});
  } else {
    if (!step.retest) s.answered++;
    if (!correct) { setSt(id, {b: 1, due: now + REVIEW_INT[1]}); s.queue.splice(Math.min(3, s.queue.length), 0, {id, retest: true}); }
  }
  save(); renderBar();
}
function advance() {
  stopSpeech();
  const s = SES;
  if (s.step && s.step.mode === 'present') { s.points += POINTS.present; addPoints(POINTS.present); setSt(s.step.id, {g: Math.max(1, st(s.step.id).g || 0), seen: Date.now()}); save(); renderBar(); }
  nextStep();
  renderStep();
}
function endSession(showSummary) {
  stopSpeech();
  if (!SES) return;
  if (!showSummary) { SES = null; return; }
}

/* ---------- session views ---------- */
function sesTop() {
  const s = SES, water = s.type !== 'learn';
  return `<div class="ses-top">
    <button class="x" id="quit" aria-label="End session">${ICON.x}</button>
    <div class="bar ${water ? 'water' : ''}" role="progressbar" aria-valuenow="${Math.round(sessionProgress() * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${sessionProgress() * 100}%"></i></div>
    <div class="points">${s.points} pts</div></div>`;
}
function catTag(it) { return `<span class="tag">${esc(it.cat)}${it.kind === 'q' ? ` · 問題 ${it.num}` : ''}</span>`; }
function itemCard(it, {withQuestion = true} = {}) {
  if (it.kind === 'v') return `
    <p class="huge-zh">${ruby(it.zh, it.pa)}</p>
    <p class="en center" style="color:var(--water);font-weight:700;margin:0">${esc(it.p)}</p>
    <p class="en strong center">${esc(it.en)}</p>
    ${it.refs && it.refs.length ? `<details class="full"><summary>Used in ${it.refs.length} question${it.refs.length > 1 ? 's' : ''}</summary>${it.refs.slice(0, 3).map(r => { const q = ITEMS['q:' + r]; return `<div class="zh">${ruby(q.q, q.qp)}</div><p class="en">${esc(q.qe)}</p>`; }).join('')}</details>` : ''}`;
  const full = stripPunct(it.key) !== stripPunct(it.a);
  return `${withQuestion ? `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><p class="big-zh" style="flex:1">${ruby(it.q, it.qp)}</p><button class="say" data-play="q" aria-label="Play question">${ICON.spk}</button></div><p class="en">${esc(it.qe)}</p>` : ''}
    <div class="answer">
      <div class="prompt-label" style="margin:0">${it.own ? 'Sample answer · say your own version' : 'Answer'} <button class="say" data-play="a" aria-label="Play answer">${ICON.spk}</button></div>
      <div class="answer-zh">${ruby(it.key, it.kp)}</div>
      <p class="en strong" style="margin:0">${esc(it.ke)}</p>
    </div>
    ${full ? `<details class="full"><summary>Full official answer</summary><div class="zh">${ruby(it.a, it.ap)}</div><p class="en">${esc(it.ae)}</p></details>` : ''}
    ${it.tip ? `<div class="mem"><b>Mem</b>${esc(it.tip)}</div>` : ''}`;
}
function renderStep() {
  if (!SES) return go('#/');
  const s = SES, step = s.step;
  if (!step) return renderSummary();
  const it = ITEMS[step.id];
  let body = '', label = '';
  if (step.mode === 'present') {
    label = st(step.id).g ? 'Revisit' : 'New item';
    body = `<div class="present">${itemCard(it)}</div>
      <div class="continue"><button class="btn learn" id="next">Next</button></div>
      <div class="keys"><kbd>Enter</kbd> next · <kbd>P</kbd> play</div>`;
  } else if (step.mode === 'self') {
    label = 'Say your answer out loud';
    body = `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><p class="big-zh" style="flex:1">${ruby(it.q, it.qp)}</p><button class="say" data-play="q" aria-label="Play question">${ICON.spk}</button></div><p class="en">${esc(it.qe)}</p>
      ${step.revealed ? `<div class="present" style="margin-top:12px">${itemCard(it, {withQuestion: false})}</div>
        <div class="continue"><button class="btn" id="selfNo">I struggled</button><button class="btn learn" id="selfOk">I said it</button></div>`
        : `<div class="continue"><button class="btn water" id="selfShow">Show sample answer</button></div>`}`;
  } else if (step.mode === 'tiles') {
    const prompt = it.kind === 'v'
      ? `<p class="en strong center">${esc(it.en)}</p><p class="hint" style="text-align:center;margin:4px 0 0">Build the Chinese word</p>`
      : `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><p class="big-zh" style="flex:1">${ruby(it.q, it.qp)}</p><button class="say" data-play="q" aria-label="Play question">${ICON.spk}</button></div><p class="en">${esc(it.qe)}</p>`;
    label = 'Tap the pieces in order';
    body = `${prompt}
      <div class="tray ${step.answered ? (step.correct ? 'right' : 'wrong') : ''}" id="tray">${step.built.length ? step.built.map((c, k) => `<button class="tile" data-built="${k}" ${step.answered ? 'disabled' : ''}>${c.p ? `<ruby>${esc(c.t)}<rt>${esc(c.p)}</rt></ruby>` : esc(c.t)}</button>`).join('') : '<span class="tray-empty">Your answer appears here</span>'}</div>
      <div class="pool">${step.tiles.pool.map((c, k) => `<button class="tile ${step.built.some(b => b.k === k) ? 'used' : ''}" data-pool="${k}" ${step.answered ? 'disabled' : ''}>${c.p ? `<ruby>${esc(c.t)}<rt>${esc(c.p)}</rt></ruby>` : esc(c.t)}</button>`).join('')}</div>
      ${step.answered ? feedback(it, step.correct) : `<div class="continue"><button class="btn" id="dunno">I don't know</button><button class="btn learn" id="check" ${step.built.length ? '' : 'disabled'}>Check</button></div>`}`;
  } else {
    const showText = step.mode !== 'listen' || step.showText || step.answered;
    let prompt;
    if (it.kind === 'v' && step.mode === 'rev') { label = 'Choose the Chinese'; prompt = `<p class="en strong center">${esc(it.en)}</p>`; }
    else if (it.kind === 'v') { label = 'Choose the meaning'; prompt = `<p class="huge-zh">${ruby(it.zh, it.pa)}</p><div class="row" style="justify-content:center"><button class="say" data-play="q" aria-label="Play">${ICON.spk}</button></div>`; }
    else if (showText) { label = step.mode === 'listen' ? 'Listen and choose the answer' : 'Choose the answer'; prompt = `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><p class="big-zh" style="flex:1">${ruby(it.q, it.qp)}</p><button class="say" data-play="q" aria-label="Play question">${ICON.spk}</button></div><p class="en">${esc(it.qe)}</p>`; }
    else { label = 'Listen and choose the answer'; prompt = `<div class="listen-box"><button class="say big" data-play="q" aria-label="Play question">${ICON.play}</button><div class="hint">Listen to the question, like in the real test</div><button class="link" id="showText">Show the text (fewer points)</button></div>`; }
    body = `${prompt}
      <div class="opts">${step.opts.map((o, k) => {
        const cls = step.answered ? (o.correct ? 'right' : (step.picked === k ? 'wrong' : '')) : '';
        const inner = o.zh != null ? `<span class="zh">${ruby(o.zh, o.py)}</span>` : `<span>${esc(o.text)}</span>`;
        return `<button class="opt ${cls}" data-opt="${k}" ${step.answered ? 'disabled' : ''}><span class="n">${k + 1}</span>${inner}</button>`;
      }).join('')}</div>
      ${step.answered && !step.correct ? feedback(it, false) : ''}
      ${!step.answered ? `<div class="keys"><kbd>1</kbd>–<kbd>${step.opts.length}</kbd> choose · <kbd>P</kbd> play</div>` : ''}`;
  }
  app.innerHTML = `<div class="session">${sesTop()}
    <section class="prompt pop"><div class="prompt-label"><span>${label}${step.retest ? ' · again' : ''}</span>${catTag(it)}</div>${body}</section></div>`;
  wireStep(it, step);
}
function feedback(it, correct) {
  return `<div class="feedback ${correct ? 'right' : 'wrong'}"><h3>${correct ? 'Correct!' : 'Not quite. Here is the answer:'}</h3>
    ${correct ? '' : `<div class="present">${itemCard(it, {withQuestion: false})}</div>`}</div>
    <div class="continue"><button class="btn ${correct ? 'learn' : ''}" id="next">Continue</button></div>
    <div class="keys"><kbd>Enter</kbd> continue</div>`;
}
function wireStep(it, step) {
  $('#quit').onclick = () => { SES = null; stopSpeech(); go('#/'); };
  $$('[data-play]').forEach(b => b.onclick = () => b.dataset.play === 'a' ? speakAnswer(it) : speakItem(it));
  const nx = $('#next'); if (nx) nx.onclick = advance;
  const stx = $('#showText'); if (stx) stx.onclick = () => { step.showText = true; renderStep(); };
  $$('[data-opt]').forEach(b => b.onclick = () => pickOpt(+b.dataset.opt));
  const ss = $('#selfShow'); if (ss) ss.onclick = () => { step.revealed = true; renderStep(); if (S.settings.autoplay) speakAnswer(it); };
  const sok = $('#selfOk'); if (sok) sok.onclick = () => { answer(true); advance(); };
  const sno = $('#selfNo'); if (sno) sno.onclick = () => { answer(false); advance(); };
  $$('[data-pool]').forEach(b => b.onclick = () => { const k = +b.dataset.pool; if (step.built.some(x => x.k === k)) return; step.built.push({...step.tiles.pool[k], k}); renderStep(); });
  $$('[data-built]').forEach(b => b.onclick = () => { step.built.splice(+b.dataset.built, 1); renderStep(); });
  const ck = $('#check'); if (ck) ck.onclick = checkTiles;
  const dk = $('#dunno'); if (dk) dk.onclick = () => { step.built = []; answer(false); renderStep(); };
  if (S.settings.autoplay && !step.autoplayed) {
    step.autoplayed = true;
    if (step.mode === 'present' || step.mode === 'listen' || step.mode === 'self' || (step.mode === 'mc' && it.kind === 'v')) setTimeout(() => speakItem(it), 200);
  }
  if (step.answered && step.correct && step.mode !== 'present') {
    if (S.settings.autoplay) speakAnswer(it);
    clearTimeout(step.timer); step.timer = setTimeout(() => { if (SES && SES.step === step) advance(); }, S.settings.autoplay ? 1600 : 900);
  }
}
function pickOpt(k) {
  const step = SES.step; if (step.answered) return;
  step.picked = k;
  answer(step.opts[k].correct);
  renderStep();
}
function checkTiles() {
  const step = SES.step;
  const built = step.built.map(c => c.t).join('');
  answer(stripPunct(built) === step.tiles.target);
  if (!step.correct) step.built = step.tiles.chunks.map(c => ({...c, k: -1}));
  renderStep();
}
function renderSummary() {
  const s = SES;
  const title = s.type === 'learn' ? 'Session complete' : s.type === 'review' ? 'Review complete' : 'Practice complete';
  const today = S.days[dayKey()] || 0, goalMet = today >= S.settings.goal;
  const nxt = nextLearnLevel(), cs = courseStats();
  app.innerHTML = `<div class="session"><section class="prompt summary pop">
    <h1>${title}</h1>
    <div class="pts">+${s.points}</div>
    <p class="hint" style="margin:0">points · ${today} of ${S.settings.goal} today${goalMet ? ' · daily goal met' : ''}</p>
    <div class="things sum-list">${s.ids.map(id => { const it = ITEMS[id], r = s.results[id] || {ok: 0, bad: 0}; return `<div class="thing">${flower(id)}<div><div class="col-a">${it.kind === 'v' ? ruby(it.zh, it.pa) : `<span class="ans">${ruby(it.key, it.kp)}</span>`}</div><div class="col-b">${esc(it.kind === 'v' ? it.en : it.qe)}</div></div><div class="tools" style="font-size:13px;font-weight:800;color:${r.bad ? 'var(--bad)' : 'var(--leaf-2)'}">${r.bad ? r.bad + ' missed' : r.ok ? 'all correct' : ''}</div></div>`; }).join('')}</div>
    <div class="continue" style="flex-wrap:wrap">
      ${s.type === 'learn' && nxt ? `<button class="btn learn" id="more">${ICON.seed} Learn 5 more</button>` : ''}
      ${cs.due ? `<button class="btn water" id="rev">${ICON.drop} Review ${cs.due}</button>` : ''}
      <button class="btn" id="home">Back to course</button>
    </div></section></div>`;
  const lvl = s.level; SES = null;
  const m = $('#more'); if (m) m.onclick = () => startLearn(lvl && LEVELS[lvl - 1].ids.some(id => !ignored(id) && !planted(id)) ? lvl : nxt.n);
  const r = $('#rev'); if (r) r.onclick = () => startReview();
  $('#home').onclick = () => go('#/');
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  if (!SES || !SES.step || !route.startsWith('session')) return;
  const step = SES.step, it = ITEMS[step.id];
  if (e.key.toLowerCase() === 'p') { speakItem(it); return; }
  if (e.key === 'Enter') {
    if (step.mode === 'present' || step.answered) { e.preventDefault(); advance(); }
    else if (step.mode === 'tiles' && step.built.length) { e.preventDefault(); checkTiles(); }
    return;
  }
  if (step.opts && !step.answered && /^[1-9]$/.test(e.key) && +e.key <= step.opts.length) pickOpt(+e.key - 1);
});

/* ---------- commute mode ---------- */
const commute = {on: false, list: [], i: 0, phase: '', timer: null, lock: null, src: 'learned'};
function commuteList(src) {
  if (src === 'all') return Q_IDS.filter(id => !ignored(id));
  if (src.startsWith('level:')) return LEVELS[+src.slice(6) - 1].ids.filter(id => !ignored(id));
  const now = Date.now();
  const learned = ALL_IDS.filter(id => planted(id) && !ignored(id) && ITEMS[id].kind === 'q');
  const due = learned.filter(id => isDue(id, now)), rest = shuffle(learned.filter(id => !isDue(id, now)));
  return learned.length ? [...shuffle(due), ...rest] : Q_IDS.filter(id => !ignored(id)).slice(0, 30);
}
function renderCommute() {
  const it = commute.list.length ? ITEMS[commute.list[commute.i]] : null;
  app.innerHTML = `
    <div class="crumbs"><a href="#/">← Course</a></div>
    <section class="panel">
      <h2>Commute mode</h2>
      <p>Hands-free practice for the MRT. The app reads a question, waits for you to answer out loud, then reads the answer. Keep the screen on. Most phones pause the voice when the screen locks.</p>
      <div class="row">
        <label class="field" style="margin:0;flex:1 1 220px">Play
          <select id="cSrc">
            <option value="learned" ${commute.src === 'learned' ? 'selected' : ''}>Questions I've learned (due first)</option>
            <option value="all" ${commute.src === 'all' ? 'selected' : ''}>All 237 questions in order</option>
            ${LEVELS.filter(l => l.kind === 'q').map(l => `<option value="level:${l.n}" ${commute.src === 'level:' + l.n ? 'selected' : ''}>Level ${l.n} · ${esc(l.cat)} ${esc(CAT_EN[l.cat])}</option>`).join('')}
          </select></label>
        <label class="field" style="margin:0;flex:0 1 150px">Pause to answer
          <select id="cPause">${[3, 5, 8, 12].map(s => `<option value="${s}" ${S.settings.commutePause === s ? 'selected' : ''}>${s} seconds</option>`).join('')}</select></label>
      </div>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="cEn" ${S.settings.commuteEnglish ? 'checked' : ''}> Also read the English translation</label>
    </section>
    <section class="prompt commute-card">
      ${it ? `<div class="commute-phase" id="cPhase">${esc(commute.phase || 'Ready')}</div>
        <p class="hint" style="margin:4px 0 8px">${commute.i + 1} of ${commute.list.length} · <span class="zh">${esc(it.cat)}</span></p>
        ${it.kind === 'q' ? `<p class="big-zh center">${ruby(it.q, it.qp)}</p><p class="en center">${esc(it.qe)}</p>
          <div ${commute.phase === 'Answer' ? '' : 'style="visibility:hidden"'}><div class="answer-zh" style="text-align:center">${ruby(it.key, it.kp)}</div><p class="en center strong">${esc(it.ke)}</p></div>`
          : `<p class="huge-zh">${ruby(it.zh, it.pa)}</p><p class="en center strong">${esc(it.en)}</p>`}`
        : `<p class="hint">Press play to start.</p>`}
      <div class="commute-ctrl">
        <button class="say" id="cPrev" aria-label="Previous">${ICON.prev}</button>
        <button class="say big" id="cPlay" aria-label="${commute.on ? 'Pause' : 'Play'}">${commute.on ? ICON.pause : ICON.play}</button>
        <button class="say" id="cNext" aria-label="Next">${ICON.next}</button>
      </div>
    </section>
    ${voiceNote()}`;
  $('#cSrc').onchange = e => { commute.src = e.target.value; commute.list = commuteList(commute.src); commute.i = 0; stopCommute(); renderCommute(); };
  $('#cPause').onchange = e => { S.settings.commutePause = +e.target.value; save(); };
  $('#cEn').onchange = e => { S.settings.commuteEnglish = e.target.checked; save(); };
  $('#cPlay').onclick = () => commute.on ? (stopCommute(), renderCommute()) : startCommute();
  $('#cPrev').onclick = () => { if (!commute.list.length) return; commute.i = (commute.i - 1 + commute.list.length) % commute.list.length; if (commute.on) runCommute(); else renderCommute(); };
  $('#cNext').onclick = () => { if (!commute.list.length) return; commute.i = (commute.i + 1) % commute.list.length; if (commute.on) runCommute(); else renderCommute(); };
}
async function startCommute() {
  if (!commute.list.length) commute.list = commuteList(commute.src);
  commute.on = true;
  try { commute.lock = await navigator.wakeLock?.request('screen'); } catch (e) { commute.lock = null; }
  runCommute();
}
function stopCommute() {
  commute.on = false; commute.phase = ''; clearTimeout(commute.timer); stopSpeech();
  try { commute.lock && commute.lock.release(); } catch (e) {} commute.lock = null;
}
function runCommute() {
  clearTimeout(commute.timer); stopSpeech();
  const id = commute.list[commute.i], it = ITEMS[id];
  const step = (phase, fn) => { if (!commute.on || commute.list[commute.i] !== id) return; commute.phase = phase; renderCommute(); fn(); };
  const nextItem = () => { if (!commute.on || commute.list[commute.i] !== id) return; commute.i = (commute.i + 1) % commute.list.length; runCommute(); };
  const afterAnswer = () => commute.timer = setTimeout(nextItem, 1500);
  const sayAnswer = () => step('Answer', () => speak(it.kind === 'q' ? it.key : it.zh, {onend: () => {
    if (S.settings.commuteEnglish) speak(it.kind === 'q' ? it.ke : it.en, {lang: 'en', onend: afterAnswer}); else afterAnswer();
  }}));
  const wait = () => step('Your turn', () => { commute.timer = setTimeout(sayAnswer, S.settings.commutePause * 1000); });
  step('Question', () => speak(it.kind === 'q' ? it.q : it.zh, {onend: () => {
    if (S.settings.commuteEnglish && it.kind === 'q') speak(it.qe, {lang: 'en', onend: wait}); else wait();
  }}));
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && commute.on && !commute.lock) { try { commute.lock = await navigator.wakeLock?.request('screen'); } catch (e) {} }
});

/* ---------- mock exam ---------- */
let exam = null;
function renderExam() {
  if (!exam) {
    const hist = S.exams.slice(-6).reverse();
    app.innerHTML = `
      <div class="crumbs"><a href="#/">← Course</a></div>
      <section class="panel">
        <h2>口試 Mock exam</h2>
        <p>Like the real oral test: 20 random questions from the bank, 5 points each. You need 70 points to use the result for naturalization. Each question is read aloud with the text hidden. Answer out loud, check the official answer, and mark yourself honestly. Missed questions come back in your next review.</p>
        <button class="btn sun" id="eStart">Start mock exam</button>
      </section>
      ${hist.length ? `<h2 class="section">Recent results</h2><div class="things">${hist.map(h => `<div class="thing" style="grid-template-columns:1fr auto"><div>${new Date(h.t).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}</div><div style="font-weight:800;color:${h.score >= PASS_SCORE ? 'var(--leaf-2)' : 'var(--bad)'}">${h.score}/100 ${h.score >= PASS_SCORE ? 'Pass' : 'Not yet'}</div></div>`).join('')}</div>` : ''}
      ${voiceNote()}`;
    $('#eStart').onclick = () => { exam = {ids: shuffle(Q_IDS).slice(0, 20), i: 0, marks: [], shown: false, text: false}; renderExam(); setTimeout(() => speakItem(ITEMS[exam.ids[0]]), 250); };
    return;
  }
  if (exam.i >= 20) {
    const right = exam.marks.filter(Boolean).length, score = right * 5, pass = score >= PASS_SCORE;
    const wrong = exam.ids.filter((id, i) => !exam.marks[i]);
    app.innerHTML = `<div class="session"><section class="prompt summary pop">
      <div class="stamp ${pass ? '' : 'fail'}">${pass ? '合格' : '未過'}<small>${pass ? 'PASS' : 'NOT YET'}</small></div>
      <div class="pts" style="margin-top:12px">${score}<span style="font-size:20px;color:var(--ink-3)">/100</span></div>
      <p class="hint">${right} of 20 correct. ${pass ? 'You would pass the real test.' : `You need ${PASS_SCORE / 5} correct (${PASS_SCORE} points) to pass.`}</p>
      ${wrong.length ? `<div class="things sum-list">${wrong.map(id => { const it = ITEMS[id]; return `<div class="thing" style="grid-template-columns:1fr"><div><div class="col-a">${ruby(it.q, it.qp)}<br><span class="ans">${ruby(it.key, it.kp)}</span></div><div class="col-b en">${esc(it.qe)} → <b>${esc(it.ke)}</b></div></div></div>`; }).join('')}</div>` : ''}
      <div class="continue"><button class="btn sun" id="eAgain">Take another</button><button class="btn" id="eHome">Back to course</button></div>
    </section></div>`;
    $('#eAgain').onclick = () => { exam = null; renderExam(); $('#eStart').click(); };
    $('#eHome').onclick = () => { exam = null; go('#/'); };
    return;
  }
  const it = ITEMS[exam.ids[exam.i]];
  app.innerHTML = `<div class="session">
    <div class="ses-top"><button class="x" id="eQuit" aria-label="Quit exam">${ICON.x}</button>
      <div class="dots" aria-label="Question ${exam.i + 1} of 20">${exam.ids.map((_, i) => `<i class="${i < exam.i ? (exam.marks[i] ? 'ok' : 'no') : ''} ${i === exam.i ? 'cur' : ''}"></i>`).join('')}</div>
      <div class="points">${exam.i + 1}/20</div></div>
    <section class="prompt pop">
      <div class="prompt-label"><span>Question ${exam.i + 1}</span>${catTag(it)}</div>
      ${exam.text || exam.shown ? `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><p class="big-zh" style="flex:1">${ruby(it.q, it.qp)}</p><button class="say" data-play="q" aria-label="Play question">${ICON.spk}</button></div><p class="en">${esc(it.qe)}</p>`
        : `<div class="listen-box"><button class="say big" data-play="q" aria-label="Play question">${ICON.play}</button><div class="hint">Answer out loud, then check</div><button class="link" id="eText">Show the text</button></div>`}
      ${exam.shown ? `<div class="present" style="margin-top:12px">${itemCard(it, {withQuestion: false})}</div>
        <div class="continue"><button class="btn" id="eNo">I got it wrong</button><button class="btn learn" id="eOk">I got it right</button></div>`
        : `<div class="continue"><button class="btn water" id="eShow">Check answer</button></div>`}
    </section></div>`;
  $$('[data-play]').forEach(b => b.onclick = () => b.dataset.play === 'a' ? speakAnswer(it) : speakItem(it));
  $('#eQuit').onclick = () => { exam = null; stopSpeech(); renderExam(); };
  const et = $('#eText'); if (et) et.onclick = () => { exam.text = true; renderExam(); };
  const es = $('#eShow'); if (es) es.onclick = () => { exam.shown = true; renderExam(); if (S.settings.autoplay) speakAnswer(it); };
  const mark = ok => {
    exam.marks.push(ok);
    if (!ok && planted(it.id)) setSt(it.id, {b: 1, due: Date.now()});
    exam.i++; exam.shown = false; exam.text = false;
    if (exam.i >= 20) { S.exams.push({t: Date.now(), score: exam.marks.filter(Boolean).length * 5}); S.exams = S.exams.slice(-50); }
    save(); renderExam();
    if (exam.i < 20) setTimeout(() => speakItem(ITEMS[exam.ids[exam.i]]), 250);
  };
  const ok = $('#eOk'); if (ok) ok.onclick = () => mark(true);
  const no = $('#eNo'); if (no) no.onclick = () => mark(false);
}

/* ---------- settings ---------- */
function renderSettings() {
  const s = S.settings;
  app.innerHTML = `
    <div class="crumbs"><a href="#/">← Course</a></div>
    <section class="panel">
      <h2>Study settings</h2>
      <label class="field">Daily goal
        <select id="sGoal">${[[500, 'Casual · 500 points'], [1500, 'Regular · 1,500 points'], [3000, 'Serious · 3,000 points'], [6000, 'Intense · 6,000 points']].map(([v, t]) => `<option value="${v}" ${s.goal === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Voice speed <span id="sRateV" style="color:var(--ink-3)">${s.rate.toFixed(2)}×</span>
        <input type="range" id="sRate" min="0.6" max="1.5" step="0.05" value="${s.rate}"></label>
      <label class="check"><input type="checkbox" id="sPy" ${s.pinyin ? 'checked' : ''}> Show pinyin above characters</label>
      <label class="check"><input type="checkbox" id="sEn" ${s.english ? 'checked' : ''}> Show English translations</label>
      <label class="check"><input type="checkbox" id="sAuto" ${s.autoplay ? 'checked' : ''}> Play audio automatically</label>
      <div class="note" id="sVoice"></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="sAudioAll">Save all audio for offline use</button><span class="hint" id="sAudioMsg"></span></div>
      <div class="row" style="margin-top:10px"><button class="btn water" id="sTest">${ICON.spk} Test voice</button></div>
    </section>
    <section class="panel">
      <h2>Move your progress</h2>
      <p>Progress is saved on this device. To continue on another phone or computer, copy your progress code here and paste it there, or save it as a file.</p>
      <div class="row"><button class="btn" id="sCopy">Copy progress code</button><button class="btn" id="sFile">Save as file</button><button class="btn" id="sLoadFile">Load from file</button><input type="file" id="sFileIn" accept="application/json,.json" hidden></div>
      <label class="field" style="margin-top:12px">Paste a progress code<textarea id="sCode" placeholder="Paste the code from your other device"></textarea></label>
      <button class="btn water" id="sImport">Load progress code</button>
    </section>
    <section class="panel">
      <h2>Install on your phone</h2>
      <p><b>iPhone:</b> open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>.<br><b>Android:</b> open it in Chrome, tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.<br>After the first visit it works offline.</p>
    </section>
    <section class="panel">
      <h2>Reset</h2>
      <p>Erase all progress on this device. This can't be undone unless you saved a progress code first.</p>
      <button class="btn" id="sReset" style="color:var(--bad)">Reset all progress</button>
    </section>
    <p class="hint">Questions: 內政部 official oral question bank, ${esc(D.version)}. ${Q_IDS.length} questions, ${ALL_IDS.length - Q_IDS.length} words, ${LEVELS.length} levels.</p>`;
  $('#sGoal').onchange = e => { s.goal = +e.target.value; save(); renderBar(); };
  $('#sRate').oninput = e => { s.rate = +e.target.value; $('#sRateV').textContent = s.rate.toFixed(2) + '×'; save(); };
  $('#sPy').onchange = e => { s.pinyin = e.target.checked; applySettings(); save(); };
  $('#sEn').onchange = e => { s.english = e.target.checked; applySettings(); save(); };
  $('#sAuto').onchange = e => { s.autoplay = e.target.checked; save(); };
  const showVoice = () => {
    pickVoices();
    const lines = [];
    lines.push(`Recorded audio: <b>${new Set(Object.values(AUDIO)).size} clips</b>, Taiwan voice 曉臻. These play even in Silent mode.`);
    if (!window.speechSynthesis) lines.push('Backup voice: this browser has no speech support.');
    else {
      lines.push('Backup voice, used only if a recording is missing:');
      lines.push(`Chinese voice: <b>${zhVoice ? esc(zhVoice.name + ' · ' + zhVoice.lang) : 'not found'}</b> · ${voiceCount} voices on this device`);
      if (lastSpeechError) lines.push(`Last error: <b>${esc(lastSpeechError)}</b>`);
      if (!zhVoice) lines.push('Android: open Settings → search “Text-to-speech” → Preferred engine: Speech Services by Google → ⚙ → Install voice data → Chinese (Taiwan). Then restart the app.');
      lines.push('iPhone: the backup voice is muted in Silent mode. The recordings are not.');
    }
    $('#sVoice').innerHTML = lines.join('<br>');
  };
  showVoice();
  $('#sAudioAll').onclick = async e => {
    const files = [...new Set(Object.values(AUDIO))], total = files.length, btn = e.target, msg = $('#sAudioMsg');
    if (!total) return;
    btn.disabled = true; let n = 0, failed = 0;
    const worker = async () => { while (files.length) { const f = files.shift(); try { const r = await fetch('audio/' + f); if (!r.ok) failed++; } catch (err) { failed++; } msg.textContent = `${++n} of ${total}`; } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    btn.disabled = false;
    msg.textContent = failed ? `${total - failed} of ${total} saved. Connect to Wi-Fi and try again for the rest.` : `All ${total} clips saved for offline use.`;
  };
  $('#sTest').onclick = () => { speak('中華民國總統每幾年選一次？'); setTimeout(showVoice, 1500); };
  const code = () => btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  $('#sCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(code()); toast('Progress code copied. Paste it on your other device.'); }
    catch (e) { $('#sCode').value = code(); $('#sCode').select(); toast('Copy the selected code below.'); }
  };
  $('#sFile').onclick = () => {
    const blob = new Blob([JSON.stringify(S)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `naturalization-progress-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#sLoadFile').onclick = () => $('#sFileIn').click();
  $('#sFileIn').onchange = async e => { const f = e.target.files[0]; if (f) importState(await f.text()); };
  $('#sImport').onclick = () => {
    const v = $('#sCode').value.trim(); if (!v) return toast('Paste a progress code first.');
    let txt = v; try { txt = decodeURIComponent(escape(atob(v))); } catch (e) { /* maybe raw JSON */ }
    importState(txt);
  };
  $('#sReset').onclick = e => {
    if (e.target.dataset.armed) { S = defaults(); save(); applySettings(); toast('Progress erased.'); go('#/'); }
    else { e.target.dataset.armed = '1'; e.target.textContent = 'Tap again to erase everything'; }
  };
}
function importState(txt) {
  try {
    const p = JSON.parse(txt);
    if (!p || typeof p !== 'object' || !p.items) throw new Error('bad');
    S = {...defaults(), ...p, settings: {...defaults().settings, ...(p.settings || {})}};
    save(); applySettings(); toast('Progress loaded.'); go('#/');
  } catch (e) { toast("That code didn't work. Copy it again from your other device."); }
}

/* ---------- boot ---------- */
applySettings();
onRoute();
