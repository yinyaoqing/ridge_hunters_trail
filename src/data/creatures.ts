import type { TerrainType, Locale } from '../core/types';

export interface Creature {
  id: string;
  names: Record<Locale, string>;
  descs: Record<Locale, string>;
  color: number; // 剪影佔位色/發光細節色（後續換 sprite；不得與線索金光 0xd8c874 相近，避免誤讀為線索）
  terrain: TerrainType; // 地形偏好：目標所在格地形
  quirkHints: Record<Locale, string>; // 個性提示：說明該生物對生成參數的修飾（設計提案 §2 W1）
}

export const CREATURES: Creature[] = [
  { id: 'mistfawn', names: { en: 'Mistfawn', 'zh-TW': '霧絨鹿' }, color: 0x9ad1c8, terrain: 'mist',
    descs: { en: 'A gentle grazer that melts into morning fog when startled.', 'zh-TW': '性情溫馴的食草獸，受驚時化入晨霧之中。' },
    quirkHints: { en: 'Its scent hangs wide and faint — read the ring loosely.', 'zh-TW': '氣味淡薄而散，環帶要放寬著讀。' } },
  { id: 'emberquill', names: { en: 'Emberquill', 'zh-TW': '燼棘獸' }, color: 0xe0955f, terrain: 'rock',
    descs: { en: 'Its soft quills give off a faint warm glow at dusk.', 'zh-TW': '柔軟的棘刺在暮色中散發微微暖光。' },
    quirkHints: { en: 'A careful walker; its disturbances are unusually tight.', 'zh-TW': '行走謹慎，擾動範圍格外收斂。' } },
  { id: 'thicketloom', names: { en: 'Thicketloom', 'zh-TW': '織叢雀' }, color: 0x7ba05b, terrain: 'thicket',
    descs: { en: 'Weaves hanging nests from silver vines deep in the brush.', 'zh-TW': '在密叢深處以銀藤編織懸巢。' },
    quirkHints: { en: 'Flies dead straight — footprint cones point true.', 'zh-TW': '直線飛行，足跡錐指向格外精確。' } },
  { id: 'dewhopper', names: { en: 'Dewhopper', 'zh-TW': '露躍獸' }, color: 0x8fb8de, terrain: 'meadow',
    descs: { en: 'Leaps between dew-heavy grass blades without shaking a drop.', 'zh-TW': '在綴滿露水的草葉間跳躍，不驚落一滴。' },
    quirkHints: { en: 'Dew gathers where it passes; supplies are plentiful.', 'zh-TW': '所經之處露水豐沛，補給更多。' } },
  { id: 'veilmoth', names: { en: 'Veilmoth', 'zh-TW': '紗霧蛾' }, color: 0xc9b1d6, terrain: 'mist',
    descs: { en: 'Broad wings patterned like slowly drifting haze.', 'zh-TW': '寬大的翅膀帶著如流霧般的紋路。' },
    quirkHints: { en: 'Its scales confuse the senses — expect an extra false trail.', 'zh-TW': '鱗粉迷惑感官，會多一條假蹤跡。' } },
  { id: 'lanternshrew', names: { en: 'Lanternshrew', 'zh-TW': '燈籽獸' }, color: 0xe88fb0, terrain: 'thicket',
    descs: { en: 'Carries a glowing seed in its cheek to light narrow trails.', 'zh-TW': '頰囊裡含著發光種籽，照亮窄徑。' },
    quirkHints: { en: 'Never wanders far; its traces sit close together.', 'zh-TW': '不走遠路，蹤跡彼此相近。' } },
  { id: 'ridgecrest', names: { en: 'Ridgecrest', 'zh-TW': '稜脊獸' }, color: 0xc0ccd8, terrain: 'rock',
    descs: { en: 'Its stony crest mirrors the skyline of the mountains it roams.', 'zh-TW': '石質背脊映著牠漫遊的群山稜線。' },
    quirkHints: { en: 'Rocky ground spreads wherever it roams.', 'zh-TW': '牠漫遊的山域，岩坡格外遍布。' } },
  { id: 'plumetail', names: { en: 'Plumetail', 'zh-TW': '羽尾獸' }, color: 0xb5d68f, terrain: 'meadow',
    descs: { en: 'Trails soft spores that settle over the grass like morning frost.', 'zh-TW': '尾羽灑落的孢子如晨霜覆上草地。' },
    quirkHints: { en: 'Spores drift far on the wind; traces sit farther out.', 'zh-TW': '孢子隨風飄遠，蹤跡落在更遠處。' } },
];
