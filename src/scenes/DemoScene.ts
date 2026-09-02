import Phaser from 'phaser';
import type { I18n, MsgKey } from '../core/i18n';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import type { Vec2 } from '../core/geometry';
import { intersect, key } from '../core/clues';
import { heatMap, maxHeat } from '../core/deduction';
import type { MarkMap } from '../core/marks';
import {
  DEMO_SIZE, DEMO_CLUES, DEMO_PAIR, DEMO_TARGET, DEMO_STEPS, demoUnseen, type DemoStep,
} from '../core/demo';
import { cssHex, FONTS, displayFont, drawClueToken, drawClueOverlay, drawMark } from './paint';

type DemoFrom = 'Camp' | 'Map' | 'Result';

// 推理示範：以並行場景疊在暫停的來源場景上（同 HelpScene 的手法）。
// 課程內容全部在 src/core/demo.ts，本檔只負責把它畫出來與收玩家的點擊。
export class DemoScene extends Phaser.Scene {
  private pal!: Palette;
  private from: DemoFrom = 'Camp';
  private step = 0;
  private gridG!: Phaser.GameObjects.Graphics;
  private chapterText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private narrationText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private cell = 40;
  private gx = 0;   // 網格左上角
  private gy = 0;
  // 玩家在動手點 ① 選中的排除格。由玩家決定，因此必須存下來，
  // 之後每一步都要把那個紅 ✕ 畫回去。
  private excluded: Vec2 | null = null;
  // 已完成的動手步驟索引。用它讓「上一步」回頭後不必重做一次同樣的動作。
  private done = new Set<number>();

  constructor() {
    super('Demo');
  }

  // 場景實例跨次開啟存活，欄位初始值不會重新套用——每次進來都必須明確歸零，
  // 否則第二次打開會停在上一次離開的那一步（Phase 5 付過代價的同一類問題）。
  init(data: { from?: DemoFrom }) {
    this.from = data?.from ?? 'Camp';
    this.step = 0;
    this.excluded = null;
    this.done = new Set();
  }

  create() {
    const s: SessionState = this.registry.get('session');
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const i18n = this.i18n();
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    // 遮罩：擋住下層場景的點擊
    this.add.rectangle(cx, h / 2, w, h, 0x000000, 0.72).setInteractive();

    const pw = Math.min(580, w - 24);
    const ph = Math.min(636, h - 32);
    const px0 = cx - pw / 2;
    const py0 = (h - ph) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(pal.panel, 1).fillRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });
    panel.lineStyle(1.5, pal.gold, 0.55).strokeRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });

    // 關閉鈕（右上角筆觸 X，同 HelpScene）
    const closeG = this.add.graphics();
    const cxx = px0 + pw - 30;
    const cxy = py0 + 30;
    closeG.lineStyle(2.5, pal.paperDim, 0.9);
    closeG.lineBetween(cxx - 8, cxy - 8, cxx + 8, cxy + 8);
    closeG.lineBetween(cxx + 8, cxy - 8, cxx - 8, cxy + 8);
    this.add.rectangle(cxx, cxy, 40, 40, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    this.add.text(cx, py0 + 34, i18n.t('demo.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '23px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);

    this.chapterText = this.add.text(cx, py0 + 62, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);

    this.progressText = this.add.text(px0 + 30, py0 + 30, '', {
      fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1);

    // 版面由面板底部往上錨定，只有網格會伸縮。下方固定預算合計 197px：
    // 導覽列 55（中心在 ph-34、高 42）＋提示兩行 44＋旁白三行 66＋三段間距 32。
    // 網格因此最多只能吃掉 ph-88-197 的高度；上方 88 是標題與章節列。
    // 舊版把旁白與提示綁在網格底緣、且預算漏算了兩者之間的間距，
    // 預設視窗下導覽列會直接壓在旁白文字上。
    const gridTop = py0 + 88;
    const availH = ph - 88 - 197;
    this.cell = Math.max(16, Math.floor(Math.min((pw - 56) / DEMO_SIZE, availH / DEMO_SIZE)));
    this.gx = cx - (this.cell * DEMO_SIZE) / 2;
    this.gy = gridTop;

    this.gridG = this.add.graphics();

    const narrY = py0 + ph - 177;
    this.narrationText = this.add.text(cx, narrY, '', {
      fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paper),
      wordWrap: { width: pw - 56, useAdvancedWrap: true }, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0);

    // 提示行：只有動手點做錯時才有內容，平時為空字串，不佔視覺重量
    this.hintText = this.add.text(cx, py0 + ph - 107, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.mark),
      wordWrap: { width: pw - 56, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);

    this.render();

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private i18n(): I18n {
    return this.registry.get('i18n');
  }

  // 每一步的標記狀態由步驟索引重新算出，而非逐步累加——
  // 上一步／下一步因此永遠不會累積狀態漂移。
  private marksFor(i: number): MarkMap {
    const m: MarkMap = new Map();
    // 排除標記從玩家做完動手點 ① 的下一步開始出現
    if (this.excluded && i > 2) m.set(key(this.excluded), 'exclude');
    if (DEMO_STEPS[i].autoSuspect) {
      for (const k of DEMO_PAIR) if (!m.has(k)) m.set(k, 'suspect');
    }
    // 押注在揭曉那一步出現（覆蓋掉該格原本的存疑，同真實遊戲的三態語意）
    if (i === DEMO_STEPS.length - 1) m.set(key(DEMO_TARGET), 'wager');
    return m;
  }

  private px(v: Vec2): { x: number; y: number } {
    const cs = this.cell;
    return { x: this.gx + v.x * cs + cs / 2, y: this.gy + v.y * cs + cs / 2 };
  }

  private render() {
    const step: DemoStep = DEMO_STEPS[this.step];
    const i18n = this.i18n();
    const pal = this.pal;
    const g = this.gridG;
    const cs = this.cell;
    g.clear();

    // 底面：一律草地色。示範不教地形——那是 help.stamina 的職責，
    // 在這裡只會讓玩家以為地形也是推理的一部分。
    for (let y = 0; y < DEMO_SIZE; y++) {
      for (let x = 0; x < DEMO_SIZE; x++) {
        g.fillStyle(pal.terrain.meadow, 1).fillRect(this.gx + x * cs, this.gy + y * cs, cs, cs);
      }
    }
    g.lineStyle(1, pal.bg, 0.5);
    for (let i = 0; i <= DEMO_SIZE; i++) {
      g.lineBetween(this.gx + i * cs, this.gy, this.gx + i * cs, this.gy + DEMO_SIZE * cs);
      g.lineBetween(this.gx, this.gy + i * cs, this.gx + DEMO_SIZE * cs, this.gy + i * cs);
    }

    const live = step.clues.filter((i) => !step.muted.includes(i)).map((i) => DEMO_CLUES[i]);

    // 疊層：heat 沿用 MapScene 的正規化透明度公式，讓示範看到的濃淡與真實地圖一致；
    // intersect 用單一較高透明度，把「只剩這一格」講死。
    if (step.overlay === 'heat' && live.length > 0) {
      const heat = heatMap(live, DEMO_SIZE);
      const peak = maxHeat(heat);
      if (peak > 0) {
        for (const [hk, n] of heat) {
          const [hx, hy] = hk.split(',').map(Number);
          g.fillStyle(pal.gold, 0.06 + 0.16 * (n / peak))
            .fillRect(this.gx + hx * cs, this.gy + hy * cs, cs, cs);
        }
      }
    } else if (step.overlay === 'intersect' && live.length > 0) {
      for (const ik of intersect(live, DEMO_SIZE)) {
        const [ix, iy] = ik.split(',').map(Number);
        g.fillStyle(pal.gold, 0.3).fillRect(this.gx + ix * cs, this.gy + iy * cs, cs, cs);
      }
    }

    // 線索覆蓋層（未靜音者）與線索記號
    for (const i of step.clues) {
      if (step.muted.includes(i)) continue;
      drawClueOverlay(g, DEMO_CLUES[i], this.px(DEMO_CLUES[i].position), cs, pal, false);
    }
    const tokenR = Math.max(8, cs * 0.34);
    for (const i of step.clues) {
      const p = this.px(DEMO_CLUES[i].position);
      drawClueToken(g, p.x, p.y, tokenR, DEMO_CLUES[i].type, pal);
      if (step.muted.includes(i)) {
        // 靜音斜槓：與 MapScene 及 ♪ chip 同一套語彙
        g.lineStyle(2, pal.paperDim, 0.95);
        g.lineBetween(p.x - tokenR, p.y + tokenR, p.x + tokenR, p.y - tokenR);
      }
    }

    // 三態標記：與 MapScene 共用 paint.drawMark，形狀由建構保證一致
    for (const [mk, kind] of this.marksFor(this.step)) {
      const [mx, my] = mk.split(',').map(Number);
      const p = this.px({ x: mx, y: my });
      drawMark(g, kind, p.x, p.y, cs, pal);
    }

    // 迷霧：同 MapScene 的壓暗而非全黑
    for (const uk of demoUnseen(step)) {
      const [ux, uy] = uk.split(',').map(Number);
      g.fillStyle(0x000000, 0.62).fillRect(this.gx + ux * cs, this.gy + uy * cs, cs, cs);
    }

    // 玩家：光暈＋紙墨白圓點
    const pp = this.px(step.player);
    g.fillStyle(pal.paper, 0.18).fillCircle(pp.x, pp.y, cs * 0.42);
    g.fillStyle(pal.paper, 1).fillCircle(pp.x, pp.y, cs * 0.2);

    // 揭曉：最後一步畫出真實位置（同 help.reveal 圖示的語彙）
    if (this.step === DEMO_STEPS.length - 1) {
      const t = this.px(DEMO_TARGET);
      g.fillStyle(pal.glow, 1).fillCircle(t.x, t.y, cs * 0.18);
      g.lineStyle(2.5, pal.gold, 1).strokeCircle(t.x, t.y, cs * 0.44);
    }

    this.chapterText.setText(i18n.t(CHAPTER_KEY[step.chapter]));
    this.progressText.setText(
      i18n.t('demo.progress', { n: this.step + 1, total: DEMO_STEPS.length }));
    this.narrationText.setText(i18n.t(step.narration, step.vars));
    this.hintText.setText('');
  }

  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}

// 章節字串鍵映射：同 MapScene 的 WEATHER_KEY 手法，
// 避免模板字面型別（`demo.ch${n}`）無法收斂為 MsgKey 聯集
const CHAPTER_KEY: Record<1 | 2 | 3 | 4, MsgKey> = {
  1: 'demo.ch1', 2: 'demo.ch2', 3: 'demo.ch3', 4: 'demo.ch4',
};
