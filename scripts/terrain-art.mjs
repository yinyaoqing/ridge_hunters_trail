// 地形紋理向量原稿（美術母檔）。全部為原創抽象筆觸：不取材任何真實紋樣、
// 民族圖騰或宗教符號；僅為自然質感的抽象化，符合 PEGI 3–7。
//
// 【關鍵設計】紋理一律「無色相」——只用白（高光）與黑（陰影）加透明度。
// 地圖色塊的色相來自 palette.ts 的 pal.terrain[type]，且隨難度循環三套配色；
// 若紋理自帶顏色會破壞循環，故紋理只負責「質感」，疊在色塊之上，色相仍由配色決定。
//
// 【無縫平鋪】圖樣以 3×3 位移重複後裁切到 64×64，確保四邊接合無縫。

const TILE = 64;

// 每種地形的圖樣內容（座標系 0..64；跨邊界的元素由 3×3 重複自動補齊）
const PATTERNS = {
  // 草地：細短草筆觸，疏落輕盈
  meadow: `
    <g stroke="#ffffff" fill="none" stroke-linecap="round" opacity="0.065">
      <path d="M6 22 Q7 16 5 11" stroke-width="1.2"/>
      <path d="M11 27 Q13 21 12 15" stroke-width="0.9"/>
      <path d="M23 13 Q24 7 21 2" stroke-width="1.1"/>
      <path d="M28 19 Q30 13 29 8" stroke-width="0.9"/>
      <path d="M38 31 Q39 25 36 20" stroke-width="1.2"/>
      <path d="M44 35 Q46 29 45 24" stroke-width="0.9"/>
      <path d="M54 20 Q55 13 52 8" stroke-width="1.1"/>
      <path d="M59 27 Q61 21 60 16" stroke-width="0.9"/>
      <path d="M14 53 Q15 46 12 41" stroke-width="1.2"/>
      <path d="M32 59 Q34 52 33 47" stroke-width="0.9"/>
      <path d="M47 55 Q48 48 45 43" stroke-width="1.1"/>
      <path d="M62 49 Q63 42 60 37" stroke-width="0.9"/>
    </g>
    <g fill="#000000" opacity="0.035">
      <ellipse cx="18" cy="38" rx="6" ry="2.4" transform="rotate(-8 18 38)"/>
      <ellipse cx="50" cy="10" rx="4.5" ry="1.8" transform="rotate(6 50 10)"/>
      <ellipse cx="36" cy="62" rx="5.5" ry="2.2" transform="rotate(-4 36 62)"/>
    </g>`,

  // 霧地：柔邊霧團（徑向漸層，非硬邊橢圓）＋橫向氣流，對比極低
  mist: `
    <g opacity="0.5">
      <ellipse cx="14" cy="16" rx="24" ry="11" fill="url(#fog)"/>
      <ellipse cx="50" cy="10" rx="18" ry="8" fill="url(#fog)"/>
      <ellipse cx="55" cy="41" rx="26" ry="12" fill="url(#fog)"/>
      <ellipse cx="10" cy="55" rx="20" ry="9" fill="url(#fog)"/>
      <ellipse cx="34" cy="29" rx="30" ry="13" fill="url(#fog)"/>
    </g>
    <g stroke="#ffffff" fill="none" opacity="0.03" stroke-linecap="round" stroke-width="1.4">
      <path d="M-4 25 Q16 20 34 25 Q52 30 68 24"/>
      <path d="M-4 47 Q14 42 30 47 Q48 53 68 46"/>
    </g>`,

  // 密叢：交纏的叢葉；團塊大小落差刻意拉大、位置打散，避免讀成規則點陣
  thicket: `
    <g fill="#000000" opacity="0.05">
      <ellipse cx="11" cy="13" rx="12" ry="7" transform="rotate(-16 11 13)"/>
      <ellipse cx="46" cy="20" rx="13" ry="7.5" transform="rotate(-7 46 20)"/>
      <ellipse cx="42" cy="49" rx="11" ry="6.5" transform="rotate(-12 42 49)"/>
      <ellipse cx="4" cy="58" rx="10" ry="5.5" transform="rotate(-4 4 58)"/>
    </g>
    <g fill="#000000" opacity="0.045">
      <ellipse cx="30" cy="6" rx="5" ry="3.4" transform="rotate(14 30 6)"/>
      <ellipse cx="20" cy="38" rx="4.2" ry="2.8" transform="rotate(-9 20 38)"/>
      <ellipse cx="62" cy="36" rx="5.5" ry="3.6" transform="rotate(8 62 36)"/>
      <ellipse cx="35" cy="63" rx="4.6" ry="3" transform="rotate(-11 35 63)"/>
      <ellipse cx="55" cy="59" rx="3.4" ry="2.4" transform="rotate(5 55 59)"/>
      <ellipse cx="24" cy="24" rx="3.2" ry="2.2" transform="rotate(-6 24 24)"/>
    </g>
    <g stroke="#ffffff" fill="none" opacity="0.05" stroke-linecap="round" stroke-width="1">
      <path d="M5 17 Q12 7 21 3"/><path d="M40 24 Q48 13 58 9"/>
      <path d="M36 53 Q44 42 53 39"/><path d="M-2 62 Q6 52 15 49"/>
    </g>
    <g stroke="#ffffff" fill="none" opacity="0.035" stroke-linecap="round" stroke-width="0.8">
      <path d="M26 10 Q31 4 37 2"/><path d="M58 39 Q63 32 69 30"/>
      <path d="M17 41 Q22 35 28 33"/><path d="M31 66 Q36 59 42 57"/>
    </g>`,

  // 岩坡：稜面裂線與受光邊，硬朗但不尖銳
  rock: `
    <g stroke="#000000" fill="none" opacity="0.055" stroke-linecap="round" stroke-width="1.1">
      <path d="M-4 14 L12 20 L26 10 L44 18 L58 8 L70 16"/>
      <path d="M-4 42 L10 34 L28 44 L46 36 L62 46 L70 40"/>
      <path d="M18 -4 L14 12 L22 26"/>
      <path d="M50 22 L54 38 L48 52"/>
      <path d="M32 44 L30 58 L38 68"/>
    </g>
    <g stroke="#ffffff" fill="none" opacity="0.04" stroke-linecap="round" stroke-width="0.9">
      <path d="M-4 16 L12 22 L26 12 L44 20"/>
      <path d="M10 36 L28 46 L46 38"/>
      <path d="M52 24 L56 40"/>
    </g>
`,
};

// 3×3 位移重複後裁切 → 四邊無縫接合
export function tileFor(type) {
  const pattern = PATTERNS[type];
  if (!pattern) throw new Error(`unknown terrain tile: ${type}`);
  const offsets = [-TILE, 0, TILE];
  let repeated = '';
  for (const dy of offsets) {
    for (const dx of offsets) {
      repeated += `<g transform="translate(${dx},${dy})">${pattern}</g>`;
    }
  }
  // SVG 根元素本身即裁切至 viewport（overflow hidden），故不需額外 clipPath：
  // 落在 0..64 之外的重複副本自然不會被畫出來。
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" width="${TILE}" height="${TILE}">
  <defs>
    <radialGradient id="fog" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.13"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>${repeated}</svg>`;
}

export const TERRAIN_TYPES = Object.keys(PATTERNS);
export const TILE_SIZE = TILE;
