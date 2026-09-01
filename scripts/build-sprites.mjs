// 生物 sprite 產生器：將 scripts/creature-art.mjs 的向量母檔輸出為
// art/creatures/<id>.svg（可編輯母檔）與 public/assets/creatures/<id>.png（遊戲用素材）。
//
// 執行方式（光柵器僅為建置期工具，刻意不寫進 package.json 相依）：
//   npm i --no-save @resvg/resvg-js
//   node scripts/build-sprites.mjs
//   npm r --no-save @resvg/resvg-js
//
// 規格見 docs/ASSETS.md：128×128、PNG 透明背景、單檔 ≤ 64 KB。

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CREATURE_IDS, svgFor } from './creature-art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_DIR = join(ROOT, 'art', 'creatures');
const PNG_DIR = join(ROOT, 'public', 'assets', 'creatures');
const SIZE = 128;
const MAX_BYTES = 64 * 1024;

mkdirSync(SVG_DIR, { recursive: true });
mkdirSync(PNG_DIR, { recursive: true });

let failed = false;
for (const id of CREATURE_IDS) {
  const svg = svgFor(id);
  writeFileSync(join(SVG_DIR, `${id}.svg`), svg, 'utf8');

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
  const pngPath = join(PNG_DIR, `${id}.png`);
  writeFileSync(pngPath, png);

  const bytes = statSync(pngPath).size;
  const ok = bytes <= MAX_BYTES;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(13)} ${String(bytes).padStart(6)} B` +
    `${ok ? '' : `  超出 ${MAX_BYTES} B 上限`}`);
}

if (failed) {
  console.error('\n有素材超出體積預算（docs/ASSETS.md §4）。');
  process.exit(1);
}
console.log(`\n完成：${CREATURE_IDS.length} 隻生物，SVG 母檔於 art/creatures/、PNG 於 public/assets/creatures/。`);
