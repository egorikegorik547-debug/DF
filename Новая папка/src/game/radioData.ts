// @ts-nocheck
/* ============================================================
   ВОЕННАЯ РАДИОСТАНЦИЯ — ДАННЫЕ И ЛОГИКА
   • Маяки (пеленгация): слабые сигналы на случайных частотах, меняются каждый день. Поймал маяк — получил квадрат сети,
     где на следующей вылазке будет пустующее убежище или запертый армейский склад.
   • Номерные станции: монотонный голос диктует цифры. Позывной на бирке замка → ищем свой позывной в эфире → записываем код.
   • Связь: выжившие за пределами бункера. Разговор, подсказки по эфиру и редкие задания (сдаются торговцу).
   ============================================================ */

export const F_MIN = 3, F_MAX = 30;
export const SQ_COLS = ['А', 'Б', 'В', 'Г', 'Д'];
export const sqName = (sx, sz) => SQ_COLS[sx] + '-' + (sz + 1);
export const MAX_PENDING_FIXES = 3;

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtF = f => f.toFixed(3);

/* ---------- Номерные станции (постоянные частоты) ---------- */
export const STATIONS = [
  { id: 'e07', name: 'Е-07 «Колыбельная»', short: 'Е-07', freq: 5.37, pitch: 1.75, rate: 0.62, color: '#ff9ad0' },
  { id: 's12', name: 'С-12 «Диспетчер»', short: 'С-12', freq: 9.115, pitch: 0.2, rate: 0.72, color: '#9ad7ff' }
];

/* ---------- Жуткие вставки между передачами ---------- */
export const CREEPY = [
  'Двадцать третий, ответьте. Вы уже внутри.',
  'Не оборачивайтесь. Считайте до семи.',
  'Он стоит у шлюза. Он ждёт, пока вы отвлечётесь.',
  'Колыбельная окончена. Дети, спите.',
  'Тот, кто слушает, слышит и нас.',
  'Дверь не заперта. Дверь никогда не была заперта.',
  'Повторяю для тех, кто за стеной: вас никто не звал.',
  'Девять. Девять. Девять. Почему вы всё ещё слушаете?',
  'Ваш позывной утерян. Ваш позывной утерян. Ваш позывной утерян.'
];

const DIG = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
export const digWord = d => DIG[d | 0];

export const CIPHERS = [
  { say: 'Группа.', note: 'как есть' },
  { say: 'Группа в обратном порядке.', note: 'цифры диктуют С КОНЦА' },
  { say: 'Каждая цифра увеличена на единицу.', note: 'из каждой цифры вычесть 1' }
];
/** что именно диктуют в эфире для кода и шифра */
export function spokenCode(code, cipher) {
  const a = String(code).split('').map(Number);
  if (cipher === 1) return a.reverse();
  if (cipher === 2) return a.map(d => (d + 1) % 10);
  return a;
}

/* ---------- Контакты за пределами бункера ---------- */
export const CONTACTS = [
  {
    id: 'hawk', name: 'Ястреб', role: 'бывший армейский связист · блокпост «Север»', freq: 7.15, day: 1, color: '#9ad48a', icon: '🪖',
    bio: 'Ястреб — старший сержант связи, остался на блокпосту, когда остальные ушли на эвакуацию. Говорит коротко, по уставу, любит позывные и не любит лишних вопросов.',
    greet: ['Здесь «Ястреб». Приём. Говори чётко, батарею береги.', 'Ястреб на связи. Хорошо, что ты вышел. Докладывай.', 'Слышу тебя, бункер. Эфир пока чистый. Что надо?'],
    rumors: ['Колонна «Бывших» прошла вдоль эстакады — человек сорок. Идут молча, как на параде. Не нравится мне это.', 'У нас на блокпосту нашли армейский склад. Пустой. Кто-то успел раньше — и оставил на ящиках метки мелом.', 'В эфире на пяти с лишним мегагерцах работает номерная станция. Диктует цифры уже полгода. Я бы не стал слушать после полуночи.', 'Генератор жрёт топливо, как не в себя. Если у тебя есть лишний — береги, дороже золота.'],
    ask: ['Нужна помощь по снабжению, боец. Делай, что скажу, — рассчитаюсь по-армейски.', 'Задание такое. Выполнишь — торговец выдаст награду, я с ним договорился.', 'Есть работа. Без героизма, но с пользой.'],
    askHunt: ['Эти твари мешают отойти от блокпоста. Убери их — пеленг подтвердит.'],
    fetch: [['key', [1, 1], 1, 'карта доступа'], ['pick', [4, 6], 1], ['ammoK', [30, 30], 2], ['armyMed', [1, 1], 2], ['batt', [4, 6], 1]],
    hunt: [['brute', [1, 1], 3], ['runner', [3, 4], 2], ['any', [8, 10], 1]]
  },
  {
    id: 'fox', name: 'Лиса', role: 'мародёр-одиночка · Западная эстакада', freq: 11.74, day: 1, color: '#ffb25a', icon: '🦊',
    bio: 'Лиса — быстрая, дерзкая, всегда на шаг впереди. Тащит всё, что не прибито, а что прибито — отрывает. Но слово держит, и выходит на связь чаще остальных.',
    greet: ['О, живой! А я уж думала, ты в эфире один такой. Чего хотел?', 'Лиса на проводе. Только быстро — я сейчас в шумном месте.', 'Ха, новый слушатель. Давай без «приёма-передачи», я не военная.'],
    rumors: ['Нашла сегодня три банки порошка в вентшахте. Забрала все — прости. Шучу. Две забрала.', 'За вторым шлюзом слышен какой-то скрежет. Я туда не хожу. И тебе не советую.', 'Торговец в сети — жадный, но честный. Редкие вещи берёт охотно. Мне он как-то выдал целый автомат за коробку батарей.', 'Если слышишь маяк — это не ловушка. Ловушки не пищат так тихо.'],
    ask: ['Слушай, у меня есть заказ, но самой лень. Принеси — поделюсь.', 'Хочешь заработать? У меня как раз покупатель на такое.', 'Есть дельце. Награду выдаст торговец — я у него в долгу, он выдаст.'],
    askHunt: ['Одна тварь мне весь маршрут портит. Прибей — не пожалеешь.'],
    fetch: [['batt', [4, 6], 1], ['meds', [2, 3], 1], ['powder', [6, 6], 1], ['fuel', [15, 20], 2], ['pick', [5, 6], 1], ['schem', [1, 1], 4]],
    hunt: [['spitter', [2, 3], 3], ['spider', [5, 6], 1], ['rat', [6, 8], 2]]
  },
  {
    id: 'anna', name: 'Сестра Анна', role: 'медик-волонтёр · подвал церкви', freq: 19.86, day: 2, color: '#e8e0ff', icon: '✚',
    bio: 'Анна ухаживает за ранеными в подвале церкви. Голос усталый, но тёплый. Раздаёт утешение там, где нет лекарств, — поэтому лекарства ценит больше всего.',
    greet: ['Мир тебе, живой. Это сестра Анна. Ты не ранен?', 'Анна слушает. Говори тихо — у нас тут спят.', 'Слава богу, ещё кто-то выходит в эфир. Что у тебя, дитя?'],
    rumors: ['К нам в подвал привели мальчика — он слышит голоса из пустых коридоров. Говорит, они считают.', 'Чистая вода кончилась в среду. Мы кипятим дождевую. Если бог даст, дождь не кислотный.', 'Иногда ночью в эфире читают молитву — не мою. Чужим голосом. Я выключаю радио.', 'Лекарства у нас — только бинты и надежда. Бинты кончаются первыми.'],
    ask: ['Мне стыдно просить, но у нас люди умирают без самого простого.', 'Если найдёшь — принеси. Награда не от меня, но от чистого сердца.', 'Помоги. Торговец выдаст то, что я смогла собрать.'],
    askHunt: ['Эти существа приходят к нашей двери по ночам. Избавь нас от них — ради живых.'],
    fetch: [['meds', [3, 3], 1], ['band', [4, 4], 1], ['armyMed', [1, 2], 2], ['water', [4, 5], 2], ['caffeine', [4, 4], 2], ['sciMed', [1, 1], 5]],
    hunt: [['walker', [4, 5], 1], ['bloater', [1, 2], 3]]
  },
  {
    id: 'prof', name: 'Профессор', role: 'учёный · закрытая лаборатория «Дельта»', freq: 15.32, day: 3, color: '#7fd8ff', icon: '🔬',
    bio: 'Профессор заперт в лаборатории «Дельта» вместе с неисправным реактором и тремя колбами неизвестного. Говорит рассеянно, перескакивает с темы на тему, но схемы знает лучше любого инженера.',
    greet: ['Лаборатория «Дельта». Кто-кто? А. Бункерный. Хорошо-хорошо. Слушаю.', 'Профессор. Минуту — у меня тут что-то булькает. Да. Слушаю.', 'Вы вовремя. Я как раз записывал: сорок два, сорок два, сорок… Ладно, говорите.'],
    rumors: ['Знаете ли вы, что «Бывшие» реагируют на частоту сети? Я проверял. Они поворачиваются на гул лампы. Забавно. Нет. Страшно.', 'Промышленные схемы хранятся в сейфах, не в шкафах. Ищите чёрные и золотые — там лежит самое интересное.', 'Помехи на одиннадцати мегагерцах — это не помехи. Это дыхание. Я записал. Не слушайте.', 'Мой реактор показывает красный. Он показывает красный уже девятый день. Я привык.'],
    ask: ['Мне нужны материалы для эксперимента. Принесите — я щедро заплачу чем есть.', 'Есть небольшая просьба. Для науки. И для вашего же выживания.', 'Задача: достать. Поручение выдам — награду передадите через торговца.'],
    askHunt: ['Один образец нужен мне… в неживом виде. Вы поймёте. Принесите результат — вернее, обеспечьте его.'],
    fetch: [['schem', [2, 2], 3], ['batt', [5, 6], 2], ['fuel', [20, 20], 3], ['sciMed', [1, 1], 5], ['key', [1, 1], 3]],
    hunt: [['bloater', [2, 2], 3], ['spitter', [3, 3], 4], ['brute', [1, 1], 4]]
  },
  {
    id: 'mak', name: 'Дед Макар', role: 'смотритель метро · станция «Лесная»', freq: 24.505, day: 4, color: '#d9c28a', icon: '🧓',
    bio: 'Дед Макар сорок лет проработал смотрителем станции «Лесная» и не собирается её бросать. Ворчит, делится самогоном (по радио не передашь), знает все слухи подземки.',
    greet: ['Ну, чего тебе, бункерный? Макар на проводе. Говори, пока лампа не сдохла.', 'А, слышу-слышу. Давай, рассказывай. Только без этих ваших «приём».', 'Станция «Лесная», смотритель на связи. Поезда сегодня не будет.'],
    rumors: ['По туннелю ходит кто-то огромный. Идёт — рельсы звенят. Я свет не включаю, пока не уйдёт.', 'В тридцать седьмом году я говорил: не копайте под рекой. Не послушали. Вот и копают теперь — оттуда.', 'Паучья колония в вентиляции растёт. Огнемёт им — как баня. Огнемёт, слышишь?', 'Крыс стало как людей раньше. Хорошо, что хоть едят друг друга.'],
    ask: ['Слушай сюда, сынок. Есть для тебя работа, и награда достойная.', 'Мне уже не по силам — а тебе в самый раз. Сделаешь — торговец расплатится.', 'Дело такое. Не спорь, а слушай.'],
    askHunt: ['Развелось этой нечисти в туннелях — не пройти. Поубивай, а мне покой.'],
    fetch: [['powder', [6, 6], 1], ['fuel', [18, 20], 2], ['ammoK', [30, 30], 3], ['meds', [3, 3], 2]],
    hunt: [['brute', [1, 2], 3], ['rat', [8, 10], 1], ['spider', [6, 8], 1], ['walker', [5, 6], 1]]
  }
];
export const contactById = id => CONTACTS.find(c => c.id === id);

/* ---------- Состояние радио в сохранении ---------- */
const validFix = f => f && typeof f === 'object' && (f.type === 'refuge' || f.type === 'depot') && f.sx >= 0 && f.sx < 5 && f.sz >= 0 && f.sz < 5 && typeof f.code === 'string';
export function ensureRadio(save) {
  let r = save.radio;
  if (!r || typeof r !== 'object' || Array.isArray(r)) r = save.radio = {};
  r.freq = clamp(+r.freq || CONTACTS[0].freq, F_MIN, F_MAX);
  if (!['df', 'num', 'com'].includes(r.mode)) r.mode = 'df';
  r.fixes = Array.isArray(r.fixes) ? r.fixes.filter(validFix) : [];
  r.fixUid = Math.max(1, r.fixUid | 0, ...r.fixes.map(f => (f.id | 0) + 1));
  r.beacons = Array.isArray(r.beacons) ? r.beacons : [];
  r.beaconsDay = r.beaconsDay | 0;
  if (!r.contacts || typeof r.contacts !== 'object') r.contacts = {};
  for (const c of CONTACTS) {
    const s = r.contacts[c.id] = Object.assign({ known: c.id === 'hawk', trust: 0, intro: false, talkDay: 0, questDay: 0, tipDay: 0 }, r.contacts[c.id] || {});
    s.trust = clamp(+s.trust || 0, 0, 6);
  }
  r.notes = typeof r.notes === 'string' ? r.notes.slice(0, 4000) : '';
  r.subs = r.subs !== false;
  r.hints = Array.isArray(r.hints) ? r.hints.filter(h => h && h.day === save.day).slice(0, 6) : [];
  r.decoys = r.decoys && r.decoys.day === save.day ? r.decoys : null;
  r.heard = r.heard && typeof r.heard === 'object' ? r.heard : {};
  genBeacons(save);
  return r;
}

/** Каждый день в эфире появляются новые маяки */
export function genBeacons(save) {
  const r = save.radio;
  if (r.beaconsDay === save.day && r.beacons.length) return;
  r.beaconsDay = save.day;
  const used = [...STATIONS.map(s => s.freq), ...CONTACTS.map(c => c.freq)], out = [];
  const types = shuffleArr(['refuge', 'depot', Math.random() < 0.5 ? 'refuge' : 'depot']);
  for (let i = 0; i < 3; i++) {
    let f = 0, tries = 0;
    do { f = Math.round(rnd(3.6, 29.4) * 1000) / 1000; tries++; }
    while (tries < 60 && [...used, ...out.map(b => b.freq)].some(u => Math.abs(u - f) < 1.1));
    out.push({ id: 'b' + save.day + '_' + i, freq: f, type: types[i], found: false, bearing: ri(0, 359) });
  }
  r.beacons = out; r.hints = []; r.decoys = null;
}
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const pendingFixes = save => ensureRadioSafe(save).fixes.filter(f => !f.done);
function ensureRadioSafe(save) { return save.radio && save.radio.fixes ? save.radio : ensureRadio(save); }

/** Поймали маяк → запись о цели следующей вылазки */
export function makeFix(save, beacon) {
  const r = save.radio;
  let sx, sz, t = 0;
  do { sx = ri(0, 4); sz = ri(0, 4); t++; } while ((sx + sz === 0 || (beacon.type === 'depot' && sx + sz < 3 && t < 30)) && t < 40);
  const cipher = save.day < 3 ? 0 : pick([0, 0, 1, 2]);
  const fix = {
    id: r.fixUid++, type: beacon.type, sx, sz, cipher, station: ri(0, STATIONS.length - 1), day: save.day,
    callsign: String(ri(100, 999)), code: String(ri(1000, 9999)), done: false
  };
  r.fixes.push(fix);
  beacon.found = true;
  return fix;
}

/* ---------- Передачи номерных станций ---------- */
function decoysFor(save) {
  const r = save.radio;
  if (!r.decoys) {
    const mk = () => ({ callsign: String(ri(100, 999)), code: String(ri(1000, 9999)), cipher: save.day < 3 ? 0 : pick([0, 0, 1, 2]), decoy: true });
    r.decoys = { day: save.day, list: STATIONS.map(() => [mk(), mk()]) };
  }
  return r.decoys.list;
}
/** список передач станции: ваши позывные вперемешку с чужими */
export function stationPlaylist(save, idx) {
  const r = ensureRadioSafe(save), d = decoysFor(save)[idx] || [];
  const real = r.fixes.filter(f => !f.done && f.station === idx).map(f => ({ callsign: f.callsign, code: f.code, cipher: f.cipher, fixId: f.id }));
  const lst = [d[0], ...real, d[1]].filter(Boolean);
  return lst;
}
/** сценарий одной передачи: сегменты для озвучки и субтитров */
export function messageScript(msg) {
  const cs = msg.callsign.split('').map(Number), g = spokenCode(msg.code, msg.cipher);
  const S = [];
  const ph = (say, line) => S.push({ k: 'p', say, line });
  const dg = (arr, label) => arr.forEach((d, i) => S.push({ k: 'd', say: digWord(d), d, label, first: i === 0 }));
  ph('Внимание. Внимание.', 'ВНИМАНИЕ');
  ph('Позывной.', '');
  dg(cs, 'ПОЗЫВНОЙ');
  ph('Повторяю. Позывной.', '');
  dg(cs, 'ПОЗЫВНОЙ');
  ph(CIPHERS[msg.cipher].say, 'ШИФР: ' + CIPHERS[msg.cipher].say);
  dg(g, 'ГРУППА');
  ph('Повторяю.', '');
  dg(g, 'ГРУППА');
  ph('Конец передачи.', 'КОНЕЦ ПЕРЕДАЧИ');
  return S;
}

/* ---------- Редкие задания по рации ---------- */
const RARE_REWARDS = [
  { id: 'armyMed', n: [1, 1], tier: 1 }, { id: 'ammoRv', n: [10, 14], tier: 1 }, { id: 'ammoV', n: [16, 20], tier: 1 },
  { id: 'ammoK', n: [24, 30], tier: 1 }, { id: 'pick', n: [5, 7], tier: 1 }, { id: 'powder', n: [6, 8], tier: 1 },
  { id: 'schem', n: [1, 2], tier: 2 }, { id: 'key', n: [1, 1], tier: 2 }, { id: 'sciMed', n: [1, 1], tier: 3 }
];
export function rollRareQuest(contact, day, trust, ITEMS) {
  const hunt = Math.random() < 0.4;
  const pool = (hunt ? contact.hunt : contact.fetch).filter(t => t[2] <= Math.max(1, day) && (hunt || ITEMS[t[0]]));
  const list = pool.length ? pool : (contact.fetch.filter(t => ITEMS[t[0]]));
  const t = pick(list), isHunt = hunt && pool.length > 0;
  const n = ri(t[1][0], t[1][1]);
  const HG = { brute: 'Громил', bloater: 'Подрывников', spitter: 'Кислотников', runner: 'Бегунов', spider: 'пауков-мутантов', rat: 'крыс-мутантов', walker: 'Бродяг', any: 'Бывших' };
  // сложность → награда
  const hard = isHunt ? ({ brute: 4, bloater: 3, spitter: 3, runner: 2.4, spider: 1.6, rat: 1.4, walker: 1.4, any: 1.2 }[t[0]] || 1.5) * Math.max(1, n / 2) : ({ key: 3.5, schem: 4, armyMed: 3, sciMed: 5, ammoK: 2.5, fuel: 2, batt: 2, pick: 2, meds: 2, powder: 2, water: 1.5, caffeine: 1.5, band: 1.2 }[t[0]] || 2) * Math.max(1, n / 3);
  const maxTier = trust >= 5 ? 3 : trust >= 3 ? 2 : 1;
  const elig = RARE_REWARDS.filter(r => ITEMS[r.id] && r.tier <= maxTier && (isHunt || r.id !== t[0]));
  const reward = [];
  const first = (hard >= 3.5 ? pick(elig.filter(r => r.tier >= Math.min(maxTier, 2))) : null) || pick(elig);
  reward.push([first.id, ri(first.n[0], first.n[1])]);
  if (Math.random() < 0.65 || hard >= 3) {
    const sec = pick(elig.filter(r => r.id !== first.id && r.tier === 1)) || pick(elig.filter(r => r.id !== first.id));
    if (sec) reward.push([sec.id, ri(sec.n[0], sec.n[1])]);
  }
  const say = pick(isHunt ? contact.askHunt : contact.ask);
  return {
    uid: 0, rare: true, kind: isHunt ? 'hunt' : 'fetch', item: isHunt ? null : t[0], mon: isHunt ? t[0] : null, gen: isHunt ? HG[t[0]] : null,
    n, got: 0, reward, giver: contact.name + ' (по рации)', say, key: (isHunt ? 'h:' : 'f:') + t[0] + ':r'
  };
}

/* ---------- Подсказка по частоте маяка от собеседника ---------- */
export function beaconHint(save) {
  const r = save.radio, un = r.beacons.filter(b => !b.found);
  if (!un.length) return null;
  const b = pick(un), half = 0.35 + Math.random() * 0.25, off = rnd(-half * 0.6, half * 0.6);
  const lo = Math.max(F_MIN, b.freq + off - half), hi = Math.min(F_MAX, b.freq + off + half);
  const h = { day: save.day, lo, hi, type: b.type };
  r.hints.push(h);
  return h;
}
export function unknownContact(save) {
  const r = save.radio;
  return CONTACTS.filter(c => c.day <= save.day && !r.contacts[c.id].known)[0] || null;
}
