import Phaser from 'phaser';
import type { ClueType, Locale } from '../core/types';
import { CLUE_GOLD, type Palette } from '../core/palette';
import type { Quality } from '../core/quality';

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

// 去除字串前後的方括號（含全形），用於按鈕文字裁切「[ ]」外框
export const stripBrackets = (s: string): string =>
  s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');
