import Phaser from 'phaser';
import type { I18n } from '../core/i18n';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { DEMO_STEPS } from '../core/demo';
import { cssHex, FONTS, displayFont } from './paint';

type DemoFrom = 'Camp' | 'Map' | 'Result';

// 推理示範：以並行場景疊在暫停的來源場景上（同 HelpScene 的手法）。
// 課程內容全部在 src/core/demo.ts，本檔只負責把它畫出來與收玩家的點擊。
export class DemoScene extends Phaser.Scene {
  private pal!: Palette;
  private from: DemoFrom = 'Camp';
  private step = 0;

  constructor() {
    super('Demo');
  }

  // 場景實例跨次開啟存活，欄位初始值不會重新套用——每次進來都必須明確歸零，
  // 否則第二次打開會停在上一次離開的那一步（Phase 5 付過代價的同一類問題）。
  init(data: { from?: DemoFrom }) {
    this.from = data?.from ?? 'Camp';
    this.step = 0;
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

    // 暫時的佔位：Task 7 會換成網格與旁白
    this.add.text(cx, py0 + ph / 2, `${DEMO_STEPS.length}`, {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private i18n(): I18n {
    return this.registry.get('i18n');
  }

  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
