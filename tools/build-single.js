// 앱 전체(CSS, JS, 그림)를 HTML 파일 하나로 묶습니다. 모바일 미리보기/공유용.
// 사용법: node tools/build-single.js dist/kongkong-cards.html
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = process.argv[2] || path.join(root, "dist/kongkong-cards.html");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const dataUri = f => "data:image/webp;base64," + fs.readFileSync(path.join(root, f)).toString("base64");

const emojiDir = path.join(root, "img/emoji");
const emojiData = {};
for (const f of fs.readdirSync(emojiDir)) emojiData[f.replace(".webp", "")] = dataUri(`img/emoji/${f}`);

let html = read("index.html");
const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"))
  .replace(/<script src="js\/[^"]+"><\/script>\s*/g, "")
  .replace(/src="(img\/emoji\/[^"]+\.webp)"/g, (_, f) => `src="${dataUri(f)}"`);

const page = `<title>콩콩 카드</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">
<style>
${read("css/style.css")}
</style>
${body}
<script>window.EMOJI_DATA = ${JSON.stringify(emojiData)};</script>
<script>
${read("js/cards.js")}
</script>
<script>
${read("js/app.js")}
</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`${out} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
