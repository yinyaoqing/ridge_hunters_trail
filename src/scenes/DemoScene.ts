import Phaser from 'phaser';
import type { I18n, MsgKey } from '../core/i18n';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import type { Vec2 } from '../core/geometry';
import { intersect, key } from '../core/clues';
import { heatMap, maxHeat } from '../core/deduction';
import type { MarkMap } from '../core/marks';
import {
  demoScript, type DemoScript, type DemoScriptId, type DemoStep,
} from '../core/demo';
import {
  cssHex, FONTS, displayFont, drawClueToken, drawClueOverlay, drawMark, stripBrackets, BRUSH_RADIUS,
} from './paint';

type DemoFrom = 'Camp' | 'Map' | 'Result';

// 推理示範：以並行場景疊在暫停的來源場景上（同 HelpScene 的手法）。
// 課程內容全部在 src/core/demo.ts，本檔只負責把它畫出來與收玩家的點擊。
export class DemoScene extends Phaser.Scene {
  private pal!: Palette;
  private from: DemoFrom = 'Camp';
  private script: DemoScript = demoScript('deduction');
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
  private prevG!: Phaser.GameObjects.Graphics;
  private prevTxt!: Phaser.GameObjects.Text;
  private nextG!: Phaser.GameObjects.Graphics;
  private nextTxt!: Phaser.GameObjects.Text;
  private navY = 0;
  // 'pick-age' 步驟的新鮮度 chip：與 MapScene 的 heatAge 同款四態循環，
  // 但這裡是「玩家還沒選對就不能過關」的動手點，不是持久的圖層設定，
  // 因此每次進入一個新的 pick-age 步驟都要歸零（見 render()）。
  private ageChipG!: Phaser.GameObjects.Graphics;
  private ageChipText!: Phaser.GameObjects.Text;
  private ageChipHit!: Phaser.GameObjects.Rectangle;
  private ageChipX = 0;
  private ageChipY = 0;
  private ageChipW = 0;
  private ageChipH = 0;
  private ageChoice: 0 | 1 | 2 | null = 2;

  constructor() {
    super('Demo');
  }

  // 場景實例跨次開啟存活，欄位初始值不會重新套用——每次進來都必須明確歸零，
  // 否則第二次打開會停在上一次離開的那一步（Phase 5 付過代價的同一類問題）。
  init(data: { from?: DemoFrom; scriptId?: DemoScriptId }) {
    this.from = data?.from ?? 'Camp';
    this.script = demoScript(data?.scriptId ?? 'deduction');
    this.step = 0;
    this.excluded = null;
    this.done = new Set();
    this.ageChoice = 2;
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

    this.add.text(cx, py0 + 34, i18n.t(this.script.titleKey), {
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
    const size = this.script.size;
    this.cell = Math.max(16, Math.floor(Math.min((pw - 56) / size, availH / size)));
    this.gx = cx - (this.cell * size) / 2;
    this.gy = gridTop;

    this.gridG = this.add.graphics();

    // 遮罩：把網格圖層剪裁在網格矩形內。drawClueOverlay 是以格數換算世界座標畫距離圈，
    // 氣味線索半徑達 6 格，在這張窄卡片裡足以畫出面板外、蓋過旁白與按鈕——
    // MapScene 沒事是因為地圖本身佔滿整個視窗，沒有邊界可越。這裡網格只是卡片裡
    // 的一小塊，必須自己擋住溢出（做法同 HelpScene 列表捲動用的幾何遮罩）。
    const gridMask = this.make.graphics({}, false);
    gridMask.fillStyle(0xffffff).fillRect(this.gx, this.gy, this.cell * size, this.cell * size);
    this.gridG.setMask(gridMask.createGeometryMask());

    // 單一互動矩形覆蓋整個網格，由座標換算格子——比建立 81 個互動物件簡單，
    // 也與 MapScene 的做法一致。
    const gw = this.cell * size;
    this.add.rectangle(this.gx + gw / 2, this.gy + gw / 2, gw, gw, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => this.onGridClick(p));

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

    // 新鮮度 chip（'pick-age' 步驟專用）：與 MapScene 的新鮮度 chip 同款外觀（金色描邊、
    // 標籤取 age.*），共用提示行那一列版面——'pick-age' 步驟規格明定切錯不出提示，
    // 那一列本來就閒置，不必另外挪版面、不會撞上其餘步驟的提示文字。
    this.ageChipW = 100;
    this.ageChipH = 30;
    this.ageChipX = cx - this.ageChipW / 2;
    this.ageChipY = py0 + ph - 107;
    this.ageChipG = this.add.graphics();
    this.ageChipText = this.add.text(cx, this.ageChipY + this.ageChipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.ageChipHit = this.add.rectangle(
      cx, this.ageChipY + this.ageChipH / 2, this.ageChipW, Math.max(this.ageChipH, 44), 0, 0,
    )
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onAgeChipClick());

    // 導覽列：面板底部，上一步／下一步各半。關閉走右上角的 X 或 ESC。
    this.navY = py0 + ph - 34;
    const nbw = 150;
    const nbh = 42;
    this.prevG = this.add.graphics();
    this.prevTxt = this.add.text(cx - 82, this.navY, stripBrackets(i18n.t('btn.prev')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx - 82, this.navY, nbw, Math.max(nbh, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goto(this.step - 1));

    this.nextG = this.add.graphics();
    this.nextTxt = this.add.text(cx + 82, this.navY, stripBrackets(i18n.t('btn.next')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.bg), fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx + 82, this.navY, nbw, Math.max(nbh, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goto(this.step + 1));

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
    // 排除標記從玩家做完動手點 ① 的那一步起就要畫（含當步本身）：
    // 這樣「上一步」從第 4 步退回第 3 步時，玩家自己選的那個 ✕ 仍在原地——
    // 首次造訪第 3 步時 this.excluded 還是 null，不受影響。
    if (this.excluded && i >= 2) m.set(key(this.excluded), 'exclude');
    if (this.script.steps[i].autoSuspect) {
      for (const k of this.script.pair) if (!m.has(k)) m.set(k, 'suspect');
    }
    // 押注在揭曉那一步出現（覆蓋掉該格原本的存疑，同真實遊戲的三態語意）
    if (i === this.script.steps.length - 1) m.set(key(this.script.target), 'wager');
    return m;
  }

  private px(v: Vec2): { x: number; y: number } {
    const cs = this.cell;
    return { x: this.gx + v.x * cs + cs / 2, y: this.gy + v.y * cs + cs / 2 };
  }

  private render() {
    const step: DemoStep = this.script.steps[this.step];
    const i18n = this.i18n();
    const pal = this.pal;
    const g = this.gridG;
    const cs = this.cell;
    const size = this.script.size;
    const clues = this.script.clues;
    g.clear();

    // 底面：一律草地色。示範不教地形——那是 help.stamina 的職責，
    // 在這裡只會讓玩家以為地形也是推理的一部分。
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        g.fillStyle(pal.terrain.meadow, 1).fillRect(this.gx + x * cs, this.gy + y * cs, cs, cs);
      }
    }
    g.lineStyle(1, pal.bg, 0.5);
    for (let i = 0; i <= size; i++) {
      g.lineBetween(this.gx + i * cs, this.gy, this.gx + i * cs, this.gy + size * cs);
      g.lineBetween(this.gx, this.gy + i * cs, this.gx + size * cs, this.gy + i * cs);
    }

    const live = step.clues.filter((i) => !step.muted.includes(i)).map((i) => clues[i]);

    // 新鮮度篩選：heatAge 為 null／undefined 時不篩（第一課全程如此，行為與加這段之前完全相同）
    const age = step.heatAge ?? null;
    const shown = age === null ? live : live.filter((c) => c.age === age);

    // 迷霧：畫在地形與格線之後、疊層之前——順序刻意與 MapScene 不同。真實地圖上迷霧
    // 代表「這片地你看不見」，蓋在所有東西最上層合理；但示範裡的疊層、記號都是在
    // 教玩家對「已經在教的那片地」做推理，不是要重現視野限制本身，所以必須留在迷霧
    // 之上維持可讀——第 3 步要玩家「挑一格在錐外的排除」，兩列霧區裡就有 10 格落在
    // 錐內，壓在迷霧最上層會讓那 10 格的金色錐形壓暗到看不出來，排除變成看運氣。
    for (const uk of this.script.unseen(step)) {
      const [ux, uy] = uk.split(',').map(Number);
      g.fillStyle(0x000000, 0.62).fillRect(this.gx + ux * cs, this.gy + uy * cs, cs, cs);
    }

    // 疊層：heat 沿用 MapScene 的正規化透明度公式，讓示範看到的濃淡與真實地圖一致；
    // intersect 用單一較高透明度，把「只剩這一格」講死。兩者都吃 shown（依 heatAge 篩過
    // 齡別），不是 live——齡別改變的是熱區與交集，不是「線索存在與否」。
    if (step.overlay === 'heat' && shown.length > 0) {
      const heat = heatMap(shown, size);
      const peak = maxHeat(heat);
      if (peak > 0) {
        for (const [hk, n] of heat) {
          const [hx, hy] = hk.split(',').map(Number);
          g.fillStyle(pal.gold, 0.06 + 0.16 * (n / peak))
            .fillRect(this.gx + hx * cs, this.gy + hy * cs, cs, cs);
        }
      }
    } else if (step.overlay === 'intersect' && shown.length > 0) {
      for (const ik of intersect(shown, size)) {
        const [ix, iy] = ik.split(',').map(Number);
        g.fillStyle(pal.gold, 0.3).fillRect(this.gx + ix * cs, this.gy + iy * cs, cs, cs);
      }
    }

    // 線索覆蓋層（未靜音者）。overlay 為 'none' 時不畫任何範圍圈——那代表「線索的
    // 記號已經在地圖上，但玩家還沒走過去判讀它」，正是真實遊戲裡「看到標記」與
    // 「走到標記旁才解出範圍」的差別；記號本身仍要畫（見下方 token 迴圈，不受此限）。
    if (step.overlay !== 'none') {
      for (const i of step.clues) {
        if (step.muted.includes(i)) continue;
        drawClueOverlay(g, clues[i], this.px(clues[i].position), cs, pal, false);
      }
    }
    const tokenR = Math.max(8, cs * 0.34);
    for (const i of step.clues) {
      const p = this.px(clues[i].position);
      drawClueToken(g, p.x, p.y, tokenR, clues[i].type, pal);
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

    // 玩家：光暈＋紙墨白圓點
    const pp = this.px(step.player);
    g.fillStyle(pal.paper, 0.18).fillCircle(pp.x, pp.y, cs * 0.42);
    g.fillStyle(pal.paper, 1).fillCircle(pp.x, pp.y, cs * 0.2);

    // 揭曉：最後一步畫出真實位置（同 help.reveal 圖示的語彙）
    if (this.step === this.script.steps.length - 1) {
      const t = this.px(this.script.target);
      g.fillStyle(pal.glow, 1).fillCircle(t.x, t.y, cs * 0.18);
      g.lineStyle(2.5, pal.gold, 1).strokeCircle(t.x, t.y, cs * 0.44);
    }

    this.chapterText.setText(i18n.t(CHAPTER_KEY[step.chapter]));
    this.progressText.setText(
      i18n.t('demo.progress', { n: this.step + 1, total: this.script.steps.length }));
    this.narrationText.setText(i18n.t(step.narration, step.vars));
    this.hintText.setText('');

    // 新鮮度 chip：只有本步 action 為 'pick-age' 且尚未過關時顯示與可點。
    // 每次進入這樣的一步都從 2（今晨）重新開始循環——render() 只在步驟切換時
    // 整段重跑（見 goto()），同一步內的循環點擊只更新 chip 文字，不會再次
    // 經過這裡，因此在此歸零不會抹掉玩家在同一步內已經做的選擇。
    const pickAge = step.action === 'pick-age' && !this.done.has(this.step);
    if (pickAge) {
      this.ageChoice = 2;
      this.drawAgeChip();
    } else {
      this.ageChipG.clear();
      this.ageChipText.setText('');
    }
    this.ageChipG.setVisible(pickAge);
    this.ageChipText.setVisible(pickAge);
    this.ageChipHit.setVisible(pickAge);

    this.drawNav();
  }

  // 新鮮度 chip 標籤：只顯示目前選中的齡別本身（同 MapScene.ageLabel 的取捨——
  // 前綴會讓標籤過長，選項本身已足以說明目前選的是哪一齡）。
  private ageLabel(age: 0 | 1 | 2 | null): string {
    const valueKey = age === null ? 'age.all' : (['age.older', 'age.night', 'age.fresh'] as const)[age];
    return this.i18n().t(valueKey);
  }

  // 新鮮度 chip 外觀：與 MapScene 同款金色描邊。
  private drawAgeChip() {
    const pal = this.pal;
    const { ageChipX: x, ageChipY: y, ageChipW: w, ageChipH: h } = this;
    this.ageChipG.clear();
    this.ageChipG.lineStyle(1.5, pal.gold, 0.75).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
    this.ageChipText.setColor(cssHex(pal.gold)).setText(this.ageLabel(this.ageChoice));
  }

  // 新鮮度 chip 點擊：依 2 → 1 → 0 → null → 2 循環。切錯不是答錯——只是還沒切到，
  // 不出提示、不阻擋，切到該步 heatAge 指定的值才視為通過並前進。
  private onAgeChipClick() {
    const step = this.script.steps[this.step];
    if (step.action !== 'pick-age' || this.done.has(this.step)) return;
    this.ageChoice = this.ageChoice === 2 ? 1 : this.ageChoice === 1 ? 0 : this.ageChoice === 0 ? null : 2;
    if (this.ageChoice === (step.heatAge ?? null)) {
      this.done.add(this.step);
      this.goto(this.step + 1);
      return;
    }
    this.ageChipText.setText(this.ageLabel(this.ageChoice));
  }

  // 動手步驟必須先完成才放行。做過一次之後(this.done 記著)，
  // 回頭再前進就不必重做——玩家用「上一步」回去看畫面是常態，
  // 不該因此被罰再操作一次。
  private canAdvance(): boolean {
    const step = this.script.steps[this.step];
    return !step.action || this.done.has(this.step);
  }

  private goto(i: number) {
    if (i < 0 || i >= this.script.steps.length) return;
    if (i > this.step && !this.canAdvance()) return;
    this.step = i;
    this.render();
  }

  // 導覽鈕外觀：下一步在不可前進時以描邊＋暗色呈現，明確表示「還有事要做」。
  private drawNav() {
    const pal = this.pal;
    const cx = this.scale.width / 2;
    const nbw = 150;
    const nbh = 42;
    const box = (x: number) => ({ x: x - nbw / 2, y: this.navY - nbh / 2, w: nbw, h: nbh });

    const pb = box(cx - 82);
    this.prevG.clear();
    const canBack = this.step > 0;
    this.prevG.lineStyle(1.5, pal.gold, canBack ? 0.65 : 0.15)
      .strokeRoundedRect(pb.x, pb.y, pb.w, pb.h, BRUSH_RADIUS);
    this.prevTxt.setColor(cssHex(pal.gold)).setAlpha(canBack ? 1 : 0.3);

    const nb = box(cx + 82);
    const last = this.step === this.script.steps.length - 1;
    const open = this.canAdvance() && !last;
    this.nextG.clear();
    if (open) {
      this.nextG.fillStyle(pal.gold, 0.92).fillRoundedRect(nb.x, nb.y, nb.w, nb.h, BRUSH_RADIUS);
      this.nextTxt.setColor(cssHex(pal.bg)).setAlpha(1);
    } else {
      this.nextG.lineStyle(1.5, pal.gold, 0.15).strokeRoundedRect(nb.x, nb.y, nb.w, nb.h, BRUSH_RADIUS);
      this.nextTxt.setColor(cssHex(pal.gold)).setAlpha(0.3);
    }
  }

  // 網格點擊。只有在該步有動手點時才有作用——其餘步驟點格子不該有任何效果，
  // 免得玩家以為自己弄壞了什麼。
  private onGridClick(p: Phaser.Input.Pointer) {
    const step = this.script.steps[this.step];
    if (!step.action || this.done.has(this.step)) return;

    const cs = this.cell;
    const size = this.script.size;
    const cell = {
      x: Math.floor((p.x - this.gx) / cs),
      y: Math.floor((p.y - this.gy) / cs),
    };
    if (cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size) return;

    if (step.action === 'mute') {
      // 靜音要點的是線索記號，不是格子。先找出被點到的是哪一條已判讀的線索；
      // 點在空地上不給提示——那不是「答錯」，只是還沒點到東西。
      const hit = step.clues.find((i) => {
        const q = this.script.clues[i].position;
        return q.x === cell.x && q.y === cell.y;
      });
      if (hit === undefined) return;
      this.resolve(this.script.checkClue(hit));
      return;
    }

    // DemoAction 還有 'pick-age'，但那一步沒有格子動作可點——它走專屬的
    // onAgeChipClick()，不經過這裡；這裡純粹是型別窄化，不改變任何一步的實際行為。
    if (step.action !== 'exclude' && step.action !== 'wager') return;
    this.resolve(this.script.checkCell(step.action, cell), cell);
  }

  // 動手點的共同收尾：答對就記下並自動前進到下一步（下一步的資料本身就是
  // 這個動作的結果，因此不需要任何中間狀態或計時器）；答錯就顯示提示，畫面不動。
  private resolve(hint: MsgKey | null, cell?: Vec2) {
    if (hint !== null) {
      this.hintText.setText(this.i18n().t(hint));
      return;
    }
    if (this.script.steps[this.step].action === 'exclude' && cell) this.excluded = cell;
    this.done.add(this.step);
    this.goto(this.step + 1);
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
