// 生物剪影概念稿 · 第二波（40 種）— 美術母檔
//
// 風格延續 docs/design/ArtDirection.dc.html 的「生物剪影概念稿」：
//   · 座標系 viewBox -52 -44 104 84，造型寬約 80、高約 70，重心落在 (0,0) 附近
//   · 單色墨剪影（INK）＋單點／少量發光細節（ACCENT），無漸層、無外部引用
//   · 發光色不得接近線索金光 #d8c874（規格書 §8.2）
//
// 取材原則（§2 / §8.2 的相容作法）：以地球既有生命的「結構」為骨架
// （原生生物、細菌、病毒、真菌、植物、無脊椎動物為主），造型一律抽象化、
// 比例改寫、命名虛構；不複製任何特定物種輪廓，不取用文化紋樣或宗教符號。
// 每筆的 source 欄位保留取材出處，供量產前人工目視複查。
//
// 本檔為「美術概念稿」，尚未併入 src/data/creatures.ts；遊戲執行期仍是 8 隻。

export const TERRAIN_INK = {
  meadow: '#11160f',
  mist: '#0f1316',
  thicket: '#101710',
  rock: '#14130f',
};

export const KINGDOM_LABEL = {
  bacteria: '細菌／古菌',
  virus: '病毒',
  protist: '原生生物',
  fungus: '真菌與共生體',
  plant: '植物',
  invertebrate: '無脊椎動物',
  vertebrate: '脊椎動物',
};

export const TERRAIN_LABEL = {
  meadow: '草甸',
  mist: '霧澤',
  thicket: '密叢',
  rock: '岩坡',
};

export const BESTIARY_WAVE2 = [
  // ── 草甸 Meadow ────────────────────────────────────────────────────────────
  {
    id: 'dawncilia', en: 'Dawncilia', zh: '曦纖蟲', terrain: 'meadow', kingdom: 'protist', accent: '#b5d68f',
    source: { zh: '草履蟲（纖毛蟲）', en: 'Paramecium' },
    trait: '晨光下以纖毛推開草間水膜',
    shape: `
    <g fill="INK">
      <path d="M-36 4 Q-42 -8 -26 -14 Q-2 -22 20 -17 Q36 -13 36 -3 Q36 8 16 13 Q-8 18 -24 15 Q-34 12 -36 4 Z"/>
    </g>
    <g stroke="INK" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M-31 -10 L-37 -22"/><path d="M-19 -16 L-22 -30"/><path d="M-6 -20 L-7 -34"/>
      <path d="M8 -19 L11 -32"/><path d="M22 -15 L28 -26"/><path d="M32 -8 L42 -14"/>
      <path d="M-29 12 L-34 24"/><path d="M-15 16 L-16 29"/><path d="M0 16 L2 29"/>
      <path d="M14 13 L19 25"/><path d="M26 9 L34 19"/>
    </g>
    <ellipse cx="2" cy="-2" rx="7" ry="5.5" fill="ACCENT" opacity="0.3"/>
    <circle cx="2" cy="-2" r="2.6" fill="ACCENT"/>
    <circle cx="-16" cy="2" r="2" fill="ACCENT" opacity="0.45"/>`,
  },
  {
    id: 'glisterleaf', en: 'Glisterleaf', zh: '黏露葉', terrain: 'meadow', kingdom: 'plant', accent: '#8fb8de',
    source: { zh: '毛氈苔（食蟲植物）', en: 'Sundew' },
    trait: '腺毛頂端結出整夜不落的亮珠',
    shape: `
    <g stroke="INK" stroke-width="2.6" fill="none" stroke-linecap="round">
      <path d="M0 8 Q-14 0 -26 -10"/><path d="M0 6 Q-10 -8 -14 -22"/><path d="M0 6 Q0 -12 2 -26"/>
      <path d="M0 6 Q12 -6 20 -20"/><path d="M0 8 Q16 0 30 -6"/>
      <path d="M0 10 Q-18 8 -30 4"/><path d="M0 10 Q18 10 30 8"/>
    </g>
    <g fill="INK">
      <path d="M-2 18 L-2 4 L2 4 L2 18 Z"/>
      <path d="M-20 22 Q0 12 20 22 Q0 30 -20 22 Z"/>
    </g>
    <g fill="ACCENT" opacity="0.2">
      <circle cx="2" cy="-27" r="7"/><circle cx="-15" cy="-23" r="6"/><circle cx="21" cy="-21" r="6"/>
    </g>
    <g fill="ACCENT">
      <circle cx="-27" cy="-11" r="2.6"/><circle cx="-15" cy="-23" r="2.6"/><circle cx="2" cy="-27" r="2.9"/>
      <circle cx="21" cy="-21" r="2.6"/><circle cx="31" cy="-7" r="2.3"/>
      <circle cx="-31" cy="4" r="2.3"/><circle cx="31" cy="9" r="2.1"/>
    </g>`,
  },
  {
    id: 'driftcrown', en: 'Driftcrown', zh: '傘冠絮', terrain: 'meadow', kingdom: 'plant', accent: '#c0ccd8',
    source: { zh: '蒲公英冠毛（風媒種子）', en: 'Dandelion pappus' },
    trait: '一陣風就把自己拆成一片星屑',
    shape: `
    <g stroke="INK" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M0 -12 L0 -37"/><path d="M0 -12 L-14 -34"/><path d="M0 -12 L-25 -27"/>
      <path d="M0 -12 L-33 -16"/><path d="M0 -12 L-29 -1"/><path d="M0 -12 L-15 6"/>
      <path d="M0 -12 L14 -34"/><path d="M0 -12 L25 -27"/><path d="M0 -12 L33 -16"/>
      <path d="M0 -12 L29 -1"/><path d="M0 -12 L15 6"/>
    </g>
    <path d="M0 -10 Q1 2 1 12 L1 28" stroke="INK" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M-5 10 Q1 -3 6 10 Q1 18 -5 10 Z" fill="INK"/>
    <circle cx="0" cy="-12" r="9" fill="ACCENT" opacity="0.16"/>
    <circle cx="0" cy="-12" r="2.4" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.5">
      <circle cx="0" cy="-36" r="1.6"/><circle cx="-24" cy="-26" r="1.4"/><circle cx="24" cy="-26" r="1.4"/>
      <circle cx="31" cy="-15" r="1.3"/><circle cx="-31" cy="-15" r="1.3"/>
    </g>`,
  },
  {
    id: 'duskglim', en: 'Duskglim', zh: '暮螢甲', terrain: 'meadow', kingdom: 'invertebrate', accent: '#a8dcc0',
    source: { zh: '螢火蟲（發光甲蟲）', en: 'Firefly' },
    trait: '腹端冷光按固定節拍明滅',
    shape: `
    <g fill="INK">
      <path d="M-10 -10 Q10 -15 24 -5 Q27 3 14 8 Q-4 11 -11 6 Z"/>
      <ellipse cx="-17" cy="-2" rx="8.5" ry="7"/>
    </g>
    <g stroke="INK" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path d="M-23 -6 Q-31 -15 -38 -16"/><path d="M-23 -1 Q-32 -7 -40 -5"/>
      <path d="M-8 9 L-12 19"/><path d="M2 10 L2 21"/><path d="M12 8 L17 18"/>
    </g>
    <path d="M24 -5 Q35 -3 35 4 Q31 10 20 8 Z" fill="ACCENT"/>
    <circle cx="28" cy="2" r="10" fill="ACCENT" opacity="0.22"/>
    <circle cx="28" cy="2" r="17" fill="ACCENT" opacity="0.09"/>
    <circle cx="-21" cy="-4" r="1.7" fill="ACCENT" opacity="0.7"/>`,
  },
  {
    id: 'furlspring', en: 'Furlspring', zh: '弓尾蟲', terrain: 'meadow', kingdom: 'invertebrate', accent: '#8fb8de',
    source: { zh: '彈尾蟲的彈器', en: 'Springtail furcula' },
    trait: '腹下彈器一鬆，人就不見了',
    shape: `
    <g fill="INK">
      <path d="M-14 8 Q-21 -6 -4 -13 Q14 -18 25 -8 Q31 -1 22 8 Q6 15 -8 12 Z"/>
    </g>
    <g stroke="INK" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M23 -9 Q31 -15 39 -15"/><path d="M23 -4 Q32 -8 40 -6"/>
      <path d="M-2 13 L-5 22"/><path d="M8 14 L9 23"/><path d="M17 11 L22 20"/>
    </g>
    <g stroke="INK" stroke-width="3.4" stroke-linecap="round" fill="none">
      <path d="M-12 11 Q-28 18 -37 8"/>
      <path d="M-37 8 L-46 4"/><path d="M-37 8 L-41 -3"/>
    </g>
    <circle cx="19" cy="-6" r="2" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.3"><circle cx="-30" cy="-15" r="3.2"/><circle cx="-22" cy="-24" r="2.2"/><circle cx="-12" cy="-29" r="1.5"/></g>`,
  },
  {
    id: 'wheelbloom', en: 'Wheelbloom', zh: '輪冠蟲', terrain: 'meadow', kingdom: 'invertebrate', accent: '#9ad1c8',
    source: { zh: '輪蟲的頭冠纖毛環', en: 'Rotifer corona' },
    trait: '頭頂雙輪一轉，露水就成了漩渦',
    shape: `
    <g fill="INK">
      <path d="M-17 -14 Q-14 6 -6 18 L-4 30 L5 30 L6 18 Q15 6 18 -14 Z"/>
      <ellipse cx="-13" cy="-19" rx="12" ry="9"/><ellipse cx="13" cy="-19" rx="12" ry="9"/>
      <path d="M-20 -18 Q0 -10 20 -18 Q0 -4 -20 -18 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.7">
      <path d="M-19 -21 L-22 -30"/><path d="M-12 -25 L-13 -33"/><path d="M-4 -22 L-5 -31"/>
      <path d="M5 -22 L6 -31"/><path d="M13 -25 L14 -33"/><path d="M20 -21 L23 -30"/>
    </g>
    <circle cx="0" cy="0" r="4" fill="ACCENT" opacity="0.4"/>
    <circle cx="0" cy="0" r="1.8" fill="ACCENT"/>`,
  },
  {
    id: 'orbchoir', en: 'Orbchoir', zh: '團藻球', terrain: 'meadow', kingdom: 'protist', accent: '#b5d68f',
    source: { zh: '團藻（群體綠藻）', en: 'Volvox colony' },
    trait: '一顆球裡住著整群更小的自己',
    shape: `
    <circle cx="0" cy="-2" r="27" fill="ACCENT" opacity="0.08"/>
    <circle cx="0" cy="-2" r="27" fill="none" stroke="INK" stroke-width="3.4"/>
    <g fill="INK">
      <circle cx="-11" cy="-11" r="6.4"/><circle cx="8" cy="-15" r="4.6"/>
      <circle cx="13" cy="4" r="7.2"/><circle cx="-8" cy="9" r="5.4"/><circle cx="1" cy="-3" r="3.4"/>
    </g>
    <g fill="ACCENT" opacity="0.55">
      <circle cx="-20" cy="4" r="1.6"/><circle cx="18" cy="-13" r="1.6"/><circle cx="-3" cy="19" r="1.6"/>
    </g>
    <circle cx="13" cy="4" r="2.2" fill="ACCENT"/>`,
  },
  {
    id: 'starsnout', en: 'Starsnout', zh: '星吻獸', terrain: 'meadow', kingdom: 'vertebrate', accent: '#e88fb0',
    source: { zh: '星鼻鼴的觸手狀鼻器', en: 'Star-nosed mole nasal rays' },
    trait: '不靠眼睛，用鼻端的星芒讀地面',
    shape: `
    <g fill="INK">
      <path d="M-26 10 Q-33 -6 -14 -13 Q6 -19 21 -11 Q29 -6 27 4 Q22 12 4 14 Q-16 16 -26 10 Z"/>
      <path d="M-26 6 Q-38 8 -41 0 Q-33 -3 -26 1 Z"/>
      <path d="M-7 12 Q-9 22 1 22 Q7 18 3 12 Z"/>
      <path d="M14 12 Q14 21 22 21 Q27 16 22 11 Z"/>
    </g>
    <g stroke="INK" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M25 -7 L31 -16"/><path d="M27 -3 L37 -11"/><path d="M28 1 L39 -3"/>
      <path d="M28 5 L38 7"/><path d="M26 9 L34 15"/>
    </g>
    <g fill="ACCENT">
      <circle cx="31" cy="-16" r="1.7"/><circle cx="37" cy="-11" r="1.8"/><circle cx="39" cy="-3" r="1.8"/>
      <circle cx="38" cy="7" r="1.7"/><circle cx="34" cy="15" r="1.5"/>
    </g>
    <g fill="ACCENT" opacity="0.18"><circle cx="35" cy="-3" r="10"/></g>
    <circle cx="15" cy="-6" r="1.7" fill="ACCENT" opacity="0.8"/>`,
  },
  {
    id: 'jointreed', en: 'Jointreed', zh: '節莖草', terrain: 'meadow', kingdom: 'plant', accent: '#9ad1c8',
    source: { zh: '木賊（石炭紀孑遺蕨類）', en: 'Horsetail' },
    trait: '一節一節長高，節上長出細輪',
    shape: `
    <path d="M-8 -30 Q0 -44 8 -30 Q8 -22 0 -22 Q-8 -22 -8 -30 Z" fill="INK"/>
    <rect x="-4.5" y="-25" width="9" height="54" rx="4.5" fill="INK"/>
    <g stroke="INK" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M0 -16 Q-14 -13 -23 -2"/><path d="M0 -16 Q-11 -18 -21 -15"/><path d="M0 -16 Q-10 -8 -14 5"/>
      <path d="M0 -16 Q14 -13 23 -2"/><path d="M0 -16 Q11 -18 21 -15"/><path d="M0 -16 Q10 -8 14 5"/>
      <path d="M0 4 Q-13 8 -21 17"/><path d="M0 4 Q-11 3 -20 6"/>
      <path d="M0 4 Q13 8 21 17"/><path d="M0 4 Q11 3 20 6"/>
    </g>
    <g stroke="ACCENT" stroke-width="3.4" stroke-linecap="round" opacity="0.4">
      <path d="M-4.5 -16 L4.5 -16"/><path d="M-4.5 4 L4.5 4"/><path d="M-4.5 20 L4.5 20"/>
    </g>
    <circle cx="0" cy="-35" r="2.3" fill="ACCENT"/>
    <circle cx="0" cy="-35" r="6.5" fill="ACCENT" opacity="0.2"/>`,
  },
  {
    id: 'pollendrift', en: 'Pollendrift', zh: '攜粉蜂', terrain: 'meadow', kingdom: 'invertebrate', accent: '#e0955f',
    source: { zh: '蜜蜂後足的花粉籃', en: 'Honeybee pollen basket' },
    trait: '後腿掛著兩團暖光走遍草甸',
    shape: `
    <g fill="INK">
      <path d="M-3 -7 Q10 -26 30 -29 Q28 -16 3 -4 Z"/>
      <path d="M-8 -7 Q-14 -25 -32 -30 Q-34 -18 -12 -4 Z"/>
      <ellipse cx="9" cy="6" rx="19" ry="12"/>
      <ellipse cx="-11" cy="1" rx="10.5" ry="9.5"/>
      <circle cx="-24" cy="-1" r="7"/>
    </g>
    <g stroke="INK" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M-29 -6 Q-36 -13 -43 -13"/>
      <path d="M-7 12 L-10 21"/><path d="M8 15 L10 23"/>
    </g>
    <g fill="ACCENT" opacity="0.2"><circle cx="-9" cy="21" r="8.5"/><circle cx="9" cy="22" r="8.5"/></g>
    <g fill="ACCENT"><circle cx="-9" cy="21" r="4"/><circle cx="9" cy="22" r="4.2"/></g>
    <circle cx="-20" cy="-2" r="1.8" fill="ACCENT"/>
    <g stroke="ACCENT" stroke-width="1.4" opacity="0.3" fill="none"><path d="M0 6 Q10 4 18 6"/></g>`,
  },

  // ── 霧澤 Mist ──────────────────────────────────────────────────────────────
  {
    id: 'bellveil', en: 'Bellveil', zh: '帷鐘獸', terrain: 'mist', kingdom: 'invertebrate', accent: '#9ad1c8',
    source: { zh: '缽水母的傘鐘與觸手', en: 'Jellyfish bell' },
    trait: '傘鐘一收一放，霧就跟著呼吸',
    shape: `
    <g fill="INK">
      <path d="M-28 0 Q-28 -26 0 -26 Q28 -26 28 0 Q16 6 0 6 Q-16 6 -28 0 Z"/>
    </g>
    <g stroke="INK" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M-19 4 Q-23 16 -17 28"/><path d="M-9 6 Q-13 18 -7 30"/><path d="M2 6 Q6 18 0 30"/>
      <path d="M12 5 Q18 16 12 28"/><path d="M22 2 Q26 14 22 24"/>
    </g>
    <path d="M-27 1 Q0 10 27 1" stroke="ACCENT" stroke-width="1.6" fill="none" opacity="0.5"/>
    <circle cx="0" cy="-14" r="5.5" fill="ACCENT" opacity="0.3"/>
    <circle cx="0" cy="-14" r="2.2" fill="ACCENT"/>`,
  },
  {
    id: 'combglow', en: 'Combglow', zh: '櫛光帶', terrain: 'mist', kingdom: 'invertebrate', accent: '#c9b1d6',
    source: { zh: '櫛水母的八列櫛板', en: 'Ctenophore comb rows' },
    trait: '八列櫛板划動時漏出流動的虹光',
    shape: `
    <g fill="INK">
      <path d="M0 -32 Q21 -24 21 0 Q21 18 0 26 Q-21 18 -21 0 Q-21 -24 0 -32 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M-13 -19 Q-17 0 -11 17"/><path d="M-4.5 -25 Q-6.5 0 -4 22"/>
      <path d="M4.5 -25 Q6.5 0 4 22"/><path d="M13 -19 Q17 0 11 17"/>
    </g>
    <g stroke="INK" stroke-width="1.5" stroke-linecap="round" fill="none">
      <path d="M-6 26 Q-10 34 -18 38"/><path d="M6 26 Q10 34 18 38"/>
    </g>
    <circle cx="0" cy="-3" r="8" fill="ACCENT" opacity="0.14"/>
    <circle cx="0" cy="-22" r="2" fill="ACCENT" opacity="0.8"/>`,
  },
  {
    id: 'chainlantern', en: 'Chainlantern', zh: '串燈群', terrain: 'mist', kingdom: 'invertebrate', accent: '#8fb8de',
    source: { zh: '管水母（群體個蟲串接）', en: 'Siphonophore colony' },
    trait: '每一節都是一隻，合起來才是一個',
    shape: `
    <g fill="INK">
      <path d="M-8 -36 Q8 -36 8 -26 Q8 -19 0 -17 Q-8 -19 -8 -26 Z"/>
      <rect x="-1.6" y="-19" width="3.2" height="39" rx="1.6"/>
      <ellipse cx="-7" cy="-9" rx="8.5" ry="6"/><ellipse cx="7" cy="0" rx="8.5" ry="6"/>
      <ellipse cx="-6" cy="9" rx="7.5" ry="5.2"/><ellipse cx="6" cy="17" rx="6.4" ry="4.6"/>
    </g>
    <g stroke="INK" stroke-width="1.4" stroke-linecap="round" fill="none">
      <path d="M0 20 Q-6 30 -15 35"/><path d="M0 20 Q5 32 13 37"/><path d="M0 20 Q-1 32 -3 39"/>
    </g>
    <g fill="ACCENT" opacity="0.65">
      <circle cx="-7" cy="-9" r="2"/><circle cx="7" cy="0" r="2"/>
      <circle cx="-6" cy="9" r="1.8"/><circle cx="6" cy="17" r="1.6"/>
    </g>
    <circle cx="0" cy="-27" r="2.4" fill="ACCENT"/>
    <circle cx="0" cy="-27" r="7" fill="ACCENT" opacity="0.18"/>`,
  },
  {
    id: 'glasswheel', en: 'Glasswheel', zh: '矽輪藻', terrain: 'mist', kingdom: 'protist', accent: '#c0ccd8',
    source: { zh: '矽藻的二氧化矽殼與放射紋', en: 'Diatom frustule' },
    trait: '玻璃質的殼，光一斜照就整圈亮起',
    shape: `
    <ellipse cx="0" cy="-2" rx="30" ry="21" fill="INK"/>
    <g stroke="ACCENT" stroke-width="1.5" stroke-linecap="round" opacity="0.5">
      <path d="M-25 -2 L-11 -2"/><path d="M25 -2 L11 -2"/>
      <path d="M-22 -10 L-9 -6"/><path d="M22 -10 L9 -6"/>
      <path d="M-22 6 L-9 2"/><path d="M22 6 L9 2"/>
      <path d="M-14 -16 L-6 -8"/><path d="M14 -16 L6 -8"/>
      <path d="M-14 12 L-6 4"/><path d="M14 12 L6 4"/>
      <path d="M0 -19 L0 -9"/><path d="M0 15 L0 5"/>
    </g>
    <ellipse cx="0" cy="-2" rx="30" ry="21" fill="none" stroke="ACCENT" stroke-width="1.2" opacity="0.35"/>
    <circle cx="0" cy="-2" r="7" fill="ACCENT" opacity="0.28"/>
    <circle cx="0" cy="-2" r="2.6" fill="ACCENT"/>
    <g stroke="INK" stroke-width="2" stroke-linecap="round"><path d="M-30 -2 L-38 -6"/><path d="M30 -2 L38 2"/></g>`,
  },
  {
    id: 'spineglobe', en: 'Spineglobe', zh: '放芒球', terrain: 'mist', kingdom: 'protist', accent: '#c9b1d6',
    source: { zh: '放射蟲的矽質骨針', en: 'Radiolarian spicules' },
    trait: '懸在霧裡不動，只把針芒轉向來風',
    shape: `
    <g stroke="INK" stroke-width="2.4" stroke-linecap="round">
      <path d="M0 -18 L0 -34"/><path d="M13 -13 L24 -25"/><path d="M18 -2 L34 -2"/>
      <path d="M13 9 L24 21"/><path d="M0 14 L0 30"/><path d="M-13 9 L-24 21"/>
      <path d="M-18 -2 L-34 -2"/><path d="M-13 -13 L-24 -25"/>
      <path d="M7 -16 L12 -30"/><path d="M-7 -16 L-12 -30"/><path d="M17 5 L30 12"/><path d="M-17 5 L-30 12"/>
    </g>
    <circle cx="0" cy="-2" r="16" fill="INK"/>
    <circle cx="0" cy="-2" r="16" fill="none" stroke="ACCENT" stroke-width="1.2" opacity="0.4"/>
    <circle cx="0" cy="-2" r="5" fill="ACCENT" opacity="0.4"/>
    <g fill="ACCENT" opacity="0.55">
      <circle cx="0" cy="-34" r="1.5"/><circle cx="34" cy="-2" r="1.5"/><circle cx="-34" cy="-2" r="1.5"/><circle cx="0" cy="30" r="1.5"/>
    </g>`,
  },
  {
    id: 'flowfoot', en: 'Flowfoot', zh: '流足蟲', terrain: 'mist', kingdom: 'protist', accent: '#9ad1c8',
    source: { zh: '變形蟲的偽足', en: 'Amoeba pseudopods' },
    trait: '沒有固定形狀，只有固定去向',
    shape: `
    <path d="M-30 6 Q-41 -6 -26 -14 Q-21 -27 -6 -21 Q4 -31 14 -21 Q31 -23 30 -8 Q41 0 28 8 Q25 21 8 15 Q-6 23 -16 12 Q-26 17 -30 6 Z" fill="INK"/>
    <circle cx="4" cy="-4" r="8" fill="ACCENT" opacity="0.28"/>
    <circle cx="4" cy="-4" r="3.2" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.3"><circle cx="-16" cy="4" r="3.4"/><circle cx="17" cy="6" r="2.6"/></g>`,
  },
  {
    id: 'horncilia', en: 'Horncilia', zh: '喇叭纖蟲', terrain: 'mist', kingdom: 'protist', accent: '#e88fb0',
    source: { zh: '喇叭蟲（固著性纖毛蟲）', en: 'Stentor' },
    trait: '受驚時把整支喇叭縮成一顆珠',
    shape: `
    <path d="M-23 -24 Q0 -33 23 -24 L6 16 Q3 22 -1 22 L-5 16 Z" fill="INK"/>
    <path d="M-2 21 Q-5 32 -14 35" stroke="INK" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M-14 35 Q-20 36 -22 32" stroke="INK" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <g stroke="ACCENT" stroke-width="1.6" stroke-linecap="round" opacity="0.7">
      <path d="M-21 -27 L-24 -35"/><path d="M-13 -30 L-15 -38"/><path d="M-5 -31 L-6 -39"/>
      <path d="M4 -31 L5 -39"/><path d="M12 -30 L14 -38"/><path d="M20 -27 L23 -35"/>
    </g>
    <path d="M-19 -22 Q0 -14 19 -22" stroke="ACCENT" stroke-width="1.4" fill="none" opacity="0.45"/>
    <circle cx="0" cy="-6" r="3.2" fill="ACCENT" opacity="0.45"/>`,
  },
  {
    id: 'beadfilament', en: 'Beadfilament', zh: '珠絲藻', terrain: 'mist', kingdom: 'bacteria', accent: '#8fb8de',
    source: { zh: '藍綠菌絲與異形細胞', en: 'Cyanobacteria filament' },
    trait: '一串細胞裡總有一顆亮得不一樣',
    shape: `
    <g fill="INK">
      <circle cx="-35" cy="12" r="5"/><circle cx="-25" cy="6" r="5.4"/><circle cx="-15" cy="1" r="5.6"/>
      <circle cx="-5" cy="-2" r="5.8"/><circle cx="6" cy="-3" r="5.8"/><circle cx="16" cy="-7" r="5.6"/>
      <circle cx="26" cy="-14" r="5.2"/><circle cx="35" cy="-22" r="4.8"/>
    </g>
    <circle cx="-5" cy="-2" r="13" fill="ACCENT" opacity="0.16"/>
    <circle cx="-5" cy="-2" r="6.2" fill="ACCENT" opacity="0.9"/>
    <g fill="ACCENT" opacity="0.4"><circle cx="16" cy="-7" r="2"/><circle cx="-25" cy="6" r="1.8"/></g>`,
  },
  {
    id: 'mistray', en: 'Mistray', zh: '霧翼鰩', terrain: 'mist', kingdom: 'vertebrate', accent: '#c0ccd8',
    source: { zh: '蝠鱝的胸鰭滑翔（俯視）', en: 'Manta ray, top view' },
    trait: '貼著霧面滑行，不留一道漣漪',
    shape: `
    <g fill="INK">
      <path d="M0 -16 Q-16 -18 -33 -3 Q-43 7 -27 12 Q-12 15 0 10 Q12 15 27 12 Q43 7 33 -3 Q16 -18 0 -16 Z"/>
      <path d="M-12 -16 Q-22 -23 -18 -12 Q-15 -11 -11 -13 Z"/>
      <path d="M12 -16 Q22 -23 18 -12 Q15 -11 11 -13 Z"/>
    </g>
    <path d="M0 11 Q1 26 3 36" stroke="INK" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g stroke="ACCENT" stroke-width="1.4" fill="none" opacity="0.35">
      <path d="M-26 2 Q-14 -2 -4 -6"/><path d="M26 2 Q14 -2 4 -6"/>
    </g>
    <g fill="ACCENT"><circle cx="-6" cy="-13" r="1.8"/><circle cx="6" cy="-13" r="1.8"/></g>
    <g fill="ACCENT" opacity="0.15"><circle cx="0" cy="-13" r="9"/></g>`,
  },
  {
    id: 'gillfrond', en: 'Gillfrond', zh: '羽鰓螈', terrain: 'mist', kingdom: 'vertebrate', accent: '#e88fb0',
    source: { zh: '美西螈的外鰓（幼態成熟）', en: 'Axolotl external gills' },
    trait: '一輩子留著幼時的羽鰓，在霧裡呼吸',
    shape: `
    <g stroke="INK" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M13 -7 Q4 -16 -4 -22"/><path d="M20 -8 Q19 -20 15 -30"/><path d="M27 -7 Q34 -17 42 -21"/>
    </g>
    <g fill="INK">
      <path d="M-18 -3 Q2 -10 22 -8 Q35 -7 35 2 Q35 11 22 12 Q2 15 -18 9 Z"/>
      <path d="M-18 -5 Q-36 -18 -44 -6 Q-46 11 -32 19 Q-22 23 -18 13 Z"/>
      <path d="M-6 13 Q-9 24 0 25 Q6 22 3 13 Z"/>
      <path d="M16 12 Q14 23 23 23 Q28 20 24 11 Z"/>
      <circle cx="-4" cy="-22" r="4.6"/><circle cx="-9" cy="-27" r="3.4"/><circle cx="1" cy="-28" r="3.6"/>
      <circle cx="15" cy="-30" r="4.6"/><circle cx="10" cy="-36" r="3.4"/><circle cx="20" cy="-36" r="3.6"/>
      <circle cx="42" cy="-21" r="4.6"/><circle cx="43" cy="-29" r="3.4"/><circle cx="48" cy="-16" r="3.2"/>
    </g>
    <g fill="ACCENT" opacity="0.8"><circle cx="-4" cy="-24" r="1.8"/><circle cx="15" cy="-32" r="1.8"/><circle cx="43" cy="-23" r="1.8"/></g>
    <g fill="ACCENT" opacity="0.12"><circle cx="-4" cy="-25" r="9"/><circle cx="15" cy="-33" r="9"/><circle cx="43" cy="-24" r="9"/></g>
    <circle cx="30" cy="0" r="1.9" fill="ACCENT"/>`,
  },

  // ── 密叢 Thicket ───────────────────────────────────────────────────────────
  {
    id: 'mossbear', en: 'Mossbear', zh: '苔熊蟲', terrain: 'thicket', kingdom: 'invertebrate', accent: '#b5d68f',
    source: { zh: '緩步動物（水熊蟲）的桶狀體節', en: 'Tardigrade' },
    trait: '苔乾了就把自己收成一粒塵，等雨',
    shape: `
    <g fill="INK">
      <path d="M-30 3 Q-33 -12 -16 -17 Q4 -21 22 -17 Q35 -13 35 -2 Q35 8 22 10 L-20 12 Q-29 12 -30 3 Z"/>
      <path d="M-25 10 Q-28 21 -20 21 Q-14 19 -16 10 Z"/>
      <path d="M-12 11 Q-15 22 -7 22 Q-1 20 -3 11 Z"/>
      <path d="M1 11 Q-1 22 7 22 Q13 20 11 11 Z"/>
      <path d="M14 10 Q12 21 20 21 Q26 19 24 10 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.2" fill="none" opacity="0.32">
      <path d="M-16 -16 Q-14 -3 -16 11"/><path d="M-2 -19 Q0 -4 -2 12"/><path d="M12 -18 Q14 -4 12 11"/>
    </g>
    <circle cx="29" cy="-5" r="1.8" fill="ACCENT"/>
    <g stroke="INK" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path d="M33 -10 L39 -16"/><path d="M35 -6 L42 -8"/>
    </g>
    <g fill="ACCENT" opacity="0.25"><circle cx="-37" cy="-6" r="4.5"/><circle cx="-43" cy="-13" r="2.6"/></g>`,
  },
  {
    id: 'velvetcrawl', en: 'Velvetcrawl', zh: '絨蠕蟲', terrain: 'thicket', kingdom: 'invertebrate', accent: '#e0955f',
    source: { zh: '有爪動物（天鵝絨蟲）的肉突足', en: 'Velvet worm lobopods' },
    trait: '絨面吸光，走過的落葉層不見凹痕',
    shape: `
    <g fill="INK">
      <path d="M-38 2 Q-39 -8 -25 -11 Q0 -15 20 -13 Q34 -12 37 -5 Q37 4 23 5 Q0 8 -22 8 Q-38 10 -38 2 Z"/>
      <path d="M-31 6 L-34 18 L-27 18 Z"/><path d="M-22 7 L-25 19 L-18 19 Z"/>
      <path d="M-13 8 L-16 20 L-9 20 Z"/><path d="M-4 8 L-7 20 L0 20 Z"/>
      <path d="M5 7 L2 19 L9 19 Z"/><path d="M14 6 L11 18 L18 18 Z"/>
      <path d="M23 5 L21 16 L28 16 Z"/>
    </g>
    <g stroke="INK" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M35 -8 Q41 -16 47 -18"/><path d="M34 -4 Q42 -8 48 -8"/>
    </g>
    <circle cx="31" cy="-4" r="1.7" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.35"><circle cx="-30" cy="-14" r="2.6"/><circle cx="-14" cy="-18" r="2"/><circle cx="2" cy="-19" r="1.5"/></g>`,
  },
  {
    id: 'veinweb', en: 'Veinweb', zh: '脈網菌', terrain: 'thicket', kingdom: 'protist', accent: '#c9b1d6',
    source: { zh: '黏菌（絨泡菌）的原生質脈網', en: 'Slime mould plasmodium' },
    trait: '沒有腦，卻總能挑出最短的那條路',
    shape: `
    <g stroke="INK" stroke-linecap="round" fill="none">
      <path d="M-34 22 Q-20 14 -8 7" stroke-width="5.4"/>
      <path d="M-8 7 Q4 1 17 -5" stroke-width="4.4"/>
      <path d="M-8 7 Q-4 -8 2 -20" stroke-width="3.6"/>
      <path d="M17 -5 Q27 -12 37 -12" stroke-width="2.9"/>
      <path d="M17 -5 Q23 5 31 11" stroke-width="2.6"/>
      <path d="M2 -20 Q-6 -29 -17 -31" stroke-width="2.1"/>
      <path d="M2 -20 Q10 -27 19 -29" stroke-width="1.9"/>
      <path d="M-8 7 Q-19 5 -29 -2" stroke-width="2.5"/>
      <path d="M-29 -2 Q-36 -6 -41 -13" stroke-width="1.7"/>
    </g>
    <path d="M-42 28 Q-31 15 -18 17 Q-25 25 -21 32 Q-34 34 -42 28 Z" fill="INK"/>
    <g fill="ACCENT" opacity="0.75">
      <circle cx="37" cy="-12" r="2.2"/><circle cx="-17" cy="-31" r="2"/><circle cx="19" cy="-29" r="2"/>
      <circle cx="31" cy="11" r="1.9"/><circle cx="-41" cy="-13" r="1.7"/>
    </g>
    <g fill="ACCENT" opacity="0.18"><circle cx="-8" cy="7" r="8"/></g>`,
  },
  {
    id: 'capveil', en: 'Capveil', zh: '幕傘菌', terrain: 'thicket', kingdom: 'fungus', accent: '#e88fb0',
    source: { zh: '傘菌的菌幕與孢子雨', en: 'Mushroom veil and spores' },
    trait: '菌幕一破，孢子就把夜色染成粉塵',
    shape: `
    <g fill="INK">
      <path d="M-27 -4 Q-25 -27 0 -27 Q25 -27 27 -4 Q14 3 0 3 Q-14 3 -27 -4 Z"/>
      <path d="M-6 0 L-8 25 Q0 30 8 25 L6 0 Z"/>
      <path d="M-15 5 Q0 12 15 5 Q15 13 0 15 Q-15 13 -15 5 Z"/>
      <path d="M-16 27 Q0 22 16 27 Q0 32 -16 27 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.3">
      <path d="M-20 -10 Q0 -20 20 -10"/><path d="M-13 -18 Q0 -24 13 -18"/>
    </g>
    <g fill="ACCENT" opacity="0.55">
      <circle cx="-22" cy="10" r="1.7"/><circle cx="-27" cy="18" r="1.3"/><circle cx="-18" cy="22" r="1.1"/>
      <circle cx="22" cy="9" r="1.7"/><circle cx="28" cy="17" r="1.3"/><circle cx="19" cy="23" r="1.1"/>
    </g>
    <circle cx="0" cy="-15" r="2.2" fill="ACCENT"/>
    <circle cx="0" cy="-15" r="7" fill="ACCENT" opacity="0.16"/>`,
  },
  {
    id: 'silkglow', en: 'Silkglow', zh: '絲光蚋', terrain: 'thicket', kingdom: 'invertebrate', accent: '#9ad1c8',
    source: { zh: '發光蕈蚊幼蟲的黏絲釣線', en: 'Glow-worm silk lines' },
    trait: '垂下一簾冷光的釣線，自己躲在暗處',
    shape: `
    <path d="M-42 -32 Q0 -28 42 -32" stroke="INK" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M-25 -30 Q-6 -35 15 -31 Q26 -29 26 -24 Q24 -20 13 -20 L-19 -22 Q-28 -24 -25 -30 Z" fill="INK"/>
    <g stroke="INK" stroke-width="0.9" fill="none" opacity="0.75">
      <path d="M-19 -21 L-21 9"/><path d="M-9 -20 L-9 16"/><path d="M2 -20 L4 6"/>
      <path d="M13 -20 L15 13"/><path d="M22 -22 L24 2"/>
    </g>
    <g fill="ACCENT" opacity="0.18">
      <circle cx="-21" cy="9" r="6"/><circle cx="-9" cy="16" r="7"/><circle cx="15" cy="13" r="6"/>
    </g>
    <g fill="ACCENT">
      <circle cx="-21" cy="9" r="2"/><circle cx="-9" cy="16" r="2.3"/><circle cx="4" cy="6" r="1.8"/>
      <circle cx="15" cy="13" r="2"/><circle cx="24" cy="2" r="1.6"/>
    </g>
    <g fill="ACCENT" opacity="0.45">
      <circle cx="-20" cy="-3" r="1.1"/><circle cx="-9" cy="2" r="1.1"/><circle cx="3" cy="-6" r="1"/><circle cx="14" cy="0" r="1.1"/>
    </g>
    <circle cx="20" cy="-26" r="1.8" fill="ACCENT" opacity="0.7"/>`,
  },
  {
    id: 'curlfrond', en: 'Curlfrond', zh: '卷芽蕨', terrain: 'thicket', kingdom: 'plant', accent: '#7ba05b',
    source: { zh: '蕨類的拳卷幼葉', en: 'Fern fiddlehead' },
    trait: '整株都還捲著，只有頂端先醒來',
    shape: `
    <path d="M-2 30 Q-4 8 4 -6 Q12 -21 26 -20 Q38 -19 37 -7 Q36 2 26 2 Q18 1 19 -7 Q20 -12 26 -12"
          stroke="INK" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g stroke="INK" stroke-width="2.6" fill="none" stroke-linecap="round">
      <path d="M-2 18 Q-14 15 -21 6"/><path d="M0 6 Q-11 1 -16 -9"/><path d="M4 -4 Q-4 -12 -6 -22"/>
      <path d="M-1 24 Q-13 24 -22 19"/>
    </g>
    <g stroke="INK" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.8">
      <path d="M-14 12 L-16 5"/><path d="M-8 3 L-11 -3"/><path d="M-13 21 L-16 15"/>
    </g>
    <circle cx="27" cy="-11" r="2.4" fill="ACCENT"/>
    <circle cx="27" cy="-11" r="7" fill="ACCENT" opacity="0.18"/>
    <g fill="ACCENT" opacity="0.4"><circle cx="-21" cy="6" r="1.8"/><circle cx="-6" cy="-22" r="1.6"/></g>`,
  },
  {
    id: 'pebblecase', en: 'Pebblecase', zh: '綴石蠶', terrain: 'thicket', kingdom: 'invertebrate', accent: '#c0ccd8',
    source: { zh: '石蠶蛾幼蟲以砂石築的巢筒', en: 'Caddisfly larval case' },
    trait: '把撿到的碎石一顆顆黏成自己的殼',
    shape: `
    <g fill="INK">
      <circle cx="-32" cy="5" r="6"/><circle cx="-22" cy="0" r="7"/><circle cx="-12" cy="5" r="6.6"/>
      <circle cx="-3" cy="-2" r="7.6"/><circle cx="7" cy="4" r="6.6"/><circle cx="14" cy="-4" r="6"/>
      <circle cx="21" cy="2" r="5.4"/>
      <path d="M25 -3 Q36 -5 38 1 Q36 8 27 6 Z"/>
    </g>
    <g stroke="INK" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M27 6 L29 16"/><path d="M34 5 L39 14"/><path d="M36 -4 Q43 -9 48 -8"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.2" fill="none" opacity="0.4" stroke-linecap="round">
      <path d="M-25 -4 Q-22 -6 -18 -5"/><path d="M-6 -7 Q-3 -9 1 -8"/><path d="M12 -8 Q15 -10 18 -9"/>
    </g>
    <circle cx="33" cy="-1" r="1.7" fill="ACCENT"/>`,
  },
  {
    id: 'whorlkeeper', en: 'Whorlkeeper', zh: '螺紋蝸', terrain: 'thicket', kingdom: 'invertebrate', accent: '#b5d68f',
    source: { zh: '陸生腹足類的對數螺旋殼', en: 'Land snail shell' },
    trait: '背著一整圈年輪慢慢走',
    shape: `
    <circle cx="-4" cy="-9" r="21" fill="INK"/>
    <g fill="INK">
      <path d="M-25 8 Q-33 12 -31 19 Q-19 24 6 22 Q23 20 31 13 Q35 9 31 5 Q21 10 6 12 Q-10 14 -25 8 Z"/>
    </g>
    <g stroke="INK" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M31 8 Q38 0 42 -6"/><path d="M29 12 Q36 8 41 5"/>
    </g>
    <path d="M9 -9 A13 13 0 1 1 -1 -21 A8 8 0 1 0 3 -13 A4 4 0 1 1 0 -17"
          fill="none" stroke="ACCENT" stroke-width="1.5" opacity="0.45"/>
    <g fill="ACCENT"><circle cx="42" cy="-6" r="1.8"/><circle cx="41" cy="5" r="1.6"/></g>
    <g fill="ACCENT" opacity="0.14"><circle cx="42" cy="-6" r="6"/></g>`,
  },
  {
    id: 'leafcling', en: 'Leafcling', zh: '貼葉蛙', terrain: 'thicket', kingdom: 'vertebrate', accent: '#8fb8de',
    source: { zh: '樹蛙的吸盤趾', en: 'Tree frog toe pads' },
    trait: '整夜貼在葉背，只有指端反光',
    shape: `
    <g fill="INK">
      <path d="M-18 6 Q-23 -11 -8 -18 Q0 -22 8 -18 Q23 -11 18 6 Q10 15 0 15 Q-10 15 -18 6 Z"/>
      <path d="M-17 -2 Q-30 2 -33 13"/>
    </g>
    <g stroke="INK" stroke-width="4.2" fill="none" stroke-linecap="round">
      <path d="M-16 0 Q-28 3 -32 13"/><path d="M16 0 Q28 3 32 13"/>
      <path d="M-13 10 Q-24 16 -25 26"/><path d="M13 10 Q24 16 25 26"/>
    </g>
    <g fill="INK">
      <circle cx="-33" cy="16" r="4.4"/><circle cx="33" cy="16" r="4.4"/>
      <circle cx="-25" cy="29" r="4.4"/><circle cx="25" cy="29" r="4.4"/>
    </g>
    <g fill="ACCENT" opacity="0.45">
      <circle cx="-33" cy="16" r="1.8"/><circle cx="33" cy="16" r="1.8"/>
      <circle cx="-25" cy="29" r="1.6"/><circle cx="25" cy="29" r="1.6"/>
    </g>
    <g fill="ACCENT"><circle cx="-8" cy="-11" r="2.4"/><circle cx="8" cy="-11" r="2.4"/></g>
    <g fill="ACCENT" opacity="0.18"><circle cx="-8" cy="-11" r="6.5"/><circle cx="8" cy="-11" r="6.5"/></g>`,
  },
  {
    id: 'urnleaf', en: 'Urnleaf', zh: '甕葉草', terrain: 'thicket', kingdom: 'plant', accent: '#e0955f',
    source: { zh: '豬籠草的捕蟲籠與蜜腺', en: 'Pitcher plant' },
    trait: '甕口一圈蜜光，雨水在裡面靜著',
    shape: `
    <g fill="INK">
      <path d="M-13 -12 Q-17 -1 -19 12 Q-19 27 -2 30 Q16 30 18 14 Q17 0 13 -12 Z"/>
      <path d="M-16 -13 Q0 -21 17 -13 Q0 -6 -16 -13 Z"/>
      <path d="M-6 -19 Q7 -32 22 -28 Q15 -18 2 -16 Z"/>
    </g>
    <path d="M-13 -4 Q-30 2 -36 18" stroke="INK" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M-36 18 Q-42 22 -43 16" stroke="INK" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.3">
      <path d="M-15 4 Q0 9 14 4"/><path d="M-17 16 Q0 21 16 16"/>
      <path d="M-9 -8 Q-11 6 -12 20"/><path d="M9 -8 Q11 6 12 20"/>
    </g>
    <path d="M-15 -13 Q0 -6 16 -13" stroke="ACCENT" stroke-width="1.6" fill="none" opacity="0.6"/>
    <circle cx="0" cy="-9" r="2" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.18"><circle cx="0" cy="-12" r="10"/></g>`,
  },

  // ── 岩坡 Rock ──────────────────────────────────────────────────────────────
  {
    id: 'sporelander', en: 'Sporelander', zh: '降體孢', terrain: 'rock', kingdom: 'virus', accent: '#c9b1d6',
    source: { zh: '噬菌體的正二十面體衣殼與尾絲', en: 'Bacteriophage capsid' },
    trait: '像一具小小的登陸艇，蹲在岩面上',
    shape: `
    <g fill="INK">
      <path d="M0 -36 L15 -27 L15 -10 L0 -1 L-15 -10 L-15 -27 Z"/>
      <rect x="-3.4" y="-2" width="6.8" height="17" rx="1.5"/>
      <path d="M-15 15 L15 15 L11 21 L-11 21 Z"/>
    </g>
    <g stroke="INK" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M-11 21 Q-19 27 -23 37"/><path d="M-4 21 Q-8 29 -10 39"/>
      <path d="M4 21 Q8 29 10 39"/><path d="M11 21 Q19 27 23 37"/>
      <path d="M-13 18 Q-27 22 -35 31"/><path d="M13 18 Q27 22 35 31"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.2" fill="none" opacity="0.4">
      <path d="M0 -36 L0 -1"/><path d="M-15 -27 L15 -10"/><path d="M15 -27 L-15 -10"/>
    </g>
    <circle cx="0" cy="-19" r="3.4" fill="ACCENT" opacity="0.35"/>
    <circle cx="0" cy="18" r="2" fill="ACCENT"/>`,
  },
  {
    id: 'platecrawler', en: 'Platecrawler', zh: '疊甲蟲', terrain: 'rock', kingdom: 'invertebrate', accent: '#c0ccd8',
    source: { zh: '三葉蟲的頭甲與體節', en: 'Trilobite' },
    trait: '甲片一節節疊著，遇驚就捲成石子',
    shape: `
    <g fill="INK">
      <path d="M-30 -16 Q0 -27 30 -16 Q35 -8 31 -1 L-31 -1 Q-35 -8 -30 -16 Z"/>
      <path d="M-29 -1 L29 -1 Q27 18 14 27 Q0 33 -14 27 Q-27 18 -29 -1 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.38">
      <path d="M-27 4 L27 4"/><path d="M-25 10 L25 10"/><path d="M-21 16 L21 16"/><path d="M-15 22 L15 22"/>
      <path d="M-8 -1 Q-9 14 -6 28"/><path d="M8 -1 Q9 14 6 28"/>
      <path d="M-9 -3 Q0 -22 9 -3"/>
    </g>
    <g stroke="INK" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M-31 -4 L-40 2"/><path d="M31 -4 L40 2"/>
    </g>
    <g fill="ACCENT"><circle cx="-15" cy="-13" r="1.9"/><circle cx="15" cy="-13" r="1.9"/></g>
    <g fill="ACCENT" opacity="0.16"><circle cx="-15" cy="-13" r="5.5"/><circle cx="15" cy="-13" r="5.5"/></g>`,
  },
  {
    id: 'chamberwhorl', en: 'Chamberwhorl', zh: '室螺獸', terrain: 'rock', kingdom: 'invertebrate', accent: '#8fb8de',
    source: { zh: '鸚鵡螺的隔室與觸手冠', en: 'Nautilus chambers' },
    trait: '每長大一次就封起一間舊房',
    shape: `
    <path d="M20 -6 A20 20 0 1 1 -20 -6 A16 16 0 1 1 12 -6 A12 12 0 1 1 -12 -6 A8.5 8.5 0 1 1 5 -6 A5 5 0 1 1 -5 -6"
          fill="none" stroke="INK" stroke-width="11" stroke-linecap="round"/>
    <path d="M20 -6 A20 20 0 1 1 -20 -6 A16 16 0 1 1 12 -6 A12 12 0 1 1 -12 -6 A8.5 8.5 0 1 1 5 -6"
          fill="none" stroke="ACCENT" stroke-width="1.2" opacity="0.3"/>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.35">
      <path d="M-2 -30 L-2 -20"/><path d="M-25 -13 L-15 -11"/><path d="M-19 6 L-12 1"/><path d="M4 12 L2 3"/>
    </g>
    <g fill="INK">
      <path d="M14 4 Q28 2 34 10 Q30 20 16 18 Z"/>
    </g>
    <g stroke="INK" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M32 7 Q42 3 48 5"/><path d="M34 12 Q44 12 49 15"/><path d="M31 17 Q40 21 44 25"/>
      <path d="M25 19 Q30 27 31 34"/>
    </g>
    <circle cx="22" cy="9" r="2" fill="ACCENT"/>
    <circle cx="22" cy="9" r="6" fill="ACCENT" opacity="0.18"/>`,
  },
  {
    id: 'chalkcoil', en: 'Chalkcoil', zh: '灰室蟲', terrain: 'rock', kingdom: 'protist', accent: '#e0955f',
    source: { zh: '有孔蟲的鈣質房室與偽足刺', en: 'Foraminifera test' },
    trait: '整片岩坡都是牠們留下的白灰',
    shape: `
    <g stroke="INK" stroke-width="1.6" stroke-linecap="round">
      <path d="M-14 20 L-22 32"/><path d="M-16 6 L-30 12"/><path d="M-13 -14 L-27 -20"/>
      <path d="M4 -26 L2 -40"/><path d="M24 -25 L32 -37"/><path d="M36 -6 L48 -10"/>
      <path d="M31 12 L42 20"/><path d="M14 20 L18 33"/>
    </g>
    <g fill="INK">
      <circle cx="-6" cy="14" r="6"/><circle cx="-9" cy="1" r="8"/><circle cx="-3" cy="-12" r="10"/>
      <circle cx="11" cy="-19" r="11.5"/><circle cx="25" cy="-9" r="12"/><circle cx="22" cy="8" r="11"/>
    </g>
    <g fill="ACCENT" opacity="0.45">
      <circle cx="-3" cy="-12" r="2"/><circle cx="11" cy="-19" r="2.2"/><circle cx="25" cy="-9" r="2.2"/><circle cx="22" cy="8" r="2"/>
    </g>
    <circle cx="16" cy="-6" r="4" fill="ACCENT" opacity="0.2"/>`,
  },
  {
    id: 'crustbloom', en: 'Crustbloom', zh: '殼衣菌', terrain: 'rock', kingdom: 'fungus', accent: '#b5d68f',
    source: { zh: '地衣（真菌與藻類共生體）', en: 'Lichen thallus' },
    trait: '一年只長一根頭髮的寬度',
    shape: `
    <g fill="INK">
      <path d="M-43 16 Q-36 6 -24 9 Q-16 1 -4 5 Q4 -3 15 1 Q25 -6 34 -1 Q44 3 41 12 Q30 19 14 17
               Q2 21 -10 18 Q-24 22 -34 20 Q-42 21 -43 16 Z"/>
      <path d="M-30 8 Q-24 -1 -13 -2 Q-20 -8 -28 -5 Q-34 -1 -30 8 Z"/>
      <path d="M18 -2 Q25 -12 36 -11 Q31 -3 24 0 Z"/>
      <path d="M-6 3 Q0 -8 10 -9 Q8 -1 2 3 Z"/>
    </g>
    <g fill="ACCENT" opacity="0.16"><circle cx="4" cy="7" r="9"/><circle cx="-14" cy="11" r="7"/></g>
    <g fill="ACCENT">
      <circle cx="-14" cy="11" r="3"/><circle cx="4" cy="7" r="3.4"/><circle cx="22" cy="9" r="2.8"/>
      <circle cx="-28" cy="15" r="2.2"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.1" fill="none" opacity="0.3">
      <path d="M-34 16 Q-20 12 -4 14"/><path d="M8 15 Q22 16 33 12"/>
    </g>`,
  },
  {
    id: 'screecaller', en: 'Screecaller', zh: '岩鳴獸', terrain: 'rock', kingdom: 'vertebrate', accent: '#e88fb0',
    source: { zh: '鼠兔的圓耳與示警叫聲', en: 'Pika alarm call' },
    trait: '一聲短鳴，整片碎石坡都安靜下來',
    shape: `
    <g fill="INK">
      <path d="M-20 12 Q-27 -4 -12 -13 Q3 -21 17 -14 Q29 -8 27 6 Q25 17 8 19 Q-10 21 -20 12 Z"/>
      <circle cx="16" cy="-17" r="7.5"/><circle cx="1" cy="-21" r="7.5"/>
      <path d="M-20 8 Q-31 10 -33 3 Q-26 1 -20 4 Z"/>
      <path d="M-4 18 Q-6 25 2 25 Q7 22 4 17 Z"/>
      <path d="M13 17 Q12 24 20 24 Q24 21 21 16 Z"/>
    </g>
    <circle cx="22" cy="-3" r="1.9" fill="ACCENT"/>
    <g stroke="ACCENT" stroke-width="1.4" fill="none" opacity="0.45" stroke-linecap="round">
      <path d="M32 -2 Q39 -4 43 -9"/><path d="M33 3 Q41 3 46 0"/><path d="M31 8 Q38 11 42 15"/>
    </g>
    <g fill="ACCENT" opacity="0.4"><circle cx="16" cy="-17" r="2.4"/><circle cx="1" cy="-21" r="2.4"/></g>`,
  },
  {
    id: 'scalecurl', en: 'Scalecurl', zh: '覆鱗獸', terrain: 'rock', kingdom: 'vertebrate', accent: '#e0955f',
    source: { zh: '穿山甲的角質鱗與蜷球姿態', en: 'Pangolin keratin scales' },
    trait: '受驚就成一顆帶紋的石球',
    shape: `
    <circle cx="0" cy="-2" r="26" fill="INK"/>
    <path d="M-24 8 Q-36 12 -34 22 Q-24 25 -17 16 Z" fill="INK"/>
    <path d="M20 -16 Q31 -22 36 -14 Q31 -6 22 -8 Z" fill="INK"/>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.38">
      <path d="M-22 -13 Q0 -22 22 -13"/><path d="M-25 -3 Q0 -12 25 -3"/>
      <path d="M-24 7 Q0 -2 24 7"/><path d="M-18 16 Q0 8 18 16"/>
      <path d="M-11 -21 Q-13 -8 -11 6"/><path d="M0 -24 Q2 -8 0 8"/><path d="M11 -21 Q13 -8 11 6"/>
    </g>
    <circle cx="31" cy="-14" r="1.8" fill="ACCENT"/>
    <circle cx="31" cy="-14" r="5.5" fill="ACCENT" opacity="0.16"/>`,
  },
  {
    id: 'raywander', en: 'Raywander', zh: '五腕星', terrain: 'rock', kingdom: 'invertebrate', accent: '#9ad1c8',
    source: { zh: '陽燧足（蛇尾綱）的五腕輻射對稱', en: 'Brittle star arms' },
    trait: '五條腕輪流帶路，沒有正面也沒有背面',
    shape: `
    <g stroke="INK" stroke-width="4.4" stroke-linecap="round" fill="none">
      <path d="M0 -9 Q3 -23 -4 -36"/><path d="M9 2 Q23 7 34 -1"/><path d="M-9 2 Q-23 7 -34 -1"/>
      <path d="M6 9 Q14 23 9 34"/><path d="M-6 9 Q-14 23 -9 34"/>
    </g>
    <g stroke="INK" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="0.8">
      <path d="M1 -20 L-4 -23"/><path d="M2 -28 L-3 -31"/>
      <path d="M20 6 L21 11"/><path d="M28 4 L30 9"/>
      <path d="M-20 6 L-21 11"/><path d="M-28 4 L-30 9"/>
      <path d="M12 19 L17 20"/><path d="M-12 19 L-17 20"/>
    </g>
    <circle cx="0" cy="-2" r="9.5" fill="INK"/>
    <circle cx="0" cy="-2" r="4" fill="ACCENT" opacity="0.4"/>
    <circle cx="0" cy="-2" r="1.8" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.5"><circle cx="-4" cy="-36" r="1.5"/><circle cx="34" cy="-1" r="1.5"/><circle cx="-34" cy="-1" r="1.5"/></g>`,
  },
  {
    id: 'tiermound', en: 'Tiermound', zh: '疊層丘', terrain: 'rock', kingdom: 'bacteria', accent: '#c0ccd8',
    source: { zh: '疊層石（藍綠菌席的碳酸鈣層）', en: 'Stromatolite' },
    trait: '長得比山慢，卻比山先來',
    shape: `
    <g fill="INK">
      <path d="M-34 30 Q-32 5 -14 -7 Q0 -16 14 -7 Q32 5 34 30 Z"/>
      <path d="M-44 30 Q-43 18 -34 11 Q-28 22 -28 30 Z"/>
      <path d="M44 30 Q43 16 33 8 Q28 20 28 30 Z"/>
    </g>
    <g stroke="ACCENT" stroke-width="1.3" fill="none" opacity="0.32">
      <path d="M-29 24 Q0 8 29 24"/><path d="M-25 15 Q0 0 25 15"/><path d="M-19 7 Q0 -6 19 7"/><path d="M-12 0 Q0 -10 12 0"/>
    </g>
    <g fill="ACCENT" opacity="0.55">
      <circle cx="-6" cy="-22" r="2"/><circle cx="4" cy="-29" r="1.6"/><circle cx="-2" cy="-35" r="1.2"/>
      <circle cx="12" cy="-24" r="1.4"/>
    </g>
    <circle cx="0" cy="-14" r="2.2" fill="ACCENT"/>
    <circle cx="0" cy="-14" r="6.5" fill="ACCENT" opacity="0.16"/>`,
  },
  {
    id: 'stiltstepper', en: 'Stiltstepper', zh: '高蹺蛛', terrain: 'rock', kingdom: 'invertebrate', accent: '#c9b1d6',
    source: { zh: '盲蛛（長腳目）的細長步足', en: 'Harvestman legs' },
    trait: '八根細腳踩過碎石，一顆也不動',
    shape: `
    <g stroke="INK" stroke-width="1.7" stroke-linecap="round" fill="none">
      <path d="M-6 -2 Q-22 -30 -38 -6"/><path d="M-7 0 Q-28 -20 -44 6"/>
      <path d="M-7 3 Q-26 -8 -40 18"/><path d="M-5 6 Q-20 4 -28 28"/>
      <path d="M6 -2 Q22 -30 38 -6"/><path d="M7 0 Q28 -20 44 6"/>
      <path d="M7 3 Q26 -8 40 18"/><path d="M5 6 Q20 4 28 28"/>
    </g>
    <ellipse cx="0" cy="1" rx="9.5" ry="7.5" fill="INK"/>
    <ellipse cx="0" cy="-6" rx="5" ry="4" fill="INK"/>
    <g fill="ACCENT"><circle cx="-2.4" cy="-7" r="1.5"/><circle cx="2.4" cy="-7" r="1.5"/></g>
    <circle cx="0" cy="-7" r="6" fill="ACCENT" opacity="0.14"/>
    <g fill="ACCENT" opacity="0.35"><circle cx="-38" cy="-6" r="1.4"/><circle cx="38" cy="-6" r="1.4"/></g>`,
  },
];
