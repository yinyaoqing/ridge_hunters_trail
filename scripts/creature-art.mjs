// 生物 sprite 向量原稿（美術母檔）。全部為原創虛構造型：不取材任何真實物種、
// 民族紋樣或宗教符號；造型溫和無威嚇，符合 PEGI 3–7。
// 風格延續水墨方向：深墨剪影＋頂光邊緣＋單一發光細節（accent = creatures.ts 的 color）。
// 產出由 scripts/build-sprites.mjs 光柵化為 128×128 PNG。
//
// 座標系：viewBox 0 0 128 128，地面線約 y=98，主體約佔 112px。

const INK_DEEP = '#0d1418';
const INK_BODY = '#1b262b';
const INK_LIGHT = '#2e3f45';

export const CREATURE_ART = {
  // 霧絨鹿：細長溫馴的食草獸，背線化入霧氣；頭冠為柔軟捲鬚，非任何真實鹿角形制
  mistfawn: {
    accent: '#9ad1c8',
    body: `
      <ellipse cx="52" cy="92" rx="32" ry="5" fill="url(#shade)"/>
      <path d="M22 66 Q18 48 34 42 Q52 34 70 40 Q78 30 86 26 Q88 16 92 12 Q94 20 92 26
               Q100 22 104 26 Q100 32 94 34 Q98 42 90 46 Q80 50 70 48 Q56 56 40 56
               Q26 58 22 66 Z" fill="url(#bodyGrad)"/>
      <path d="M22 66 Q26 58 40 56 Q56 56 70 48 Q80 50 90 46 Q86 52 74 56
               Q56 64 38 64 Q26 64 22 66 Z" fill="${INK_DEEP}" opacity="0.55"/>
      <path d="M27 54 Q31 54 32 58 L34 88 Q34 91 31 91 Q29 91 29 88 L27 60 Z" fill="url(#legGrad)"/>
      <path d="M40 55 Q44 55 44 59 L45 89 Q45 92 42 92 Q40 92 40 89 L39 61 Z" fill="url(#legGrad)"/>
      <path d="M58 52 Q62 52 62 56 L63 88 Q63 91 60 91 Q58 91 58 88 L57 58 Z" fill="url(#legGrad)"/>
      <path d="M68 50 Q72 50 72 54 L73 88 Q73 91 70 91 Q68 91 68 88 L67 56 Z" fill="url(#legGrad)"/>
      <path d="M22 62 Q12 60 10 52 Q18 54 22 60 Z" fill="${INK_BODY}"/>
      <path d="M86 24 Q84 12 90 6" stroke="ACCENT" stroke-width="2" fill="none"
            stroke-linecap="round" opacity="0.75"/>
      <path d="M92 22 Q96 12 104 10" stroke="ACCENT" stroke-width="2" fill="none"
            stroke-linecap="round" opacity="0.6"/>
      <circle cx="94" cy="30" r="2.4" fill="ACCENT"/>
      <circle cx="94" cy="30" r="5.5" fill="ACCENT" opacity="0.22"/>
      <g fill="ACCENT" opacity="0.3">
        <circle cx="16" cy="70" r="6"/><circle cx="8" cy="62" r="4"/><circle cx="20" cy="80" r="3"/>
      </g>`,
  },

  // 燼棘獸：低矮圓潤的岩地生物，柔軟鈍棘於暮色泛暖光；棘為圓頭無尖銳感
  emberquill: {
    accent: '#e0955f',
    body: `
      <ellipse cx="64" cy="96" rx="34" ry="5" fill="url(#shade)"/>
      <path d="M30 88 Q26 60 50 50 Q72 42 92 54 Q106 62 104 88 Z" fill="url(#bodyGrad)"/>
      <path d="M92 60 Q108 58 112 68 Q110 78 98 78 Q92 72 92 60 Z" fill="url(#bodyGrad)"/>
      <path d="M30 88 Q34 74 56 70 Q82 66 104 76 L104 88 Z" fill="${INK_DEEP}" opacity="0.5"/>
      <g stroke="ACCENT" stroke-width="3.2" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M42 54 Q38 44 40 36"/><path d="M54 48 Q52 36 56 28"/>
        <path d="M68 45 Q70 33 76 26"/><path d="M82 48 Q88 38 96 34"/>
      </g>
      <g fill="ACCENT">
        <circle cx="40" cy="35" r="2.6"/><circle cx="56" cy="27" r="2.8"/>
        <circle cx="76" cy="25" r="2.6"/><circle cx="96" cy="33" r="2.4"/>
      </g>
      <g fill="ACCENT" opacity="0.2">
        <circle cx="40" cy="35" r="7"/><circle cx="56" cy="27" r="7.5"/>
        <circle cx="76" cy="25" r="7"/><circle cx="96" cy="33" r="6.5"/>
      </g>
      <rect x="42" y="82" width="6" height="12" rx="3" fill="${INK_DEEP}"/>
      <rect x="82" y="82" width="6" height="12" rx="3" fill="${INK_DEEP}"/>
      <circle cx="102" cy="68" r="2.2" fill="ACCENT"/>
      <g fill="ACCENT" opacity="0.35"><circle cx="34" cy="22" r="2"/><circle cx="64" cy="14" r="1.6"/></g>`,
  },

  // 織叢雀：密叢中以銀藤織巢的小型棲禽；喙短鈍，無猛禽特徵
  thicketloom: {
    accent: '#7ba05b',
    body: `
      <path d="M10 22 Q40 14 78 22 Q104 28 120 22" stroke="${INK_LIGHT}" stroke-width="3.5"
            fill="none" stroke-linecap="round" opacity="0.85"/>
      <path d="M42 20 Q40 30 44 40 Q48 30 46 19" fill="${INK_LIGHT}" opacity="0.55"/>
      <path d="M90 24 Q94 34 90 42 Q86 32 88 23" fill="${INK_LIGHT}" opacity="0.45"/>
      <path d="M56 74 Q40 82 26 100 Q44 94 58 84 Z" fill="${INK_BODY}"/>
      <path d="M60 78 Q48 92 40 110 Q56 100 66 86 Z" fill="${INK_BODY}" opacity="0.8"/>
      <path d="M78 40 Q58 42 54 60 Q50 78 64 86 Q80 92 90 80 Q98 66 92 52 Q88 42 78 40 Z"
            fill="url(#bodyGrad)"/>
      <path d="M54 60 Q50 78 64 86 Q80 92 90 80 Q78 84 68 78 Q56 70 54 60 Z"
            fill="${INK_DEEP}" opacity="0.5"/>
      <path d="M62 56 Q76 54 88 62 Q80 74 68 72 Q60 66 62 56 Z" fill="${INK_DEEP}" opacity="0.4"/>
      <path d="M88 46 Q94 34 106 32 Q112 40 108 50 Q100 56 90 54 Z" fill="url(#bodyGrad)"/>
      <path d="M108 44 Q118 44 120 48 Q116 52 107 50 Z" fill="${INK_LIGHT}"/>
      <path d="M84 40 Q86 30 92 26" stroke="ACCENT" stroke-width="1.8" fill="none"
            stroke-linecap="round" opacity="0.55"/>
      <path d="M74 88 Q74 98 76 104" stroke="#8d9aa2" stroke-width="1.4" fill="none" opacity="0.7"/>
      <path d="M68 104 Q76 98 84 104 Q86 114 76 116 Q66 114 68 104 Z"
            fill="${INK_BODY}" opacity="0.95"/>
      <g stroke="ACCENT" stroke-width="1" fill="none" opacity="0.45" stroke-linecap="round">
        <path d="M69 107 Q76 111 83 107"/><path d="M70 112 Q76 115 82 112"/>
      </g>
      <circle cx="102" cy="42" r="2.4" fill="ACCENT"/>
      <circle cx="102" cy="42" r="5.5" fill="ACCENT" opacity="0.22"/>
      <g fill="ACCENT" opacity="0.28"><circle cx="76" cy="110" r="7"/><circle cx="44" cy="24" r="2.2"/></g>`,
  },

  // 露躍獸：草地上輕盈彈跳的小獸；耳為短圓鰭狀，露珠環繞
  dewhopper: {
    accent: '#8fb8de',
    body: `
      <ellipse cx="64" cy="102" rx="26" ry="4" fill="url(#shade)"/>
      <path d="M34 74 Q30 54 50 46 Q72 38 90 48 Q104 56 100 74 Q94 86 76 88
               Q54 90 42 84 Q34 80 34 74 Z" fill="url(#bodyGrad)"/>
      <path d="M34 74 Q42 82 60 86 Q80 88 100 74 Q96 86 76 88 Q54 90 42 84 Z"
            fill="${INK_DEEP}" opacity="0.5"/>
      <path d="M36 78 Q22 76 18 62 Q30 62 38 72 Z" fill="${INK_BODY}"/>
      <path d="M40 84 Q34 96 44 100 Q52 98 50 88 Z" fill="${INK_BODY}"/>
      <path d="M86 84 Q84 96 92 98 Q98 94 94 84 Z" fill="${INK_BODY}" opacity="0.85"/>
      <path d="M93 44 Q98 28 108 22 Q107 36 100 47 Z" fill="url(#legGrad)"/>
      <path d="M96 45 Q102 33 107 27" stroke="ACCENT" stroke-width="1.4" fill="none"
            stroke-linecap="round" opacity="0.35"/>
      <path d="M83 41 Q82 26 88 18 Q92 30 90 44 Z" fill="url(#legGrad)" opacity="0.92"/>
      <path d="M86 40 Q86 29 88 23" stroke="ACCENT" stroke-width="1.4" fill="none"
            stroke-linecap="round" opacity="0.3"/>
      <circle cx="96" cy="58" r="2.4" fill="ACCENT"/>
      <circle cx="96" cy="58" r="5.5" fill="ACCENT" opacity="0.22"/>
      <g fill="ACCENT">
        <circle cx="24" cy="46" r="3.4" opacity="0.75"/>
        <circle cx="16" cy="58" r="2.4" opacity="0.55"/>
        <circle cx="110" cy="80" r="3" opacity="0.65"/>
        <circle cx="118" cy="66" r="2" opacity="0.45"/>
      </g>
      <g fill="ACCENT" opacity="0.18">
        <circle cx="24" cy="46" r="8"/><circle cx="110" cy="80" r="7"/>
      </g>`,
  },

  // 紗霧蛾：寬翅如流霧；翅紋為抽象波帶，非任何真實紋樣取材
  veilmoth: {
    accent: '#c9b1d6',
    body: `
      <path d="M62 58 Q40 30 16 30 Q4 42 14 58 Q26 72 58 70 Z" fill="url(#bodyGrad)"/>
      <path d="M66 58 Q88 30 112 30 Q124 42 114 58 Q102 72 70 70 Z" fill="url(#bodyGrad)"/>
      <path d="M60 68 Q42 78 34 96 Q46 106 58 96 Q64 86 62 72 Z" fill="url(#bodyGrad)" opacity="0.92"/>
      <path d="M68 68 Q86 78 94 96 Q82 106 70 96 Q64 86 66 72 Z" fill="url(#bodyGrad)" opacity="0.92"/>
      <g stroke="ACCENT" fill="none" stroke-linecap="round" opacity="0.55">
        <path d="M22 40 Q38 44 52 56" stroke-width="2"/>
        <path d="M18 52 Q34 56 50 64" stroke-width="1.6" opacity="0.7"/>
        <path d="M106 40 Q90 44 76 56" stroke-width="2"/>
        <path d="M110 52 Q94 56 78 64" stroke-width="1.6" opacity="0.7"/>
        <path d="M44 84 Q52 82 58 78" stroke-width="1.6"/>
        <path d="M84 84 Q76 82 70 78" stroke-width="1.6"/>
      </g>
      <ellipse cx="64" cy="68" rx="8" ry="22" fill="${INK_BODY}"/>
      <ellipse cx="64" cy="52" rx="7" ry="8" fill="${INK_LIGHT}"/>
      <path d="M60 46 Q52 34 42 30" stroke="ACCENT" stroke-width="2" fill="none"
            stroke-linecap="round" opacity="0.8"/>
      <path d="M68 46 Q76 34 86 30" stroke="ACCENT" stroke-width="2" fill="none"
            stroke-linecap="round" opacity="0.8"/>
      <circle cx="60" cy="52" r="2" fill="ACCENT"/>
      <circle cx="68" cy="52" r="2" fill="ACCENT"/>
      <circle cx="64" cy="52" r="10" fill="ACCENT" opacity="0.16"/>
      <g fill="ACCENT" opacity="0.3"><circle cx="42" cy="30" r="2.2"/><circle cx="86" cy="30" r="2.2"/></g>`,
  },

  // 燈籽獸：頰囊含發光種籽，為畫面主要光源；體態低伏溫和
  lanternshrew: {
    accent: '#e88fb0',
    body: `
      <ellipse cx="62" cy="98" rx="30" ry="4" fill="url(#shade)"/>
      <ellipse cx="100" cy="98" rx="22" ry="4" fill="ACCENT" opacity="0.18"/>
      <path d="M28 84 Q22 66 40 58 Q62 48 84 56 Q98 62 98 78 Q96 90 78 92
               Q50 94 36 90 Q28 88 28 84 Z" fill="url(#bodyGrad)"/>
      <path d="M28 84 Q40 90 62 92 Q84 92 98 78 Q96 90 78 92 Q50 94 36 90 Z"
            fill="${INK_DEEP}" opacity="0.5"/>
      <path d="M92 62 Q108 60 116 70 Q108 78 96 76 Q90 70 92 62 Z" fill="url(#bodyGrad)"/>
      <circle cx="100" cy="72" r="20" fill="ACCENT" opacity="0.12"/>
      <circle cx="100" cy="72" r="13" fill="ACCENT" opacity="0.25"/>
      <circle cx="100" cy="72" r="7.5" fill="ACCENT"/>
      <circle cx="98" cy="70" r="3" fill="#ffffff" opacity="0.5"/>
      <circle cx="88" cy="62" r="2" fill="ACCENT"/>
      <path d="M74 52 Q76 42 84 40 Q84 50 80 56 Z" fill="${INK_LIGHT}"/>
      <path d="M60 50 Q60 40 68 38 Q70 48 66 54 Z" fill="${INK_LIGHT}" opacity="0.9"/>
      <path d="M28 82 Q14 84 8 74 Q20 72 30 78 Z" fill="${INK_BODY}"/>
      <rect x="40" y="86" width="6" height="10" rx="3" fill="${INK_DEEP}"/>
      <rect x="72" y="86" width="6" height="10" rx="3" fill="${INK_DEEP}"/>`,
  },

  // 稜脊獸：石質背脊映著群山稜線；造型敦厚沉穩，無攻擊性特徵
  ridgecrest: {
    accent: '#c0ccd8',
    body: `
      <ellipse cx="64" cy="98" rx="34" ry="5" fill="url(#shade)"/>
      <path d="M24 60 L36 40 L46 52 L58 28 L70 48 L82 36 L92 54 L104 46 L108 62
               Q110 84 92 90 Q62 96 36 90 Q22 84 24 60 Z" fill="url(#bodyGrad)"/>
      <path d="M24 62 Q40 74 64 76 Q90 76 108 62 Q110 84 92 90 Q62 96 36 90 Q22 84 24 62 Z"
            fill="${INK_DEEP}" opacity="0.55"/>
      <g stroke="ACCENT" stroke-width="1.6" fill="none" opacity="0.45" stroke-linecap="round">
        <path d="M36 42 L46 54"/><path d="M58 30 L70 50"/><path d="M82 38 L92 56"/>
        <path d="M30 66 L44 70"/><path d="M60 70 L80 70"/>
      </g>
      <path d="M104 50 Q118 50 120 60 Q114 68 104 66 Z" fill="url(#bodyGrad)"/>
      <circle cx="112" cy="58" r="2.4" fill="ACCENT"/>
      <circle cx="112" cy="58" r="5.5" fill="ACCENT" opacity="0.22"/>
      <rect x="36" y="86" width="8" height="12" rx="3" fill="${INK_DEEP}"/>
      <rect x="56" y="88" width="8" height="10" rx="3" fill="${INK_DEEP}"/>
      <rect x="84" y="86" width="8" height="12" rx="3" fill="${INK_DEEP}"/>
      <path d="M24 66 Q12 68 8 60 Q18 58 26 62 Z" fill="${INK_BODY}"/>
      <g fill="ACCENT" opacity="0.28">
        <circle cx="46" cy="52" r="2"/><circle cx="70" cy="48" r="2.2"/><circle cx="92" cy="54" r="1.8"/>
      </g>`,
  },

  // 羽尾獸：尾羽灑落孢子如晨霜；尾部為抽象羽扇造型
  plumetail: {
    accent: '#b5d68f',
    body: `
      <ellipse cx="78" cy="98" rx="26" ry="4" fill="url(#shade)"/>
      <path d="M56 76 Q30 74 16 54 Q8 38 20 30 Q26 44 40 52 Q28 38 36 28
               Q44 40 54 50 Q50 34 60 30 Q62 46 64 62 Z" fill="url(#bodyGrad)" opacity="0.95"/>
      <g stroke="ACCENT" stroke-width="1.4" fill="none" opacity="0.4" stroke-linecap="round">
        <path d="M22 34 Q34 46 50 56"/><path d="M38 30 Q48 44 58 56"/><path d="M58 32 Q60 46 62 60"/>
      </g>
      <path d="M56 62 Q56 46 72 42 Q92 38 102 50 Q110 62 104 78 Q96 90 78 90
               Q60 88 56 76 Z" fill="url(#bodyGrad)"/>
      <path d="M56 76 Q68 88 84 90 Q98 88 104 78 Q96 90 78 90 Q60 88 56 76 Z"
            fill="${INK_DEEP}" opacity="0.5"/>
      <path d="M96 44 Q108 40 114 48 Q110 58 100 56 Z" fill="url(#bodyGrad)"/>
      <rect x="66" y="86" width="6" height="12" rx="3" fill="${INK_DEEP}"/>
      <rect x="88" y="86" width="6" height="12" rx="3" fill="${INK_DEEP}"/>
      <circle cx="106" cy="50" r="2.4" fill="ACCENT"/>
      <circle cx="106" cy="50" r="5.5" fill="ACCENT" opacity="0.22"/>
      <g fill="ACCENT" opacity="0.15"><circle cx="18" cy="66" r="7"/><circle cx="28" cy="84" r="6"/></g>
      <g fill="ACCENT">
        <circle cx="18" cy="66" r="2.6" opacity="0.7"/><circle cx="10" cy="76" r="2" opacity="0.5"/>
        <circle cx="28" cy="84" r="2.2" opacity="0.6"/><circle cx="20" cy="94" r="1.6" opacity="0.4"/>
      </g>`,
  },
};

// 共用定義：頂光身體漸層、腿部漸層、地面陰影
export function svgFor(id) {
  const art = CREATURE_ART[id];
  if (!art) throw new Error(`unknown creature art: ${id}`);
  const body = art.body.replaceAll('ACCENT', art.accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_LIGHT}"/>
      <stop offset="0.55" stop-color="${INK_BODY}"/>
      <stop offset="1" stop-color="${INK_DEEP}"/>
    </linearGradient>
    <linearGradient id="legGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_BODY}"/>
      <stop offset="1" stop-color="${INK_DEEP}"/>
    </linearGradient>
    <radialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
${body}
</svg>`;
}

export const CREATURE_IDS = Object.keys(CREATURE_ART);
