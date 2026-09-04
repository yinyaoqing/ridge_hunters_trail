// 由 scripts/bestiary-wave2.mjs 產生：
//   · docs/design/Bestiary2.dc.html —— 設計畫布上的「生物剪影概念稿 · 第二波」方向板
//   · art/bestiary2/<id>.svg        —— 各生物的 SVG 母檔（供外部向量軟體再加工）
//
// 用法：node scripts/build-bestiary-board.mjs
// 純字串輸出，無外部相依；不觸碰 src/ 下的執行期資料。

import { mkdirSync, writeFileSync } from 'node:fs';
import { BESTIARY_WAVE2, TERRAIN_INK, TERRAIN_LABEL, KINGDOM_LABEL } from './bestiary-wave2.mjs';

const VIEW_BOX = '-52 -44 104 84';
const CLUE_GOLD = [0xd8, 0xc8, 0x74];

/** 單隻生物的獨立 SVG（已代入墨色與發光色）。 */
export function bestiarySvg(entry, { width = 208, height = 168 } = {}) {
  const body = entry.shape.replaceAll('INK', TERRAIN_INK[entry.terrain]).replaceAll('ACCENT', entry.accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" width="${width}" height="${height}">${body}\n</svg>`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 與線索金光的色距（規格書 §8.2：發光細節色不得與 #d8c874 相近）。 */
function distanceToClueGold(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [cr, cg, cb] = CLUE_GOLD;
  return Math.round(Math.hypot(r - cr, g - cg, b - cb));
}

function card(entry) {
  const svg = bestiarySvg(entry, { width: 150, height: 112 });
  return `      <div style="background: #1b2520; border-radius: 12px; padding: 13px 12px 15px; display: flex; flex-direction: column; align-items: center; gap: 7px;">
        ${svg}
        <div style="text-align: center;">
          <div style="font-family: 'Marcellus', Georgia, serif; font-size: 15px;">${entry.en}</div>
          <div style="font-size: 12px; color: #e8e3d2; opacity: 0.72;">${entry.zh}</div>
          <div style="font-size: 10.5px; color: #8a9a8c; margin-top: 4px; line-height: 1.5;">${entry.trait}</div>
          <div style="font-size: 10px; color: #6f7f72; margin-top: 3px;">取材：${entry.source.zh}</div>
          <div style="font-size: 9.5px; color: #6f7f72; margin-top: 2px; letter-spacing: 0.5px;">${KINGDOM_LABEL[entry.kingdom]}</div>
        </div>
      </div>`;
}

function section(terrain) {
  const list = BESTIARY_WAVE2.filter((e) => e.terrain === terrain);
  return `  <div style="display: flex; flex-direction: column; gap: 16px;">
    <div style="font-family: 'Marcellus', 'Noto Sans TC', Georgia, serif; font-size: 20px; border-bottom: 1px solid rgba(232,227,210,0.12); padding-bottom: 8px;">${TERRAIN_LABEL[terrain]} ${terrain[0].toUpperCase() + terrain.slice(1)} <span style="font-size: 12.5px; color: #8a9a8c; font-family: 'Karla', 'Noto Sans TC', sans-serif;">— ${list.length} 種；墨色 ${TERRAIN_INK[terrain]}</span></div>
    <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px;">
${list.map(card).join('\n')}
    </div>
  </div>`;
}

const accents = [...new Set(BESTIARY_WAVE2.map((e) => e.accent))].sort();
const minGoldDistance = Math.min(...accents.map(distanceToClueGold));

const board = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&amp;family=Karla:wght@400;500;700&amp;family=Noto+Sans+TC:wght@400;500;700&amp;display=swap">
  <style>
    body { margin: 0; background: #131a17; font-family: 'Karla', 'Noto Sans TC', 'Segoe UI', sans-serif; }
  </style>
</helmet>
<div style="width: 1180px; box-sizing: border-box; background: #131a17; color: #e8e3d2; display: flex; flex-direction: column; gap: 34px; padding: 48px 56px 56px;">

  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 12px; letter-spacing: 5px; color: #d8c874;">RIDGE HUNTER'S TRAIL</div>
    <div style="font-family: 'Marcellus', 'Noto Sans TC', Georgia, serif; font-size: 32px;">生物剪影概念稿 · 第二波 <span style="font-size: 17px; color: #8a9a8c;">Bestiary Wave 2 — ${BESTIARY_WAVE2.length} 種</span></div>
    <div style="font-size: 13.5px; line-height: 1.75; color: #8a9a8c; max-width: 860px;">延續美術方向板的剪影語彙：單色墨形＋單點發光細節、統一座標系 viewBox ${VIEW_BOX}、四種地形各 10 種。造型以地球既有生命的<b style="color:#a9a698;">結構</b>為骨架（原生生物、細菌、病毒、真菌、植物、無脊椎與少數脊椎動物），一律抽象化改寫、命名虛構；每張卡標註取材出處，供 §8.2 人工目視複查時對照。本批為概念稿，尚未併入執行期的生物表。</div>
  </div>

${['meadow', 'mist', 'thicket', 'rock'].map(section).join('\n\n')}

  <div style="display: flex; gap: 36px; align-items: flex-start;">
    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-family: 'Marcellus', 'Noto Sans TC', Georgia, serif; font-size: 20px; border-bottom: 1px solid rgba(232,227,210,0.12); padding-bottom: 8px;">發光細節色盤</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
${accents.map((a) => `        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #8a9a8c;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${a}; display: inline-block;"></span>${a}</div>`).join('\n')}
      </div>
      <div style="font-size: 12.5px; line-height: 1.8; color: #a9a698;">全部沿用三套配色循環既有的生物光色（冷光／暖光／幽光及其近鄰），與線索金光 #d8c874 的最短 RGB 色距為 <b>${minGoldDistance}</b>，維持「發光細節不得誤讀為線索」的判讀分界。</div>
    </div>
    <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-family: 'Marcellus', 'Noto Sans TC', Georgia, serif; font-size: 20px; border-bottom: 1px solid rgba(232,227,210,0.12); padding-bottom: 8px;">內容邊界（§2 / §8.2）</div>
      <div style="font-size: 12.5px; line-height: 1.85; color: #a9a698;">取材僅止於「結構層次」：體節、纖毛環、放射骨針、螺旋房室、菌絲網、冠毛等通用生物形式，不複製任何特定物種的可辨識輪廓，不取用文化紋樣或宗教符號。造型一律溫和無威嚇、無攻擊性特徵（PEGI 3–7）。量產（光柵化為 sprite）前仍須逐張人工目視複查。</div>
    </div>
  </div>

</div>
</x-dc>
</body>
</html>
`;

writeFileSync(new URL('../docs/design/Bestiary2.dc.html', import.meta.url), board);

const artDir = new URL('../art/bestiary2/', import.meta.url);
mkdirSync(artDir, { recursive: true });
for (const entry of BESTIARY_WAVE2) {
  writeFileSync(new URL(`${entry.id}.svg`, artDir), `${bestiarySvg(entry)}\n`);
}

console.log(`Bestiary2.dc.html + art/bestiary2/*.svg — ${BESTIARY_WAVE2.length} 種，最短金光色距 ${minGoldDistance}`);

// ── 選配：可分享的線上審稿頁（Artifact 用），node scripts/build-bestiary-board.mjs --review <path>
const reviewFlag = process.argv.indexOf('--review');
if (reviewFlag !== -1) {
  const out = process.argv[reviewFlag + 1];
  if (!out) throw new Error('--review 需要輸出路徑');
  writeFileSync(out, reviewPage());
  console.log(`審稿頁 → ${out}`);
}

/** 審稿頁：墨形以 CSS 變數帶入顏色，才能一鍵切「只看墨形」與「反白校對」。 */
function reviewCard(entry) {
  const body = entry.shape.replaceAll('INK', 'var(--ik)').replaceAll('ACCENT', 'var(--ac)');
  return `        <li class="spec" data-kingdom="${entry.kingdom}" style="--ac-src: ${entry.accent}; --ik-src: ${TERRAIN_INK[entry.terrain]}">
          <div class="plate"><svg viewBox="${VIEW_BOX}" role="img" aria-label="${entry.en} 剪影">${body}</svg></div>
          <h3>${entry.en}</h3>
          <p class="zh">${entry.zh}</p>
          <p class="trait">${entry.trait}</p>
          <p class="src"><span>取材</span>${entry.source.zh}<span class="lat">${entry.source.en}</span></p>
          <p class="meta"><span class="dot"></span><span class="king">${KINGDOM_LABEL[entry.kingdom]}</span><code>${entry.id}</code></p>
        </li>`;
}

function reviewSection(terrain) {
  const list = BESTIARY_WAVE2.filter((e) => e.terrain === terrain);
  return `    <section class="terrain" data-terrain="${terrain}">
      <div class="thead">
        <h2>${TERRAIN_LABEL[terrain]}<span class="lat">${terrain}</span></h2>
        <p class="tmeta"><span class="chip-ink" style="background:${TERRAIN_INK[terrain]}"></span>墨色 ${TERRAIN_INK[terrain]} · ${list.length} 種</p>
      </div>
      <ul class="grid">
${list.map(reviewCard).join('\n')}
      </ul>
    </section>`;
}

function reviewPage() {
  const kingdoms = [...new Set(BESTIARY_WAVE2.map((e) => e.kingdom))]
    .sort((a, b) => BESTIARY_WAVE2.filter((e) => e.kingdom === b).length - BESTIARY_WAVE2.filter((e) => e.kingdom === a).length);
  const counts = Object.fromEntries(kingdoms.map((k) => [k, BESTIARY_WAVE2.filter((e) => e.kingdom === k).length]));
  return `<title>Bestiary Wave Two</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Karla:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap">
<style>
  :root {
    --ground: #131a17; --plate: #1b2520; --sunk: #16211b;
    --paper: #e8e3d2; --sage: #8a9a8c; --dim: #6f7f72;
    --gold: #d8c874; --line: rgba(232,227,210,0.12);
    --serif: 'Marcellus', 'Noto Serif TC', Georgia, serif;
    --sans: 'Karla', 'Noto Sans TC', 'Segoe UI', sans-serif;
    --mono: ui-monospace, 'Cascadia Mono', 'Consolas', monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--paper); font-family: var(--sans);
         font-size: 15px; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1160px; margin: 0 auto; padding: 56px 28px 96px; display: flex; flex-direction: column; gap: 44px; }

  .eyebrow { font-size: 11px; letter-spacing: 5px; color: var(--gold); margin: 0; }
  h1 { font-family: var(--serif); font-size: clamp(30px, 4.6vw, 44px); font-weight: 400; margin: 10px 0 0;
       text-wrap: balance; line-height: 1.2; }
  h1 span { display: block; font-size: 0.42em; letter-spacing: 3px; color: var(--sage); margin-top: 10px; font-family: var(--sans); }
  .lede { max-width: 66ch; color: var(--sage); margin: 18px 0 0; }
  .lede b { color: var(--paper); font-weight: 500; }

  .facts { display: flex; flex-wrap: wrap; gap: 0; margin-top: 26px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .facts div { flex: 1 1 150px; padding: 16px 20px 15px; border-right: 1px solid var(--line); }
  .facts div:last-child { border-right: 0; }
  .facts dt { font-size: 10.5px; letter-spacing: 2.4px; color: var(--dim); text-transform: uppercase; }
  .facts dd { margin: 5px 0 0; font-family: var(--serif); font-size: 27px; font-variant-numeric: tabular-nums; }
  .facts dd small { font-size: 13px; color: var(--sage); font-family: var(--sans); margin-left: 5px; }

  .rail { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
  .rail .label { font-size: 10.5px; letter-spacing: 2.4px; color: var(--dim); text-transform: uppercase; margin-right: 4px; }
  button { font: inherit; font-size: 12.5px; color: var(--sage); background: transparent; cursor: pointer;
           border: 1px solid var(--line); border-radius: 999px; padding: 5px 13px; transition: color .18s, border-color .18s, background .18s; }
  button:hover { color: var(--paper); border-color: rgba(232,227,210,0.3); }
  button[aria-pressed="true"] { color: var(--ground); background: var(--paper); border-color: var(--paper); }
  button b { font-weight: 500; font-variant-numeric: tabular-nums; opacity: .55; margin-left: 5px; }
  button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .rail .sep { width: 1px; height: 20px; background: var(--line); margin: 0 6px; }

  .terrain { display: flex; flex-direction: column; gap: 18px; }
  .thead { display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
           border-bottom: 1px solid var(--line); padding-bottom: 9px; }
  h2 { font-family: var(--serif); font-size: 21px; font-weight: 400; margin: 0; }
  h2 .lat, .src .lat { font-family: var(--sans); font-size: 12px; letter-spacing: 2.6px;
                       text-transform: uppercase; color: var(--dim); margin-left: 11px; }
  .tmeta { margin: 0; font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 7px; font-variant-numeric: tabular-nums; }
  .chip-ink { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line); display: inline-block; }

  .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); }
  .spec { display: flex; flex-direction: column; gap: 3px; --ac: var(--ac-src); --ik: var(--ik-src); }
  .plate { background: var(--plate); border-radius: 12px; padding: 10px; margin-bottom: 9px;
           transition: background .2s; }
  .plate svg { display: block; width: 100%; height: auto; }
  h3 { font-family: var(--serif); font-size: 17px; font-weight: 400; margin: 0; }
  .zh { margin: 0; font-size: 13px; color: rgba(232,227,210,0.78); }
  .trait { margin: 5px 0 0; font-size: 12px; line-height: 1.6; color: var(--sage); }
  .src { margin: 7px 0 0; padding-top: 7px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--dim); }
  .src > span:first-child { letter-spacing: 2px; margin-right: 7px; color: rgba(232,227,210,0.32); }
  .src .lat { display: block; margin: 2px 0 0; font-size: 9.5px; letter-spacing: 1.6px; }
  .meta { margin: 6px 0 0; display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--dim); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ac); flex: none; }
  .meta code { font-family: var(--mono); font-size: 10.5px; margin-left: auto; color: rgba(232,227,210,0.28); }

  body.ink-only .spec { --ac: var(--ik-src); }
  body.proof .plate { background: var(--paper); }
  body.proof .spec { --ik: #101610; }
  .spec[hidden] { display: none; }
  .terrain[hidden] { display: none; }

  .notes { display: grid; gap: 30px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
           border-top: 1px solid var(--line); padding-top: 30px; }
  .notes h4 { font-family: var(--serif); font-size: 17px; font-weight: 400; margin: 0 0 12px; }
  .notes p { margin: 0; font-size: 13px; line-height: 1.8; color: var(--sage); max-width: 60ch; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .swatches span { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--dim); font-family: var(--mono); }
  .swatches i { width: 15px; height: 15px; border-radius: 4px; display: block; }
  ol { margin: 0; padding-left: 0; list-style: none; counter-reset: step; display: flex; flex-direction: column; gap: 11px; }
  ol li { counter-increment: step; position: relative; padding-left: 30px; font-size: 13px; line-height: 1.7; color: var(--sage); }
  ol li::before { content: counter(step); position: absolute; left: 0; top: 1px; width: 20px; height: 20px;
                  border: 1px solid var(--line); border-radius: 50%; display: grid; place-items: center;
                  font-size: 10.5px; color: var(--gold); font-variant-numeric: tabular-nums; }
  ol code, .notes code, .lede code { font-family: var(--mono); font-size: 11.5px; color: rgba(232,227,210,0.72); }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media (max-width: 620px) { .wrap { padding: 40px 18px 64px; } .facts div { flex-basis: 50%; } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">RIDGE HUNTER'S TRAIL · ART DIRECTION</p>
    <h1>生物剪影概念稿 · 第二波<span>BESTIARY WAVE TWO</span></h1>
    <p class="lede">延續美術方向板的剪影語彙：<b>單色墨形＋單點發光細節</b>，同一組座標系 <code>viewBox ${VIEW_BOX}</code>，四種地形各 10 種。造型以地球既有生命的<b>結構</b>為骨架——體節、纖毛環、放射骨針、螺旋房室、菌絲網、冠毛——一律抽象化改寫、命名虛構；每張卡標註取材出處，供規格書 §8.2 人工目視複查時對照。</p>
    <dl class="facts">
      <div><dt>剪影</dt><dd>${BESTIARY_WAVE2.length}<small>種</small></dd></div>
      <div><dt>地形分布</dt><dd>10<small>× 4</small></dd></div>
      <div><dt>取材界別</dt><dd>${kingdoms.length}<small>類</small></dd></div>
      <div><dt>與線索金光最短色距</dt><dd>${minGoldDistance}<small>RGB</small></dd></div>
    </dl>
  </header>

  <div class="rail">
    <span class="label">界別</span>
    <button type="button" data-filter="all" aria-pressed="true">全部<b>${BESTIARY_WAVE2.length}</b></button>
${kingdoms.map((k) => `    <button type="button" data-filter="${k}" aria-pressed="false">${KINGDOM_LABEL[k]}<b>${counts[k]}</b></button>`).join('\n')}
    <span class="sep"></span>
    <button type="button" id="inkOnly" aria-pressed="false">只看墨形</button>
    <button type="button" id="proof" aria-pressed="false">反白校對</button>
  </div>

${['meadow', 'mist', 'thicket', 'rock'].map(reviewSection).join('\n\n')}

  <div class="notes">
    <div>
      <h4>發光細節色盤</h4>
      <div class="swatches">
${accents.map((a) => `        <span><i style="background:${a}"></i>${a}</span>`).join('\n')}
      </div>
      <p>全部沿用三套配色循環既有的生物光色（冷光／暖光／幽光及其近鄰）。與線索金光 <code>#d8c874</code> 的最短 RGB 色距為 ${minGoldDistance}，等同既有生物中最靠近金光的羽尾獸，維持「發光細節不得誤讀為線索」的判讀分界。</p>
    </div>
    <div>
      <h4>內容邊界（§2 / §8.2）</h4>
      <p>取材僅止於結構層次，不複製任何特定物種的可辨識輪廓，不取用文化紋樣或宗教符號；造型一律溫和無威嚇、無攻擊性特徵（PEGI 3–7）。「反白校對」把墨形放到紙白底上，是量產前逐張目視複查的第一關。</p>
    </div>
    <div>
      <h4>要讓其中一隻真的進遊戲</h4>
      <ol>
        <li>把造型搬進 <code>src/data/silhouettes.ts</code> 的 <code>SHAPES</code></li>
        <li>在 <code>src/data/creatures.ts</code> 補雙語敘述與 <code>quirkHints</code>（個性提示會改寫生成參數）</li>
        <li>讓 <code>tests/solvability.test.ts</code> 的可解性掃描通過——每種生物在每個難度層都要有 96% 以上的理想路線走得完</li>
      </ol>
    </div>
  </div>
</div>

<script>
  const specs = [...document.querySelectorAll('.spec')];
  const sections = [...document.querySelectorAll('.terrain')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  filters.forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.filter;
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    specs.forEach((s) => { s.hidden = key !== 'all' && s.dataset.kingdom !== key; });
    sections.forEach((sec) => {
      sec.hidden = ![...sec.querySelectorAll('.spec')].some((s) => !s.hidden);
    });
  }));
  const toggle = (id, cls) => {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      document.body.classList.toggle(cls, on);
    });
  };
  toggle('inkOnly', 'ink-only');
  toggle('proof', 'proof');
</script>
`;
}
