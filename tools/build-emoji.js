// 카드에 쓰인 이모지의 3D 이미지(Microsoft Fluent Emoji, MIT)를 img/emoji/로 복사합니다.
// 사용법:
//   curl -sO https://registry.npmjs.org/@lobehub/fluent-emoji-3d/-/fluent-emoji-3d-1.1.0.tgz
//   tar xzf fluent-emoji-3d-1.1.0.tgz
//   node tools/build-emoji.js package/assets
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = process.argv[2];
if (!src) { console.error("usage: node tools/build-emoji.js <fluent-emoji-3d assets dir>"); process.exit(1); }
const root = path.join(__dirname, "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/cards.js"), "utf8"), sandbox);
const ui = require("./ui-emoji.json");

const code = emoji => [...emoji].map(ch => ch.codePointAt(0).toString(16)).join("-");
const key = emoji => code(emoji).split("-").filter(part => part !== "fe0f").join("-");

const wanted = new Set(ui);
for (const category of sandbox.window.CATEGORIES) {
  wanted.add(category.cover);
  for (const card of category.cards) if (category.type !== "shape") wanted.add(card[0]);
}
const files = fs.readdirSync(src);
const byKey = new Map(files.map(file => [file.replace(".webp", "").split("-").filter(p => p !== "fe0f").join("-"), file]));
const out = path.join(root, "img/emoji");
fs.mkdirSync(out, { recursive: true });
const missing = [];
for (const emoji of wanted) {
  const file = byKey.get(key(emoji));
  if (!file) { missing.push(`${emoji} ${code(emoji)}`); continue; }
  fs.copyFileSync(path.join(src, file), path.join(out, `${key(emoji)}.webp`));
}
console.log(`copied ${wanted.size - missing.length} images`);
if (missing.length) { console.error("missing:\n" + missing.join("\n")); process.exit(1); }
