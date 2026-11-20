/* ============================================================
   SAVE & TELL — a gamer's quest-log library
   Offline-first PWA · data lives in IndexedDB on this device
   ============================================================ */
'use strict';

/* ---------------- tiny utils ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function lum(h) { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
const inkFor = c => lum(c) > 0.62 ? '#1b1b1b' : '#fff8e6';
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
const fmtTime = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toUpperCase();
const fmtDay = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
function ago(ts) {
  if (!ts) return 'never';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  const d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
}

/* ---------------- PIXEL SPRITES ----------------
   '#' = main color · 'o' = highlight · 'x' = shade · 'w' white · 'k' black
   any other letter → palette lookup                                   */
const SPR = {
  controller: ['..........', '.########.', '##o####x##', '#ooo##x#x#', '##o####x##', '##########', '###....###', '##......##'],
  sword: ['......oo', '.....o#o', '....o#o.', '.x.o#o..', '..x#o...', '..xx....', '.x..x...', 'x.......'],
  shield: ['########', '#oo####x', '#o#####x', '#######x', '.#####x.', '.#####x.', '..###x..', '...#x...'],
  heart: ['.##..##.', '#oo####x', '#o#####x', '#######x', '.#####x.', '..###x..', '...#x...', '........'],
  star: ['...##...', '...o#...', '#o####xx', '.#o###x.', '..####..', '..##x#..', '.##..x#.', '.#....x.'],
  skull: ['.######.', '#o######', '#..##..#', '#..##..#', '###..###', '.######.', '..#x#x..', '..####..'],
  potion: ['...xx...', '...oo...', '..o..o..', '.o....o.', 'o######o', 'o#o####o', 'o######o', '.oooooo.'],
  coin: ['..####..', '.#oooox.', '#o#oo#x#', '#o#oo#x#', '#o#oo#x#', '#o#oo#x#', '.xxxxxx.', '..xxxx..'],
  ghost: ['..####..', '.######.', '##ww#ww#', '##kw#kw#', '########', '########', '########', '#.##.##.'],
  key: ['.###....', '#o..#...', '#...#...', '.###....', '..#.....', '..##....', '..#.....', '..##....'],
  crown: ['........', '#..##..#', '#.#oo#.#', '##o##o##', '########', '#o#o#o#x', 'xxxxxxxx', '........'],
  mushroom: ['..####..', '.##ww##.', '#ww##ww#', '########', '..wkkw..', '..wwww..', '..wwww..', '........'],
  gem: ['........', '.######.', '#oo###xx', '.#o##xx.', '..####..', '...##...', '........', '........'],
  rocket: ['...##...', '..#oo#..', '..#ow#..', '..####..', '..####..', '.######.', '#.#..#.#', '...xx...'],
  flag: ['#.......', '#####...', '#oo####.', '#####...', '#.......', '#.......', '#.......', '#.......'],
  moon: ['..####..', '.##oo...', '##o.....', '##......', '##......', '##o.....', '.##oo...', '..####..'],
  // ---- UI icons ----
  gear: ['..#..#..', '.######.', '.##..##.', '###..###', '###..###', '.##..##.', '.######.', '..#..#..'],
  camera: ['........', '.##.....', '########', '###..###', '##.##.##', '##.##.##', '###..###', '########'],
  back: ['...#....', '..##....', '.#######', '########', '.#######', '..##....', '...#....', '........'],
  plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
  pencil: ['......##', '.....#o#', '....###.', '...###..', '..###...', '.###....', 'o##.....', 'oo......'],
  trash: ['...##...', '########', '........', '.######.', '.#.##.#.', '.#.##.#.', '.#.##.#.', '..####..'],
  speaker: ['...#..#.', '..##...#', '####.#.#', '####.#.#', '####.#.#', '..##...#', '...#..#.', '........'],
  mute: ['...#....', '..##....', '####.#.#', '####..#.', '####.#.#', '..##....', '...#....', '........'],
  trophy: ['########', '##o###x#', '.#o##x#.', '..####..', '...##...', '...##...', '..####..', '.######.'],
  download: ['...##...', '...##...', '...##...', '.######.', '..####..', '...##...', '#......#', '########'],
  upload: ['...##...', '..####..', '.######.', '...##...', '...##...', '...##...', '#......#', '########'],
  brush: ['......##', '.....###', '....###.', '...###..', '..##....', '.###....', '####....', '##......'],
  close: ['##....##', '.##..##.', '..####..', '...##...', '..####..', '.##..##.', '##....##', '........'],
  photo: ['########', '#......#', '#.oo...#', '#....#.#', '#...####', '#..#####', '########', '........'],
  sort: ['.#......', '###...##', '.#......', '.#..####', '.#......', '.#.#####', '.#......', '........'],
  tag: ['####....', '#..##...', '#..###..', '#######.', '.#######', '..######', '...####.', '....##..'],
  search: ['.####...', '#....#..', '#....#..', '#....#..', '.####...', '....##..', '.....##.', '......##'],
  book: ['.######.', '#oooooo#', '#o####o#', '#oooooo#', '#o###oo#', '#oooooo#', '#xxxxxx#', '.######.'],
  pin: ['..###...', '.#ooo#..', '.#o###..', '.#####..', '..###...', '...#....', '...#....', '...#....'],
  // ---- decor ----
  plant: ['...gg.....', '..gGg.g...', '.gGg.gGg..', '..gg.Gg...', '...gGg....', '....g.....', '..tttttt..', '..tTTTTt..', '...tTTt...', '...tTTt...', '...tttt...'],
  bottle: ['...kk...', '...cc...', '...ww...', '..wbbw..', '.wbBbbw.', '.wbbbbw.', '.wbBbbw.', '.wbbbbw.', '..wwww..'],
  globe: ['..bbbb..', '.bgggbb.', 'bbggbbgb', 'bgbbbggb', 'bbbbgggb', '.bbbbbb.', '..bbbb..', '...yy...', '..yyyy..'],
  candleS: ['...f....', '..fF....', '..fF....', '...w....', '..ww....', '..ww....', '..ww....', '.yyyy...'],
  quill: ['.......ww', '......wwk', '.....wwk.', '....wwk..', '...wwk...', '..wwk....', '..wk.....', '.k.......', 'k........'],
  cat: ['k...k.......', 'kk.kk.......', 'kkkkk.......', 'kykyk....kk.', 'kkkkkkkkk.k.', '.kkkkkkkk...', '.kkkkkkkk...', '.k.k..k.k...'],
};
const PAL = { g: '#3f8a35', G: '#6cc24a', t: '#8a3a1c', T: '#c0612f', k: '#141414', w: '#f6f1e3', b: '#3b6fd1', B: '#7fb0ff', c: '#a0703a', y: '#e9b43a', f: '#ff8a00', F: '#ffe066' };
const _spr = new Map();
function sprite(name, color = '#ffffff', scale = 4, palette = null) {
  const key = name + color + scale + (palette ? JSON.stringify(palette) : '');
  if (_spr.has(key)) return _spr.get(key);
  const rows = SPR[name] || SPR.star;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
  const x = c.getContext('2d');
  const lite = mix(color, '#ffffff', .55), dark = mix(color, '#000000', .45);
  for (let r = 0; r < h; r++) for (let q = 0; q < rows[r].length; q++) {
    const ch = rows[r][q]; if (ch === '.') continue;
    let col = ch === '#' ? color : ch === 'o' ? lite : ch === 'x' ? dark : (palette && palette[ch]) || PAL[ch] || color;
    x.fillStyle = col; x.fillRect(q * scale, r * scale, scale, scale);
  }
  const url = c.toDataURL(); _spr.set(key, url); return url;
}
// mini 5x5 motif tiles for book patterns
const MINI = {
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  star: ['..#..', '.###.', '#####', '.#.#.', '#...#'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
  dot: ['.....', '.##..', '.##..', '.....', '.....'],
};
function motifTile(name, color, alpha = .5) {
  const key = 'm' + name + color + alpha; if (_spr.has(key)) return _spr.get(key);
  const s = 2, c = document.createElement('canvas'); c.width = 8 * s; c.height = 8 * s;
  const x = c.getContext('2d'); x.globalAlpha = alpha; x.fillStyle = color;
  MINI[name].forEach((row, r) => [...row].forEach((ch, q) => { if (ch === '#') x.fillRect((q + 1) * s, (r + 1) * s, s, s); }));
  const url = c.toDataURL(); _spr.set(key, url); return url;
}
function fillIcons(root = document) {
  $$('img[data-ico]', root).forEach(img => { img.src = sprite(img.dataset.ico, img.dataset.col || getIconColor()); img.classList.add('px'); });
}
function getIconColor() { return getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || '#ffffff'; }

/* ---------------- SOUND (synthesised chiptune, no files) ---------------- */
const SFX = {
  ctx: null, master: null,
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      }
      this.master.gain.value = S.vol * 0.4;
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch (e) { }
  },
  t(f, d, { type = 'square', at = 0, v = .3, to = null, att = .004 } = {}) {
    const c = this.ctx, t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + d + .03);
  },
  n(d, { at = 0, v = .3, f = 2000, q = .8, type = 'bandpass', to = null } = {}) {
    const c = this.ctx, t0 = c.currentTime + at, len = Math.max(1, Math.floor(c.sampleRate * d));
    const b = c.createBuffer(1, len, c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + d); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(fl).connect(g).connect(this.master); s.start(t0);
  },
  play(name) {
    if (!S.sound) return; this.init(); if (!this.ctx) return;
    const T = this.t.bind(this), N = this.n.bind(this);
    try {
      switch (name) {
        case 'tap': T(760, .045, { v: .18 }); break;
        case 'select': T(660, .05, { v: .22 }); T(990, .07, { at: .05, v: .22 }); break;
        case 'back': T(660, .05, { v: .22 }); T(440, .08, { at: .05, v: .22 }); break;
        case 'open': N(.35, { f: 400, to: 3200, v: .22 }); T(330, .22, { type: 'triangle', to: 660, v: .3 }); break;
        case 'page': N(.16, { f: 3200, type: 'highpass', v: .3 }); N(.1, { at: .08, f: 1800, v: .18 }); break;
        case 'save': [523, 659, 784, 1047].forEach((f, i) => T(f, .09, { at: i * .065, v: .22 })); T(131, .32, { type: 'triangle', v: .35 }); break;
        case 'coin': T(988, .07, { v: .22 }); T(1319, .3, { at: .07, v: .22 }); break;
        case 'level': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => T(f, .12, { at: i * .085, v: .2 })); [523, 659, 784].forEach(f => T(f, .6, { at: .55, type: 'triangle', v: .2 })); break;
        case 'ach': [784, 988, 1175, 1568].forEach((f, i) => T(f, .15, { at: i * .1, type: 'triangle', v: .32 })); T(2093, .4, { at: .4, type: 'square', v: .08 }); break;
        case 'del': T(440, .3, { type: 'sawtooth', to: 70, v: .16 }); N(.25, { f: 600, v: .18 }); break;
        case 'shutter': N(.04, { f: 5000, type: 'highpass', v: .45 }); N(.07, { at: .07, f: 3000, v: .35 }); T(1800, .03, { at: .02, v: .08 }); break;
        case 'error': T(180, .1, { v: .25 }); T(140, .15, { at: .11, v: .25 }); break;
        case 'wipe': T(180, .32, { to: 1100, v: .08 }); N(.3, { f: 800, to: 4000, v: .08 }); break;
        case 'start': [392, 523, 659, 784, 1047].forEach((f, i) => T(f, .1, { at: i * .06, v: .25 })); T(1568, .45, { at: .32, type: 'triangle', v: .25 }); break;
        case 'drop': T(320, .12, { to: 90, type: 'triangle', v: .4 }); N(.09, { at: .1, f: 260, v: .3 }); T(880, .06, { at: .22, v: .12 }); break;
        case 'toggle': T(880, .04, { v: .16 }); T(1320, .04, { at: .04, v: .12 }); break;
        case 'type': T(1500 + Math.random() * 500, .018, { v: .045, type: 'square' }); break;
        case 'thunder': N(1.2, { f: 120, type: 'lowpass', v: .4 }); break;
        case 'pop': T(500, .08, { to: 1200, v: .18 }); break;
        case 'shuffle': for (let i = 0; i < 6; i++) T(300 + Math.random() * 900, .04, { at: i * .04, v: .12 }); break;
      }
    } catch (e) { }
  }
};

/* ---------------- STORAGE (IndexedDB) ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('save-and-tell', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('journals')) d.createObjectStore('journals', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'id' }).createIndex('journalId', 'journalId');
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode), q = fn(tx.objectStore(store));
      tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  },
  all(s) { return this.req(s, 'readonly', o => o.getAll()); },
  get(s, k) { return this.req(s, 'readonly', o => o.get(k)); },
  put(s, v) { return this.req(s, 'readwrite', o => o.put(v)); },
  del(s, k) { return this.req(s, 'readwrite', o => o.delete(k)); },
  clear(s) { return this.req(s, 'readwrite', o => o.clear()); },
  putMany(s, arr) { return this.req(s, 'readwrite', o => { arr.forEach(v => o.put(v)); return null; }); },
};

/* ---------------- SETTINGS ---------------- */
const DEF = {
  theme: 'cozy', sound: true, typeSfx: true, vol: .6, libName: 'My Library', sort: 'recent',
  loc: null, locAsked: false, wx: null, wxEvery: 30 * 60e3, ach: {}, lastBackup: 0, seenTitle: false
};
let S = Object.assign({}, DEF, (() => { try { return JSON.parse(localStorage.getItem('snt.settings') || '{}'); } catch { return {}; } })());
const saveS = () => { try { localStorage.setItem('snt.settings', JSON.stringify(S)); } catch (e) { } };

/* ---------------- BOOK OPTIONS ---------------- */
const TYPES = [
  { id: 'hardcover', name: 'Hardcover', h: 150 }, { id: 'leather', name: 'Leather Tome', h: 156 },
  { id: 'spell', name: 'Spellbook', h: 162 }, { id: 'cart', name: 'Game Cartridge', h: 130 },
  { id: 'notebook', name: 'Spiral Notebook', h: 140 }, { id: 'manga', name: 'Manga Volume', h: 134 },
];
const FONTS = [
  { id: 'pixelsans', name: 'Pixel Sans', css: "'Pixelify Sans',monospace", fs: 18, sfs: 13, k: 1 },
  { id: 'arcade', name: 'Arcade', css: "'Press Start 2P',monospace", fs: 10.5, sfs: 7, k: .62 },
  { id: 'terminal', name: 'Terminal', css: "'VT323',monospace", fs: 21, sfs: 15, k: 1.15 },
  { id: 'silk', name: 'Silkscreen', css: "'Silkscreen',monospace", fs: 14, sfs: 10, k: .82 },
  { id: 'hand', name: 'Handwritten', css: "'Caveat',cursive", fs: 23, sfs: 16, k: 1.3 },
  { id: 'type', name: 'Typewriter', css: "'Special Elite',monospace", fs: 16, sfs: 12, k: .95 },
  { id: 'story', name: 'Storybook', css: "Georgia,'Times New Roman',serif", fs: 17, sfs: 12, k: 1 },
];
const PATTERNS = [
  { id: 'none', name: 'Plain' }, { id: 'stripes', name: 'Stripes' }, { id: 'bands', name: 'Bands' }, { id: 'checker', name: 'Checker' },
  { id: 'dots', name: 'Dots' }, { id: 'hearts', name: 'Hearts' }, { id: 'stars', name: 'Stars' }, { id: 'diamonds', name: 'Diamonds' },
];
const SIZES = [{ id: 'slim', name: 'Slim', w: 34 }, { id: 'regular', name: 'Regular', w: 44 }, { id: 'chunky', name: 'Chunky', w: 56 }];
const PAGES = [
  { id: 'auto', name: 'Match Book' }, { id: 'cream', name: 'Cream Lined' }, { id: 'parchment', name: 'Parchment' }, { id: 'notebook', name: 'Notebook' },
  { id: 'screen', name: 'Save Screen' }, { id: 'graph', name: 'Graph Paper' }, { id: 'night', name: 'Starry Night' },
];
const AUTO_PAGE = { hardcover: 'cream', leather: 'parchment', spell: 'night', cart: 'screen', notebook: 'notebook', manga: 'graph' };
const PALETTE = ['#b8322a', '#e2702a', '#f0c330', '#2f9e4f', '#14897a', '#2f6fbf', '#283f86', '#7a3fb0', '#d0508f', '#6d4c41', '#3a2a22', '#2c3e50', '#808a90', '#e8e2d0', '#ff6b6b', '#111111'];
const ACCENTS = ['#ffd34d', '#c9a227', '#f5f5f5', '#b0b7c3', '#ff4fa3', '#43e0ff', '#7cfc6a', '#ff8a3d', '#9b59ff', '#ff3b3b', '#a0522d', '#1b1b1b'];
const EMBLEMS = ['controller', 'sword', 'shield', 'heart', 'star', 'skull', 'potion', 'coin', 'ghost', 'key', 'crown', 'mushroom', 'gem', 'rocket', 'flag', 'moon'];
const STATUSES = ['Playing', 'Paused', 'Completed', '100%', 'Backlog', 'Dropped'];
const PLATFORMS = ['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Nintendo Switch 2', 'Steam Deck', 'Mobile', 'Retro', 'Game Boy', 'SNES', 'N64', 'VR'];
const TAGS = [
  { id: 'progress', name: 'Progress', icon: 'flag' }, { id: 'leftoff', name: 'Left Off Here', icon: 'pin' }, { id: 'boss', name: 'Boss', icon: 'skull' },
  { id: 'loot', name: 'Loot', icon: 'coin' }, { id: 'secret', name: 'Secret', icon: 'key' }, { id: 'tip', name: 'Tip', icon: 'star' },
  { id: 'lore', name: 'Lore', icon: 'potion' }, { id: 'fav', name: 'Fave Moment', icon: 'heart' },
];
const RANKS = [[0, 'FRESH SAVE'], [5, 'PAGE TURNER'], [20, 'QUEST SCRIBE'], [50, 'LORE KEEPER'], [100, 'GRAND ARCHIVIST'], [250, 'LEGENDARY CHRONICLER']];
const ACH = [
  { id: 'first', name: 'First Words', desc: 'Write your first note', icon: 'pencil' },
  { id: 'snap', name: 'Say Cheese', desc: 'Save your first snapshot', icon: 'camera' },
  { id: 'shelf3', name: 'Collector', desc: '3 journals on the shelf', icon: 'book' },
  { id: 'shelf10', name: 'Archivist', desc: '10 journals on the shelf', icon: 'crown' },
  { id: 'ten', name: 'Chronicler', desc: '10 notes in one journal', icon: 'flag' },
  { id: 'fifty', name: 'Lore Master', desc: '50 notes in total', icon: 'potion' },
  { id: 'lv5', name: 'Veteran', desc: 'Reach LV 5 in a journal', icon: 'shield' },
  { id: 'owl', name: 'Night Owl', desc: 'Save a note from 12-4 AM', icon: 'moon' },
  { id: 'decor', name: 'Decorator', desc: 'Change the library theme', icon: 'brush' },
  { id: 'style', name: 'Fashionista', desc: 'Restyle a book', icon: 'gem' },
  { id: 'credits', name: 'Credits Roll', desc: 'Mark a game Completed', icon: 'trophy' },
  { id: 'backup', name: 'Save Point', desc: 'Export a backup', icon: 'download' },
];

/* ---------------- THEMES ---------------- */
const THEMES = {
  cozy: { name: 'Cozy Library', particles: 'dust', vars: { bg: '#1e130d', wall1: '#5b3427', shelf: '#8b5a2b', 'shelf-l': '#b57b3f', 'shelf-d': '#4e2f14', back1: '#2b1a0f', back2: '#3d2616', frame: '#6b4423', curtain: '#9b2f2f', 'curtain-d': '#6e1f1f', panel: '#3a2418', 'panel-b': '#e8c88a', ui: '#f6e3bd', accent: '#ffcc4d', accent2: '#e8734a', floor1: '#6b3f22', floor2: '#4d2c17', wipe: '#1e130d' } },
  arcade: { name: 'Neon Arcade', particles: 'neon', vars: { bg: '#0b0618', wall1: '#160b2e', shelf: '#25173f', 'shelf-l': '#ff3fa4', 'shelf-d': '#0e0820', back1: '#0a0516', back2: '#170c30', frame: '#2a1a4a', curtain: '#3b1d6e', 'curtain-d': '#25104a', panel: '#140a2a', 'panel-b': '#43e0ff', ui: '#e9e4ff', accent: '#ff3fa4', accent2: '#43e0ff', floor1: '#1a0d33', floor2: '#0d061c', wipe: '#ff3fa4' } },
  dungeon: { name: 'Dungeon Keep', particles: 'embers', vars: { bg: '#121216', wall1: '#3a3a44', shelf: '#5a4632', 'shelf-l': '#7a6246', 'shelf-d': '#2e231a', back1: '#18171c', back2: '#25232b', frame: '#4a4a55', curtain: '#3d5a3d', 'curtain-d': '#263d26', panel: '#23222a', 'panel-b': '#b9b2a0', ui: '#e6e0cf', accent: '#ff9a3c', accent2: '#e0564a', floor1: '#2d2c33', floor2: '#1e1d23', wipe: '#121216' } },
  space: { name: 'Starship Archive', particles: 'stars', vars: { bg: '#05080f', wall1: '#1c2738', shelf: '#3a4a60', 'shelf-l': '#8fb3d9', 'shelf-d': '#1a2230', back1: '#0b111c', back2: '#121b2a', frame: '#596d88', curtain: '#2a3a50', 'curtain-d': '#1a2433', panel: '#101826', 'panel-b': '#5fd3ff', ui: '#dbeeff', accent: '#5fd3ff', accent2: '#ffb84d', floor1: '#18212f', floor2: '#0e141e', wipe: '#5fd3ff' } },
  grove: { name: 'Enchanted Grove', particles: 'fireflies', vars: { bg: '#0e1a10', wall1: '#2b4a2a', shelf: '#6b4a2b', 'shelf-l': '#8f6a3c', 'shelf-d': '#3d2915', back1: '#132313', back2: '#1d331c', frame: '#5a3d22', curtain: '#7aa04a', 'curtain-d': '#4f7530', panel: '#1e2f1b', 'panel-b': '#c8e69a', ui: '#eef7da', accent: '#c8f06a', accent2: '#ff9ad5', floor1: '#3a2a18', floor2: '#2a1d10', wipe: '#0e1a10' } },
  haunted: { name: 'Haunted Manor', particles: 'wisps', vars: { bg: '#120d1a', wall1: '#2e2340', shelf: '#3b2a2a', 'shelf-l': '#5c4444', 'shelf-d': '#1f1515', back1: '#140f1c', back2: '#1f172b', frame: '#3a2d4a', curtain: '#5a1d4a', 'curtain-d': '#3a1030', panel: '#1a1424', 'panel-b': '#b7a6d9', ui: '#e7defa', accent: '#9dff8a', accent2: '#b07cff', floor1: '#2a1e2e', floor2: '#1a121e', wipe: '#120d1a' } },
  pocket: { name: 'Pocket 4-Color', particles: 'pocket', vars: { bg: '#0f380f', wall1: '#306230', shelf: '#0f380f', 'shelf-l': '#8bac0f', 'shelf-d': '#0a2a0a', back1: '#1d4a1d', back2: '#306230', frame: '#0f380f', curtain: '#8bac0f', 'curtain-d': '#306230', panel: '#0f380f', 'panel-b': '#9bbc0f', ui: '#9bbc0f', accent: '#9bbc0f', accent2: '#8bac0f', floor1: '#306230', floor2: '#0f380f', wipe: '#0f380f' } },
};

/* procedurally painted 16x16 wall tiles (upscaled 4x, crisp) */
const _tiles = {};
function wallTile(id) {
  if (_tiles[id]) return _tiles[id];
  const v = THEMES[id].vars, R = rng(hashStr(id)), g = [];
  for (let y = 0; y < 16; y++) { g[y] = []; for (let x = 0; x < 16; x++) g[y][x] = v.wall1; }
  const P = (x, y, c) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; };
  if (id === 'cozy') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g[y][x] = (x % 8 < 4) ? v.wall1 : mix(v.wall1, '#000', .12);
    [[2, 3], [1, 4], [3, 4], [2, 5], [10, 11], [9, 12], [11, 12], [10, 13]].forEach(([x, y]) => P(x, y, mix(v.wall1, '#ffcc4d', .35)));
  } else if (id === 'arcade') {
    for (let i = 0; i < 16; i++) { P(i, 0, '#2a1458'); P(0, i, '#2a1458'); }
    P(8, 8, '#3a1a6a'); if (R() > .3) P(12, 4, '#4a1f7a');
  } else if (id === 'dungeon') {
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let b = -1; b < 3; b++) {
        const bc = mix(v.wall1, R() > .5 ? '#000' : '#fff', R() * .12);
        for (let y = row * 4; y < row * 4 + 3; y++) for (let x = b * 8 + off; x < b * 8 + off + 7; x++) P(x, y, bc);
        P(b * 8 + off, row * 4, mix(bc, '#fff', .18));
        if (R() > .5) P(b * 8 + off + 3 + Math.floor(R() * 3), row * 4 + 1, mix(bc, '#000', .2));
      }
      for (let x = 0; x < 16; x++) P(x, row * 4 + 3, '#26262e');
      for (let y = row * 4; y < row * 4 + 3; y++) { P((7 + off) % 16, y, '#26262e'); P((15 + off) % 16, y, '#26262e'); }
    }
  } else if (id === 'space') {
    for (let i = 0; i < 16; i++) { P(i, 15, '#0f1722'); P(15, i, '#0f1722'); P(i, 0, '#2a3a50'); P(0, i, '#2a3a50'); }
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => P(x, y, '#6b7f99'));
    for (let x = 5; x < 11; x++) P(x, 8, '#223047');
  } else if (id === 'grove') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = R(); g[y][x] = r > .82 ? '#335a31' : r < .12 ? '#233d22' : v.wall1; }
    [[4, 3], [5, 4], [4, 5], [11, 10], [12, 11], [11, 12]].forEach(([x, y]) => P(x, y, '#4f7d3f'));
  } else if (id === 'haunted') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g[y][x] = (x % 8 < 5) ? v.wall1 : '#271d38';
    [[2, 2], [1, 3], [3, 3], [2, 4], [2, 1], [2, 5], [10, 10], [9, 11], [11, 11], [10, 12], [10, 9], [10, 13]].forEach(([x, y]) => P(x, y, '#3d2f56'));
  } else if (id === 'pocket') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 4 === 0 && y % 4 === 0) P(x, y, '#0f380f');
    P(2, 2, '#8bac0f'); P(10, 10, '#8bac0f');
  }
  const s = 4, c = document.createElement('canvas'); c.width = c.height = 16 * s; const x = c.getContext('2d');
  for (let y = 0; y < 16; y++) for (let q = 0; q < 16; q++) { x.fillStyle = g[y][q]; x.fillRect(q * s, y * s, s, s); }
  return (_tiles[id] = c.toDataURL());
}
/* ============================================================
   WEATHER + TIME-OF-DAY (Open-Meteo · free · no API key)
   ============================================================ */
const WX = {
  kind() {
    const c = S.wx ? S.wx.code : null;
    if (c == null) return 'clear';
    if (c === 0) return 'clear';
    if (c <= 2) return 'partly';
    if (c === 3) return 'overcast';
    if (c === 45 || c === 48) return 'fog';
    if (c >= 51 && c <= 57) return 'drizzle';
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'storm';
    return 'clear';
  },
  label() {
    return { clear: 'Clear skies', partly: 'A few clouds', overcast: 'Overcast', fog: 'Foggy', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' }[this.kind()];
  },
  // minutes after midnight for today's sunrise/sunset (falls back to 6:45 / 18:15)
  sunTimes() {
    let rise = 405, set = 1095;
    try {
      const d = S.wx && S.wx.daily; if (d && d.sunrise && d.sunrise.length) {
        const today = ymd(new Date());
        let i = d.sunrise.findIndex(s => s.startsWith(today)); if (i < 0) i = 0;
        const hm = s => { const t = s.split('T')[1].split(':'); return (+t[0]) * 60 + (+t[1]); };
        rise = hm(d.sunrise[i]); set = hm(d.sunset[i]);
      }
    } catch (e) { }
    return { rise, set };
  },
  phase(now = new Date()) {
    const { rise, set } = this.sunTimes(), m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60, D = 40;
    let name = 'day';
    if (m < rise - D || m > set + D) name = 'night'; else if (m < rise + D) name = 'dawn'; else if (m > set - D) name = 'dusk';
    const sunProg = (m - rise) / (set - rise);
    const nightLen = 1440 - (set - rise), moonProg = (((m - set) % 1440) + 1440) % 1440 / nightLen;
    return { name, sunProg, moonProg };
  },
  async fetch(force = false) {
    if (!S.loc) return;
    if (!force && S.wx && Date.now() - S.wx.at < S.wxEvery) return;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${S.loc.lat.toFixed(3)}&longitude=${S.loc.lon.toFixed(3)}&current=weather_code,cloud_cover,wind_speed_10m,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=3`;
      const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw 0;
      const d = await r.json();
      S.wx = { code: d.current.weather_code, cloud: d.current.cloud_cover, wind: d.current.wind_speed_10m, daily: { sunrise: d.daily.sunrise, sunset: d.daily.sunset }, at: Date.now() };
      saveS(); WIN.reset(); applyTimeOfDay();
    } catch (e) { /* offline: keep cached sky */ }
  },
  askLocation() {
    return new Promise(res => {
      if (!navigator.geolocation) { S.locAsked = true; saveS(); return res(false); }
      navigator.geolocation.getCurrentPosition(p => {
        S.loc = { lat: p.coords.latitude, lon: p.coords.longitude }; S.locAsked = true; saveS();
        this.fetch(true); res(true);
      }, () => { S.locAsked = true; saveS(); res(false); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 3600e3 });
    });
  }
};
function applyTimeOfDay() {
  const app = $('#app'), p = WX.phase().name;
  ['tod-night', 'tod-dawn', 'tod-day', 'tod-dusk'].forEach(c => app.classList.remove(c));
  app.classList.add('tod-' + p);
}

/* ============================================================
   THE LITTLE WINDOW — live pixel sky (48 x 40 virtual pixels)
   ============================================================ */
const WIN = {
  W: 48, H: 40, c: null, x: null, S: 2, clouds: [], drops: [], stars: [], fog: [], flash: 0, last: 0, t: 0, raf: 0, active: false,
  init(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    const R = rng(7);
    for (let i = 0; i < 26; i++) this.stars.push({ x: Math.floor(R() * this.W), y: Math.floor(R() * 24), p: R() * 6 });
    this.resize(); this.reset();
  },
  resize() {
    const r = this.c.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.S = Math.max(1, Math.round((r.width * dpr) / this.W));
    this.c.width = this.W * this.S; this.c.height = this.H * this.S;
  },
  reset() {
    const k = WX.kind(), R = Math.random;
    const nClouds = { clear: 1, partly: 3, overcast: 7, fog: 3, drizzle: 6, rain: 7, snow: 6, storm: 8 }[k];
    this.clouds = Array.from({ length: nClouds }, (_, i) => ({ x: R() * (this.W + 20) - 10, y: 2 + Math.floor(R() * 14), w: 8 + Math.floor(R() * 9), sp: .6 + R() * .8 }));
    const nDrops = { drizzle: 18, rain: 45, storm: 65, snow: 40 }[k] || 0;
    this.drops = Array.from({ length: nDrops }, () => ({ x: R() * this.W, y: R() * this.H, s: .8 + R() * .5, ph: R() * 6 }));
    this.fog = k === 'fog' ? [0, 1, 2, 3].map(i => ({ y: 14 + i * 6, x: R() * 30, sp: .5 + R() })) : [];
    this.streaks = (k === 'rain' || k === 'storm' || k === 'drizzle') ? Array.from({ length: 6 }, () => ({ x: Math.floor(R() * this.W), y: R() * this.H, l: 2 + Math.floor(R() * 4) })) : [];
  },
  px(x, y, w, h, c) { this.x.fillStyle = c; this.x.fillRect(Math.round(x), Math.round(y), w, h); },
  start() { if (this.active) return; this.active = true; const loop = ts => { if (!this.active) return; this.raf = requestAnimationFrame(loop); if (ts - this.last < 80) return; const dt = Math.min(.2, (ts - this.last) / 1000 || .08); this.last = ts; this.t += dt; this.draw(dt); }; this.raf = requestAnimationFrame(loop); },
  stop() { this.active = false; cancelAnimationFrame(this.raf); },
  draw(dt) {
    const { W, H } = this, x = this.x, k = WX.kind(), ph = WX.phase(), wind = (S.wx && S.wx.wind) || 8;
    x.setTransform(this.S, 0, 0, this.S, 0, 0);
    const gloomy = ['overcast', 'rain', 'storm', 'drizzle', 'snow', 'fog'].includes(k);
    const SKY = { night: ['#060a22', '#1b2552'], dawn: ['#3a4a9a', '#ffb38a'], day: ['#3f8fe0', '#a9dcff'], dusk: ['#2b1f5c', '#ff8a5c'] }[ph.name];
    const grayT = { night: ['#0b0d16', '#1d212e'], dawn: ['#6c6f86', '#b8a7a0'], day: ['#7f8b98', '#b8c2cc'], dusk: ['#3d3550', '#8a6a70'] }[ph.name];
    const gm = k === 'storm' ? .85 : gloomy ? .65 : k === 'partly' ? .12 : 0;
    const top = mix(SKY[0], grayT[0], gm), bot = mix(SKY[1], grayT[1], gm);
    const bands = 10;
    for (let i = 0; i < bands; i++) this.px(0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1, mix(top, bot, i / (bands - 1)));
    // stars
    if ((ph.name === 'night' || ph.name === 'dusk' || ph.name === 'dawn') && !gloomy) {
      const a = ph.name === 'night' ? 1 : .35;
      this.stars.forEach(s => { const tw = (Math.sin(this.t * 2 + s.p) + 1) / 2; if (tw > .25) { x.globalAlpha = a * tw; this.px(s.x, s.y, 1, 1, tw > .85 ? '#ffffff' : '#c9d4ff'); } });
      x.globalAlpha = 1;
    }
    // sun / moon
    const disc = (cx, cy, col, glow, moon) => {
      if (glow) { x.globalAlpha = .22; this.px(cx - 4, cy - 2, 9, 5, glow); this.px(cx - 2, cy - 4, 5, 9, glow); this.px(cx - 3, cy - 3, 7, 7, glow); x.globalAlpha = 1; }
      this.px(cx - 1, cy - 2, 3, 5, col); this.px(cx - 2, cy - 1, 5, 3, col);
      if (moon) { this.px(cx + 1, cy - 1, 1, 1, mix(col, '#000', .25)); this.px(cx - 1, cy + 1, 1, 1, mix(col, '#000', .2)); }
    };
    const dim = gloomy ? (k === 'partly' ? 1 : .35) : 1;
    if (ph.name !== 'night' && ph.sunProg > -0.15 && ph.sunProg < 1.15) {
      const p = clamp(ph.sunProg, -0.1, 1.1), cx = 4 + p * (W - 8), cy = 31 - Math.sin(clamp(p, 0, 1) * Math.PI) * 24;
      x.globalAlpha = dim; disc(cx, cy, ph.name === 'day' ? '#fff3b0' : '#ffb36b', ph.name === 'day' ? '#fff7c8' : '#ffcf8a'); x.globalAlpha = 1;
    } else if (ph.name === 'night') {
      const p = clamp(ph.moonProg, 0, 1), cx = 4 + p * (W - 8), cy = 30 - Math.sin(p * Math.PI) * 22;
      x.globalAlpha = dim; disc(cx, cy, '#e8e8f2', '#9fb0ff', true); x.globalAlpha = 1;
    }
    // hills + tiny village
    const HC = { night: ['#1d2440', '#12182d', '#0b1020'], dawn: ['#6a5a8a', '#4a3d6a', '#2f2748'], day: ['#6fae6a', '#4a8a4a', '#2f6a35'], dusk: ['#6a4a7a', '#4a3358', '#2e2040'] }[ph.name];
    const snowy = k === 'snow';
    for (let i = 0; i < W; i++) {
      const y1 = 26 + Math.round(Math.sin(i * .19 + 1) * 2 + Math.sin(i * .07) * 2);
      this.px(i, y1, 1, H - y1, gloomy ? mix(HC[0], '#777', .25) : HC[0]); if (snowy) this.px(i, y1, 1, 1, '#e8eef5');
    }
    // houses with glowing windows at night
    const lit = ph.name !== 'day';
    [[9, 29], [33, 28], [40, 30]].forEach(([hx, hy], i) => {
      this.px(hx, hy, 5, 4, mix(HC[1], '#000', .15)); this.px(hx - 1, hy - 1, 7, 1, snowy ? '#e8eef5' : '#7a3a3a'); this.px(hx, hy - 2, 5, 1, snowy ? '#e8eef5' : '#7a3a3a'); this.px(hx + 1, hy - 3, 3, 1, snowy ? '#e8eef5' : '#7a3a3a');
      if (lit) { const fl = (Math.sin(this.t * 3 + i * 2) + 1) / 2 > .1; this.px(hx + 1, hy + 1, 1, 1, fl ? '#ffd86b' : '#d8a040'); this.px(hx + 3, hy + 1, 1, 1, '#ffd86b'); }
    });
    for (let i = 0; i < W; i++) {
      const y2 = 32 + Math.round(Math.sin(i * .27 + 3) * 1.5 + Math.sin(i * .11) * 1.6);
      this.px(i, y2, 1, H - y2, gloomy ? mix(HC[1], '#666', .2) : HC[1]); if (snowy) this.px(i, y2, 1, 1, '#f4f8fb');
    }
    [[3, 31], [20, 32], [27, 31], [45, 31]].forEach(([tx, ty]) => { const c = HC[2]; this.px(tx, ty - 4, 1, 1, c); this.px(tx - 1, ty - 3, 3, 2, c); this.px(tx - 2, ty - 1, 5, 2, c); this.px(tx, ty + 1, 1, 2, '#3a2416'); if (snowy) this.px(tx, ty - 4, 1, 1, '#fff'); });
    // clouds
    const cc = { night: '#3a4266', dawn: '#ffd0c0', day: '#ffffff', dusk: '#f0a0b0' }[ph.name];
    const cloudCol = k === 'storm' ? mix(cc, '#2a2a36', .8) : gloomy ? mix(cc, '#6a7080', .55) : cc;
    const sp = (wind / 10 + .4);
    if (k === 'overcast' || k === 'rain' || k === 'storm') this.px(0, 0, W, 4, mix(cloudCol, '#000', .08));
    this.clouds.forEach(c => {
      c.x += c.sp * sp * dt * 2.2; if (c.x > W + 4) { c.x = -c.w - 4; c.y = 2 + Math.floor(Math.random() * 14); }
      const X = Math.floor(c.x), Y = c.y, w = c.w;
      this.px(X, Y + 2, w, 3, cloudCol); this.px(X + 2, Y + 1, w - 4, 1, cloudCol); this.px(X + 3, Y, Math.max(2, Math.floor(w / 2) - 1), 1, cloudCol);
      this.px(X + 1, Y + 4, w - 2, 1, mix(cloudCol, '#000', .18));
      this.px(X + 3, Y + 1, 2, 1, mix(cloudCol, '#fff', .3));
    });
    // fog
    this.fog.forEach(f => { f.x += f.sp * dt * 3; if (f.x > W) f.x = -30; x.globalAlpha = .38; this.px(Math.floor(f.x), f.y, 30, 2, '#d5dce2'); this.px(Math.floor(f.x) - 20, f.y + 3, 26, 1, '#d5dce2'); x.globalAlpha = 1; });
    // precipitation
    if (k === 'snow') {
      this.drops.forEach(d => { d.y += d.s * 7 * dt; d.x += Math.sin(this.t * 1.5 + d.ph) * .08 + wind * .004; if (d.y > H) { d.y = -1; d.x = Math.random() * W; } if (d.x > W) d.x = 0; this.px(d.x, d.y, 1, 1, '#ffffff'); });
    } else if (this.drops.length) {
      const slant = clamp(wind / 25, .1, .8), col = ph.name === 'night' ? '#6f86c4' : '#bcd6ff';
      this.drops.forEach(d => { d.y += d.s * 48 * dt; d.x += slant * 20 * dt; if (d.y > H) { d.y = -2; d.x = Math.random() * W - 4; } if (d.x > W) d.x -= W; this.px(d.x, d.y, 1, k === 'drizzle' ? 1 : 2, col); });
    }
    // lightning
    if (k === 'storm') {
      if (this.flash <= 0 && Math.random() < dt * .12) { this.flash = .35; this.bolt = 8 + Math.floor(Math.random() * 30); if (S.sound && $('#library').classList.contains('active')) setTimeout(() => SFX.play('thunder'), 500); }
      if (this.flash > 0) {
        this.flash -= dt; x.globalAlpha = clamp(this.flash * 2, 0, .7); this.px(0, 0, W, H, '#ffffff'); x.globalAlpha = 1;
        let bx = this.bolt; for (let y = 3; y < 26; y += 2) { this.px(bx, y, 1, 2, '#fffbd0'); bx += (y % 4 ? 1 : -1); }
      }
    }
    // rain streaks on the glass
    (this.streaks || []).forEach(s => { s.y += dt * 4; if (s.y > H) { s.y = -s.l; s.x = Math.floor(Math.random() * W); } x.globalAlpha = .35; this.px(s.x, s.y, 1, s.l, '#e6f0ff'); x.globalAlpha = 1; });
    // window mullions (cross)
    const fc = getComputedStyle(document.documentElement).getPropertyValue('--frame').trim() || '#6b4423';
    if (S.theme !== 'space') { this.px(W / 2 - 1, 0, 2, H, fc); this.px(0, H / 2 - 1, W, 2, fc); this.px(W / 2 - 1, H / 2 - 1, 1, 1, mix(fc, '#fff', .3)); }
    else { x.globalAlpha = .25; this.px(0, H / 2, W, 1, '#5fd3ff'); x.globalAlpha = 1; }
  }
};

/* ============================================================
   AMBIENT PARTICLES (dust motes, embers, fireflies, ...)
   ============================================================ */
const AMB = {
  c: null, x: null, p: [], mode: 'dust', raf: 0, last: 0, sz: 3,
  init(c) { this.c = c; this.x = c.getContext('2d'); this.resize(); const loop = ts => { this.raf = requestAnimationFrame(loop); if (document.hidden || ts - this.last < 50) return; const dt = Math.min(.1, (ts - this.last) / 1000); this.last = ts; this.step(dt); }; requestAnimationFrame(loop); },
  resize() { const r = this.c.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); const d = Math.min(2, devicePixelRatio || 1); this.c.width = this.w * d; this.c.height = this.h * d; this.x.setTransform(d, 0, 0, d, 0, 0); this.seed(); },
  setMode(m) { if (this.mode !== m) { this.mode = m; this.seed(); } },
  seed() {
    const n = { dust: 28, neon: 22, embers: 26, stars: 40, fireflies: 16, wisps: 10, pocket: 18, title: 60 }[this.mode] || 20;
    this.p = Array.from({ length: n }, () => this.spawn(true));
  },
  spawn(any) {
    const R = Math.random, w = this.w, h = this.h, m = this.mode;
    const p = { x: R() * w, y: any ? R() * h : h + 6, vx: 0, vy: 0, a: R(), ph: R() * 6, s: 3, c: '#fff' };
    if (m === 'dust') { p.vx = (R() - .5) * 6; p.vy = (R() - .5) * 5; p.c = '#ffe2a8'; p.s = R() > .7 ? 3 : 2; }
    if (m === 'neon') { p.vy = -6 - R() * 6; p.c = R() > .5 ? '#ff3fa4' : '#43e0ff'; p.s = 3; }
    if (m === 'embers') { p.vy = -14 - R() * 18; p.vx = (R() - .5) * 6; p.c = R() > .5 ? '#ff9a3c' : '#ffd34d'; p.s = R() > .6 ? 3 : 2; }
    if (m === 'stars' || m === 'title') { p.vy = 3 + R() * 10; p.vx = 0; if (any) p.y = R() * h; else p.y = -4; p.c = R() > .8 ? '#ffd34d' : R() > .5 ? '#9fd8ff' : '#ffffff'; p.s = R() > .85 ? 3 : 2; }
    if (m === 'fireflies') { p.c = '#d8ff6a'; p.s = 3; }
    if (m === 'wisps') { p.c = '#bfa8ff'; p.s = 4; p.vy = -4 - R() * 4; }
    if (m === 'pocket') { p.c = '#9bbc0f'; p.s = 4; p.vy = -8 - R() * 6; }
    return p;
  },
  step(dt) {
    const x = this.x, m = this.mode; x.clearRect(0, 0, this.w, this.h);
    const t = performance.now() / 1000;
    this.p.forEach((p, i) => {
      if (m === 'fireflies') { p.vx += (Math.random() - .5) * 30 * dt; p.vy += (Math.random() - .5) * 30 * dt; p.vx *= .96; p.vy *= .96; }
      if (m === 'wisps') { p.vx = Math.sin(t + p.ph) * 8; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -10 || p.y > this.h + 10 || p.x < -10 || p.x > this.w + 10) { this.p[i] = this.spawn(m === 'dust' || m === 'fireflies'); return; }
      let al = .55;
      if (m === 'dust') al = .25 + .3 * (Math.sin(t * 1.5 + p.ph) + 1) / 2;
      if (m === 'neon' || m === 'title' || m === 'stars') al = (Math.sin(t * 3 + p.ph) + 1) / 2 > .3 ? .85 : .2;
      if (m === 'embers') al = clamp(p.y / this.h, .1, .9);
      if (m === 'fireflies') al = Math.max(0, Math.sin(t * 2 + p.ph));
      if (m === 'wisps') al = .18 + .15 * Math.sin(t + p.ph);
      if (m === 'pocket') al = .35;
      x.globalAlpha = al; x.fillStyle = p.c;
      const X = Math.round(p.x / 3) * 3, Y = Math.round(p.y / 3) * 3; x.fillRect(X, Y, p.s, p.s);
      if (m === 'fireflies' && al > .5) { x.globalAlpha = al * .25; x.fillRect(X - 3, Y - 3, 9, 9); }
      if (m === 'wisps') { x.globalAlpha = al * .5; x.fillRect(X - 4, Y + 4, p.s + 8, p.s); }
    });
    x.globalAlpha = 1;
  }
};

/* ============================================================
   FX: pixel bursts, confetti, floating text, level-up banner
   ============================================================ */
const FX = {
  c: null, x: null, p: [], running: false,
  init(c) { this.c = c; this.x = c.getContext('2d'); this.resize(); },
  resize() { const r = this.c.getBoundingClientRect(); this.w = r.width; this.h = r.height; const d = Math.min(2, devicePixelRatio || 1); this.c.width = this.w * d; this.c.height = this.h * d; this.x.setTransform(d, 0, 0, d, 0, 0); },
  burst(px, py, { n = 22, colors = ['#ffd34d', '#ff4fa3', '#43e0ff', '#7cfc6a', '#ffffff'], power = 220, grav = 420, life = .9 } = {}) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = power * (.35 + Math.random() * .65); this.p.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * .35, g: grav, life, t: 0, s: 3 + Math.floor(Math.random() * 3), c: colors[i % colors.length] }); }
    this.run();
  },
  confetti(n = 90) {
    const cols = ['#ffd34d', '#ff4fa3', '#43e0ff', '#7cfc6a', '#ff8a3d', '#ffffff', '#9b59ff'];
    for (let i = 0; i < n; i++) this.p.push({ x: Math.random() * this.w, y: -10 - Math.random() * this.h * .4, vx: (Math.random() - .5) * 60, vy: 80 + Math.random() * 120, g: 60, life: 3, t: 0, s: 4 + Math.floor(Math.random() * 3), c: cols[i % cols.length], wob: Math.random() * 6 });
    this.run();
  },
  run() {
    if (this.running) return; this.running = true; let last = performance.now();
    const loop = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; const x = this.x; x.clearRect(0, 0, this.w, this.h);
      this.p = this.p.filter(p => (p.t += dt) < p.life);
      this.p.forEach(p => { p.vy += p.g * dt; p.x += (p.vx + (p.wob ? Math.sin(p.t * 6 + p.wob) * 40 : 0)) * dt; p.y += p.vy * dt; x.globalAlpha = clamp(1 - p.t / p.life, 0, 1) * 1.4; x.fillStyle = p.c; x.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.s, p.s); });
      x.globalAlpha = 1;
      if (this.p.length) requestAnimationFrame(loop); else { this.running = false; x.clearRect(0, 0, this.w, this.h); }
    };
    requestAnimationFrame(loop);
  }
};
function appPoint(el) { // element center in #app coordinates (handles rotated mode loosely)
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
}
function floatText(el, text, color = '#ffd34d') {
  const p = appPoint(el), f = document.createElement('div');
  f.className = 'floaty'; f.textContent = text; f.style.color = color; f.style.left = (p.x - 40) + 'px'; f.style.top = (p.y - 30) + 'px';
  $('#app').appendChild(f); setTimeout(() => f.remove(), 1300);
}
function levelUpBanner(lv) {
  const d = document.createElement('div'); d.className = 'lvlup'; d.innerHTML = `<b>LEVEL UP!</b><span>JOURNAL REACHED LV ${lv}</span>`;
  $('#app').appendChild(d); FX.confetti(); SFX.play('level'); setTimeout(() => d.remove(), 2000);
}

/* ---- pixel dissolve screen transition ---- */
async function pixelWipe(mid) {
  const w = $('#wipe'), app = $('#app'), W = app.clientWidth, H = app.clientHeight, cols = 9, rows = Math.ceil(cols * H / W);
  if (w.dataset.k !== cols + 'x' + rows) {
    w.dataset.k = cols + 'x' + rows; w.style.gridTemplateColumns = `repeat(${cols},1fr)`; w.style.gridTemplateRows = `repeat(${rows},1fr)`;
    w.innerHTML = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = document.createElement('i'); i.style.transitionDelay = Math.round(((c + r * .7) / (cols + rows * .7)) * 200 + Math.random() * 70) + 'ms'; w.appendChild(i); }
  }
  SFX.play('wipe'); w.classList.add('on'); await sleep(380);
  if (mid) await mid();
  await sleep(40); w.classList.remove('on'); await sleep(320);
}
/* ============================================================
   STATE
   ============================================================ */
let journals = [], entries = [], curId = null, curTab = 'log', pendingPhoto = null, selTags = new Set();
const photoCache = new Map();
const J = id => journals.find(j => j.id === id);
const cur = () => J(curId);
const entriesOf = id => entries.filter(e => e.journalId === id).sort((a, b) => a.createdAt - b.createdAt);
const fontOf = st => FONTS.find(f => f.id === st.font) || FONTS[0];
function xpOf(id) { return entries.reduce((s, e) => e.journalId === id ? s + 10 + (e.hasPhoto ? 15 : 0) + (e.tags && e.tags.length ? 2 : 0) : s, 0); }
function levelOf(xp) { let L = 1; while (xp >= 50 * L * (L + 1)) L++; return L; }
function lvProgress(xp) { const L = levelOf(xp), base = 50 * (L - 1) * L, need = 100 * L; return { L, into: xp - base, need, pct: (xp - base) / need * 100 }; }
function rankOf(n) { let r = RANKS[0][1]; RANKS.forEach(([min, name]) => { if (n >= min) r = name; }); return r; }

function randomStyle() {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
  const color = pick(PALETTE);
  return { color, accent: lum(color) > .7 ? '#1b1b1b' : pick(ACCENTS.slice(0, 10)), type: pick(TYPES).id, font: pick(FONTS).id, pattern: R() > .5 ? 'none' : pick(PATTERNS).id, emblem: pick(EMBLEMS), size: pick(SIZES).id, page: 'auto' };
}
function bookW(j) { const w = (SIZES.find(s => s.id === j.style.size) || SIZES[1]).w; return j.style.type === 'cart' ? w + 12 : w; }
function bookH(j) { const t = TYPES.find(t => t.id === j.style.type) || TYPES[0]; return t.h + (hashStr(j.id) % 18); }
function patCSS(st) {
  const a = st.accent;
  switch (st.pattern) {
    case 'stripes': return 'background-image:repeating-linear-gradient(45deg,transparent 0 5px,rgba(255,255,255,.16) 5px 10px)';
    case 'bands': return `background-image:repeating-linear-gradient(180deg,transparent 0 16px,${a} 16px 19px);opacity:.55`;
    case 'checker': return 'background-image:conic-gradient(rgba(0,0,0,.22) 25%,transparent 0 50%,rgba(0,0,0,.22) 0 75%,transparent 0);background-size:10px 10px';
    case 'dots': return `background-image:url(${motifTile('dot', a, .6)});background-size:12px 12px`;
    case 'hearts': return `background-image:url(${motifTile('heart', a, .45)});background-size:16px 16px`;
    case 'stars': return `background-image:url(${motifTile('star', a, .45)});background-size:16px 16px`;
    case 'diamonds': return `background-image:url(${motifTile('diamond', a, .4)});background-size:14px 14px`;
    default: return '';
  }
}
function styleVars(j) {
  const st = j.style, f = fontOf(st);
  return `--c:${st.color};--a:${st.accent};--ink:${inkFor(st.color)};--ff:${f.css};--sfs:${f.sfs}px;--fk:${f.k}`;
}
function spineHTML(j, extra = '') {
  const st = j.style, lv = levelOf(xpOf(j.id)), emb = `<img class="emb" src="${sprite(st.emblem, st.type === 'cart' ? mix(st.accent, '#000', lum(st.accent) > .85 ? .5 : 0) : st.accent)}" alt="">`;
  const vol = journals.indexOf(j) + 1;
  const inner = st.type === 'cart' ? `<span class="label">${emb}<span class="st">${esc(j.title)}</span></span>` : `${emb}<span class="st">${esc(j.title)}</span>`;
  return `<button class="book t-${st.type} ${extra}" data-id="${j.id}" style="${styleVars(j)};--w:${bookW(j)}px;--h:${bookH(j)}px" aria-label="${esc(j.title)}">
    <span class="pat" style="${patCSS(st)}"></span><span class="deco" data-vol="${vol || ''}"></span>${inner}<span class="lv">LV${lv}</span></button>`;
}
function coverHTML(j, cls = 'md') {
  const st = j.style;
  return `<div class="cover t-${st.type} ${cls}" style="${styleVars(j)}"><span class="pat" style="${patCSS(st)}"></span><span class="deco"></span>
    <div class="cv-in"><img class="cv-emb" src="${sprite(st.emblem, st.type === 'cart' ? mix(st.accent, '#000', lum(st.accent) > .85 ? .5 : 0) : st.accent)}" alt=""><div class="cv-title">${esc(j.title || 'Untitled')}</div>${j.platform ? `<div class="cv-plat">${esc(j.platform)}</div>` : ''}</div></div>`;
}

/* ============================================================
   SCREENS
   ============================================================ */
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'library') { WIN.resize(); WIN.start(); AMB.setMode(THEMES[S.theme].particles); }
  else WIN.stop();
  if (id === 'title') AMB.setMode('title');
}

/* ============================================================
   LIBRARY
   ============================================================ */
function sortedJournals() {
  const a = [...journals];
  if (S.sort === 'alpha') a.sort((x, y) => x.title.localeCompare(y.title));
  else if (S.sort === 'created') a.sort((x, y) => x.createdAt - y.createdAt);
  else if (S.sort === 'level') a.sort((x, y) => xpOf(y.id) - xpOf(x.id));
  else a.sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
  return a;
}
const SORTS = [['recent', 'RECENT'], ['alpha', 'A-Z'], ['created', 'OLDEST'], ['level', 'TOP LV']];
function renderLibrary(opts = {}) {
  $('#libName').textContent = (S.libName || 'My Library').toUpperCase();
  const nNotes = entries.length, nSnaps = entries.filter(e => e.hasPhoto).length;
  $('#libStats').textContent = `${journals.length} journal${journals.length === 1 ? '' : 's'} · ${nNotes} note${nNotes === 1 ? '' : 's'} · ${nSnaps} snap${nSnaps === 1 ? '' : 's'}`;
  $('#libRank').textContent = 'RANK: ' + rankOf(nNotes);
  $('#sortLabel').textContent = (SORTS.find(s => s[0] === S.sort) || SORTS[0])[1];
  const host = $('#shelves'), avail = Math.max(200, host.clientWidth - 10);
  const rows = []; let row = [], x = 0;
  sortedJournals().forEach(j => { const w = bookW(j) + 3; if (x + w > avail && row.length) { rows.push({ items: row, used: x }); row = []; x = 0; } row.push(j); x += w; });
  if (x + 43 > avail && row.length) { rows.push({ items: row, used: x }); row = []; x = 0; }
  row.push('new'); x += 43; rows.push({ items: row, used: x });
  while (rows.length < 3) rows.push({ items: [], used: 0 });
  const DECOR = [['plant', null], ['globe', null], ['bottle', null], ['candleS', null], ['cat', null], ['trophy', '#ffcc4d'], ['skull', '#e8e2d0'], ['potion', '#7cfc6a']];
  host.innerHTML = rows.map((r, i) => {
    const books = r.items.map(j => j === 'new' ? `<button class="book ghost" id="ghostBook" style="--w:40px;--h:120px" aria-label="New journal"><img data-ico="plus"><span>NEW</span></button>` : spineHTML(j, opts.drop === j.id ? 'drop' : opts.slide === j.id ? 'slidein' : '')).join('');
    let decor = '';
    if (avail - r.used > 60) { const [n, col] = DECOR[(i + hashStr(S.theme)) % DECOR.length]; decor = `<img class="decor ${n === 'cat' ? 'big' : ''}" src="${sprite(n, col || '#ffffff', 4)}" alt="">`; }
    return `<div class="shelf">${books}${decor}</div>`;
  }).join('');
  fillIcons(host);
  if (!journals.length) host.insertAdjacentHTML('afterbegin', `<div class="bubble"><b>EMPTY SHELF!</b>Tap <b style="display:inline;color:inherit">NEW GAME</b> to start your first journal.</div>`);
}
function bindShelf() {
  const host = $('#shelves'); let timer = null, longFired = false, startPt = null;
  host.addEventListener('pointerdown', e => {
    const b = e.target.closest('.book:not(.ghost)'); if (!b) return;
    longFired = false; startPt = { x: e.clientX, y: e.clientY }; b.classList.add('peek');
    timer = setTimeout(() => { longFired = true; b.classList.remove('peek'); SFX.play('pop'); if (navigator.vibrate) navigator.vibrate(15); bookMenu(b.dataset.id, b); }, 480);
  });
  const cancel = () => { clearTimeout(timer); $$('.book.peek', host).forEach(b => b.classList.remove('peek')); };
  host.addEventListener('pointerup', cancel); host.addEventListener('pointercancel', cancel); host.addEventListener('pointerleave', cancel);
  host.addEventListener('pointermove', e => { if (startPt && Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y) > 10) cancel(); });
  host.addEventListener('contextmenu', e => e.preventDefault());
  host.addEventListener('click', e => {
    if (e.target.closest('#ghostBook')) { SFX.play('select'); openBookEditor(); return; }
    const b = e.target.closest('.book'); if (!b || longFired) { longFired = false; return; }
    openJournal(b.dataset.id, b);
  });
}
function bookMenu(id, el) {
  const j = J(id), a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect();
  const layer = $('#layer'); layer.innerHTML = `<div class="backdrop" style="background:rgba(0,0,0,.35)"></div><div class="quick">
    <button data-a="open"><img data-ico="book"> Open journal</button><button data-a="style"><img data-ico="brush"> Customize</button><button data-a="del"><img data-ico="trash" data-col="#ff6b6b"> Remove</button></div>`;
  fillIcons(layer);
  const q = $('.quick', layer); const left = clamp(r.left - a.left, 10, a.width - 190), top = clamp(r.top - a.top - 10, 60, a.height - 200);
  q.style.left = left + 'px'; q.style.top = top + 'px';
  const close = () => { layer.innerHTML = ''; };
  $('.backdrop', layer).onclick = close;
  q.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; close();
    if (b.dataset.a === 'open') openJournal(id, el);
    if (b.dataset.a === 'style') openBookEditor(j);
    if (b.dataset.a === 'del') deleteJournal(j);
  };
}

/* ---------- open book animation ---------- */
let opening = false;
async function openJournal(id, el) {
  if (opening) return; opening = true;
  const j = J(id); curId = id; curTab = 'log';
  SFX.play('open');
  const app = $('#app'), a = app.getBoundingClientRect();
  if (el && el.animate) {
    const r = el.getBoundingClientRect();
    const fly = document.createElement('div'); fly.className = 'fly';
    fly.innerHTML = `<div class="fpage"></div>${coverHTML(j, 'md')}`;
    const L = r.left - a.left, T = r.top - a.top;
    Object.assign(fly.style, { left: L + 'px', top: T + 'px', width: r.width + 'px', height: r.height + 'px' });
    app.appendChild(fly); el.classList.add('pulled');
    const tw = Math.min(190, a.width * .5), th = tw * 1.36, tx = (a.width - tw) / 2, ty = (a.height - th) / 2 - 20;
    try {
      await fly.animate([
        { left: L + 'px', top: T + 'px', width: r.width + 'px', height: r.height + 'px', transform: 'rotate(0)' },
        { left: L + 'px', top: (T - 40) + 'px', width: r.width + 'px', height: r.height + 'px', transform: 'rotate(-4deg)', offset: .3 },
        { left: tx + 'px', top: ty + 'px', width: tw + 'px', height: th + 'px', transform: 'rotate(0)' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.05)', fill: 'forwards' }).finished;
      SFX.play('page');
      await $('.cover', fly).animate([{ transform: 'perspective(800px) rotateY(0deg)' }, { transform: 'perspective(800px) rotateY(-170deg)' }], { duration: 480, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).finished;
    } catch (e) { }
    renderJournal(); showScreen('journal');
    await fly.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 260, fill: 'forwards' }).finished.catch(() => { });
    fly.remove(); el.classList.remove('pulled');
  } else {
    await pixelWipe(() => { renderJournal(); showScreen('journal'); });
  }
  scrollPaperBottom(false);
  opening = false;
}
async function closeJournal() {
  SFX.play('back'); const id = curId;
  await pixelWipe(() => { renderLibrary({ slide: id }); showScreen('library'); });
  curId = null;
}

/* ============================================================
   JOURNAL
   ============================================================ */
function paperClass(st) { const p = st.page && st.page !== 'auto' ? st.page : AUTO_PAGE[st.type] || 'cream'; return 'p-' + p; }
function renderJournal() {
  const j = cur(); if (!j) return;
  const st = j.style, f = fontOf(st), sec = $('#journal');
  sec.style.setProperty('--bc', st.color); sec.style.setProperty('--bink', inkFor(st.color));
  sec.style.setProperty('--bf', f.css); sec.style.setProperty('--fs', f.fs + 'px');
  $('#jTitle').textContent = j.title.toUpperCase();
  renderHero();
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === curTab));
  $('#bookframe').classList.toggle('searching', curTab === 'search');
  const paper = $('#paper'); paper.className = 'paper ' + paperClass(st);
  $('#composer').style.display = curTab === 'log' ? '' : 'none';
  renderTagRow();
  renderPage();
}
function renderHero() {
  const j = cur(), xp = xpOf(j.id), p = lvProgress(xp), list = entriesOf(j.id), last = list[list.length - 1];
  const stCls = 'st-' + (j.status === '100%' ? '100' : j.status);
  $('#hero').innerHTML = `${coverHTML(j, 'sm')}<div class="hero-info">
    <div class="meta"><span class="chip ${stCls}">${esc(j.status || 'Playing')}</span>${j.platform ? `<span class="chip" style="color:var(--ui)">${esc(j.platform)}</span>` : ''}</div>
    <div class="lvline">LV ${p.L}<div class="xpbar"><i style="width:${p.pct}%"></i><b>${p.into}/${p.need} XP</b></div></div>
    <div class="sub">${list.length} note${list.length === 1 ? '' : 's'} · ${list.filter(e => e.hasPhoto).length} snap${list.filter(e => e.hasPhoto).length === 1 ? '' : 's'} · last saved ${last ? ago(last.createdAt) : 'never'}</div></div>`;
  $('#hero .cover').onclick = () => { SFX.play('select'); openBookEditor(j); };
}
async function loadPhoto(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  const p = await DB.get('photos', id); const d = p ? p.data : ''; photoCache.set(id, d); return d;
}
function entryHTML(e, q = '') {
  let txt = esc(e.text);
  if (q) { const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); txt = txt.replace(re, '<mark>$1</mark>'); }
  const tags = (e.tags || []).map(t => TAGS.find(x => x.id === t)).filter(Boolean);
  return `<article class="entry" data-id="${e.id}">
    <div class="stamp">${fmtDate(e.createdAt)} <em>·</em> ${fmtTime(e.createdAt)}</div>${e.editedAt ? '<span class="edited">(edited)</span>' : ''}
    ${tags.length ? `<div class="etags">${tags.map(t => `<span class="chip"><img data-ico="${t.icon}" data-col="currentColor">${t.name}</span>`).join('')}</div>` : ''}
    ${e.text ? `<div class="etext">${txt}</div>` : ''}
    ${e.hasPhoto ? `<div class="polaroid"><img data-photo="${e.id}" alt="Snapshot"></div>` : ''}
    <div class="eact"><button class="icon-btn" data-act="edit" aria-label="Edit"><img data-ico="pencil"></button><button class="icon-btn" data-act="del" aria-label="Delete"><img data-ico="trash" data-col="#ff6b6b"></button></div>
  </article>`;
}
function fixTagIcons(root) {
  const ink = getComputedStyle($('#paper')).getPropertyValue('--stamp').trim() || '#b0461b';
  $$('img[data-col="currentColor"]', root).forEach(i => i.dataset.col = ink);
  fillIcons(root);
}
function hydratePhotos(root) { $$('img[data-photo]', root).forEach(async img => { img.src = await loadPhoto(img.dataset.photo); }); }
function renderPage() {
  const j = cur(), paper = $('#paper'), list = entriesOf(j.id);
  if (curTab === 'log') {
    if (!list.length) {
      paper.innerHTML = `<div class="empty"><img src="${sprite('quill', '#fff', 4)}" alt=""><h3>A BLANK PAGE...</h3><p>Every legend starts somewhere.<br>Write your first note below, or snap a picture of your game.</p></div>`;
      return;
    }
    let html = '', lastDay = '';
    list.forEach(e => { const d = ymd(new Date(e.createdAt)); if (d !== lastDay) { html += `<div class="day-div">${fmtDay(e.createdAt)}</div>`; lastDay = d; } html += entryHTML(e); });
    paper.innerHTML = html;
  } else if (curTab === 'photos') {
    const ph = list.filter(e => e.hasPhoto).reverse();
    paper.innerHTML = ph.length ? `<div class="snaps">${ph.map(e => `<div class="snap" data-id="${e.id}"><img data-photo="${e.id}" alt=""><span>${fmtDate(e.createdAt)}</span></div>`).join('')}</div>`
      : `<div class="empty"><img src="${sprite('camera', '#fff', 4)}" alt=""><h3>NO SNAPS YET</h3><p>Tap the camera on the LOG page to capture a special moment.</p></div>`;
  } else {
    const q = ($('#searchInput').value || '').trim(); const ql = q.toLowerCase();
    const hits = q ? list.filter(e => (e.text || '').toLowerCase().includes(ql) || (e.tags || []).some(t => (TAGS.find(x => x.id === t) || {}).name?.toLowerCase().includes(ql))).reverse() : [];
    paper.innerHTML = !q ? `<div class="empty"><img src="${sprite('search', '#fff', 4)}" alt=""><h3>FIND A MEMORY</h3><p>Search notes and tags, like "boss" or "secret".</p></div>`
      : hits.length ? hits.map(e => entryHTML(e, q)).join('') : `<div class="empty"><h3>NO MATCHES</h3><p>Nothing found for "${esc(q)}".</p></div>`;
  }
  fixTagIcons(paper); hydratePhotos(paper);
}
function scrollPaperBottom(smooth = true) { const p = $('#paper'); requestAnimationFrame(() => p.scrollTo({ top: p.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })); }
function bindPaper() {
  const paper = $('#paper');
  paper.addEventListener('click', async e => {
    const snap = e.target.closest('.snap'); if (snap) { const en = entries.find(x => x.id === snap.dataset.id); openLightbox(en); return; }
    const pol = e.target.closest('.polaroid'); if (pol) { const en = entries.find(x => x.id === pol.closest('.entry').dataset.id); openLightbox(en); return; }
    const act = e.target.closest('[data-act]');
    const art = e.target.closest('.entry'); if (!art) return;
    const en = entries.find(x => x.id === art.dataset.id);
    if (act) { e.stopPropagation(); if (act.dataset.act === 'edit') editEntry(en); else deleteEntry(en, art); return; }
    const was = art.classList.contains('sel'); $$('.entry.sel', paper).forEach(a => a.classList.remove('sel'));
    if (!was) { art.classList.add('sel'); SFX.play('tap'); }
  });
}

/* ---------- composer ---------- */
function renderTagRow() {
  const row = $('#tagrow');
  row.innerHTML = TAGS.map(t => `<button class="chip ${selTags.has(t.id) ? 'on' : ''}" data-tag="${t.id}"><img data-ico="${t.icon}" data-col="${selTags.has(t.id) ? '#141414' : getIconColor()}">${t.name}</button>`).join('');
  fillIcons(row);
  $('#btnTags').classList.toggle('on', selTags.size > 0);
}
function autosize() { const t = $('#noteInput'); t.style.height = 'auto'; t.style.height = Math.min(130, t.scrollHeight) + 'px'; }
function bindComposer() {
  const ta = $('#noteInput');
  ta.addEventListener('input', () => { autosize(); if (S.typeSfx) SFX.play('type'); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitEntry(); } });
  ta.addEventListener('focus', () => setTimeout(() => scrollPaperBottom(), 300));
  $('#btnSave').onclick = submitEntry;
  $('#btnTags').onclick = () => { SFX.play('toggle'); $('#composer').classList.toggle('tags-open'); };
  $('#tagrow').onclick = e => { const b = e.target.closest('[data-tag]'); if (!b) return; const id = b.dataset.tag; selTags.has(id) ? selTags.delete(id) : selTags.add(id); SFX.play('tap'); renderTagRow(); };
  $('#btnPhoto').onclick = () => { SFX.play('tap'); $('#photoInput').click(); };
  $('#photoInput').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      pendingPhoto = await compressImage(f);
      SFX.play('shutter'); const fl = document.createElement('div'); fl.className = 'flash'; $('#composer').appendChild(fl); setTimeout(() => fl.remove(), 400);
      const pd = $('#pending'); pd.classList.add('on'); pd.innerHTML = `<img src="${pendingPhoto}" alt=""><span>Snapshot ready! Add a note or just hit SAVE.</span><button id="rmPhoto">REMOVE</button>`;
      $('#rmPhoto').onclick = () => { pendingPhoto = null; pd.classList.remove('on'); pd.innerHTML = ''; SFX.play('back'); };
    } catch (err) { SFX.play('error'); toast('Could not read that image.'); }
  };
}
function compressImage(file, max = 1600, q = .82) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
let saving = false;
async function submitEntry() {
  if (saving) return;
  const ta = $('#noteInput'), text = ta.value.trim(), j = cur();
  if (!text && !pendingPhoto) { SFX.play('error'); const c = $('#composer'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); return; }
  saving = true;
  try {
    const beforeLv = levelOf(xpOf(j.id));
    const e = { id: uid(), journalId: j.id, text, tags: [...selTags], hasPhoto: !!pendingPhoto, createdAt: Date.now() };
    if (pendingPhoto) { await DB.put('photos', { id: e.id, data: pendingPhoto }); photoCache.set(e.id, pendingPhoto); }
    await DB.put('entries', e); entries.push(e);
    j.updatedAt = e.createdAt; await DB.put('journals', j);
    const gained = 10 + (e.hasPhoto ? 15 : 0) + (e.tags.length ? 2 : 0);
    ta.value = ''; autosize(); pendingPhoto = null; $('#pending').classList.remove('on'); $('#pending').innerHTML = '';
    selTags.clear(); renderTagRow(); $('#composer').classList.remove('tags-open');
    // place it in the book
    const paper = $('#paper'), list = entriesOf(j.id);
    if (list.length === 1 || paper.querySelector('.empty')) renderPage();
    else {
      const prev = list[list.length - 2]; let html = '';
      if (ymd(new Date(prev.createdAt)) !== ymd(new Date(e.createdAt))) html += `<div class="day-div">${fmtDay(e.createdAt)}</div>`;
      paper.insertAdjacentHTML('beforeend', html + entryHTML(e)); fixTagIcons(paper); hydratePhotos(paper);
    }
    const art = paper.querySelector(`.entry[data-id="${e.id}"]`); if (art) art.classList.add('new');
    scrollPaperBottom();
    SFX.play('save'); setTimeout(() => SFX.play('coin'), 380);
    const p = appPoint($('#btnSave')); FX.burst(p.x, p.y, { n: 24 });
    floatText($('#btnSave'), `+${gained} XP`);
    renderHero();
    const afterLv = levelOf(xpOf(j.id)); if (afterLv > beforeLv) setTimeout(() => levelUpBanner(afterLv), 500);
    const h = new Date().getHours();
    checkAch({ owl: h < 4 });
  } catch (err) { console.error(err); SFX.play('error'); toast('Save failed. Storage may be full.'); }
  saving = false;
}
async function editEntry(en) {
  const tags = new Set(en.tags || []);
  const html = `<div class="sheet-head"><h2>EDIT NOTE</h2><button class="icon-btn x" data-close><img data-ico="close"></button></div>
    <p class="note" style="margin:0 0 10px">Originally saved ${fmtDate(en.createdAt)} at ${fmtTime(en.createdAt)}</p>
    <div class="field"><textarea id="edText">${esc(en.text)}</textarea></div>
    <h3>TAGS</h3><div class="opts" id="edTags">${TAGS.map(t => `<button class="opt ${tags.has(t.id) ? 'on' : ''}" data-tag="${t.id}"><img data-ico="${t.icon}">${t.name}</button>`).join('')}</div>
    <div class="sheet-actions"><button class="btn ghost" data-close>CANCEL</button><button class="btn" id="edSave">SAVE</button></div>`;
  const sh = openSheet(html);
  $('#edTags', sh).onclick = e => { const b = e.target.closest('[data-tag]'); if (!b) return; const id = b.dataset.tag; tags.has(id) ? tags.delete(id) : tags.add(id); b.classList.toggle('on'); SFX.play('tap'); };
  $('#edSave', sh).onclick = async () => {
    const t = $('#edText', sh).value.trim(); if (!t && !en.hasPhoto) { SFX.play('error'); return; }
    en.text = t; en.tags = [...tags]; en.editedAt = Date.now(); await DB.put('entries', en);
    closeSheet(); SFX.play('save'); renderPage(); renderHero(); toast('Note updated.');
  };
}
async function deleteEntry(en, art) {
  const ok = await confirmBox('DELETE NOTE?', 'This page will be torn out of the journal for good.', 'DELETE', true); if (!ok) return;
  await DB.del('entries', en.id); if (en.hasPhoto) { await DB.del('photos', en.id); photoCache.delete(en.id); }
  entries = entries.filter(e => e.id !== en.id);
  SFX.play('del'); const p = appPoint(art); FX.burst(p.x, p.y, { n: 18, colors: ['#bbb', '#888', '#eee'], power: 160 });
  art.classList.add('gone'); setTimeout(() => { renderPage(); renderHero(); }, 380);
}

/* ---------- lightbox ---------- */
async function openLightbox(en) {
  if (!en) return; SFX.play('select');
  const src = await loadPhoto(en.id), layer = $('#layer');
  layer.innerHTML = `<div class="lightbox"><button class="icon-btn x"><img data-ico="close"></button><img src="${src}" alt="Snapshot"><div class="when">${fmtDate(en.createdAt)} · ${fmtTime(en.createdAt)}</div>${en.text ? `<div class="cap">${esc(en.text)}</div>` : ''}<div class="hint">Press and hold the picture to save it to Photos</div></div>`;
  fillIcons(layer);
  $('.lightbox .x', layer).onclick = () => { SFX.play('back'); layer.innerHTML = ''; };
}

/* ============================================================
   SHEETS / MODALS / TOASTS
   ============================================================ */
function openSheet(html) {
  const layer = $('#layer'); layer.innerHTML = `<div class="backdrop"></div><div class="sheet">${html}</div>`;
  fillIcons(layer); const sh = $('.sheet', layer);
  $('.backdrop', layer).onclick = () => closeSheet();
  $$('[data-close]', sh).forEach(b => b.onclick = () => { SFX.play('back'); closeSheet(); });
  return sh;
}
function closeSheet() { const sh = $('#layer .sheet'); if (!sh) { $('#layer').innerHTML = ''; return; } sh.classList.add('closing'); setTimeout(() => { $('#layer').innerHTML = ''; }, 200); }
function modal({ title, body = '', img = '', buttons }) {
  return new Promise(res => {
    const layer = $('#layer'), prev = layer.innerHTML ? layer.cloneNode(true) : null;
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="backdrop"></div><div class="modal">${img ? `<img class="modal-img px" src="${img}">` : ''}<h2>${title}</h2>${body ? `<p>${body}</p>` : ''}<div class="btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.t}</button>`).join('')}</div></div>`;
    layer.appendChild(wrap);
    wrap.querySelector('.modal').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; SFX.play(buttons[b.dataset.i].v ? 'select' : 'back'); wrap.remove(); res(buttons[b.dataset.i].v); };
  });
}
const confirmBox = (title, body, ok = 'OK', danger = false) => modal({ title, body, buttons: [{ t: ok, v: true, cls: danger ? 'danger' : '' }, { t: 'CANCEL', v: false, cls: 'ghost' }] });
function toast(msg, icon = null) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `${icon ? `<img class="px" src="${icon}">` : ''}<div>${msg}</div>`;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function unlock(id) {
  if (S.ach[id]) return; const a = ACH.find(x => x.id === id); if (!a) return;
  S.ach[id] = Date.now(); saveS();
  setTimeout(() => {
    const t = document.createElement('div'); t.className = 'toast ach';
    t.innerHTML = `<img class="px" src="${sprite(a.icon, '#ffd34d')}"><div><small>ACHIEVEMENT UNLOCKED</small>${a.name}</div>`;
    $('#toasts').appendChild(t); SFX.play('ach'); setTimeout(() => t.remove(), 3800);
  }, 900);
}
function checkAch(ctx = {}) {
  if (entries.length >= 1) unlock('first');
  if (entries.some(e => e.hasPhoto)) unlock('snap');
  if (journals.length >= 3) unlock('shelf3');
  if (journals.length >= 10) unlock('shelf10');
  if (entries.length >= 50) unlock('fifty');
  if (journals.some(j => entriesOf(j.id).length >= 10)) unlock('ten');
  if (journals.some(j => levelOf(xpOf(j.id)) >= 5)) unlock('lv5');
  if (journals.some(j => j.status === 'Completed' || j.status === '100%')) unlock('credits');
  if (ctx.owl) unlock('owl');
}
/* ============================================================
   BOOK EDITOR (new + customize)
   ============================================================ */
function openBookEditor(existing = null) {
  const isNew = !existing;
  const d = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), title: '', platform: '', status: 'Playing', style: randomStyle(), createdAt: Date.now(), updatedAt: Date.now() };
  const optRow = (key, arr, label) => `<h3>${label}</h3><div class="opts" data-key="${key}">${arr.map(o => `<button class="opt ${d.style[key] === o.id ? 'on' : ''}" data-v="${o.id}">${o.name}</button>`).join('')}</div>`;
  const swRow = (key, arr, label) => `<h3>${label}</h3><div class="swatches" data-key="${key}">${arr.map(c => `<button class="sw ${d.style[key] === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}<label class="sw custom"><input type="color" data-key="${key}" value="${d.style[key]}"></label></div>`;
  const html = `<div class="sheet-head"><h2>${isNew ? 'NEW GAME' : 'CUSTOMIZE'}</h2><button class="icon-btn x" data-close><img data-ico="close"></button></div>
    <div class="preview" id="pv"></div>
    <div class="field" style="margin-top:26px"><h3 style="margin-top:0">GAME TITLE</h3><input type="text" id="fTitle" maxlength="60" placeholder="e.g. Hollow Quest" value="${esc(d.title)}"></div>
    <div class="row2"><div class="field"><h3>PLATFORM</h3><input type="text" id="fPlat" list="platList" maxlength="30" placeholder="Switch, PC..." value="${esc(d.platform)}"><datalist id="platList">${PLATFORMS.map(p => `<option value="${p}">`).join('')}</datalist></div>
    <div class="field"><h3>STATUS</h3><select id="fStatus">${STATUSES.map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <button class="btn alt wide" id="fRandom" style="margin-top:22px"><img data-ico="star" data-col="#141414"> RANDOMIZE LOOK</button>
    ${optRow('type', TYPES, 'BOOK TYPE')}
    ${swRow('color', PALETTE, 'COVER COLOR')}
    ${swRow('accent', ACCENTS, 'TRIM / ACCENT')}
    <h3>EMBLEM</h3><div class="emblems" data-key="emblem">${EMBLEMS.map(e => `<button class="${d.style.emblem === e ? 'on' : ''}" data-v="${e}"><img class="px" src="${sprite(e, '#ffffff')}"></button>`).join('')}</div>
    ${optRow('pattern', PATTERNS, 'PATTERN')}
    ${optRow('font', FONTS, 'FONT')}
    ${optRow('size', SIZES, 'THICKNESS')}
    ${optRow('page', PAGES, 'PAGE STYLE')}
    <div class="sheet-actions">${isNew ? '<button class="btn ghost" data-close>CANCEL</button>' : '<button class="btn danger" id="fDelete"><img data-ico="trash" data-col="#ffffff"></button>'}<button class="btn" id="fSave">${isNew ? 'ADD TO SHELF' : 'SAVE'}</button></div>`;
  const sh = openSheet(html);
  // style the font buttons in their own face
  $$('[data-key="font"] .opt', sh).forEach(b => { const f = FONTS.find(x => x.id === b.dataset.v); b.style.fontFamily = f.css; if (f.id === 'arcade') b.style.fontSize = '9px'; });
  const pv = $('#pv', sh);
  const draw = (wig) => {
    d.title = $('#fTitle', sh).value.trim() || 'Untitled'; d.platform = $('#fPlat', sh).value.trim();
    pv.innerHTML = spineHTML(d) + coverHTML(d, 'md');
    if (wig) $$('.book,.cover', pv).forEach(el => el.classList.add('wiggle'));
  };
  draw();
  $('#fTitle', sh).oninput = () => draw(); $('#fPlat', sh).oninput = () => draw();
  sh.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const key = b.parentElement.dataset.key; if (!key) return;
    d.style[key] = b.dataset.v; $$('[data-v]', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
    if (key === 'color' && lum(d.style.color) > .7 && lum(d.style.accent) > .7) d.style.accent = '#1b1b1b';
    SFX.play('tap'); draw(true);
  });
  $$('input[type=color]', sh).forEach(inp => inp.oninput = () => { d.style[inp.dataset.key] = inp.value; $$('.sw', inp.closest('.swatches')).forEach(x => x.classList.remove('on')); draw(); });
  $('#fRandom', sh).onclick = () => {
    SFX.play('shuffle'); d.style = randomStyle();
    ['type', 'pattern', 'font', 'size', 'page'].forEach(k => $$(`[data-key="${k}"] .opt`, sh).forEach(x => x.classList.toggle('on', x.dataset.v === d.style[k])));
    ['color', 'accent'].forEach(k => $$(`[data-key="${k}"] .sw[data-v]`, sh).forEach(x => x.classList.toggle('on', x.dataset.v === d.style[k])));
    $$('[data-key="emblem"] button', sh).forEach(x => x.classList.toggle('on', x.dataset.v === d.style.emblem));
    draw(true);
  };
  if (!isNew) $('#fDelete', sh).onclick = () => deleteJournal(existing);
  $('#fSave', sh).onclick = async () => {
    const title = $('#fTitle', sh).value.trim();
    if (!title) { SFX.play('error'); const f = $('#fTitle', sh); f.focus(); f.style.boxShadow = 'inset 0 0 0 3px #ff4b4b'; return; }
    d.title = title; d.platform = $('#fPlat', sh).value.trim(); d.status = $('#fStatus', sh).value; d.updatedAt = Date.now();
    await DB.put('journals', d);
    if (isNew) {
      journals.push(d); closeSheet(); renderLibrary({ drop: d.id });
      setTimeout(() => { SFX.play('drop'); const b = $(`.book[data-id="${d.id}"]`); if (b) { const p = appPoint(b); FX.burst(p.x, p.y + 60, { n: 16, power: 140, colors: [d.style.color, d.style.accent, '#ffffff'] }); } }, 420);
      toast(`"${esc(title)}" added to your shelf!`, sprite(d.style.emblem, d.style.accent));
    } else {
      const statusChanged = existing.status !== d.status;
      Object.assign(existing, d); closeSheet(); SFX.play('save'); unlock('style');
      if (curId === d.id) renderJournal(); renderLibrary();
      if (statusChanged && (d.status === 'Completed' || d.status === '100%')) { FX.confetti(); toast('GG! Another one for the hall of fame.'); }
    }
    checkAch();
  };
}
async function deleteJournal(j) {
  const n = entriesOf(j.id).length;
  const ok = await confirmBox('REMOVE JOURNAL?', `"${esc(j.title)}" and its ${n} note${n === 1 ? '' : 's'} will be deleted from this device. Export a backup first if you want to keep them.`, 'DELETE FOREVER', true);
  if (!ok) return;
  for (const e of entriesOf(j.id)) { await DB.del('entries', e.id); if (e.hasPhoto) { await DB.del('photos', e.id); photoCache.delete(e.id); } }
  await DB.del('journals', j.id);
  entries = entries.filter(e => e.journalId !== j.id); journals = journals.filter(x => x.id !== j.id);
  closeSheet(); SFX.play('del');
  if (curId === j.id) { curId = null; showScreen('library'); }
  const b = $(`.book[data-id="${j.id}"]`); if (b) { b.classList.add('poof'); const p = appPoint(b); FX.burst(p.x, p.y, { n: 20, colors: [j.style.color, j.style.accent, '#999'] }); await sleep(420); }
  renderLibrary(); toast('Journal removed.');
}

/* ============================================================
   SETTINGS · THEMES · TROPHIES · BACKUP
   ============================================================ */
function themeCard(id) {
  const t = THEMES[id], v = t.vars;
  const books = ['#b8322a', '#2f6fbf', '#f0c330', '#2f9e4f', '#7a3fb0', '#e2702a'].map((c, i) => `<i style="background:${c};height:${24 + (i * 7) % 14}px;box-shadow:inset 0 0 0 1px #000"></i>`).join('');
  return `<button class="theme-card ${S.theme === id ? 'on' : ''}" data-theme="${id}" style="background-color:${v.wall1};background-image:url(${wallTile(id)})">
    <div class="tc-shelf" style="background:linear-gradient(${v.back1},${v.back2})">${books}</div><div class="tc-plank" style="background:${v.shelf};box-shadow:inset 0 2px 0 ${v['shelf-l']}"></div><span>${t.name.toUpperCase()}</span></button>`;
}
function openSettings() {
  const lastB = S.lastBackup ? ago(S.lastBackup) : 'never';
  const every = [[30 * 60e3, 'Every 30 minutes'], [60 * 60e3, 'Every hour'], [3 * 3600e3, 'Every 3 hours'], [86400e3, 'Once a day'], [30 * 86400e3, 'Every 30 days']];
  const html = `<div class="sheet-head"><h2>SETTINGS</h2><button class="icon-btn x" data-close><img data-ico="close"></button></div>
    <div class="field"><h3 style="margin-top:4px">LIBRARY NAME</h3><input type="text" id="sName" maxlength="28" value="${esc(S.libName)}"></div>
    <h3>LIBRARY THEME</h3><div class="themes" id="sThemes">${Object.keys(THEMES).map(themeCard).join('')}</div>
    <h3>SOUND</h3>
    <div class="toggle">Sound effects <button class="switch ${S.sound ? 'on' : ''}" id="sSound"></button></div>
    <div class="toggle">Typing clicks <button class="switch ${S.typeSfx ? 'on' : ''}" id="sType"></button></div>
    <div class="toggle" style="gap:16px">Volume <input type="range" id="sVol" min="0" max="1" step=".05" value="${S.vol}" style="max-width:200px"></div>
    <h3>THE WINDOW</h3>
    <p class="note" style="margin-top:0">${S.loc ? `Showing the real sky outside. Updated ${ago(S.wx && S.wx.at)}.` : 'No location yet, so the window follows your clock with clear skies.'}</p>
    <div class="row2" style="margin-top:12px"><button class="btn ghost" id="sLoc">${S.loc ? 'UPDATE LOCATION' : 'USE MY LOCATION'}</button></div>
    <div class="field"><h3>REFRESH WEATHER</h3><select id="sEvery">${every.map(([v, t]) => `<option value="${v}" ${S.wxEvery === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <h3>BACKUP & RESTORE</h3>
    <p class="note" style="margin-top:0">Everything is saved on this device only. Last backup: <b>${lastB}</b>.</p>
    <div class="row2" style="margin-top:12px"><button class="btn" id="sExport"><img data-ico="download" data-col="#141414"> EXPORT</button><button class="btn ghost" id="sImport"><img data-ico="upload"> RESTORE</button></div>
    <h3>ABOUT</h3>
    <p class="note" style="margin-top:0">Save &amp; Tell v1.0 · Works offline once installed. On iPhone, open in Safari and choose Share → Add to Home Screen. Weather by Open-Meteo.</p>
    <button class="btn danger wide" id="sWipe" style="margin-top:18px"><img data-ico="trash" data-col="#ffffff"> ERASE EVERYTHING</button>`;
  const sh = openSheet(html);
  $('#sName', sh).onchange = e => { S.libName = e.target.value.trim() || 'My Library'; saveS(); renderLibrary(); };
  $('#sThemes', sh).onclick = e => {
    const b = e.target.closest('[data-theme]'); if (!b) return;
    if (S.theme !== b.dataset.theme) { pixelWipe(() => { applyTheme(b.dataset.theme); renderLibrary(); }); unlock('decor'); }
    $$('.theme-card', sh).forEach(x => x.classList.toggle('on', x === b));
  };
  const sw = (id, key) => $(id, sh).onclick = e => { S[key] = !S[key]; saveS(); e.target.classList.toggle('on', S[key]); SFX.play('toggle'); updateSoundBtn(); };
  sw('#sSound', 'sound'); sw('#sType', 'typeSfx');
  $('#sVol', sh).oninput = e => { S.vol = +e.target.value; saveS(); SFX.init(); };
  $('#sVol', sh).onchange = () => SFX.play('coin');
  $('#sLoc', sh).onclick = async () => { const ok = await WX.askLocation(); toast(ok ? 'Window synced to your sky!' : 'Location unavailable. Check Settings → Privacy → Location.'); };
  $('#sEvery', sh).onchange = e => { S.wxEvery = +e.target.value; saveS(); };
  $('#sExport', sh).onclick = exportLibrary;
  $('#sImport', sh).onclick = () => $('#importInput').click();
  $('#sWipe', sh).onclick = async () => {
    if (!await confirmBox('ERASE EVERYTHING?', 'All journals, notes and snaps on this device will be deleted.', 'ERASE', true)) return;
    if (!await confirmBox('ARE YOU SURE?', 'There is no undo. Export a backup first if you need one.', 'YES, ERASE IT ALL', true)) return;
    await DB.clear('journals'); await DB.clear('entries'); await DB.clear('photos'); journals = []; entries = []; photoCache.clear();
    closeSheet(); renderLibrary(); SFX.play('del'); toast('Library cleared. Fresh save file!');
  };
}
function openTrophies() {
  const got = ACH.filter(a => S.ach[a.id]).length;
  const html = `<div class="sheet-head"><h2>TROPHIES ${got}/${ACH.length}</h2><button class="icon-btn x" data-close><img data-ico="close"></button></div>
    <div class="trophies">${ACH.map(a => `<div class="trophy ${S.ach[a.id] ? '' : 'locked'}"><img class="px" src="${sprite(a.icon, '#ffd34d')}"><b>${a.name.toUpperCase()}</b><small>${a.desc}</small></div>`).join('')}</div>`;
  openSheet(html);
}
async function exportLibrary() {
  try {
    const photos = await DB.all('photos');
    const data = { app: 'Save & Tell', version: 1, exportedAt: new Date().toISOString(), settings: { theme: S.theme, libName: S.libName, ach: S.ach, sort: S.sort }, journals, entries, photos };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), name = `SaveAndTell-Backup-${ymd(new Date())}.json`;
    const done = () => { S.lastBackup = Date.now(); saveS(); unlock('backup'); toast('Backup created. Keep it somewhere safe!', sprite('download', '#7cfc6a')); };
    let file = null; try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Save & Tell Backup' }); done(); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); done();
  } catch (e) { SFX.play('error'); toast('Export failed.'); }
}
async function importLibrary(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { SFX.play('error'); toast('That file is not a Save & Tell backup.'); return; }
  if (!d || d.app !== 'Save & Tell' || !Array.isArray(d.journals)) { SFX.play('error'); toast('That file is not a Save & Tell backup.'); return; }
  const ph = d.photos || [], en = d.entries || [];
  const mode = await modal({
    title: 'RESTORE BACKUP', img: sprite('book', '#ffd34d'),
    body: `${d.journals.length} journals · ${en.length} notes · ${ph.length} snaps<br><small>from ${d.exportedAt ? new Date(d.exportedAt).toLocaleString() : 'unknown date'}</small>`,
    buttons: [{ t: 'MERGE INTO LIBRARY', v: 'merge' }, { t: 'REPLACE EVERYTHING', v: 'replace', cls: 'danger' }, { t: 'CANCEL', v: null, cls: 'ghost' }]
  });
  if (!mode) return;
  try {
    if (mode === 'replace') { await DB.clear('journals'); await DB.clear('entries'); await DB.clear('photos'); photoCache.clear(); }
    await DB.putMany('journals', d.journals); await DB.putMany('entries', en);
    for (let i = 0; i < ph.length; i += 20) await DB.putMany('photos', ph.slice(i, i + 20));
    if (d.settings) {
      S.ach = Object.assign({}, d.settings.ach || {}, S.ach);
      if (mode === 'replace') { if (d.settings.libName) S.libName = d.settings.libName; if (THEMES[d.settings.theme]) applyTheme(d.settings.theme); }
      saveS();
    }
    journals = await DB.all('journals'); entries = await DB.all('entries');
    closeSheet(); renderLibrary(); FX.confetti(); SFX.play('level'); toast('Library restored!');
  } catch (e) { SFX.play('error'); toast('Restore failed. Storage may be full.'); }
}

/* ============================================================
   THEME + MISC
   ============================================================ */
function applyTheme(id) {
  if (!THEMES[id]) id = 'cozy'; S.theme = id; saveS();
  const t = THEMES[id], root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty('--' + k, v));
  root.style.setProperty('--wall', `url(${wallTile(id)})`);
  const app = $('#app'); [...app.classList].filter(c => c.startsWith('theme-')).forEach(c => app.classList.remove(c)); app.classList.add('theme-' + id);
  document.querySelector('meta[name=theme-color]').setAttribute('content', t.vars.bg);
  if ($('#library').classList.contains('active')) AMB.setMode(t.particles);
  fillIcons(); updateSoundBtn();
}
function updateSoundBtn() { const b = $('#btnSound'); if (!b) return; const i = $('img', b); i.dataset.ico = S.sound ? 'speaker' : 'mute'; i.src = sprite(i.dataset.ico, getIconColor()); b.classList.toggle('off', !S.sound); }

function fitViewport() {
  const vv = window.visualViewport, html = document.documentElement;
  const coarse = matchMedia('(pointer:coarse)').matches, land = innerWidth > innerHeight && coarse && innerHeight < 600;
  html.classList.remove('rot-l', 'rot-r');
  if (land) { html.classList.add((window.orientation === -90 || (screen.orientation && screen.orientation.angle === 270)) ? 'rot-r' : 'rot-l'); html.style.removeProperty('--app-h'); }
  else if (vv) { html.style.setProperty('--app-h', vv.height + 'px'); html.style.setProperty('--app-top', vv.offsetTop + 'px'); html.classList.toggle('kb', vv.height < innerHeight - 120); }
  requestAnimationFrame(() => { AMB.resize(); FX.resize(); WIN.resize(); });
}
function askLocationIntro() {
  return modal({
    title: 'A WINDOW TO YOUR WORLD', img: sprite('moon', '#ffd34d'),
    body: 'Your library has a little window. Share your location and it will show your real weather and time of day outside. Only the sky is shown, nothing leaves your device except a weather lookup.',
    buttons: [{ t: 'ALLOW LOCATION', v: true }, { t: 'NOT NOW', v: false, cls: 'ghost' }]
  });
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  applyTheme(S.theme);
  // title logo: pixel open book
  const logoRows = ['................', '.wwwwww..wwwwww.', 'cwllllwggwllllwc', 'cwwwwwwggwwwwwwc', 'cwlllllggwllllwc', 'cwwwwwwggwwwwwwc', 'cwllllwggwlllwwc', 'cwwwwwwggwwwwwwc', 'cwlllwwggwllllwc', 'ccwwwwwggwwwwwcc', '.cccccc..cccccc.', '................'];
  SPR.logo = logoRows; $('#logoBook').src = sprite('logo', '#ffffff', 12, { w: '#fff6dd', l: '#c9b48a', g: '#e2cfa3', c: '#ff4fa3' });
  fillIcons();
  AMB.init($('#ambient')); FX.init($('#fx')); WIN.init($('#windowCanvas'));
  fitViewport(); applyTimeOfDay();
  try { await DB.open(); journals = await DB.all('journals'); entries = await DB.all('entries'); }
  catch (e) { toast('Storage is unavailable. Private Browsing may block saving.'); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  showScreen('title');

  // ---- events ----
  let started = false;
  const start = async () => {
    if (started) return; started = true; SFX.init(); SFX.play('start');
    const p = appPoint($('#pressStart')); FX.burst(p.x, p.y, { n: 30 });
    await sleep(350);
    await pixelWipe(() => { renderLibrary(); showScreen('library'); });
    if (!S.locAsked) { await sleep(300); const yes = await askLocationIntro(); if (yes) { const ok = await WX.askLocation(); toast(ok ? 'Window synced to your sky!' : 'No location. The window will follow your clock.'); } else { S.locAsked = true; saveS(); } }
    else WX.fetch();
    checkAch();
  };
  $('#title').addEventListener('click', start);
  bindShelf(); bindPaper(); bindComposer();
  $('#btnNew').onclick = () => { SFX.play('select'); openBookEditor(); };
  $('#btnSettings').onclick = () => { SFX.play('select'); openSettings(); };
  $('#btnTrophy').onclick = () => { SFX.play('select'); openTrophies(); };
  $('#btnSound').onclick = () => { S.sound = !S.sound; saveS(); updateSoundBtn(); SFX.play('toggle'); };
  $('#btnSort').onclick = () => { const i = SORTS.findIndex(s => s[0] === S.sort); S.sort = SORTS[(i + 1) % SORTS.length][0]; saveS(); SFX.play('shuffle'); renderLibrary(); };
  $('#btnBack').onclick = closeJournal;
  $('#btnCustomize').onclick = () => { SFX.play('select'); openBookEditor(cur()); };
  $$('.tab').forEach(t => t.onclick = () => { if (curTab === t.dataset.tab) return; curTab = t.dataset.tab; SFX.play('page'); renderJournal(); if (curTab === 'log') scrollPaperBottom(false); else $('#paper').scrollTop = 0; if (curTab === 'search') setTimeout(() => $('#searchInput').focus(), 50); });
  $('#searchInput').addEventListener('input', () => renderPage());
  $('#window').onclick = () => {
    SFX.play('tap'); const ph = WX.phase().name;
    const when = { night: 'Night', dawn: 'Dawn', day: 'Daytime', dusk: 'Dusk' }[ph];
    if (!S.loc) toast(`${when} outside. Turn on location in Settings to see your real weather.`, sprite('moon', '#ffd34d'));
    else toast(`${WX.label()} · ${when}`, sprite(ph === 'night' ? 'moon' : 'star', '#ffd34d'));
  };
  $('#importInput').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLibrary(f); };

  window.addEventListener('resize', fitViewport);
  window.addEventListener('orientationchange', () => setTimeout(fitViewport, 250));
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); }
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => { }); } catch (e) { }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { WX.fetch(); applyTimeOfDay(); } });
  setInterval(() => { applyTimeOfDay(); WX.fetch(); }, 60e3);
  let lastW = 0; new ResizeObserver(() => { const w = $('#shelves').clientWidth; if (w && Math.abs(w - lastW) > 4) { lastW = w; if ($('#library').classList.contains('active')) renderLibrary(); } }).observe($('#shelves'));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.addEventListener('DOMContentLoaded', boot);
