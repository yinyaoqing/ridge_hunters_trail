import Phaser from 'phaser';
import type { SessionState } from '../core/session';
import type { TerrainType } from '../core/types';
import { getPalette, type Palette } from '../core/palette';
import type { I18n } from '../core/i18n';
import { cssHex, drawClueToken, drawSupply, BRUSH_RADIUS, FONTS, displayFont } from './paint';

// 玩法說明彈窗：以並行場景疊在暫停的地圖上（半透明遮罩＋面板卡片）。
// 首次啟動由 MapScene 自動開啟，之後可從 HUD 的「?」鈕重開。
export class HelpScene extends Phaser.Scene {
  private pal!: Palette;
  private from: 'Camp' | 'Map' = 'Map';

  constructor() {
    super('Help');
  }

  init(data: { from?: 'Camp' | 'Map' }) {
    this.from = data.from ?? 'Map';
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const i18n: I18n = this.registry.get('i18n');
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    // 遮罩：擋住下層地圖的點擊
    this.add.rectangle(cx, h / 2, w, h, 0x000000, 0.62).setInteractive();

    // 面板
    const pw = 580;
    const ph = 636;
    const px0 = cx - pw / 2;
    const py0 = 78;
    const panel = this.add.graphics();
    panel.fillStyle(pal.panel, 1).fillRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });
    panel.lineStyle(1.5, pal.gold, 0.55).strokeRoundedRect(px0, py0, pw, ph, { tl: 14, tr: 8, br: 13, bl: 9 });

    // 關閉鈕（右上角筆觸 X）
    const closeG = this.add.graphics();
    const cxx = px0 + pw - 30;
    const cxy = py0 + 30;
    closeG.lineStyle(2.5, pal.paperDim, 0.9);
    closeG.lineBetween(cxx - 8, cxy - 8, cxx + 8, cxy + 8);
    closeG.lineBetween(cxx + 8, cxy - 8, cxx - 8, cxy + 8);
    this.add.rectangle(cxx, cxy, 40, 40, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    // 語言切換（首次開啟的玩家需要能在這裡換語言）
    this.add.text(px0 + 30, py0 + 22, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setLetterSpacing(1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.scene.restart();
      });

    this.add.text(cx, py0 + 52, i18n.t('help.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '27px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);

    this.add.text(cx, py0 + 108, i18n.t('help.goal'), {
      fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paperDim),
      wordWrap: { width: 490, useAdvancedWrap: true }, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);

    // 圖例列：用遊戲內實際圖形當說明
    const icons = this.add.graphics();
    const rowX = px0 + 46;
    const textX = px0 + 84;
    const rows: { y: number; key: Parameters<I18n['t']>[0]; icon: (y: number) => void }[] = [
      { y: py0 + 178, key: 'help.footprint', icon: (y) => drawClueToken(icons, rowX, y, 15, 'footprint', pal) },
      { y: py0 + 226, key: 'help.disturbance', icon: (y) => drawClueToken(icons, rowX, y, 15, 'disturbance', pal) },
      { y: py0 + 274, key: 'help.scent', icon: (y) => drawClueToken(icons, rowX, y, 15, 'scent', pal) },
      {
        y: py0 + 322, key: 'help.decoy',
        icon: (y) => {
          drawClueToken(icons, rowX, y, 15, 'footprint', pal);
          icons.lineStyle(2, pal.mark, 0.9);
          icons.lineBetween(rowX + 8, y - 12, rowX + 16, y - 4);
          icons.lineBetween(rowX + 16, y - 12, rowX + 8, y - 4);
        },
      },
      {
        y: py0 + 370, key: 'help.stamina',
        icon: (y) => {
          drawSupply(icons, rowX - 8, y, 34, 0, pal);
          drawSupply(icons, rowX + 10, y, 34, 1, pal);
        },
      },
      {
        y: py0 + 418, key: 'help.mark',
        icon: (y) => {
          icons.lineStyle(3, pal.mark, 0.9);
          icons.lineBetween(rowX - 9, y - 9, rowX + 9, y + 9);
          icons.lineBetween(rowX + 9, y - 9, rowX - 9, y + 9);
        },
      },
      {
        y: py0 + 466, key: 'help.qte',
        icon: (y) => {
          icons.lineStyle(2.5, 0x5c6b73, 1).strokeCircle(rowX, y, 14);
          icons.lineStyle(4, pal.gold, 1);
          icons.beginPath();
          icons.arc(rowX, y, 14, -Math.PI * 0.45, Math.PI * 0.1);
          icons.strokePath();
          icons.lineStyle(2, pal.paper, 1).lineBetween(rowX, y, rowX + 10, y - 7);
          icons.fillStyle(pal.paper, 1).fillCircle(rowX, y, 2.5);
        },
      },
      {
        // 第 8 列（py0+514）：與開始按鈕（py0+ph-56=py0+580）仍保有 66px 間距，未擠壓版面
        y: py0 + 514, key: 'help.terrain',
        icon: (y) => {
          const order: TerrainType[] = ['meadow', 'mist', 'thicket', 'rock'];
          const sq = 6;
          const gap = 2;
          const totalW = order.length * sq + (order.length - 1) * gap;
          let x = rowX - totalW / 2;
          for (const t of order) {
            icons.fillStyle(pal.terrain[t], 1).fillRect(x, y - sq / 2, sq, sq);
            x += sq + gap;
          }
        },
      },
    ];
    for (const row of rows) {
      row.icon(row.y);
      this.add.text(textX, row.y, i18n.t(row.key), {
        fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paperDim),
        wordWrap: { width: pw - (textX - px0) - 40, useAdvancedWrap: true }, lineSpacing: 4,
      }).setOrigin(0, 0.5);
    }

    // 開始按鈕
    const label = i18n.t('btn.start').replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');
    const bw = 240;
    const bh = 48;
    const by = py0 + ph - 56;
    const btn = this.add.graphics();
    btn.fillStyle(pal.gold, 1).fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, BRUSH_RADIUS);
    this.add.text(cx, by, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.bg), fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx, by, bw, bh, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
