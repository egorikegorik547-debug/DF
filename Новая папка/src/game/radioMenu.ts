// @ts-nocheck
/* ============================================================
   ВОЕННАЯ РАДИОСТАНЦИЯ Р-159 — МЕНЮ
   Вкладки: 📡 Пеленгатор · 🔢 Номерные станции · 🗣 Связь · 📝 Блокнот.
   Общая настройка: ручки «ГРУБО» / «ТОЧНО», лента спектра, индикатор сигнала.
   Дополнительно здесь же: кодовый замок (клавиатура + блокнот) для дверей и сейфов в сети бункеров.
   ============================================================ */
import './radio.css';
import {
  F_MIN, F_MAX, SQ_COLS, sqName, fmtF, STATIONS, CONTACTS, CREEPY, CIPHERS, MAX_PENDING_FIXES,
  ensureRadio, makeFix, stationPlaylist, messageScript, rollRareQuest, beaconHint, unknownContact, contactById
} from './radioData';
import { MAX_ACTIVE_QUESTS, ensureQuests, questTitle } from './quests';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const gauss = (d, w) => Math.exp(-(d * d) / (w * w));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPE_NAME = { refuge: 'пустующее убежище выживших', depot: 'запертый армейский склад' };
const TYPE_ICON = { refuge: '🏚', depot: '🪖' };

export function createRadio(api) {
  const save = () => api.getSave();
  const $ = id => document.getElementById(id);
  const host = document.getElementById('gameRoot') || document.body;

  /* ---------- голос: Web Speech API (если нет русского голоса — цифры «пищат» тонами) ---------- */
  let ruVoice = null;
  const refreshVoices = () => { try { ruVoice = (speechSynthesis.getVoices() || []).find(v => /^ru/i.test(v.lang)) || null; } catch (e) { ruVoice = null; } };
  if (typeof speechSynthesis !== 'undefined') { refreshVoices(); try { speechSynthesis.onvoiceschanged = refreshVoices; } catch (e) {} }
  const cancelSpeech = () => { try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {} };

  /* ---------- разметка ---------- */
  const root = document.createElement('div');
  root.innerHTML = `
<div id="scr-radio" class="screen dim off" style="z-index:62">
  <div class="panel rd-panel">
    <div class="rd-head">
      <div class="rd-title"><span class="rd-led" id="rdLed"></span>Р-159 · военная радиостанция</div>
      <div class="flex items-center gap-2"><span class="chip text-xs" id="rdBatt"></span><button class="btn sm" id="rdClose">✕ Выключить <kbd>Esc</kbd></button></div>
    </div>
    <div class="rd-body">
      <div class="rd-dev">
        <div class="rd-lcd">
          <div class="rd-freq"><b id="rdFreq">00.000</b><small>МГц</small></div>
          <div class="rd-lcdr"><span id="rdMode"></span><span id="rdQual"></span></div>
        </div>
        <canvas id="rdScope" width="560" height="150"></canvas>
        <div class="rd-bandbar" id="rdBar" title="Клик — быстро перейти по диапазону 3–30 МГц"><div id="rdBarMk"></div><i id="rdBarCur"></i></div>
        <div class="rd-bandlbl"><span>3</span><span>8</span><span>13</span><span>18</span><span>23</span><span>30 МГц</span></div>
        <div class="rd-knobs">
          <div class="rd-kw"><div class="rd-knob" id="rdK1"><i></i></div><span>ГРУБО</span></div>
          <div class="rd-meter"><div class="rd-segs" id="rdSegs"></div><span>СИГНАЛ</span></div>
          <div class="rd-kw"><div class="rd-knob sm" id="rdK2"><i></i></div><span>ТОЧНО</span></div>
        </div>
        <div class="rd-steps">
          <button class="btn sm" data-step="-1">◀◀ −1</button><button class="btn sm" data-step="-0.1">◀ −0.1</button>
          <button class="btn sm" data-step="-0.01">‹ −0.01</button><button class="btn sm" data-step="0.01">+0.01 ›</button>
          <button class="btn sm" data-step="0.1">+0.1 ▶</button><button class="btn sm" data-step="1">+1 ▶▶</button>
        </div>
        <p class="rd-keys">Ручки: перетаскивайте мышью по кругу или крутите колесом. Клавиши: <kbd>←</kbd><kbd>→</kbd> ±0.01 · <kbd>Shift</kbd> ±0.001 · <kbd>↑</kbd><kbd>↓</kbd> ±0.1 · <kbd>PgUp</kbd><kbd>PgDn</kbd> ±1</p>
      </div>
      <div class="rd-main">
        <div class="rd-tabs" id="rdTabs">
          <button data-tab="df">📡 Пеленгатор</button><button data-tab="num">🔢 Номерные станции</button>
          <button data-tab="com">🗣 Связь<span id="rdComDot"></span></button><button data-tab="note">📝 Блокнот</button>
        </div>
        <div id="rdTab" class="rd-tab"></div>
      </div>
    </div>
  </div>
</div>
<div id="scr-code" class="screen dim off" style="z-index:64">
  <div class="panel cd-panel">
    <div class="rd-head">
      <div class="rd-title" id="cdTitle"></div>
      <button class="btn sm" id="cdClose">✕ Отойти <kbd>Esc</kbd></button>
    </div>
    <div class="cd-body">
      <div class="cd-lock" id="cdLockBox">
        <div class="cd-tag" id="cdTag"></div>
        <div class="cd-disp" id="cdDisp"></div>
        <div class="cd-msg" id="cdMsg"></div>
        <div class="cd-pad" id="cdPad"></div>
        <p class="rd-keys">Цифры <kbd>0</kbd>–<kbd>9</kbd> · <kbd>Backspace</kbd> — стереть · <kbd>Enter</kbd> — подтвердить. Неверный код шумит — на звук могут прийти Бывшие.</p>
      </div>
      <div class="cd-note">
        <h3>📝 Блокнот</h3>
        <textarea id="cdNotes" placeholder="Запишите сюда позывные и цифры из эфира…" spellcheck="false"></textarea>
        <div id="cdFixes"></div>
      </div>
    </div>
  </div>
</div>`;
  while (root.firstChild) host.appendChild(root.firstChild);

  /* ---------- состояние ---------- */
  const R = {
    open: false, rec: null, tab: 'df', lastMode: 'df', f: 7.15, timer: 0, raf: 0, last: 0, uiT: 0, staticT: 0, beepT: 0,
    q: 0, qKind: '', sig: 0, rot1: 0, rot2: 0, bearing: 0,
    df: { prog: 0, msg: '', result: null, full: false },
    num: { cur: -1, token: 0, cursor: [0, 0], view: null, running: false },
    com: { state: 'idle', near: null, prog: 0, chat: null, lostT: 0 }
  };
  const K = { open: false, o: null, val: '', lock: 0, notesOnly: false };

  /* ---------- частота ---------- */
  function setFreq(f) {
    R.f = Math.round(clamp(f, F_MIN, F_MAX) * 1000) / 1000;
    save().radio.freq = R.f;
  }
  const mode = () => (R.tab === 'note' ? R.lastMode : R.tab);

  function signalsAt(f) {
    const S = [], r = save().radio, day = save().day;
    for (const b of r.beacons) S.push({ kind: 'df', ref: b, freq: b.freq, s: gauss(f - b.freq, 0.09), amp: 0.24, w: 0.045 });
    STATIONS.forEach((st, i) => S.push({ kind: 'num', idx: i, ref: st, freq: st.freq, s: gauss(f - st.freq, 0.03), amp: 0.95, w: 0.02, color: st.color }));
    for (const c of CONTACTS) if (c.day <= day) S.push({ kind: 'com', ref: c, freq: c.freq, s: gauss(f - c.freq, 0.045), amp: 0.55, w: 0.03, color: c.color });
    return S;
  }

  /* ============================================================
     ОТКРЫТИЕ / ЗАКРЫТИЕ
     ============================================================ */
  function open(rec) {
    if (R.open) return;
    const r = ensureRadio(save());
    api.initAudio();
    R.open = true; R.rec = rec; R.f = r.freq; R.tab = r.mode === 'df' || r.mode === 'num' || r.mode === 'com' ? r.mode : 'df'; R.lastMode = R.tab;
    R.df = { prog: 0, msg: '', result: null, full: false };
    R.num.cur = -1; R.num.token++; R.num.view = null; R.num.running = false;
    R.com = { state: 'idle', near: null, prog: 0, chat: null, lostT: 0 };
    R.q = 0; R.sig = 0; R.last = performance.now(); R.beepT = 0; R.staticT = 0;
    $('scr-radio').classList.remove('off');
    renderTabs(); renderTab();
    clearInterval(R.timer); R.timer = setInterval(step, 100);
    cancelAnimationFrame(R.raf); R.raf = requestAnimationFrame(frame);
    api.sfx.open();
    api.noise(0.35, 0.08, 5000); api.tone(380, 0.5, 'sine', 0.03, 900);
    if (!ensureRadio(save()).heard.intro) {
      ensureRadio(save()).heard.intro = true;
      api.toast('📻 Р-159 включена. Вкладки: пеленгатор, номерные станции, связь. Известна частота «Ястреба» — 7.150 МГц', 'good');
    }
  }
  function close(reason) {
    if (!R.open) return;
    R.open = false; clearInterval(R.timer); cancelAnimationFrame(R.raf);
    R.num.token++; R.num.cur = -1; cancelSpeech();
    if (R.com.chat) { clearInterval(R.com.chat.typeT); R.com.chat = null; }
    save().radio.mode = mode();
    $('scr-radio').classList.add('off');
    api.noise(0.25, 0.07, 4500); api.tone(900, 0.3, 'sine', 0.025, -600);
    api.store();
    const rec = R.rec; R.rec = null;
    if (api.onClose) api.onClose(rec, reason);
  }

  /* ============================================================
     ШАГ СИМУЛЯЦИИ (10 раз в секунду)
     ============================================================ */
  function step() {
    if (!R.open) return;
    const now = performance.now(), dt = Math.min(0.5, (now - R.last) / 1000); R.last = now;
    // питание
    const left = api.drain(R.rec, dt);
    if (left <= 0) { api.toast('🔋 Батарейка села — радиостанция замолчала. Вставьте новую', 'bad'); api.noise(0.5, 0.06, 2400); api.tone(260, 0.5, 'sine', 0.04, -200); close('dead'); return; }
    const m = mode(), S = signalsAt(R.f), V = 1;
    const best = k => S.filter(x => x.kind === k).reduce((a, x) => (x.s > (a ? a.s : -1) ? x : a), null);
    const bm = best(m);
    R.sig = bm ? bm.s : 0; R.qKind = m;
    // фоновый шум эфира — тем тише, чем чище приём
    R.staticT -= dt;
    if (R.staticT <= 0) { api.noise(0.26, (0.02 + Math.random() * 0.012) * (1 - clamp(R.sig, 0, 1) * 0.85) * V, rnd(2200, 6000)); R.staticT = 0.22; }

    if (m === 'df') stepDF(dt, S, bm);
    else if (R.df.prog > 0) R.df.prog = 0;
    if (m === 'num') stepNum(S, best('num')); else if (R.num.cur !== -1) { R.num.token++; R.num.cur = -1; cancelSpeech(); }
    if (m === 'com') stepCom(dt, S, best('com'));
    else if (R.com.state === 'calling') { R.com.state = 'idle'; R.com.prog = 0; }
    // связь рвётся, если уйти с частоты
    if (R.com.chat) {
      const c = R.com.chat.c, d = Math.abs(R.f - c.freq);
      if (d > 0.3) { R.com.lostT += dt; if (R.com.lostT > 0.8) endChat('Связь потеряна: вы ушли с частоты ' + fmtF(c.freq) + ' МГц.'); } else R.com.lostT = 0;
    }
    R.q = bm && (m === 'num' ? bm.s : m === 'com' ? bm.s : bm.s) || 0;
  }

  /* ---------- 📡 Пеленгатор ---------- */
  function stepDF(dt, S, bm) {
    const s = bm ? bm.s : 0, b = bm && bm.ref;
    // пикающий маяк: чем ближе к частоте — тем чаще и выше
    R.beepT -= dt;
    if (s > 0.05 && R.beepT <= 0) {
      api.tone(520 + 760 * s, 0.05 + 0.06 * s, 'sine', 0.025 + 0.085 * s);
      if (s > 0.8) api.tone(1040 + 760 * s, 0.04, 'triangle', 0.02);
      R.beepT = 1.15 - 1.03 * Math.pow(s, 0.65);
    }
    const D = R.df;
    if (b && s > 0.05) R.bearing += ((b.bearing + (Math.random() - 0.5) * (1 - s) * 140) - R.bearing) * 0.35;
    else R.bearing += rnd(-9, 14);
    if (b && !b.found && s >= 0.9) {
      const pend = save().radio.fixes.filter(f => !f.done).length;
      if (pend >= MAX_PENDING_FIXES) { D.full = true; D.prog = 0; }
      else {
        D.full = false; D.prog = clamp(D.prog + dt / 2.6, 0, 1);
        api.tone(1180 + 500 * D.prog, 0.06, 'sine', 0.03);
        if (D.prog >= 1) captureBeacon(b);
      }
    } else { D.full = false; D.prog = Math.max(0, D.prog - dt / 1.3); }
  }
  function captureBeacon(b) {
    const r = save().radio, fix = makeFix(save(), b);
    b.fixId = fix.id; R.df.prog = 0; R.df.result = fix.id;
    api.store();
    api.tone(880, 0.18, 'triangle', 0.1); setTimeout(() => api.tone(1320, 0.25, 'triangle', 0.1), 150); setTimeout(() => api.tone(1760, 0.4, 'sine', 0.08), 320);
    api.noise(0.2, 0.08, 6000);
    api.toast(`📡 Маяк захвачен: ${TYPE_NAME[fix.type]} · квадрат ${sqName(fix.sx, fix.sz)} · позывной замка ${fix.callsign}`, 'good');
    renderTab();
  }

  /* ---------- 🔢 Номерные станции ---------- */
  function stepNum(S, bm) {
    const want = bm && bm.s > 0.55 ? bm.idx : -1;
    if (want !== R.num.cur) {
      R.num.token++; cancelSpeech(); R.num.cur = want; R.num.view = null;
      if (want >= 0) { R.num.running = true; runStation(want, R.num.token); }
    }
  }
  async function runStation(idx, token) {
    const live = () => R.open && token === R.num.token;
    const st = STATIONS[idx];
    await sleep(500);
    while (live()) {
      const pl = stationPlaylist(save(), idx), k = R.num.cursor[idx] % Math.max(1, pl.length), msg = pl[k];
      if (!msg) { await sleep(1000); continue; }
      R.num.view = { idx, lines: [], msgNo: k + 1, total: pl.length, mine: !!msg.fixId, creepy: '' };
      renderNumView();
      await numCarrier(st, token);
      if (!live()) return;
      const script = messageScript(msg);
      for (const seg of script) {
        if (!live()) return;
        const V = R.num.view;
        if (seg.k === 'p') { if (seg.line) V.lines.push({ label: seg.line, digits: [], text: true }); }
        else {
          let L = V.lines[V.lines.length - 1];
          if (seg.first || !L || L.text || L.label !== seg.label) { L = { label: seg.label, digits: [] }; V.lines.push(L); }
          const sNow = R.q, shown = sNow >= 0.88 || Math.random() > (0.88 - sNow) * 2.4;
          L.digits.push(shown ? seg.d : null);
        }
        renderNumView();
        await speak(seg.say, st, seg, token);
        await sleep(seg.k === 'd' ? 380 : 480);
      }
      if (!live()) return;
      R.num.cursor[idx] = (R.num.cursor[idx] || 0) + 1;
      await sleep(900);
      if (live() && Math.random() < 0.6) {
        const line = pick(CREEPY);
        R.num.view = Object.assign({}, R.num.view, { creepy: line }); renderNumView();
        await speak(line, { pitch: Math.max(0.1, st.pitch - 0.35), rate: 0.5 }, { k: 'c' }, token);
        await sleep(1300);
        if (R.num.view) R.num.view.creepy = ''; renderNumView();
      }
      await sleep(1200);
    }
  }
  async function numCarrier(st, token) {
    for (let i = 0; i < 3 && R.open && token === R.num.token; i++) { api.tone(st.pitch > 1 ? 1500 : 700, 0.12, 'sine', 0.035 * (0.4 + R.q)); await sleep(260); }
    await sleep(300);
  }
  function speak(text, st, seg, token) {
    return new Promise(resolve => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(to); resolve(); };
      const to = setTimeout(fin, 1500 + text.length * 260);
      const vol = clamp(api.vol() * (0.35 + R.q * 0.65), 0.05, 1);
      if (ruVoice && typeof speechSynthesis !== 'undefined') {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'ru-RU'; u.voice = ruVoice; u.pitch = clamp(st.pitch, 0, 2); u.rate = clamp(st.rate, 0.1, 2); u.volume = vol;
          u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
          return;
        } catch (e) {}
      }
      // запасной вариант: цифра = столько писков, 0 = один длинный
      const q = 0.35 + R.q * 0.65;
      if (seg.k === 'd') {
        const n = seg.d === 0 ? 1 : seg.d;
        if (seg.d === 0) api.tone(360, 0.38, 'square', 0.04 * q);
        else for (let i = 0; i < n; i++) setTimeout(() => { if (R.open && token === R.num.token) api.tone(640 + i * 12, 0.07, 'square', 0.04 * q); }, i * 150);
        setTimeout(fin, n * 150 + 380);
      } else {
        const hi = st.pitch > 1;
        api.tone(hi ? 520 : 240, 0.3, 'sawtooth', 0.025 * q, hi ? 400 : 160); api.noise(0.3, 0.04 * q, 3000);
        setTimeout(fin, seg.k === 'c' ? 2200 : 700 + text.length * 25);
      }
    });
  }

  /* ---------- 🗣 Связь ---------- */
  function stepCom(dt, S, bm) {
    const C = R.com, s = bm ? bm.s : 0;
    C.near = bm && s > 0.25 ? bm.ref : null; C.nearS = s;
    const r = save().radio;
    if (bm && s > 0.82 && !r.contacts[bm.ref.id].known) { r.contacts[bm.ref.id].known = true; api.toast(`🗣 Слышен голос: «${bm.ref.name}» — частота записана`, 'good'); api.store(); renderTab(); }
    if (!C.chat && s > 0.12) {   // искажённая речь вдалеке
      if (Math.random() < 0.55) {
        const n = 3 + Math.floor(Math.random() * 4), f0 = rnd(120, 200) * (bm.ref.id === 'anna' ? 1.5 : 1);
        for (let k = 0; k < n; k++) setTimeout(() => { if (R.open && !R.com.chat) { api.tone(f0 * rnd(0.8, 1.7), 0.08, 'sawtooth', 0.02 * s); api.noise(0.07, 0.025 * s, 2800); } }, k * rnd(90, 140));
      }
    }
    if (C.state === 'calling') {
      if (bm && s >= 0.8) {
        C.prog = clamp(C.prog + dt / 2.4, 0, 1);
        if (Math.floor(C.prog * 5) !== Math.floor((C.prog - dt / 2.4) * 5)) api.tone(720, 0.12, 'triangle', 0.05);
        if (C.prog >= 1) startChat(bm.ref);
      } else { C.prog -= dt * 1.2; if (C.prog <= 0) { C.state = 'idle'; C.prog = 0; setComStatus('⚠ Сигнал потерян при вызове. Удерживайте частоту точнее.'); } }
    }
  }
  function callNearest() {
    const C = R.com;
    if (C.chat) return;
    if (!C.near || C.nearS < 0.8) { setComStatus('⚠ Нет устойчивого сигнала. Настройтесь на частоту абонента точнее (шкала «СИГНАЛ» почти полная).'); api.sfx.empty(); return; }
    C.state = 'calling'; C.prog = 0; api.tone(540, 0.2, 'sine', 0.05); setComStatus(`📞 Вызываю «${C.near.name}»… не сбивайте частоту`);
  }
  function startChat(c) {
    const C = R.com, rs = save().radio.contacts[c.id];
    C.state = 'connected'; C.prog = 0; C.lostT = 0; rs.known = true;
    api.tone(660, 0.1, 'triangle', 0.06); setTimeout(() => api.tone(990, 0.16, 'triangle', 0.06), 110);
    C.chat = { c, log: [], typing: false, typeT: 0, choices: [], offer: null, seq: 0 };
    renderTab();
    const lines = c.greet; chatSay(pick(lines), () => chatMenu());
  }
  function endChat(reason) {
    const C = R.com; if (!C.chat) return;
    clearInterval(C.chat.typeT); C.chat = null; C.state = 'idle'; C.prog = 0;
    api.noise(0.3, 0.06, 4000); api.tone(500, 0.3, 'sine', 0.04, -300);
    renderTab();
    if (reason) setComStatus(reason);
  }
  function chatSay(text, then) {
    const ch = R.com.chat; if (!ch) return;
    const line = { who: 'c', text, shown: 0 }; ch.log.push(line); ch.typing = true; ch.choices = [];
    renderChat();
    clearInterval(ch.typeT);
    ch.typeT = setInterval(() => {
      line.shown = Math.min(text.length, line.shown + 2);
      if (line.shown % 6 < 2) api.tone(rnd(300, 520), 0.03, 'square', 0.008);
      const fin = line.shown >= text.length;
      if (fin) { clearInterval(ch.typeT); ch.typing = false; }
      updateLastLine();
      if (fin && then) then();
    }, 22);
  }
  function chatMe(text) { const ch = R.com.chat; if (!ch) return; ch.log.push({ who: 'me', text, shown: text.length }); }
  function chatSys(text) { const ch = R.com.chat; if (!ch) return; ch.log.push({ who: 'sys', text, shown: text.length }); }
  function chatMenu() {
    const ch = R.com.chat; if (!ch) return;
    const c = ch.c, r = save().radio, rs = r.contacts[c.id], day = save().day;
    const ch_ = [];
    if (!rs.intro) ch_.push({ label: 'Кто ты и откуда выходишь в эфир?', fn: () => actIntro() });
    ch_.push({ label: 'Что слышно снаружи?', fn: () => actRumor() });
    ch_.push({ label: 'Не слышал ли ты чего-нибудь в эфире — частоты, маяки?', fn: () => actTip(), dim: rs.tipDay === day });
    ch_.push({ label: `Есть работа? Что-то редкое? ${rs.trust >= 2 ? '' : '(нужно больше доверия)'}`, fn: () => actWork(), dim: rs.trust < 2 || rs.questDay === day });
    ch_.push({ label: 'Отбой. Конец связи.', fn: () => { chatMe('Отбой.'); chatSay(pick(['Принято. Береги батарею.', 'Конец связи. Не пропадай.', 'Отбой. И будь тише.']), () => setTimeout(() => endChat('Связь окончена.'), 700)); } });
    ch.choices = ch_;
    renderChat();
  }
  const trustUp = (rs, v) => { rs.trust = clamp(rs.trust + v, 0, 6); api.store(); };
  function actIntro() {
    const ch = R.com.chat, c = ch.c, rs = save().radio.contacts[c.id];
    chatMe('Кто ты и откуда выходишь в эфир?'); rs.intro = true; trustUp(rs, 1);
    chatSay(c.bio, () => { chatSys('Доверие растёт.'); chatMenu(); });
  }
  function actRumor() {
    const ch = R.com.chat, c = ch.c, rs = save().radio.contacts[c.id], day = save().day;
    chatMe('Что слышно снаружи?');
    const first = rs.talkDay !== day; if (first) { rs.talkDay = day; trustUp(rs, 1); }
    chatSay(pick(c.rumors), () => { if (first) chatSys('Доверие растёт.'); chatMenu(); });
  }
  function actTip() {
    const ch = R.com.chat, c = ch.c, rs = save().radio.contacts[c.id], day = save().day;
    chatMe('Не слышал ли ты чего-нибудь в эфире — частоты, маяки?');
    if (rs.tipDay === day) { chatSay('Я тебе уже всё рассказал на сегодня. Не мучай меня, приходи завтра.', () => chatMenu()); return; }
    rs.tipDay = day;
    const uc = unknownContact(save());
    if (uc && uc.id !== c.id) {
      save().radio.contacts[uc.id].known = true; api.store();
      chatSay(`Есть ещё один человек. «${uc.name}», ${uc.role}. Выходит на ${fmtF(uc.freq)} МГц. Скажи, что от меня.`, () => { chatSys(`📻 Частота записана: «${uc.name}» — ${fmtF(uc.freq)} МГц`); chatMenu(); });
      return;
    }
    const h = beaconHint(save());
    if (h) {
      api.store();
      chatSay(`Слышал слабый маяк — между ${h.lo.toFixed(2)} и ${h.hi.toFixed(2)} МГц. По тону — ${h.type === 'depot' ? 'военный, склад' : 'гражданский, чьё-то убежище'}. Искать надо тихо и точно.`, () => { chatSys(`📡 Диапазон отмечен на ленте: ${h.lo.toFixed(2)}–${h.hi.toFixed(2)} МГц`); chatMenu(); });
    } else chatSay('Эфир сегодня пустой. Все маяки, что были, ты уже поймал. Молодец.', () => chatMenu());
  }
  function actWork() {
    const ch = R.com.chat, c = ch.c, rs = save().radio.contacts[c.id], day = save().day;
    chatMe('Есть работа? Что-то редкое?');
    if (rs.trust < 2) { chatSay('Мы ещё мало знакомы. Поговори со мной, расскажи, что у тебя. Потом разберёмся.', () => chatMenu()); return; }
    if (rs.questDay === day) { chatSay('Сегодня я уже давал тебе поручение. Приходи завтра — придумаю новое.', () => chatMenu()); return; }
    const Q = ensureQuests(save());
    if (Q.active.length >= MAX_ACTIVE_QUESTS) { chatSay(`У тебя уже ${Q.active.length} задания на руках. Сначала сдай их торговцу, потом поговорим.`, () => chatMenu()); return; }
    const q = rollRareQuest(c, day, rs.trust, api.ITEMS);
    rs.questDay = day; api.store();
    ch.offer = q;
    const rew = q.reward.map(([id, n]) => api.ITEMS[id].name + ' ×' + n).join(', ');
    chatSay(`${q.say} Задача: ${questTitle(q, api.ITEMS)}. Награда: ${rew}. Сдашь торговцу в любой лавке — вкладка «Задания».`, () => {
      ch.choices = [
        { label: '✔ Беру. Сделаю.', fn: () => acceptOffer() },
        { label: '✕ Не сейчас.', fn: () => { chatMe('Не сейчас.'); ch.offer = null; chatSay('Дело твоё. Но предложение на сегодня — последнее.', () => chatMenu()); } }
      ];
      renderChat();
    });
  }
  function acceptOffer() {
    const ch = R.com.chat; if (!ch || !ch.offer) return;
    const Q = ensureQuests(save()), q = ch.offer; ch.offer = null;
    q.uid = Q.uid++; q.got = 0; Q.active.push(q);
    chatMe('Беру. Сделаю.'); trustUp(save().radio.contacts[ch.c.id], 0.5);
    api.sfx.pick(); api.toast('📜 Редкое задание принято: ' + questTitle(q, api.ITEMS) + ' — сдайте торговцу', 'good');
    chatSay(pick(['Вот это по-нашему. Удачи, и не шуми.', 'Договорились. Награду получишь у торговца.', 'Жду результата. Конец связи — когда захочешь.']), () => { chatSys('📜 Задание добавлено. Сдать его можно у торговца в лавке.'); chatMenu(); });
  }

  /* ============================================================
     ОТРИСОВКА
     ============================================================ */
  function renderTabs() {
    for (const b of $('rdTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === R.tab);
    $('rdMode').textContent = { df: 'ПЕЛЕНГ', num: 'AM · ПРИЁМ', com: 'ГОЛОС · УКВ', note: 'ЖУРНАЛ' }[R.tab] || '';
  }
  function setTab(t) {
    if (R.tab === t) return;
    if (t !== 'note') R.lastMode = t;
    R.tab = t; renderTabs(); renderTab(); api.sfx.click();
  }
  function renderTab() {
    const el = $('rdTab'); if (!el) return;
    const r = save().radio;
    if (R.tab === 'df') {
      const hint = r.hints.map(h => `<span class="rd-pill">≈ ${h.lo.toFixed(2)}–${h.hi.toFixed(2)} МГц · ${h.type === 'depot' ? 'склад' : 'убежище'}</span>`).join('');
      const un = r.beacons.filter(b => !b.found).length;
      el.innerHTML = `
        <p class="rd-help">Маяки выжившего и армейских складов очень слабы: на ленте спектра ищите <b>едва заметный бугорок</b> и слушайте писк — он учащается при приближении.
        Подведите частоту ручкой «ТОЧНО» и держите, пока заполнится шкала захвата. Каждый день в эфире — новые маяки (сегодня непойманных: <b>${un}</b>).</p>
        <div class="rd-card">
          <div class="rd-row"><span>Уровень сигнала</span><b id="dfS">0%</b></div><div class="rd-sigbar"><i id="dfBar"></i></div>
          <div class="rd-row"><span>Захват пеленга</span><b id="dfP">0%</b></div><div class="rd-sigbar lock"><i id="dfLock"></i></div>
          <div class="rd-status" id="dfStatus"></div>
        </div>
        <div class="rd-compass"><div class="rd-dial"><b>С</b><i id="dfNeedle"></i></div><div><div class="text-xs text-white/55">Пеленг на источник</div><div class="rd-big" id="dfBear">—</div></div></div>
        ${hint ? `<div class="rd-sub">Подсказки собеседников:</div><div>${hint}</div>` : ''}
        <div class="rd-sub">Журнал пеленгации:</div><div id="dfFixes">${fixesHTML()}</div>`;
    } else if (R.tab === 'num') {
      el.innerHTML = `
        <p class="rd-help">Номерные станции вещают цифры монотонным голосом. На двери или сейфе висит бирка с <b>позывным</b> — найдите в эфире передачу с этим позывным и запишите <b>группу цифр</b>. Не всякая группа диктуется как есть: слушайте, какой <b>шифр</b> объявлен. Станции повторяют группу дважды.</p>
        <div class="rd-presets">${STATIONS.map((s, i) => `<button class="btn sm" data-preset="${i}" style="border-color:${s.color}66">${i ? '📻' : '🌙'} ${s.name} · ${fmtF(s.freq)}</button>`).join('')}</div>
        <div class="rd-card">
          <div class="rd-row"><span id="numTitle">Станция не принимается — настройтесь на частоту</span><b id="numNo"></b></div>
          <div id="numView" class="rd-subs"></div>
          <div class="rd-ctrl">
            <label class="rd-chk"><input type="checkbox" id="numSubs" ${r.subs ? 'checked' : ''}> Субтитры на экране</label>
            <button class="btn sm" id="numRep">🔁 Сначала</button><button class="btn sm" id="numNext">⏭ Следующая передача</button>
          </div>
          <div class="rd-voice">${ruVoice ? '🔊 Голос станции: синтез речи' : '🔊 Русского голоса в браузере нет — цифры передаются писками: сколько писков, такая цифра (0 — один длинный)'}</div>
        </div>
        <div class="rd-sub">📝 Блокнот <span class="text-white/45">(сохраняется, доступен на вылазке клавишей <kbd>N</kbd>)</span></div>
        <textarea class="rd-notes" id="rdNotes" rows="4" spellcheck="false" placeholder="417 — 5 8 2 0 ...">${esc(r.notes)}</textarea>
        <div id="dfFixes">${fixesHTML()}</div>`;
      renderNumView();
    } else if (R.tab === 'com') {
      const day = save().day;
      el.innerHTML = `
        <p class="rd-help">За пределами бункера есть живые. Найдите их частоты (ручкой — они откликаются голосом) или узнайте у других собеседников, затем нажмите <b>«Вызвать»</b> и удерживайте частоту, пока не установится связь. Говорите, завоёвывайте доверие — и они дадут <b>редкие задания</b> (награду выдаёт торговец).</p>
        <div class="rd-contacts">${CONTACTS.map(c => {
          const rs = r.contacts[c.id], avail = c.day <= day;
          return `<div class="rd-ct ${rs.known ? 'known' : ''} ${avail ? '' : 'off'}" data-ct="${c.id}"><span class="rd-ctic" style="background:${c.color}33;border-color:${c.color}">${c.icon}</span>
            <div><b>${rs.known ? c.name : '«???»'}</b><small>${rs.known ? c.role : avail ? 'не опознан — ищите в эфире' : 'пока молчит (появится позже)'}</small></div>
            <div class="rd-ctf">${rs.known ? fmtF(c.freq) : '—'}<small>${rs.known ? '🤝 ' + '●'.repeat(Math.min(5, Math.floor(rs.trust))) + '○'.repeat(Math.max(0, 5 - Math.floor(rs.trust))) : ''}</small></div></div>`;
        }).join('')}</div>
        <div class="rd-card">
          <div class="rd-row"><span id="comStatus">Нет сигнала голосовой связи.</span><button class="btn sm main" id="comCall">📞 Вызвать</button></div>
          <div class="rd-sigbar lock"><i id="comProg"></i></div>
          <div id="comChat" class="rd-chat"></div><div id="comChoices" class="rd-choices"></div>
        </div>`;
      renderChat(); updateComStatus();
    } else {
      el.innerHTML = `
        <p class="rd-help">Записывайте всё важное: позывные, цифры, координаты. Блокнот сохраняется вместе с игрой и открывается на вылазке клавишей <kbd>N</kbd>.</p>
        <textarea class="rd-notes big" id="rdNotes" spellcheck="false" placeholder="Позывные, коды, частоты…">${esc(r.notes)}</textarea>
        <div class="rd-sub">Журнал пеленгации:</div><div id="dfFixes">${fixesHTML()}</div>`;
    }
    const ta = $('rdNotes');
    if (ta) ta.addEventListener('input', () => { save().radio.notes = ta.value.slice(0, 4000); clearTimeout(R.noteT); R.noteT = setTimeout(() => api.store(), 400); });
    const ds = $('numSubs'); if (ds) ds.onchange = () => { save().radio.subs = ds.checked; api.store(); renderNumView(); };
    const rep = $('numRep'); if (rep) rep.onclick = () => { if (R.num.cur >= 0) { R.num.token++; cancelSpeech(); const i = R.num.cur; R.num.cur = -1; R.num.view = null; api.sfx.click(); } };
    const nx = $('numNext'); if (nx) nx.onclick = () => { if (R.num.cur >= 0) { const i = R.num.cur; R.num.cursor[i] = (R.num.cursor[i] || 0) + 1; R.num.token++; cancelSpeech(); R.num.cur = -1; R.num.view = null; api.sfx.click(); } };
    for (const b of el.querySelectorAll('[data-preset]')) b.onclick = () => { setFreq(STATIONS[+b.dataset.preset].freq); api.sfx.click(); api.noise(0.2, 0.06, 5000); };
    const call = $('comCall'); if (call) call.onclick = callNearest;
    for (const b of el.querySelectorAll('[data-ct]')) b.onclick = () => { const c = contactById(b.dataset.ct), rs = save().radio.contacts[c.id]; if (rs.known) { setFreq(c.freq); api.sfx.click(); api.noise(0.2, 0.06, 5000); } };
    updateDFUI(); renderBarMarks();
  }
  function fixesHTML() {
    const fx = save().radio.fixes.slice().reverse();
    if (!fx.length) return '<p class="text-white/45 text-xs">Пока ни одного маяка не поймано.</p>';
    return fx.map(f => `<div class="rd-fix ${f.done ? 'done' : ''}"><span class="rd-fixic">${TYPE_ICON[f.type]}</span><div><b>${f.type === 'depot' ? 'Армейский склад' : 'Пустующее убежище'}</b> · квадрат <b class="text-amber-300">${sqName(f.sx, f.sz)}</b><small>Позывной на замке: <b>${f.callsign}</b> · ${f.done ? '✔ вскрыто' : f.type === 'depot' ? 'замок на двери склада' : 'кодовый сейф внутри'} · код — на номерной станции</small></div></div>`).join('');
  }
  function renderNumView() {
    const el = $('numView'), t = $('numTitle'); if (!el) return;
    const V = R.num.view, subs = save().radio.subs;
    if (!V) { el.innerHTML = '<div class="rd-idle">· · · эфир · · ·</div>'; if (t) t.textContent = R.num.cur >= 0 ? 'Станция на связи — ждём начала передачи…' : 'Станция не принимается — настройтесь на частоту'; $('numNo').textContent = ''; return; }
    const st = STATIONS[V.idx];
    t.innerHTML = `<span style="color:${st.color}">●</span> ${st.name}`; $('numNo').textContent = `передача ${V.msgNo}/${V.total}`;
    if (V.creepy) { el.innerHTML = `<div class="rd-creepy">${subs ? esc(V.creepy) : '… … …'}</div>`; return; }
    if (!subs) { el.innerHTML = '<div class="rd-onair"><i></i><i></i><i></i><i></i><i></i></div><div class="rd-idle">Идёт передача. Субтитры выключены — записывайте на слух.</div>'; return; }
    el.innerHTML = V.lines.map(L => L.text ? `<div class="rd-line txt">${esc(L.label)}</div>` : `<div class="rd-line"><span>${esc(L.label)}</span><b>${L.digits.map(d => (d === null ? '▒' : d)).join(' ')}</b></div>`).join('');
  }
  function renderChat() {
    const ch = R.com.chat, box = $('comChat'), cb = $('comChoices'); if (!box) return;
    if (!ch) { box.innerHTML = ''; if (cb) cb.innerHTML = ''; return; }
    box.innerHTML = ch.log.map((l, i) => `<div class="rd-msg ${l.who}" data-i="${i}"><b>${l.who === 'c' ? esc(ch.c.name) : l.who === 'me' ? 'Вы' : ''}</b><span>${esc(l.text.slice(0, l.shown))}</span></div>`).join('');
    box.scrollTop = box.scrollHeight;
    cb.innerHTML = ch.typing ? '<div class="rd-idle">… собеседник говорит …</div>' : ch.choices.map((c, i) => `<button class="btn sm ${c.dim ? 'dim' : ''}" data-ch="${i}">${esc(c.label)}</button>`).join('');
    for (const b of cb.querySelectorAll('[data-ch]')) b.onclick = () => { const c = ch.choices[+b.dataset.ch]; if (c && !ch.typing) { api.sfx.click(); c.fn(); } };
  }
  function updateLastLine() {
    const ch = R.com.chat, box = $('comChat'); if (!ch || !box) return;
    const i = ch.log.length - 1, l = ch.log[i], el = box.querySelector(`[data-i="${i}"]`);
    if (el && el.lastChild) { el.lastChild.textContent = l.text.slice(0, l.shown); box.scrollTop = box.scrollHeight; }
    if (l.shown >= l.text.length) renderChat();
  }
  function setComStatus(t) { R.com.msg = t; R.com.msgT = performance.now(); updateComStatus(); }
  function updateComStatus() {
    const el = $('comStatus'); if (!el) return;
    const C = R.com, call = $('comCall');
    let txt;
    if (C.chat) txt = `🟢 На связи: «${C.chat.c.name}»`;
    else if (C.state === 'calling') txt = `📞 Установление связи… ${Math.round(C.prog * 100)}%`;
    else if (C.msg && performance.now() - C.msgT < 6000) txt = C.msg;
    else if (C.near && C.nearS > 0.8 && save().radio.contacts[C.near.id].known) txt = `📶 Устойчивый сигнал: «${C.near.name}» — можно вызывать`;
    else if (C.near && C.nearS > 0.8) txt = '📶 Слышен чей-то голос — подождите, опознаю…';
    else if (C.near && C.nearS > 0.25) txt = '〰 Слышна обрывками чья-то речь — подстройте частоту';
    else txt = 'Нет сигнала голосовой связи. Крутите ручки — абоненты откликаются голосом.';
    if (el.textContent !== txt) el.textContent = txt;
    if (call) { call.disabled = !!C.chat || C.state === 'calling'; call.textContent = C.chat ? '🟢 На связи' : '📞 Вызвать'; }
    const pr = $('comProg'); if (pr) pr.style.width = (C.chat ? 100 : Math.round(C.prog * 100)) + '%';
  }
  function updateDFUI() {
    const s = $('dfS'); if (!s) return;
    const D = R.df, sg = R.qKind === 'df' ? R.sig : 0;
    s.textContent = Math.round(sg * 100) + '%'; $('dfBar').style.width = Math.round(sg * 100) + '%';
    $('dfP').textContent = Math.round(D.prog * 100) + '%'; $('dfLock').style.width = Math.round(D.prog * 100) + '%';
    const S = signalsAt(R.f).filter(x => x.kind === 'df' && x.s > 0.5).sort((a, b) => b.s - a.s)[0];
    let txt = 'Эфир пуст — слышны только помехи.';
    if (D.full) txt = '⚠ Память пеленгатора заполнена: сначала сходите на вылазку по уже пойманным координатам.';
    else if (D.result) { const f = save().radio.fixes.find(x => x.id === D.result); if (f) txt = `✔ МАЯК ЗАХВАЧЕН: ${TYPE_NAME[f.type]}. Квадрат ${sqName(f.sx, f.sz)}. Позывной замка ${f.callsign}.`; }
    if (!D.full && S && S.ref.found) txt = `Этот маяк уже пеленгован${S.ref.fixId ? '' : ''}.`;
    else if (!D.full && S && S.s >= 0.9) txt = '🎯 Захват… держите частоту!';
    else if (!D.full && S && S.s > 0.5) txt = '〰 Сигнал близко — подстройте ручкой «ТОЧНО».';
    else if (!D.full && sg > 0.1) txt = '· · · слабый писк на краю слышимости…';
    $('dfStatus').textContent = txt;
    const bear = $('dfBear'), nd = $('dfNeedle');
    if (nd) nd.style.transform = `translate(-50%,-100%) rotate(${R.bearing}deg)`;
    if (bear) bear.textContent = sg > 0.5 ? Math.round(((R.bearing % 360) + 360) % 360) + '°' : '—';
  }

  /* ---------- шкала спектра и ручки: кадр ---------- */
  let hubFlash = 0;
  function frame(t) {
    if (!R.open) return;
    R.raf = requestAnimationFrame(frame);
    const cv = $('rdScope'), g = cv.getContext('2d'), W = cv.width, H = cv.height, f = R.f;
    g.fillStyle = '#04100a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,255,150,.10)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < 10; i++) { g.moveTo(i * W / 10, 0); g.lineTo(i * W / 10, H); }
    for (let j = 1; j < 4; j++) { g.moveTo(0, j * H / 4); g.lineTo(W, j * H / 4); }
    g.stroke();
    const S = signalsAt(f), m = mode(), x0 = f - 1, span = 2;
    // подсказки собеседников
    for (const h of save().radio.hints) {
      const a = (h.lo - x0) / span * W, b = (h.hi - x0) / span * W;
      if (b > 0 && a < W) { g.fillStyle = 'rgba(255,190,70,.09)'; g.fillRect(a, 0, b - a, H); }
    }
    const pts = new Float32Array(W / 2 + 1);
    for (let i = 0; i <= W / 2; i++) {
      const fx = x0 + span * (i * 2) / W;
      let y = 0.05 + Math.random() * 0.10 + 0.03 * Math.sin(fx * 40 + t / 300);
      for (const s of S) {
        const on = s.kind === m;
        const hide = s.kind === 'df' && s.ref.found && !on;
        if (hide) continue;
        y += s.amp * gauss(fx - s.freq, s.w * 1.4) * (on ? 1 : 0.35) * (0.82 + Math.random() * 0.3);
      }
      pts[i] = y;
    }
    g.beginPath(); g.moveTo(0, H);
    for (let i = 0; i <= W / 2; i++) g.lineTo(i * 2, H - clamp(pts[i], 0, 1) * (H - 14) - 4);
    g.lineTo(W, H); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(90,255,160,.55)'); gr.addColorStop(1, 'rgba(20,90,50,.10)');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#6dffa6'; g.lineWidth = 1.4; g.beginPath();
    for (let i = 0; i <= W / 2; i++) { const y = H - clamp(pts[i], 0, 1) * (H - 14) - 4; i ? g.lineTo(i * 2, y) : g.moveTo(0, y); }
    g.stroke();
    // метки станций / контактов
    g.font = '11px monospace'; g.textAlign = 'center';
    for (const s of S) {
      if (s.kind === 'df') continue;
      const x = (s.freq - x0) / span * W; if (x < 0 || x > W) continue;
      if (s.kind === 'com' && !save().radio.contacts[s.ref.id].known) continue;
      g.fillStyle = s.color; g.fillText(s.kind === 'num' ? s.ref.short : s.ref.name, x, 12);
    }
    // центральная метка
    g.strokeStyle = 'rgba(255,90,60,.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.fillStyle = 'rgba(180,255,210,.7)'; g.textAlign = 'left'; g.fillText((f - 1).toFixed(2), 4, H - 4); g.textAlign = 'right'; g.fillText((f + 1).toFixed(2), W - 4, H - 4);

    // ручки
    $('rdK1').style.transform = `rotate(${(f / 3) * 360}deg)`;
    $('rdK2').style.transform = `rotate(${(f / 0.12) * 360}deg)`;
    $('rdFreq').textContent = f.toFixed(3);
    $('rdBarCur').style.left = ((f - F_MIN) / (F_MAX - F_MIN) * 100) + '%';
    // индикатор сигнала
    const segs = $('rdSegs').children, on = Math.round(clamp(R.sig, 0, 1) * segs.length);
    for (let i = 0; i < segs.length; i++) segs[i].className = i < on ? (i > segs.length * 0.75 ? 'on hi' : 'on') : '';
    $('rdQual').textContent = R.sig > 0.85 ? 'ПРИЁМ ЧЁТКИЙ' : R.sig > 0.4 ? 'ПРИЁМ СЛАБЫЙ' : R.sig > 0.08 ? 'ШУМ' : 'ЭФИР';
    if (t - R.uiT > 90) {
      R.uiT = t;
      $('rdBatt').textContent = '🔋 ' + api.fmtCharge(R.rec);
      updateDFUI(); updateComStatus();
      const dot = $('rdComDot'); if (dot) dot.textContent = R.com.chat ? ' ●' : '';
      $('rdLed').classList.toggle('hot', R.sig > 0.6);
    }
  }
  // отметки на ленте диапазона
  function renderBarMarks() {
    const r = save().radio, mk = [];
    for (const s of STATIONS) mk.push(`<u style="left:${(s.freq - F_MIN) / (F_MAX - F_MIN) * 100}%;background:${s.color}" title="${s.name}"></u>`);
    for (const c of CONTACTS) if (r.contacts[c.id].known) mk.push(`<u style="left:${(c.freq - F_MIN) / (F_MAX - F_MIN) * 100}%;background:${c.color}" title="${c.name}"></u>`);
    for (const h of r.hints) mk.push(`<s style="left:${(h.lo - F_MIN) / (F_MAX - F_MIN) * 100}%;width:${Math.max(0.6, (h.hi - h.lo) / (F_MAX - F_MIN) * 100)}%"></s>`);
    $('rdBarMk').innerHTML = mk.join('');
  }

  /* ---------- ввод: ручки, диапазон, кнопки ---------- */
  function bindKnob(el, perTurn, wheelStep) {
    let drag = false, last = 0;
    const ang = e => { const b = el.getBoundingClientRect(); return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)); };
    el.addEventListener('pointerdown', e => { drag = true; last = ang(e); try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const a = ang(e); let d = a - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; last = a;
      const before = R.f; setFreq(R.f + d / (2 * Math.PI) * perTurn);
      if (Math.abs(R.f - before) > 0 && Math.random() < 0.18) api.tone(rnd(900, 1500), 0.012, 'square', 0.006);
    });
    const up = () => { drag = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); setFreq(R.f + (e.deltaY < 0 ? 1 : -1) * wheelStep); api.tone(rnd(900, 1500), 0.012, 'square', 0.008); }, { passive: false });
  }
  bindKnob($('rdK1'), 3, 0.05);
  bindKnob($('rdK2'), 0.12, 0.002);
  $('rdBar').addEventListener('pointerdown', e => {
    const b = $('rdBar').getBoundingClientRect();
    setFreq(F_MIN + clamp((e.clientX - b.left) / b.width, 0, 1) * (F_MAX - F_MIN)); api.noise(0.15, 0.05, 5000);
  });
  for (const b of document.querySelectorAll('#scr-radio [data-step]')) b.onclick = () => { setFreq(R.f + +b.dataset.step); api.tone(rnd(900, 1500), 0.012, 'square', 0.01); };
  $('rdTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('rdClose').onclick = () => close('user');
  $('scr-radio').addEventListener('mousedown', e => { if (e.target === $('scr-radio')) close('user'); });
  { const sg = $('rdSegs'); for (let i = 0; i < 22; i++) sg.appendChild(document.createElement('i')); }
  // метки отрисовываем при открытии и при изменении подсказок
  const _open = open;
  const openWrap = rec => { _open(rec); renderBarMarks(); };

  /* ============================================================
     КОДОВЫЙ ЗАМОК + БЛОКНОТ (на вылазке)
     ============================================================ */
  { const pad = $('cdPad'); pad.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(k => `<button class="cd-key ${k === '✓' ? 'ok' : k === '⌫' ? 'bk' : ''}" data-k="${k}">${k}</button>`).join(''); }
  function drawCode() {
    const d = K.val.padEnd(4, '·').split('');
    $('cdDisp').innerHTML = d.map((c, i) => `<span class="${i < K.val.length ? 'on' : ''}">${c === '·' ? '' : c}</span>`).join('');
  }
  function openKeypad(o) {
    // o: { title, tag, hint, code, onSuccess(), onWrong(), onClose() }
    if (K.open) return;
    K.open = true; K.o = o; K.val = ''; K.notesOnly = false; K.lock = 0;
    const r = ensureRadio(save());
    $('cdTitle').textContent = '🔢 ' + o.title; $('cdLockBox').classList.remove('off');
    $('cdTag').innerHTML = o.tag ? `Бирка на замке: «Позывной <b>${esc(o.tag)}</b>»` : 'Кодовый замок';
    $('cdMsg').textContent = o.hint || 'Введите 4-значный код. Он передаётся на номерных станциях.';
    $('cdMsg').className = 'cd-msg';
    $('cdNotes').value = r.notes; $('cdFixes').innerHTML = fixesHTML();
    drawCode(); $('scr-code').classList.remove('off'); api.sfx.open();
  }
  function openNotebook(onClose) {
    if (K.open) return;
    K.open = true; K.o = { onClose }; K.notesOnly = true; K.val = '';
    const r = ensureRadio(save());
    $('cdTitle').textContent = '📝 Блокнот и журнал пеленгации'; $('cdLockBox').classList.add('off');
    $('cdNotes').value = r.notes; $('cdFixes').innerHTML = fixesHTML();
    $('scr-code').classList.remove('off'); api.sfx.open();
  }
  function closeKeypad(ok) {
    if (!K.open) return;
    K.open = false; $('scr-code').classList.add('off');
    save().radio.notes = $('cdNotes').value.slice(0, 4000); api.store();
    const o = K.o; K.o = null;
    if (o && o.onClose) o.onClose(!!ok);
  }
  function pressKey(k) {
    if (K.notesOnly || K.lock > performance.now()) return;
    if (k === '⌫') K.val = K.val.slice(0, -1);
    else if (k === '✓') { submitCode(); return; }
    else if (K.val.length < 4) { K.val += k; api.tone(900 + Number(k) * 40, 0.05, 'square', 0.04); }
    if (k === '⌫') api.tone(420, 0.04, 'square', 0.03);
    drawCode();
  }
  function submitCode() {
    if (K.val.length < 4) { $('cdMsg').textContent = 'Нужно ввести четыре цифры.'; $('cdMsg').className = 'cd-msg bad'; return; }
    if (K.val === K.o.code) {
      $('cdMsg').textContent = '✔ Код принят. Замок открыт.'; $('cdMsg').className = 'cd-msg good';
      api.tone(1200, 0.12, 'triangle', 0.08); setTimeout(() => api.tone(1800, 0.2, 'triangle', 0.08), 130);
      K.lock = performance.now() + 5000;
      setTimeout(() => { if (K.open) { const o = K.o; closeKeypad(true); if (o && o.onSuccess) o.onSuccess(); } }, 650);
    } else {
      K.o.wrong = (K.o.wrong || 0) + 1;
      api.tone(180, 0.35, 'sawtooth', 0.09, -80); api.noise(0.2, 0.1, 1500);
      if (K.o.onWrong) K.o.onWrong(K.o.wrong);
      K.val = ''; drawCode();
      if (K.o.wrong % 3 === 0) { K.lock = performance.now() + 12000; $('cdMsg').textContent = '⛔ Замок заблокирован на 12 секунд. Проверьте цифры и шифр!'; }
      else { $('cdMsg').textContent = `✖ Неверный код. Попыток подряд: ${K.o.wrong % 3} из 3. Каждая ошибка шумит.`; }
      $('cdMsg').className = 'cd-msg bad';
    }
  }
  $('cdPad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) pressKey(b.dataset.k); });
  $('cdClose').onclick = () => closeKeypad(false);
  $('scr-code').addEventListener('mousedown', e => { if (e.target === $('scr-code')) closeKeypad(false); });
  $('cdNotes').addEventListener('input', () => { save().radio.notes = $('cdNotes').value.slice(0, 4000); clearTimeout(R.noteT); R.noteT = setTimeout(() => api.store(), 400); });

  /* ---------- клавиатура (перехват, пока открыт любой экран) ---------- */
  window.addEventListener('keydown', e => {
    if (!R.open && !K.open) return;
    const typing = e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT');
    e.stopImmediatePropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      if (typing && e.target.tagName === 'TEXTAREA') { e.target.blur(); return; }
      if (K.open) closeKeypad(false); else close('user');
      return;
    }
    if (typing) return;
    if (K.open) {
      if (/^(Digit|Numpad)\d$/.test(e.code)) { e.preventDefault(); pressKey(e.code.slice(-1)); }
      else if (e.code === 'Backspace') { e.preventDefault(); pressKey('⌫'); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); pressKey('✓'); }
      return;
    }
    // радио
    const fine = e.shiftKey ? 0.001 : 0.01;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); setFreq(R.f - fine); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); setFreq(R.f + fine); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); setFreq(R.f + 0.1); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setFreq(R.f - 0.1); }
    else if (e.code === 'PageUp') { e.preventDefault(); setFreq(R.f + 1); }
    else if (e.code === 'PageDown') { e.preventDefault(); setFreq(R.f - 1); }
    else if (e.code === 'Digit1') setTab('df'); else if (e.code === 'Digit2') setTab('num'); else if (e.code === 'Digit3') setTab('com'); else if (e.code === 'Digit4') setTab('note');
    else if (e.code === 'Tab') e.preventDefault();
  }, true);
  window.addEventListener('keyup', e => { if ((R.open || K.open) && e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) e.stopImmediatePropagation(); }, true);

  return {
    open: openWrap, close, isOpen: () => R.open, keypadOpen: () => K.open, uiOpen: () => R.open || K.open,
    openKeypad, openNotebook, closeKeypad, ensure: () => ensureRadio(save())
  };
}
