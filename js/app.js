"use strict";

/* ---------- 화면 배율 보정 ----------
   크롬의 '데스크톱 사이트' 모드처럼 브라우저가 가상 화면 폭을 980px 정도로 넓게 잡으면
   앱이 PC 화면처럼 작게 보입니다. 실제 기기 폭(screen.width)에 맞게 배율을 올려 줍니다. */
const viewportFix = (() => {
  const root = document.documentElement;
  let zoom = 1;
  function apply() {
    root.style.zoom = ""; root.style.removeProperty("--dvh"); root.style.removeProperty("--u");
    const dev = screen.width, layout = root.clientWidth;
    zoom = 1;
    if (navigator.maxTouchPoints > 0 && dev > 0 && dev <= 600 && layout > dev * 1.25) zoom = layout / dev;
    if (zoom > 1) {
      root.style.zoom = zoom.toFixed(3);
      root.style.setProperty("--dvh", `${(innerHeight / 100 / zoom).toFixed(3)}px`);
      root.style.setProperty("--u", `${(dev / 100).toFixed(3)}px`);
    }
  }
  apply();
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(apply, 250); };
  window.addEventListener("resize", later);
  window.addEventListener("orientationchange", later);
  const info = () => `${innerWidth}×${innerHeight} · 화면 ${screen.width}×${screen.height} · DPR ${devicePixelRatio} · 배율 ${zoom.toFixed(2)}`;
  return { info, zoom: () => zoom };
})();

/* ---------- 저장소 ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("kk2-" + key); return v === null ? fallback : JSON.parse(v); } catch (_) { return fallback; }
  },
  set(key, value) { try { localStorage.setItem("kk2-" + key, JSON.stringify(value)); } catch (_) {} }
};

const DEFAULTS = { language: "ko", speech: "full", pace: "normal", tapFirst: false, sessionSize: 10, sfx: true, motion: true };
const PACE_MS = { slow: 5000, normal: 3000, fast: 1500 };
const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
let stars = store.get("stars", null);
if (stars === null) { try { stars = Number(localStorage.getItem("kongkong-stars")) || 0; } catch (_) { stars = 0; } }
let stickers = store.get("stickers", {});     // { emoji: count }
let mistakes = store.get("mistakes", {});     // { cardKey: count }
let quizStreak = store.get("quizStreak", 0);

/* ---------- 데이터 준비 ---------- */
const CATS = window.CATEGORIES.map(raw => {
  const cat = { ...raw };
  cat.cards = raw.cards.map(c => ({
    key: `${cat.id}:${c[2]}`, cat, emoji: c[0], ko: c[1], en: c[2], koSay: c[3], enSay: c[4], extra: c[5]
  }));
  return cat;
});
const ALL_CARDS = CATS.flatMap(cat => cat.cards);
const CARD_BY_KEY = new Map(ALL_CARDS.map(card => [card.key, card]));
let enabledIds = store.get("enabled", CATS.map(cat => cat.id)).filter(id => CATS.some(cat => cat.id === id));
if (!enabledIds.length) enabledIds = CATS.map(cat => cat.id);

const STICKERS = ["🦄","🌈","🎀","💖","🍓","🧁","🌸","⭐","👑","🦋","🍭","🎈","🐰","🐱","🧸","🌷","🍩","🐥","🦩","💎","🍒","🐼","🎂","🌟"];

/* ---------- 문구 ---------- */
const T = {
  ko: {
    brand: "콩콩 카드", heroEyebrow: "콕 누르고, 듣고, 놀아요!", heroTitle: "오늘은 누구를<br><span>만나 볼까요?</span>",
    hello: "안녕!", helloSpeech: ["안녕! 나는 콩콩이야!", "같이 놀자!", "오늘도 신나게 놀아 보자!", "카드를 골라 봐!"],
    quizTitle: "찾기 놀이", quizNote: "들리는 그림을 찾아요", bubbleTitle: "비눗방울", bubbleNote: "톡톡 터뜨려요",
    categoryTitle: "카드 골라 보기", reviewTitle: "다시 만나요", reviewNote: "헷갈렸던 카드를 다시 봐요",
    listen: "다시 듣기", next: "다음", wait: "잘 보고~", swipe: "그림을 잘 보고, 하트가 차면 밀어요 💗",
    nudgeLook: "그림을 잘 봐요 👀", nudgeTap: "그림을 콕! 눌러 봐요",
    findPrompt: w => `${w}${josa(w, "을", "를")} 찾아볼까?`,
    correct: ["딩동댕! 참 잘했어요!", "우와, 맞았어요!", "최고예요!", "정답이에요, 짝짝짝!"],
    correctText: "참 잘했어요! ⭐", retry: "다시 찾아볼까?", hint: w => `${w}${josa(w, "은", "는")} 여기 있어요!`,
    settings: "보호자 설정", categorySetting: "보여 줄 카테고리",
    complete: "카드를 다 봤어요!", completeNote: "예쁜 스티커를 받았어요!", again: "한 번 더 볼래요", finish: "다른 카드 고르기",
    completeSpeech: "우와! 카드를 다 봤어요! 스티커를 받았어요!",
    stickerTitle: "내 스티커북", stickerNote: n => `모은 스티커 ${n}개! 카드를 끝까지 보면 스티커를 받아요.`,
    bubbleCheer: "비눗방울 열 개! 별을 받았어요!", quizSticker: "다섯 번 맞혀서 스티커를 받았어요!",
    holdGear: "보호자는 ⚙️를 꾹 눌러 주세요", fullscreen: "⛶ 전체 화면", install: "📲 앱으로 설치", reset: "별·스티커 초기화",
    resetConfirm: "한 번 더 누르면 지워요", save: "닫기", installHelp: "브라우저 메뉴에서 '홈 화면에 추가'를 눌러 주세요.",
    categoryIntro: n => `${n}! 카드를 잘 보세요.`
  },
  en: {
    brand: "Kong Kong Cards", heroEyebrow: "Tap, listen, and play!", heroTitle: "Who shall we<br><span>meet today?</span>",
    hello: "Hi!", helloSpeech: ["Hi! I'm Kong Kong!", "Let's play together!", "Pick a card!", "Hooray, let's have fun!"],
    quizTitle: "Find It", quizNote: "Find what you hear", bubbleTitle: "Bubbles", bubbleNote: "Pop, pop, pop!",
    categoryTitle: "Pick Cards", reviewTitle: "Try Again", reviewNote: "Meet the tricky cards again",
    listen: "Listen", next: "Next", wait: "Look~", swipe: "Look closely, then swipe when the heart fills 💗",
    nudgeLook: "Look at the picture 👀", nudgeTap: "Tap the picture!",
    findPrompt: w => `Where is the ${w.toLowerCase()}?`,
    correct: ["Great job!", "Yes, you found it!", "Super!", "Hooray, well done!"],
    correctText: "Great job! ⭐", retry: "Let's try again!", hint: w => `Here is the ${w.toLowerCase()}!`,
    settings: "Parent Settings", categorySetting: "Categories to show",
    complete: "All done!", completeNote: "You got a pretty sticker!", again: "One more time", finish: "Pick other cards",
    completeSpeech: "Wow! You finished all the cards! Here is a sticker!",
    stickerTitle: "My Sticker Book", stickerNote: n => `${n} stickers! Finish a card set to get one.`,
    bubbleCheer: "Ten bubbles! You got a star!", quizSticker: "Five right answers! Here is a sticker!",
    holdGear: "Parents: press and hold ⚙️", fullscreen: "⛶ Fullscreen", install: "📲 Install app", reset: "Reset stars & stickers",
    resetConfirm: "Tap again to clear", save: "Close", installHelp: "Use the browser menu and choose 'Add to Home Screen'.",
    categoryIntro: n => `${n}! Look at the cards.`
  }
};
const uiLang = () => (settings.language === "en" ? "en" : "ko");
const t = key => T[uiLang()][key];
const pick = list => list[Math.floor(Math.random() * list.length)];

function josa(word, withFinal, withoutFinal) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return withoutFinal;
  return (last - 0xac00) % 28 ? withFinal : withoutFinal;
}

/* ---------- 유틸 ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const emojiKey = e => [...e].map(ch => ch.codePointAt(0).toString(16)).filter(cp => cp !== "fe0f").join("-");
const emojiSrc = e => (window.EMOJI_DATA && window.EMOJI_DATA[emojiKey(e)]) || `img/emoji/${emojiKey(e)}.webp`;
function emojiImg(e, cls = "art", alt = "") {
  return `<img class="${cls}" src="${emojiSrc(e)}" alt="${esc(alt)}" draggable="false" data-emoji="${esc(e)}" onerror="kkFallback(this)">`;
}
// 움직이는 3D 그림: 정지 그림을 먼저 보여 주고, 움직이는 그림이 다 받아지면 바꿔 끼움
const ANIM_OK = !window.EMOJI_DATA;
function animate(img) {
  if (!ANIM_OK || !settings.motion || !img || !img.dataset || !img.dataset.emoji) return;
  const src = `img/anim/${emojiKey(img.dataset.emoji)}.webp`;
  const pre = new Image();
  pre.onload = () => { if (img.isConnected || img.id) img.src = src; };
  pre.src = src;
}
function animateIn(root) { root && root.querySelectorAll("img.art, img.anim").forEach(animate); }
window.kkFallback = img => {
  const span = document.createElement("span");
  span.className = "emoji-fallback";
  span.textContent = img.dataset.emoji;
  img.replaceWith(span);
};
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function toast(text, ms = 2200) {
  const el = $("#toast");
  el.textContent = text; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), ms);
}
function confetti(count = 18) {
  const box = $("#confetti");
  const bits = ["💗","✨","⭐","🎀","💖","🌸","✦"];
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.textContent = pick(bits);
    const angle = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
    s.style.setProperty("--x", `${Math.cos(angle) * dist}px`);
    s.style.setProperty("--y", `${Math.sin(angle) * dist - 60}px`);
    s.style.setProperty("--r", `${Math.random() * 360 - 180}deg`);
    s.style.fontSize = `${20 + Math.random() * 22}px`;
    box.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

/* ---------- 효과음 (Web Audio로 합성, 파일 없음) ---------- */
const sfx = (() => {
  let ctx = null;
  const ac = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  function tone(freq, start, dur, { type = "sine", vol = .18, slideTo = null } = {}) {
    const c = ac(); if (!c || !settings.sfx) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(start, dur, { vol = .12, from = 800, to = 3000 } = {}) {
    const c = ac(); if (!c || !settings.sfx) return;
    const t0 = c.currentTime + start;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t0);
  }
  return {
    unlock: () => ac(),
    tap: () => { tone(520, 0, .09, { type: "triangle", slideTo: 880 }); tone(1040, .06, .12, { vol: .08 }); },
    swipe: () => noise(0, .28, { vol: .14, from: 500, to: 2600 }),
    boing: () => tone(330, 0, .35, { type: "sine", vol: .2, slideTo: 180 }),
    ready: () => { tone(1318, 0, .18, { vol: .07 }); tone(1760, .1, .25, { vol: .06 }); },
    pop: () => { tone(900, 0, .07, { type: "square", vol: .06, slideTo: 1800 }); noise(0, .06, { vol: .1, from: 2000, to: 5000 }); },
    correct: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .09, .28, { type: "triangle", vol: .15 })),
    wrong: () => { tone(392, 0, .16, { type: "triangle", vol: .12 }); tone(330, .14, .22, { type: "triangle", vol: .12 }); },
    fanfare: () => [523, 659, 784, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * .12, i === 6 ? .6 : .2, { type: "triangle", vol: .15 })),
    sparkle: () => [1568, 2093, 2637].forEach((f, i) => tone(f, i * .07, .2, { vol: .05 }))
  };
})();

/* ---------- 음성 (TTS) ---------- */
let voices = [];
function refreshVoices() { if ("speechSynthesis" in window) voices = speechSynthesis.getVoices(); }
refreshVoices();
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = refreshVoices;

function voiceFor(lang) {
  const list = voices.filter(v => v.lang.toLowerCase().replace("_", "-").startsWith(lang));
  const score = v => {
    const n = v.name.toLowerCase(); let s = 0;
    if (/premium|enhanced|natural|neural|siri|yuna|sora|heami|samantha/.test(n)) s += 10;
    if (/google|apple|microsoft/.test(n)) s += 4;
    if (/compact|espeak/.test(n)) s -= 10;
    if (/female|여/.test(n)) s += 1;
    return s;
  };
  return list.sort((a, b) => score(b) - score(a))[0];
}
let speechToken = 0;
let speaking = false;
// parts: [{ text, lang: "ko"|"en" }]
function say(parts, onDone) {
  const token = ++speechToken;
  const done = () => { if (token !== speechToken) return; speaking = false; onDone && onDone(); };
  if (!("speechSynthesis" in window)) { setTimeout(done, 1200); return; }
  speechSynthesis.cancel();
  refreshVoices();
  speaking = true;
  let i = 0;
  const next = () => {
    if (token !== speechToken) return;
    if (i >= parts.length) { done(); return; }
    const part = parts[i++];
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = part.lang === "en" ? "en-US" : "ko-KR";
    const v = voiceFor(part.lang === "en" ? "en" : "ko"); if (v) u.voice = v;
    u.rate = part.lang === "en" ? .85 : .9;
    u.pitch = 1.12;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(guard); setTimeout(next, 180); };
    // 일부 브라우저는 onend가 안 오므로 길이 기반 안전장치
    const guard = setTimeout(finish, 1500 + part.text.length * 160);
    u.onend = finish; u.onerror = finish;
    speechSynthesis.speak(u);
  };
  next();
}
function stopSpeech() { speechToken++; speaking = false; if ("speechSynthesis" in window) speechSynthesis.cancel(); }
const sayText = (text, onDone) => say([{ text, lang: uiLang() }], onDone);

function wordOf(card, lang = uiLang()) { return lang === "en" ? card.en : card.ko; }
function cardSpeech(card, withSound = settings.speech === "full") {
  const parts = [];
  if (settings.language === "en") {
    parts.push({ text: card.en, lang: "en" });
    if (withSound) parts.push({ text: card.enSay, lang: "en" });
  } else {
    parts.push({ text: card.ko, lang: "ko" });
    if (settings.language === "both") parts.push({ text: card.en, lang: "en" });
    if (withSound) parts.push({ text: card.koSay, lang: "ko" });
  }
  return parts;
}

/* ---------- 그림 그리기 ---------- */
const SHAPES = (() => {
  const poly = (n, r, cx, cy, rot = -90) => Array.from({ length: n }, (_, i) => {
    const a = (rot + i * 360 / n) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 40 : 92, a = (-90 + i * 36) * Math.PI / 180; return `${(100 + r * Math.cos(a)).toFixed(1)},${(106 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return {
    circle:    { fill: "#ff8fc0", el: `<circle cx="100" cy="100" r="82"/>`, face: [100, 105, 1] },
    triangle:  { fill: "#ffb86b", el: `<polygon points="100,16 188,174 12,174"/>`, face: [100, 128, .85] },
    square:    { fill: "#8fc8ff", el: `<rect x="24" y="24" width="152" height="152" rx="14"/>`, face: [100, 105, 1] },
    rectangle: { fill: "#9be3b4", el: `<rect x="8" y="48" width="184" height="104" rx="12"/>`, face: [100, 104, .9] },
    star:      { fill: "#ffd84d", el: `<polygon points="${star}"/>`, face: [100, 112, .75] },
    heart:     { fill: "#ff5f9e", el: `<path d="M100 178 C 34 128, 8 92, 30 54 C 52 18, 92 26, 100 58 C 108 26, 148 18, 170 54 C 192 92, 166 128, 100 178 Z"/>`, face: [100, 100, .9] },
    oval:      { fill: "#c9a7ff", el: `<ellipse cx="100" cy="100" rx="64" ry="88"/>`, face: [100, 106, .9] },
    diamond:   { fill: "#6fdad0", el: `<polygon points="100,8 180,100 100,192 20,100"/>`, face: [100, 104, .85] },
    crescent:  { fill: "#ffe066", el: `<path d="M126 18 A 84 84 0 1 0 126 182 A 64 64 0 1 1 126 18 Z"/>`, face: [66, 100, .7] },
    pentagon:  { fill: "#ffa3a3", el: `<polygon points="${poly(5, 90, 100, 108)}"/>`, face: [100, 112, .9] },
    hexagon:   { fill: "#ffc75f", el: `<polygon points="${poly(6, 90, 100, 100, 0)}"/>`, face: [100, 104, .95] }
  };
})();
function shapeSvg(key) {
  const s = SHAPES[key];
  const [fx, fy, k] = s.face;
  const face = `<g transform="translate(${fx} ${fy}) scale(${k})">
      <circle cx="-22" cy="-6" r="7" fill="#6b3a5e"/><circle cx="22" cy="-6" r="7" fill="#6b3a5e"/>
      <circle cx="-20" cy="-8" r="2.4" fill="#fff"/><circle cx="24" cy="-8" r="2.4" fill="#fff"/>
      <ellipse cx="-36" cy="10" rx="9" ry="5" fill="#ff6fa5" opacity=".45"/><ellipse cx="36" cy="10" rx="9" ry="5" fill="#ff6fa5" opacity=".45"/>
      <path d="M-10 8 q10 10 20 0" fill="none" stroke="#6b3a5e" stroke-width="5" stroke-linecap="round"/></g>`;
  return `<svg class="shape-visual" viewBox="0 0 200 200" aria-hidden="true">
    <g fill="${s.fill}" stroke="#6b3a5e" stroke-width="6" stroke-linejoin="round">${s.el}</g>
    <g fill="#fff" opacity=".45" transform="translate(-6 -6) scale(1)"><circle cx="62" cy="58" r="8"/></g>
    ${face}</svg>`;
}
let gradId = 0;
function colorSvg(color) {
  const id = `g${++gradId}`;
  let defs = "", fill = color;
  if (color === "rainbow") {
    defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${["#ff4d5e","#ff9a3c","#ffd43b","#46c26e","#3d86f5","#9a5cf0"].map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join("")}</linearGradient>`;
    fill = `url(#${id})`;
  } else if (color === "gold") {
    defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#f5c542"/><stop offset=".7" stop-color="#d99a14"/><stop offset="1" stop-color="#ffe27a"/></linearGradient>`;
    fill = `url(#${id})`;
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs>${defs}</defs>
    <path d="M100 14 C 142 10, 184 40, 186 88 C 190 134, 160 184, 106 186 C 56 190, 14 158, 14 108 C 12 58, 52 18, 100 14 Z" fill="${fill}" stroke="#6b3a5e" stroke-width="6"/>
    <ellipse cx="66" cy="60" rx="20" ry="12" fill="#fff" opacity=".5" transform="rotate(-30 66 60)"/></svg>`;
}
function cardVisual(card) {
  const type = card.cat.type;
  if (type === "shape") return shapeSvg(card.emoji);
  if (type === "color") return `<div class="color-visual">${colorSvg(card.extra)}${emojiImg(card.emoji, "", "")}</div>`;
  if (type === "number") {
    const n = card.extra, size = n <= 3 ? .2 : n <= 6 ? .15 : .12;
    return `<div class="number-visual"><div class="big-num">${n}</div><div class="count-grid" style="--item:${size}">${
      Array.from({ length: n }, (_, i) => emojiImg(card.emoji, "", "").replace("<img ", `<img style="animation-delay:${.15 + i * .07}s" `)).join("")}</div></div>`;
  }
  return emojiImg(card.emoji, "art", wordOf(card));
}

/* ---------- 화면 ---------- */
const screens = [...document.querySelectorAll(".screen")];
let currentScreen = "homeScreen";
function showScreen(id) {
  if (currentScreen === "bubbleScreen" && id !== "bubbleScreen") stopBubbles();
  if (currentScreen === "cardScreen" && id !== "cardScreen") stopReadyLoop();
  currentScreen = id;
  screens.forEach(s => s.classList.toggle("active", s.id === id));
  $("#backButton").classList.toggle("hidden", id === "homeScreen");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "homeScreen") { stopSpeech(); renderHome(); setTimeout(() => updater.applyIfIdle(), 600); }
}

function applyLanguage() {
  document.documentElement.lang = uiLang();
  $("#brandText").textContent = t("brand");
  $("#heroEyebrow").textContent = t("heroEyebrow");
  $("#heroTitle").innerHTML = t("heroTitle");
  $("#buddyWave").textContent = t("hello");
  $("#quizBannerTitle").textContent = t("quizTitle"); $("#quizBannerNote").textContent = t("quizNote");
  $("#bubbleBannerTitle").textContent = t("bubbleTitle"); $("#bubbleBannerNote").textContent = t("bubbleNote");
  $("#bubbleTitle").textContent = t("bubbleTitle");
  $("#categoryTitle").textContent = t("categoryTitle");
  $("#reviewTitle").textContent = t("reviewTitle"); $("#reviewNote").textContent = t("reviewNote");
  $("#soundLabel").textContent = t("listen"); $("#listenLabel").textContent = t("listen");
  $("#swipeHint").textContent = t("swipe");
  $("#settingsTitle").textContent = t("settings"); $("#categorySettingLabel").textContent = t("categorySetting");
  $("#fullscreenButton").textContent = t("fullscreen"); $("#installApp").textContent = t("install");
  $("#resetProgress").textContent = t("reset"); $("#saveSettings").textContent = t("save");
  $("#completionTitle").textContent = t("complete"); $("#completionNote").textContent = t("completeNote");
  $("#againSession").textContent = t("again"); $("#finishSession").textContent = t("finish");
  $("#stickerTitle").textContent = t("stickerTitle");
  renderHome();
  if (currentScreen === "cardScreen" && session) renderCard(false);
}

function renderHome() {
  $("#categoryGrid").innerHTML = CATS.filter(cat => enabledIds.includes(cat.id)).map(cat =>
    `<button class="category-card" data-id="${cat.id}" style="background:${cat.color}">${emojiImg(cat.cover, "", "")}<span class="cat-name">${esc(cat.names[uiLang() === "en" ? 1 : 0])}</span></button>`
  ).join("");
  const hasReview = Object.keys(mistakes).some(k => mistakes[k] > 0 && CARD_BY_KEY.has(k));
  $("#startReview").classList.toggle("hidden-el", !hasReview);
}
function updateStars(bump = false) {
  $("#starCount").textContent = stars;
  if (bump) { const el = $("#starButton"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
}
function addStar(n = 1) { stars += n; store.set("stars", stars); updateStars(true); sfx.sparkle(); }
function giveSticker() {
  const e = pick(STICKERS);
  stickers[e] = (stickers[e] || 0) + 1; store.set("stickers", stickers);
  return e;
}

/* ---------- 카드 세션 ---------- */
let session = null; // { cat, title, color, icon, cards, index, review }
let cardState = { shownAt: 0, spoken: false, tapped: false, ready: false };
let readyRaf = 0;

function openCategory(id) {
  const cat = CATS.find(c => c.id === id);
  startSession({ title: cat.names, color: cat.color, icon: cat.cover, pool: cat.cards, id });
  showCard([{ text: t("categoryIntro")(cat.names[uiLang() === "en" ? 1 : 0]), lang: uiLang() }]);
}
function startReview() {
  const hard = ALL_CARDS.filter(c => mistakes[c.key] > 0).sort((a, b) => mistakes[b.key] - mistakes[a.key]);
  if (!hard.length) { startQuiz(); return; }
  startSession({ title: [T.ko.reviewTitle, T.en.reviewTitle], color: "#ffe0cc", icon: "💝", pool: hard, review: true, ordered: true });
  showCard();
}
function startSession({ title, color, icon, pool, id, review = false, ordered = false }) {
  const list = ordered ? pool.slice(0, settings.sessionSize) : shuffle(pool).slice(0, settings.sessionSize);
  session = { id, title, color, icon, pool, cards: list, index: 0, review };
  cardState = { shownAt: performance.now(), spoken: false, tapped: false, ready: false };
  showScreen("cardScreen");
  renderCard(true);
  stopSpeech();
}
function renderCard(animate = true) {
  const card = session.cards[session.index];
  const el = $("#flashcard");
  el.style.background = card.cat.color;
  $("#categoryIcon").src = emojiSrc(session.icon);
  $("#categoryLabel").textContent = session.title[uiLang() === "en" ? 1 : 0];
  if (animate || !$("#cardArt").innerHTML) { $("#cardArt").innerHTML = cardVisual(card); animateIn($("#cardArt")); }
  const main = settings.language === "en" ? card.en : card.ko;
  $("#cardWord").textContent = main;
  $("#cardWord").classList.toggle("long", main.length > 6);
  $("#cardSub").textContent = settings.language === "both" ? card.en : "";
  $("#cardSound").textContent = settings.language === "en" ? card.enSay : card.koSay;
  $("#progressHearts").innerHTML = session.cards.map((_, i) =>
    `<span class="${i < session.index ? "on" : i === session.index ? "now" : ""}">♥</span>`).join("");
  $("#nextLabel").textContent = t("wait");
}
// 카드가 나타나면: 읽어주기 → 최소 시간 대기 → (옵션) 탭 → 넘기기 가능
function showCard(intro = []) {
  if (!session) return;
  cardState = { shownAt: performance.now(), spoken: false, tapped: false, ready: false };
  $("#flashcard").classList.remove("ready");
  $("#nextButton").classList.remove("ready");
  $("#nextFill").style.width = "0%";
  $("#nextLabel").textContent = t("wait");
  $("#tapFinger").classList.toggle("show", settings.tapFirst);
  speakCurrent(intro);
  startReadyLoop();
}
function speakCurrent(intro = []) {
  const card = session.cards[session.index];
  say([...intro, ...cardSpeech(card)], () => { cardState.spoken = true; });
}
function startReadyLoop() {
  stopReadyLoop();
  const dwell = PACE_MS[settings.pace] || 3000;
  const tick = () => {
    if (!session || cardState.ready) return;
    const elapsed = performance.now() - cardState.shownAt;
    const timeOk = elapsed >= dwell;
    const spokenOk = cardState.spoken || elapsed > dwell + 6000;
    const tapOk = !settings.tapFirst || cardState.tapped;
    let progress = Math.min(1, elapsed / dwell);
    if (!spokenOk) progress = Math.min(progress, .9);
    if (!tapOk) progress = Math.min(progress, .75);
    $("#nextFill").style.width = `${progress * 100}%`;
    if (timeOk && spokenOk && tapOk) { setReady(); return; }
    readyRaf = requestAnimationFrame(tick);
  };
  readyRaf = requestAnimationFrame(tick);
}
function stopReadyLoop() { cancelAnimationFrame(readyRaf); }
function setReady() {
  cardState.ready = true;
  $("#flashcard").classList.add("ready");
  $("#nextButton").classList.add("ready");
  $("#nextLabel").textContent = session.index === session.cards.length - 1 ? "🎀 " + t("next") : t("next") + " ▶";
  sfx.ready();
}
function nudge(text) {
  const el = $("#nudge");
  el.textContent = text; el.classList.add("show");
  clearTimeout(nudge.timer); nudge.timer = setTimeout(() => el.classList.remove("show"), 1400);
}
// 아직 넘길 수 없을 때: 카드가 흔들리고 다시 읽어줌
function blockedAdvance() {
  const el = $("#flashcard");
  el.classList.remove("wobble"); void el.offsetWidth; el.classList.add("wobble");
  sfx.boing();
  const needTap = settings.tapFirst && !cardState.tapped;
  nudge(needTap ? t("nudgeTap") : t("nudgeLook"));
  if (needTap) $("#tapFinger").classList.add("show");
  if (!speaking) speakCurrent();
}
function tryAdvance(dir = { x: 1, y: 0 }) {
  if (!session) return;
  if (!cardState.ready) { blockedAdvance(); return; }
  cardState.ready = false;
  const el = $("#flashcard");
  sfx.swipe();
  el.classList.add("fly");
  el.style.transform = `translate(${dir.x * 520}px, ${dir.y * 380}px) rotate(${dir.x * 18}deg)`;
  setTimeout(() => {
    el.classList.remove("fly"); el.style.transform = "";
    if (session.index >= session.cards.length - 1) { finishSession(); return; }
    session.index++;
    renderCard(true);
    showCard();
  }, 300);
}
function tapCard() {
  if (!session) return;
  sfx.tap();
  const art = $("#cardArt");
  art.classList.remove("boing"); void art.offsetWidth; art.classList.add("boing");
  cardState.tapped = true;
  $("#tapFinger").classList.remove("show");
  cardState.spoken = false;
  say(cardSpeech(session.cards[session.index], true), () => { cardState.spoken = true; });
}
function finishSession() {
  stopReadyLoop();
  if (session.review) session.cards.forEach(c => { if (mistakes[c.key]) mistakes[c.key] = Math.max(0, mistakes[c.key] - 1); });
  store.set("mistakes", mistakes);
  const e = giveSticker();
  addStar();
  $("#earnedSticker").src = emojiSrc(e); $("#earnedSticker").dataset.emoji = e; animate($("#earnedSticker"));
  toggleModal("#completionModal", true);
  sfx.fanfare(); confetti(28);
  sayText(t("completeSpeech"));
}

/* 드래그/스와이프 */
let drag = null, suppressClick = false;
const card = $("#flashcard");
card.addEventListener("pointerdown", e => {
  sfx.unlock();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: performance.now() };
  card.classList.add("dragging");
  card.setPointerCapture && card.setPointerCapture(e.pointerId);
});
card.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = (e.clientX - drag.x) / viewportFix.zoom(); drag.dy = (e.clientY - drag.y) / viewportFix.zoom();
  // 준비되기 전엔 거의 안 움직임(고무줄 저항)
  const k = cardState.ready ? 1 : .18;
  const dx = drag.dx * k, dy = drag.dy * k;
  card.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${Math.max(-10, Math.min(10, dx / 16))}deg)`;
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { dx, dy } = drag; drag = null;
  card.classList.remove("dragging");
  const dist = Math.hypot(dx, dy);
  if (dist > 70) {
    suppressClick = true;
    if (cardState.ready) {
      const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      tryAdvance(dir);
    } else { card.style.transform = ""; blockedAdvance(); }
  } else {
    card.style.transform = "";
    if (dist > 12) suppressClick = true;
  }
}
card.addEventListener("pointerup", endDrag);
card.addEventListener("pointercancel", endDrag);
card.addEventListener("click", () => { if (suppressClick) { suppressClick = false; return; } tapCard(); });
card.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapCard(); }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") tryAdvance({ x: e.key === "ArrowRight" ? 1 : -1, y: 0 });
});
$("#nextButton").addEventListener("click", () => tryAdvance({ x: 1, y: 0 }));
$("#soundButton").addEventListener("click", () => { sfx.tap(); tapCard(); });

/* ---------- 찾기 놀이 ---------- */
let quiz = null; // { answer, tries, locked }
function quizPool() {
  const cats = CATS.filter(c => enabledIds.includes(c.id));
  return cats.length ? cats : CATS;
}
function startQuiz() {
  showScreen("quizScreen");
  renderQuizScore();
  nextQuiz();
}
function nextQuiz() {
  const cats = quizPool();
  let answer;
  const hard = ALL_CARDS.filter(c => mistakes[c.key] > 0 && enabledIds.includes(c.cat.id));
  if (hard.length && Math.random() < .35) answer = pick(hard);
  else answer = pick(pick(cats).cards);
  const others = shuffle(answer.cat.cards.filter(c => c.key !== answer.key && c.emoji !== answer.emoji)).slice(0, 2);
  const choices = shuffle([answer, ...others]);
  quiz = { answer, tries: 0, locked: false };
  $("#quizFeedback").textContent = "";
  $("#quizGrid").innerHTML = choices.map(c => `<button class="quiz-choice" data-key="${esc(c.key)}" aria-label="${esc(wordOf(c))}">${cardVisual(c)}</button>`).join("");
  renderQuizPrompt();
  setTimeout(speakQuiz, 350);
}
function renderQuizPrompt() {
  if (!quiz) return;
  $("#quizPrompt").textContent = t("findPrompt")(wordOf(quiz.answer));
}
function speakQuiz() { if (quiz && currentScreen === "quizScreen") sayText(t("findPrompt")(wordOf(quiz.answer))); }
function renderQuizScore() {
  const n = quizStreak % 5;
  $("#quizScore").innerHTML = Array.from({ length: 5 }, (_, i) => i < n ? "💗" : "🤍").join("");
}
function answerQuiz(btn) {
  if (!quiz || quiz.locked) return;
  const a = quiz.answer;
  if (btn.dataset.key === a.key) {
    quiz.locked = true;
    btn.classList.add("correct");
    animateIn(btn);
    document.querySelectorAll(".quiz-choice").forEach(b => { if (b !== btn) b.classList.add("dim"); });
    if (mistakes[a.key]) { mistakes[a.key]--; store.set("mistakes", mistakes); }
    $("#quizFeedback").textContent = t("correctText");
    sfx.correct(); confetti(14); addStar();
    quizStreak++; store.set("quizStreak", quizStreak); renderQuizScore();
    const bonus = quizStreak % 5 === 0;
    say([{ text: pick(t("correct")), lang: uiLang() }, ...cardSpeech(a, false)], () => {
      if (bonus) {
        const e = giveSticker();
        $("#earnedSticker").src = emojiSrc(e); $("#earnedSticker").dataset.emoji = e; animate($("#earnedSticker"));
        $("#completionTitle").textContent = t("quizSticker");
        $("#completionNote").textContent = "";
        quiz.bonus = true;
        toggleModal("#completionModal", true); sfx.fanfare(); confetti(24);
        return;
      }
      setTimeout(() => { if (currentScreen === "quizScreen") nextQuiz(); }, 500);
    });
  } else {
    quiz.tries++;
    btn.classList.remove("wrong"); void btn.offsetWidth; btn.classList.add("wrong");
    sfx.wrong();
    mistakes[a.key] = (mistakes[a.key] || 0) + 1; store.set("mistakes", mistakes);
    if (quiz.tries >= 2) {
      const right = document.querySelector(`.quiz-choice[data-key="${CSS.escape(a.key)}"]`);
      right && right.classList.add("hint");
      $("#quizFeedback").textContent = t("hint")(wordOf(a));
      sayText(t("hint")(wordOf(a)));
    } else {
      $("#quizFeedback").textContent = t("retry");
      say([{ text: t("retry"), lang: uiLang() }, { text: t("findPrompt")(wordOf(a)), lang: uiLang() }]);
    }
  }
}
$("#quizGrid").addEventListener("click", e => { const b = e.target.closest(".quiz-choice"); if (b) { sfx.unlock(); answerQuiz(b); } });
$("#listenPrompt").addEventListener("click", () => { sfx.tap(); speakQuiz(); });

/* ---------- 비눗방울 놀이 ---------- */
let bubbleTimer = 0, bubbleCount = 0;
function bubblePool() {
  return quizPool().filter(c => !c.type).flatMap(c => c.cards);
}
function startBubbles() {
  bubbleCount = 0; $("#bubbleCount").textContent = "0";
  $("#bubbleField").innerHTML = "";
  showScreen("bubbleScreen");
  sayText(uiLang() === "en" ? "Pop the bubbles!" : "비눗방울을 톡톡 터뜨려 봐요!");
  spawnBubble();
  bubbleTimer = setInterval(() => { if ($("#bubbleField").children.length < 6) spawnBubble(); }, 1300);
}
function stopBubbles() { clearInterval(bubbleTimer); $("#bubbleField").innerHTML = ""; }
function spawnBubble() {
  const field = $("#bubbleField");
  const pool = bubblePool().length ? bubblePool() : ALL_CARDS.filter(c => !c.cat.type);
  const c = pick(pool);
  const fz = viewportFix.zoom(), fb = field.getBoundingClientRect();
  const w = fb.width / fz - 6, h = fb.height / fz - 6;
  const size = Math.round(Math.min(190, Math.max(110, w * .3)) * (.85 + Math.random() * .3));
  const b = document.createElement("button");
  b.className = "bubble";
  b.dataset.key = c.key;
  b.setAttribute("aria-label", wordOf(c));
  b.style.setProperty("--size", `${size}px`);
  b.style.setProperty("--dur", `${8 + Math.random() * 4}s`);
  b.style.setProperty("--sway", `${(Math.random() * 40 - 20).toFixed(0)}px`);
  b.style.setProperty("--field-h", `${h}px`);
  b.style.left = `${Math.random() * Math.max(0, w - size)}px`;
  b.innerHTML = emojiImg(c.emoji, "", "");
  b.addEventListener("animationend", ev => { if (ev.animationName === "rise") b.remove(); });
  field.appendChild(b);
}
$("#bubbleField").addEventListener("pointerdown", e => {
  const b = e.target.closest(".bubble");
  if (!b || b.classList.contains("popped")) return;
  sfx.unlock();
  const c = CARD_BY_KEY.get(b.dataset.key);
  const fr = $("#bubbleField").getBoundingClientRect(), br = b.getBoundingClientRect();
  // 현재 위치에 고정하고 터뜨림
  b.style.transform = getComputedStyle(b).transform;
  b.style.animation = "none"; void b.offsetWidth;
  b.classList.add("popped"); b.style.animation = "";
  setTimeout(() => b.remove(), 360);
  sfx.pop();
  const word = document.createElement("span");
  word.className = "pop-word"; word.textContent = wordOf(c);
  word.style.left = `${(br.left - fr.left + br.width / 2) / viewportFix.zoom()}px`; word.style.top = `${(br.top - fr.top + br.height / 2) / viewportFix.zoom()}px`;
  $("#bubbleField").appendChild(word); setTimeout(() => word.remove(), 1100);
  say(cardSpeech(c, false));
  bubbleCount++; $("#bubbleCount").textContent = bubbleCount;
  if (bubbleCount % 10 === 0) { addStar(); confetti(16); setTimeout(() => sayText(t("bubbleCheer")), 900); }
});

/* ---------- 설정 (보호자) ---------- */
const SETTING_ROWS = [
  { key: "language", label: ["언어", "Language"], options: [["ko", "한국어"], ["en", "English"], ["both", "한+영"]] },
  { key: "speech", label: ["읽어 주기", "Read aloud"], options: [["word", ["단어만", "Word only"]], ["full", ["단어+소리", "Word + sound"]]] },
  { key: "pace", label: ["다음 카드까지 기다리는 시간", "Wait before next card"], options: [["slow", ["천천히", "Slow"]], ["normal", ["보통", "Normal"]], ["fast", ["빠르게", "Fast"]]],
    desc: ["천천히 5초 · 보통 3초 · 빠르게 1.5초. 카드를 다 읽어 준 뒤에만 넘어가요.", "Slow 5s · Normal 3s · Fast 1.5s. Cards move on only after being read aloud."] },
  { key: "tapFirst", label: ["그림을 눌러야 넘어가기", "Tap picture before next"], options: [[true, ["켜기", "On"]], [false, ["끄기", "Off"]]],
    desc: ["넘기기 전에 그림을 한 번 콕 눌러야 해요. 스와이프만 하는 아이에게 좋아요.", "Child must tap the picture once before moving on."] },
  { key: "sessionSize", label: ["한 번에 보는 카드 수", "Cards per session"], options: [[5, "5"], [10, "10"], [15, "15"]] },
  { key: "sfx", label: ["효과음", "Sound effects"], options: [[true, ["켜기", "On"]], [false, ["끄기", "Off"]]] },
  { key: "motion", label: ["움직이는 그림", "Animated pictures"], options: [[true, ["켜기", "On"]], [false, ["끄기", "Off"]]],
    desc: ["카드 그림이 살아 움직여요. 데이터를 아끼려면 꺼 주세요.", "Card pictures move. Turn off to save data."] }
];
function renderSettings() {
  const li = uiLang() === "en" ? 1 : 0;
  $("#settingsBody").innerHTML = SETTING_ROWS.map(row => `
    <label class="setting-label">${row.label[li]}</label>
    <div class="setting-row">${row.options.map(([value, text]) =>
      `<button class="setting-choice ${settings[row.key] === value ? "selected" : ""}" data-key="${row.key}" data-value='${JSON.stringify(value)}'>${Array.isArray(text) ? text[li] : text}</button>`).join("")}</div>
    ${row.desc ? `<p class="setting-desc">${row.desc[li]}</p>` : ""}`).join("");
  $("#screenInfo").textContent = viewportFix.info();
  $("#categorySettings").innerHTML = CATS.map(cat =>
    `<button class="category-toggle ${enabledIds.includes(cat.id) ? "selected" : ""}" data-id="${cat.id}">${emojiImg(cat.cover, "", "")}${esc(cat.names[li])}</button>`).join("");
}
$("#settingsBody").addEventListener("click", e => {
  const b = e.target.closest(".setting-choice"); if (!b) return;
  settings[b.dataset.key] = JSON.parse(b.dataset.value);
  store.set("settings", settings);
  if (b.dataset.key === "language") applyLanguage();
  renderSettings();
});
$("#categorySettings").addEventListener("click", e => {
  const b = e.target.closest(".category-toggle"); if (!b) return;
  const id = b.dataset.id;
  enabledIds = enabledIds.includes(id) ? enabledIds.filter(x => x !== id) : [...enabledIds, id];
  if (!enabledIds.length) enabledIds = [id];
  store.set("enabled", enabledIds);
  renderSettings(); renderHome();
});
function toggleModal(id, show) {
  $(id).classList.toggle("show", show); $(id).setAttribute("aria-hidden", String(!show));
  if (!show) setTimeout(() => updater.applyIfIdle(), 600);
}

// 톱니바퀴: 아이가 실수로 열지 않도록 1.2초 꾹 누르기
(() => {
  const gear = $("#settingsButton");
  let timer = 0;
  const cancel = () => { clearTimeout(timer); gear.classList.remove("holding"); };
  gear.addEventListener("pointerdown", e => {
    e.preventDefault();
    gear.classList.add("holding");
    timer = setTimeout(() => { cancel(); renderSettings(); toggleModal("#settingsModal", true); }, 1200);
  });
  gear.addEventListener("pointerup", () => { if (gear.classList.contains("holding")) toast(t("holdGear")); cancel(); });
  gear.addEventListener("pointerleave", cancel);
  gear.addEventListener("pointercancel", cancel);
  gear.addEventListener("keydown", e => { if (e.key === "Enter") { renderSettings(); toggleModal("#settingsModal", true); } });
})();
$("#closeSettings").addEventListener("click", () => toggleModal("#settingsModal", false));
$("#saveSettings").addEventListener("click", () => { toggleModal("#settingsModal", false); if (currentScreen === "homeScreen") renderHome(); });
// confirm()이 막힌 환경이 있어 두 번 눌러 확인
let resetArmed = 0;
$("#resetProgress").addEventListener("click", () => {
  const btn = $("#resetProgress");
  if (Date.now() - resetArmed > 3000) {
    resetArmed = Date.now(); btn.textContent = t("resetConfirm");
    setTimeout(() => { if (Date.now() - resetArmed >= 3000) btn.textContent = t("reset"); }, 3100);
    return;
  }
  resetArmed = 0; btn.textContent = t("reset"); toast("✓");
  stars = 0; stickers = {}; mistakes = {}; quizStreak = 0;
  store.set("stars", 0); store.set("stickers", {}); store.set("mistakes", {}); store.set("quizStreak", 0);
  updateStars(); renderHome();
});
$("#fullscreenButton").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock("portrait").catch(() => {});
  } catch (_) {}
});
let installPromptEvent = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPromptEvent = e; $("#installApp").classList.remove("hidden-el"); });
window.addEventListener("appinstalled", () => $("#installApp").classList.add("hidden-el"));
$("#installApp").addEventListener("click", async () => {
  if (!installPromptEvent) { toast(t("installHelp"), 3500); return; }
  installPromptEvent.prompt();
  await installPromptEvent.userChoice.catch(() => {});
  installPromptEvent = null; $("#installApp").classList.add("hidden-el");
});

/* ---------- 스티커북 ---------- */
function openStickers() {
  const total = Object.values(stickers).reduce((a, b) => a + b, 0);
  $("#stickerNote").textContent = t("stickerNote")(total);
  $("#stickerBook").innerHTML = STICKERS.map(e => {
    const n = stickers[e] || 0;
    return `<div class="sticker-slot ${n ? "got" : "empty"}">${emojiImg(e, "", "")}${n > 1 ? `<b>${n}</b>` : ""}</div>`;
  }).join("");
  toggleModal("#stickerModal", true);
  sfx.sparkle();
}
$("#starButton").addEventListener("click", openStickers);
$("#closeStickers").addEventListener("click", () => toggleModal("#stickerModal", false));

/* ---------- 완료 모달 ---------- */
function closeCompletion() {
  toggleModal("#completionModal", false);
  $("#completionTitle").textContent = t("complete"); $("#completionNote").textContent = t("completeNote");
}
$("#againSession").addEventListener("click", () => {
  const wasQuiz = quiz && quiz.bonus;
  closeCompletion();
  if (wasQuiz) { quiz.bonus = false; nextQuiz(); return; }
  if (!session) return;
  startSession({ title: session.title, color: session.color, icon: session.icon, pool: session.pool, id: session.id, review: session.review });
  showCard();
});
$("#finishSession").addEventListener("click", () => { closeCompletion(); if (quiz) quiz.bonus = false; showScreen("homeScreen"); });

/* ---------- 홈 ---------- */
$("#categoryGrid").addEventListener("click", e => {
  const b = e.target.closest(".category-card"); if (!b) return;
  sfx.unlock(); sfx.tap(); openCategory(b.dataset.id);
});
$("#startQuiz").addEventListener("click", () => { sfx.unlock(); sfx.tap(); startQuiz(); });
$("#startBubbles").addEventListener("click", () => { sfx.unlock(); sfx.tap(); startBubbles(); });
$("#startReview").addEventListener("click", () => { sfx.unlock(); sfx.tap(); startReview(); });
$("#backButton").addEventListener("click", () => { sfx.tap(); showScreen("homeScreen"); });
$("#brand").addEventListener("click", () => showScreen("homeScreen"));
$("#heroBuddy").addEventListener("click", () => {
  sfx.unlock(); sfx.boing();
  const b = $("#heroBuddy"); b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop");
  sayText(pick(t("helloSpeech")));
});

document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());


updateStars();
applyLanguage();
/* ---------- 자동 업데이트 ----------
   설치된 앱은 메모리에 오래 남아 있으므로, 다시 열 때 앱 파일이 바뀌었는지 확인하고
   바뀌었으면 홈 화면에 있을 때(놀이 중이 아닐 때) 조용히 새로고침합니다. */
const updater = (() => {
  const FILES = ["js/app.js", "js/cards.js", "css/style.css"];
  let baseline = null, pending = false, hiddenAt = 0;
  const enabled = location.protocol.startsWith("http") && !window.EMOJI_DATA;
  async function fingerprint() {
    const texts = await Promise.all(FILES.map(f => fetch(f, { cache: "no-store" }).then(r => r.ok ? r.text() : Promise.reject())));
    let h = 0;
    for (const ch of texts.join("|")) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return h;
  }
  function busy() {
    return currentScreen !== "homeScreen" || document.querySelector(".modal-overlay.show");
  }
  function applyIfIdle() { if (pending && !busy()) location.reload(); }
  async function check() {
    if (!enabled || !navigator.onLine) return;
    try {
      const now = await fingerprint();
      if (baseline === null) { baseline = now; return; }
      if (now !== baseline) { pending = true; applyIfIdle(); }
    } catch (_) {}
  }
  if (enabled) setTimeout(check, 3000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); stopSpeech(); return; }
    if (Date.now() - hiddenAt > 30000) check();
  });
  return { applyIfIdle };
})();
if (!window.EMOJI_DATA && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("service-worker.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
