"""카드용 움직이는 3D 그림(Microsoft Fluent Emoji Animated, MIT)을 img/anim/에 만듭니다.

img/emoji/에 있는 그림 중 카드·스티커에 쓰이는 것만 골라, 프레임을 절반으로 줄이고
화질을 조금 낮춰 용량을 절반 정도로 줄입니다.

사용법:
  for n in 1 2 3 4; do
    curl -sO https://registry.npmjs.org/@lobehub/fluent-emoji-anim-$n/-/fluent-emoji-anim-$n-1.0.0.tgz
    tar xzf fluent-emoji-anim-$n-1.0.0.tgz --strip-components=2 -C anim-src --wildcards 'package/assets/*.webp'
  done
  pip install pillow
  python3 tools/build-anim.py anim-src
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageSequence

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
out = os.path.join(root, "img/anim")
os.makedirs(out, exist_ok=True)

def key(name):
    return "-".join(p for p in name.split("-") if p != "fe0f")

# 카드 데이터에서 일반 카드(색·모양·숫자 제외)의 이모지와 스티커 목록을 가져옴
script = "const vm=require('vm'),fs=require('fs');const s={window:{}};vm.runInNewContext(fs.readFileSync('js/cards.js','utf8'),s);" \
         "const k=e=>[...e].map(c=>c.codePointAt(0).toString(16)).filter(c=>c!=='fe0f').join('-');" \
         "console.log(JSON.stringify(s.window.CATEGORIES.filter(c=>!c.type).flatMap(c=>c.cards.map(x=>k(x[0])))))"
wanted = set(json.loads(subprocess.check_output(["node", "-e", script], cwd=root)))
app = open(os.path.join(root, "js/app.js"), encoding="utf8").read()
stickers = re.search(r"const STICKERS = (\[.*?\]);", app).group(1)
wanted |= {"-".join(f"{ord(c):x}" for c in e if ord(c) != 0xFE0F) for e in json.loads(stickers)}

files = {key(f[:-5]): f for f in os.listdir(src) if f.endswith(".webp")}
missing, total = [], 0
for k in sorted(wanted):
    if k not in files:
        missing.append(k); continue
    dest = os.path.join(out, f"{k}.webp")
    if not os.path.exists(dest):
        im = Image.open(os.path.join(src, files[k]))
        frames = [f.convert("RGBA").copy() for f in ImageSequence.Iterator(im)][::2]
        frames[0].save(dest, save_all=True, append_images=frames[1:], duration=84, loop=0, quality=55, method=4)
    total += os.path.getsize(dest)
print(f"{len(wanted) - len(missing)} animated images, {total / 1e6:.1f} MB")
if missing:
    print("missing:", missing); sys.exit(1)
