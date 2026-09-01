// 素材產生器：把向量母檔輸出為遊戲用 PNG，並檢查 docs/ASSETS.md §4 的體積預算。
//
//   生物 sprite  scripts/creature-art.mjs → art/creatures/<id>.svg  + public/assets/creatures/<id>.png
//   地形紋理     scripts/terrain-art.mjs  → art/terrain/<type>.svg  + public/assets/terrain/<type>.png
//
// 執行方式（光柵器僅為建置期工具，刻意不寫進 package.json 相依，
// 以維持遊戲執行期的零額外相依）：
//   npm i --no-save @resvg/resvg-js
//   node scripts/build-assets.mjs
//   npm r --no-save @resvg/resvg-js

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CREATURE_IDS, svgFor } from './creature-art.mjs';
import { TERRAIN_TYPES, TILE_SIZE, tileFor } from './terrain-art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

// 兩類素材的規格（尺寸與單檔上限對照 docs/ASSETS.md §1、§2、§4）
const GROUPS = [
  {
    label: '生物 sprite',
    names: CREATURE_IDS,
    svg: svgFor,
    size: 128,
    maxBytes: 64 * KB,
    svgDir: join(ROOT, 'art', 'creatures'),
    pngDir: join(ROOT, 'public', 'assets', 'creatures'),
  },
  {
    label: '地形紋理',
    names: TERRAIN_TYPES,
    svg: tileFor,
    size: TILE_SIZE,
    maxBytes: 32 * KB,
    svgDir: join(ROOT, 'art', 'terrain'),
    pngDir: join(ROOT, 'public', 'assets', 'terrain'),
  },
];

let failed = false;
let total = 0;

for (const g of GROUPS) {
  mkdirSync(g.svgDir, { recursive: true });
  mkdirSync(g.pngDir, { recursive: true });
  console.log(`\n${g.label}（${g.size}×${g.size}，單檔上限 ${g.maxBytes / KB} KB）`);

  for (const name of g.names) {
    const svg = g.svg(name);
    writeFileSync(join(g.svgDir, `${name}.svg`), svg, 'utf8');

    const png = new Resvg(svg, { fitTo: { mode: 'width', value: g.size } }).render().asPng();
    const pngPath = join(g.pngDir, `${name}.png`);
    writeFileSync(pngPath, png);

    const bytes = statSync(pngPath).size;
    total += bytes;
    const ok = bytes <= g.maxBytes;
    if (!ok) failed = true;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(13)} ${String(bytes).padStart(6)} B` +
      `${ok ? '' : `  超出 ${g.maxBytes} B 上限`}`);
  }
}

if (failed) {
  console.error('\n有素材超出體積預算（docs/ASSETS.md §4）。');
  process.exit(1);
}
console.log(`\n完成：${GROUPS.reduce((n, g) => n + g.names.length, 0)} 個檔案，` +
  `合計 ${(total / KB).toFixed(1)} KB。SVG 母檔於 art/、PNG 於 public/assets/。`);
