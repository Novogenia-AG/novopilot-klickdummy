// Minimale Browser-Attrappe fuer den NovoPilot-Klickdummy (nur Node, keine Pakete).
// Bewusst grosszuegig: getElementById/querySelector liefern immer ein Element,
// damit nur echte Programmfehler (Ausnahmen, "undefined" im HTML) auffallen.
// Netzwerk ist komplett gesperrt: fetch/WebSocket/XHR lehnen ab und werden protokolliert.
import vm from 'node:vm';

const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
const styleObj = () => new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
  { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } });

class ClassList {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach(x => this.s.add(x)); }
  remove(...c) { c.forEach(x => this.s.delete(x)); }
  toggle(c, f) { const on = f === undefined ? !this.s.has(c) : !!f; on ? this.s.add(c) : this.s.delete(c); return on; }
  contains(c) { return this.s.has(c); }
  replace(a, b) { this.s.delete(a); this.s.add(b); }
  get value() { return [...this.s].join(' '); }
}

export function makeEnv({ width = 1280, href = 'https://novogenia-ag.github.io/novopilot-klickdummy/index.html' } = {}) {
  const log = { net: [], errors: [], timerErrors: [], console: [], opened: [] };
  const timers = [];
  let tid = 0;
  const listeners = { window: {}, document: {} };
  const addL = scope => (t, f) => { (listeners[scope][t] ||= []).push(f); };
  const remL = scope => (t, f) => { const a = listeners[scope][t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } };

  class El {
    constructor(tag = 'div', id = '') {
      this.tagName = String(tag).toUpperCase(); this.nodeName = this.tagName; this.nodeType = 1;
      this.id = id; this._html = ''; this.style = styleObj(); this.dataset = {}; this.classList = new ClassList();
      this.children = []; this.childNodes = []; this.attrs = {}; this.value = ''; this.checked = false; this.disabled = false;
      this.files = []; this.src = ''; this.href = ''; this.srcObject = null; this.muted = false; this.volume = 1;
      this.offsetLeft = 0; this.offsetTop = 0; this.offsetWidth = 0; this.offsetHeight = 0;
      this.clientWidth = width; this.clientHeight = 800; this.scrollLeft = 0; this.scrollTop = 0; this.scrollWidth = width; this.scrollHeight = 800;
      this.videoWidth = 0; this.videoHeight = 0; this.readyState = 0; this.parentNode = null; this.parentElement = null;
      this.contentWindow = { postMessage() {}, location: { hash: '' }, addEventListener() {}, document: null };
      this.selectionStart = 0; this.placeholder = ''; this.options = []; this.selectedIndex = 0; this.width = 0; this.height = 0;
    }
    get innerHTML() { return this._html; } set innerHTML(v) { this._html = String(v); }
    get outerHTML() { return this._html; }
    get textContent() { return this._html.replace(/<[^>]*>/g, ''); } set textContent(v) { this._html = String(v); }
    get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
    get className() { return this.classList.value; } set className(v) { this.classList = new ClassList(); String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c)); }
    get firstChild() { return this.children[0] || null; } get firstElementChild() { return this.children[0] || null; }
    get lastChild() { return this.children.at(-1) || null; } get lastElementChild() { return this.children.at(-1) || null; }
    get nextElementSibling() { return null; } get previousElementSibling() { return null; }
    get isConnected() { return true; }
    appendChild(c) { this.children.push(c); if (c && typeof c === 'object') { c.parentNode = this; c.parentElement = this; } return c; }
    append(...c) { c.forEach(x => this.appendChild(x)); } prepend(...c) { c.forEach(x => this.appendChild(x)); }
    insertBefore(c) { return this.appendChild(c); } removeChild(c) { return c; } replaceChildren() { this.children = []; }
    remove() {} replaceWith() {} before() {} after() {} cloneNode() { return new El(this.tagName); }
    insertAdjacentHTML(_p, h) { this._html += String(h); } insertAdjacentElement(_p, e) { return e; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; } toggleAttribute(k, f) { return !!f; }
    addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
    querySelector() { return new El(); } querySelectorAll() { return []; } getElementsByTagName() { return []; } getElementsByClassName() { return []; }
    closest() { return null; } matches() { return false; } contains() { return false; }
    getBoundingClientRect() { return rect(); } getClientRects() { return []; }
    scrollIntoView() {} scrollTo() {} scrollBy() {} focus() {} blur() {} click() {} select() {} setSelectionRange() {}
    play() { return Promise.resolve(); } pause() {} load() {} setSinkId() { return Promise.resolve(); } captureStream() { return new MediaStream(); }
    requestFullscreen() { return Promise.reject(new Error('kein Vollbild im Test')); }
    animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
    getContext() { return ctx2d(); } toDataURL() { return 'data:,'; } toBlob(cb) { cb && cb(new Blob([''])); }
    showModal() {} close() {} reset() {} submit() {} checkValidity() { return true; } reportValidity() { return true; }
    attachShadow() { return new El(); }
  }
  const ctx2d = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'canvas' ? new El('canvas') : (k === 'measureText' ? () => ({ width: 0 }) : (k === 'getImageData' || k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : (typeof k === 'string' && /^(create|draw|fill|stroke|clear|set|get|put|begin|close|move|line|arc|rect|save|restore|translate|rotate|scale|clip|quadratic|bezier|transform|reset|round)/.test(k) ? () => new Proxy({}, { get: () => () => {} }) : undefined))))), set: (t, k, v) => { t[k] = v; return true; } });

  class MediaStream { constructor() {} getTracks() { return []; } getAudioTracks() { return []; } getVideoTracks() { return []; } addTrack() {} removeTrack() {} }

  const byId = new Map();
  const body = new El('body'); const html = new El('html');
  const document = {
    body, documentElement: html, head: new El('head'), activeElement: body, fullscreenElement: null, hidden: false, visibilityState: 'visible',
    cookie: '', title: '', readyState: 'complete', referrer: '',
    getElementById(id) { if (!byId.has(id)) byId.set(id, new El('div', id)); return byId.get(id); },
    querySelector() { return new El(); }, querySelectorAll() { return []; }, getElementsByTagName() { return []; },
    createElement(t) { return new El(t); }, createElementNS(_n, t) { return new El(t); }, createTextNode(t) { const e = new El('#text'); e.textContent = t; return e; },
    createDocumentFragment() { return new El('#fragment'); },
    addEventListener: addL('document'), removeEventListener: remL('document'), dispatchEvent() { return true; },
    exitFullscreen() { return Promise.resolve(); }, execCommand() { return true; }, hasFocus() { return true; },
    elementFromPoint() { return null; }, getSelection() { return { removeAllRanges() {}, addRange() {}, toString: () => '' }; },
    createRange() { return { selectNodeContents() {}, setStart() {}, setEnd() {} }; },
  };

  const u = new URL(href);
  const location = {
    get href() { return u.href; }, set href(v) { log.opened.push(String(v)); },
    get hash() { return u.hash; }, set hash(v) { u.hash = v; },
    get search() { return u.search; }, get pathname() { return u.pathname; }, get origin() { return u.origin; },
    get protocol() { return u.protocol; }, get host() { return u.host; }, get hostname() { return u.hostname; },
    reload() {}, assign(v) { log.opened.push(String(v)); }, replace(v) { log.opened.push(String(v)); }, toString() { return u.href; },
  };
  const store = () => { const m = new Map(); return { getItem: k => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: k => m.delete(String(k)), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } }; };

  const blocked = name => function () { log.net.push(name + ' ' + String(arguments[0])); throw new Error(name + ' im Test gesperrt'); };
  const sb = {
    console: {
      log() {}, info() {}, debug() {},
      warn: (...a) => log.console.push('warn: ' + a.join(' ')),
      error: (...a) => log.console.push('error: ' + a.join(' ')),
    },
    document, location, navigator: {
      userAgent: 'node-test', language: 'de-AT', languages: ['de-AT'], onLine: true, platform: 'test', maxTouchPoints: 0,
      clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
      mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('keine Kamera im Test'), { name: 'NotFoundError' })), getDisplayMedia: () => Promise.reject(new Error('kein Bildschirm im Test')), enumerateDevices: () => Promise.resolve([]), addEventListener() {}, removeEventListener() {} },
      permissions: { query: () => Promise.resolve({ state: 'prompt', addEventListener() {} }) },
    },
    history: { pushState() {}, replaceState() {}, back() {}, length: 1, state: null },
    localStorage: store(), sessionStorage: store(),
    innerWidth: width, innerHeight: 800, outerWidth: width, devicePixelRatio: 1, scrollX: 0, scrollY: 0, pageYOffset: 0,
    screen: { width, height: 800 },
    addEventListener: addL('window'), removeEventListener: remL('window'), dispatchEvent() { return true; },
    scrollTo() {}, scrollBy() {}, focus() {}, print() {}, alert() {}, confirm: () => false, prompt: () => null,
    open: (url) => { log.opened.push(String(url)); return null; },
    matchMedia: q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => styleObj(),
    requestAnimationFrame: f => { timers.push({ id: ++tid, f, t: 16 }); return tid; }, cancelAnimationFrame() {},
    requestIdleCallback: f => { timers.push({ id: ++tid, f, t: 0 }); return tid; }, cancelIdleCallback() {},
    setTimeout: (f, t = 0) => { if (typeof f === 'function') timers.push({ id: ++tid, f, t: +t || 0 }); return tid; },
    clearTimeout: id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: (f, t = 0) => { if (typeof f === 'function') timers.push({ id: ++tid, f, t: +t || 0, iv: true }); return tid; },
    clearInterval: id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
    queueMicrotask, structuredClone, atob, btoa, URL, URLSearchParams, TextEncoder, TextDecoder, Blob, AbortController,
    performance, crypto: globalThis.crypto, Intl, Promise, Date, Math, JSON,
    fetch: (url) => { log.net.push('fetch ' + String(url)); return Promise.reject(new TypeError('Netzwerk im Test gesperrt')); },
    XMLHttpRequest: blocked('XMLHttpRequest'), WebSocket: blocked('WebSocket'), EventSource: blocked('EventSource'),
    BroadcastChannel: class { constructor(n) { this.name = n; this.onmessage = null; } postMessage() {} close() {} addEventListener() {} },
    RTCPeerConnection: class { constructor() { log.net.push('RTCPeerConnection'); } addTrack() {} getSenders() { return []; } close() {} createOffer() { return Promise.reject(new Error('kein WebRTC')); } addEventListener() {} },
    AudioContext: class { constructor() { this.state = 'running'; } createMediaStreamSource() { return { connect() {}, disconnect() {} }; } createAnalyser() { return { fftSize: 0, frequencyBinCount: 32, getByteTimeDomainData() {}, getFloatTimeDomainData() {}, getByteFrequencyData() {}, connect() {}, disconnect() {} }; } close() { return Promise.resolve(); } resume() { return Promise.resolve(); } },
    MediaStream,
    Image: class extends El { constructor() { super('img'); } },
    FileReader: class { readAsDataURL() {} readAsText() {} readAsArrayBuffer() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    HTMLElement: El, Element: El, Node: El, HTMLInputElement: El, HTMLVideoElement: El, HTMLCanvasElement: El, HTMLIFrameElement: El,
    Event: class { constructor(t, o = {}) { this.type = t; Object.assign(this, o); } preventDefault() {} stopPropagation() {} },
    CustomEvent: class { constructor(t, o = {}) { this.type = t; this.detail = o.detail; } },
    KeyboardEvent: class { constructor(t, o = {}) { this.type = t; Object.assign(this, o); } },
    CSS: { escape: s => String(s).replace(/[^\w-]/g, c => '\\' + c), supports: () => false },
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb; sb.parent = sb; sb.frames = sb;
  const context = vm.createContext(sb);

  async function flush(max = 400, maxDelay = 30000) {
    // Fuehrt anstehende Timer aus (Intervall nur einmal), damit verzoegerte Logik (Demo-Chat usw.) mitgetestet wird.
    let n = 0;
    for (;;) {
      await new Promise(r => setImmediate(r));
      const due = timers.filter(t => t.t <= maxDelay).sort((a, b) => a.t - b.t);
      if (!due.length || n >= max) break;
      const t = due[0]; timers.splice(timers.indexOf(t), 1); n++;
      try { t.f(0); } catch (e) { log.timerErrors.push(e); }
    }
    timers.length = 0;
    return n;
  }
  function fire(scope, type, ev = {}) {
    for (const f of [...(listeners[scope][type] || [])]) f(Object.assign({ type, preventDefault() {}, stopPropagation() {}, target: body }, ev));
  }
  return { context, sb, document, location, log, flush, fire, run: code => vm.runInContext(code, context), El };
}
