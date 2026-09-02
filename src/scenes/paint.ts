import Phaser from 'phaser';
import type { Clue, ClueType, Locale, TerrainType } from '../core/types';
import { CLUE_GOLD, type Palette } from '../core/palette';
import type { Quality } from '../core/quality';
import type { MarkKind } from '../core/marks';

type Gfx = Phaser.GameObjects.Graphics;

export const cssHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export const cssRgba = (n: number, a: number): string => {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${a})`;
};

// Phaser Graphics 沒有虛線，以短弧段近似（水墨點描感）
export function dashedCircle(
  g: Gfx, cx: number, cy: number, r: number,
  color: number, alpha: number, width = 2, dash = 4, gap = 8,
): void {
  g.lineStyle(width, color, alpha);
  const step = (dash + gap) / r;
  for (let a = 0; a < Math.PI * 2; a += step) {
    g.beginPath();
    g.arc(cx, cy, r, a, Math.min(a + dash / r, Math.PI * 2));
    g.strokePath();
  }
}

// 偏心弧（風向石）：同 dashedCircle 手法，僅畫以 centerDeg 為中心 ±spanDeg/2 的區間，
// 暗示氣味來源方向而非完整距離環
export function dashedArc(
  g: Gfx, cx: number, cy: number, r: number, centerDeg: number, spanDeg: number,
  color: number, alpha: number, width = 2, dash = 3, gap = 8,
): void {
  g.lineStyle(width, color, alpha);
  const startRad = ((centerDeg - spanDeg / 2) * Math.PI) / 180;
  const endRad = ((centerDeg + spanDeg / 2) * Math.PI) / 180;
  const step = (dash + gap) / r;
  for (let a = startRad; a < endRad; a += step) {
    g.beginPath();
    g.arc(cx, cy, r, a, Math.min(a + dash / r, endRad));
    g.strokePath();
  }
}

export function dashedLine(
  g: Gfx, x1: number, y1: number, x2: number, y2: number,
  color: number, alpha: number, width = 1.5, dash = 2, gap = 7,
): void {
  g.lineStyle(width, color, alpha);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len === 0) return;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(d + dash, len);
    g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
  }
}

// 線索圖標：深色底盤＋手繪感字形（足跡/擾動漩渦/氣味波紋），取代 F/D/S 字母。
// 真線索與干擾線索共用同一繪製（視覺完全相同）。
export function drawClueToken(
  g: Gfx, cx: number, cy: number, radius: number, type: ClueType, pal: Palette,
): void {
  const accent = type === 'scent' ? pal.glow : pal.gold;
  g.fillStyle(pal.bg, 1).fillCircle(cx, cy, radius);
  g.lineStyle(1.5, accent, 1).strokeCircle(cx, cy, radius);
  const s = radius / 13; // 字形以半徑 13 為基準設計
  if (type === 'footprint') {
    g.fillStyle(accent, 1);
    g.fillEllipse(cx - 3 * s, cy - 4 * s, 4.6 * s, 6.8 * s);
    g.fillEllipse(cx + 3 * s, cy - 4 * s, 4.6 * s, 6.8 * s);
    g.fillEllipse(cx, cy + 3.5 * s, 9.2 * s, 7.2 * s);
  } else if (type === 'disturbance') {
    g.lineStyle(1.6 * s, accent, 1);
    g.beginPath();
    g.arc(cx, cy, 6.5 * s, Math.PI * 0.6, Math.PI * 2.2);
    g.strokePath();
    g.beginPath();
    g.arc(cx, cy, 3 * s, Math.PI * 1.1, Math.PI * 2.6);
    g.strokePath();
  } else {
    // 三條上升波紋：各以兩段半弧組成 S 形
    g.lineStyle(1.6 * s, accent, 1);
    for (const off of [-4.5, 0, 4.5]) {
      const x = cx + off * s;
      g.beginPath();
      g.arc(x, cy - 3 * s, 3 * s, -Math.PI / 2, Math.PI / 2, false);
      g.strokePath();
      g.beginPath();
      g.arc(x, cy + 3 * s, 3 * s, Math.PI / 2, -Math.PI / 2, false);
      g.strokePath();
    }
  }
}

// 補給：霧葉（尖橢圓葉）與露珠果（圓果＋高光）交錯呈現
export function drawSupply(
  g: Gfx, cx: number, cy: number, cell: number, index: number, pal: Palette,
): void {
  if (index % 2 === 0) {
    g.fillStyle(pal.supply, 0.95);
    g.fillEllipse(cx, cy, cell * 0.34, cell * 0.52);
    g.lineStyle(1, pal.bg, 0.8).lineBetween(cx, cy + cell * 0.2, cx, cy - cell * 0.2);
  } else {
    g.fillStyle(0x8fb8de, 1).fillCircle(cx, cy, cell * 0.22);
    g.fillStyle(pal.paper, 0.85).fillCircle(cx - cell * 0.07, cy - cell * 0.07, cell * 0.07);
  }
}

// 已判讀線索的覆蓋層（設計板）：足跡＝金色錐形（淡填色＋點描邊線）、
// 擾動＝金色虛線圓域、氣味＝發光色虛線距離環。
// 由 MapScene 與 DemoScene 共用——示範看到的圖形必須與真實地圖逐像素相同，
// 否則玩家在示範裡學到的形狀在真實地圖上認不出來。
// windstone 為真時，氣味的完整距離環收窄為 240° 偏心弧（風向石效果）。
export function drawClueOverlay(
  g: Gfx, c: Clue, center: { x: number; y: number }, cell: number,
  pal: Palette, windstone: boolean,
): void {
  if (c.type === 'footprint') {
    const len = cell * 5;
    const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
    const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
    const p1 = { x: center.x + len * Math.cos(a1), y: center.y + len * Math.sin(a1) };
    const p2 = { x: center.x + len * Math.cos(a2), y: center.y + len * Math.sin(a2) };
    g.fillStyle(pal.gold, 0.1).fillTriangle(center.x, center.y, p1.x, p1.y, p2.x, p2.y);
    dashedLine(g, center.x, center.y, p1.x, p1.y, pal.gold, 0.55);
    dashedLine(g, center.x, center.y, p2.x, p2.y, pal.gold, 0.55);
  } else if (c.type === 'disturbance') {
    g.fillStyle(pal.gold, 0.05).fillCircle(center.x, center.y, c.data.radius * cell);
    dashedCircle(g, center.x, center.y, c.data.radius * cell, pal.gold, 0.45, 2, 6, 9);
  } else if (windstone) {
    dashedArc(g, center.x, center.y, c.data.distance * cell, c.data.biasDirection, 240, pal.glow, 0.5, 2, 3, 8);
  } else {
    dashedCircle(g, center.x, center.y, c.data.distance * cell, pal.glow, 0.5, 2, 3, 8);
  }
}

// 玩家的三態標記：排除＝紅 X、存疑＝黃 ?、押注＝金色雙環（押注全場唯一）。
// 由 MapScene 與 DemoScene 共用——排除／存疑／押注正是示範要教的三件事，
// 它們在示範裡長的樣子必須與真實地圖一模一樣，否則玩家學到的記號在真圖上認不得。
export function drawMark(
  g: Gfx, kind: MarkKind, cx: number, cy: number, cell: number, pal: Palette,
): void {
  const r = cell * 0.32;
  if (kind === 'exclude') {
    g.lineStyle(3, pal.mark, 0.9);
    g.lineBetween(cx - r, cy - r, cx + r, cy + r);
    g.lineBetween(cx + r, cy - r, cx - r, cy + r);
  } else if (kind === 'suspect') {
    g.lineStyle(2.4, pal.supply, 0.9);
    g.strokeCircle(cx, cy, r * 0.85);
    g.lineBetween(cx, cy - r * 0.3, cx, cy + r * 0.2);
    g.fillStyle(pal.supply, 0.9).fillCircle(cx, cy + r * 0.5, 1.6);
  } else {
    g.lineStyle(2.6, pal.gold, 1).strokeCircle(cx, cy, r);
    g.lineStyle(1.4, pal.gold, 0.7).strokeCircle(cx, cy, r * 0.55);
    g.fillStyle(pal.gold, 1).fillCircle(cx, cy, r * 0.2);
  }
}

// 筆觸感不規則圓角（設計板：體力條/按鈕）
export const BRUSH_RADIUS = { tl: 9, tr: 4, br: 8, bl: 5 };

// 品質蓋印色（結算場景）：銅／銀／金
export const QUALITY_COLORS: Record<Quality, number> = {
  bronze: 0xb08d57,
  silver: 0xc3ccd2,
  gold: CLUE_GOLD,
};

export interface Fonts {
  display: string;
  displayZh: string;
  body: string;
}

export const FONTS: Fonts = {
  display: '"Marcellus", Georgia, "Noto Serif TC", serif',
  displayZh: '"Noto Serif TC", "MingLiU", "Microsoft JhengHei", serif',
  body: '"Karla", "Segoe UI", "Noto Sans TC", sans-serif',
};

// 依語系挑選展示字體：zh-TW 用中文襯線堆疊，其餘沿用拉丁展示字
export const displayFont = (locale: Locale): string =>
  locale === 'zh-TW' ? FONTS.displayZh : FONTS.display;

// 生物貼圖 key：sprite 素材優先（美術管線選配，見 docs/ASSETS.md），未提供時剪影後備
export function creatureTexKey(scene: Phaser.Scene, id: string): string {
  return scene.textures.exists(`spr-${id}`) ? `spr-${id}` : `sil-${id}`;
}

// 地形紋理（選配）：載入成功回傳可平鋪的貼圖來源，否則回傳 null（呼叫端維持純色塊）。
export function terrainTexImage(
  scene: Phaser.Scene, type: TerrainType,
): HTMLImageElement | HTMLCanvasElement | null {
  const key = `terr-${type}`;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  return src instanceof HTMLImageElement || src instanceof HTMLCanvasElement ? src : null;
}

// 剪影母檔 208×176（實際墨形寬約 144px）與 sprite 128×128（實際造型寬約 112px）
// 兩者原生尺寸不同，同一 setScale 會讓 sprite 明顯偏小；此係數讓兩者在畫面上等大。
export const SPRITE_SCALE_RATIO = 1.3;

// 依實際使用的貼圖回傳顯示倍率：sprite 放大 SPRITE_SCALE_RATIO，剪影沿用原倍率。
export function creatureScale(texKey: string, silhouetteScale: number): number {
  return texKey.startsWith('spr-') ? silhouetteScale * SPRITE_SCALE_RATIO : silhouetteScale;
}

// 去除字串前後的方括號（含全形），用於按鈕文字裁切「[ ]」外框
export const stripBrackets = (s: string): string =>
  s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');
