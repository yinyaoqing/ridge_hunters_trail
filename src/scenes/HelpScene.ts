import Phaser from 'phaser';
import type { SessionState } from '../core/session';
import type { Weather } from '../core/weather';
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
    // 10 列版面預算（Phase 4）：列距維持 44px，末列 y=py0+574，
    // 開始按鈕上緣＝py0+ph-56-24=py0+600，間距 26px（與 9 列版相同的淨空）。
    // 面板底緣 py0+ph = 78+680 = 758，仍在規格書 §11.1 的 720×780 embed 視窗內。
    const ph = 680;
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

    // 天氣小圖形（同 MapScene 徽章筆觸，HelpScene 場景自成一體慣例下重複實作而非共用私有方法）：
    // 晴＝圓圈、霧＝兩短橫、風＝三斜線、雨＝兩斜點
    const drawWeatherGlyph = (gx: number, gy: number, wtr: Weather) => {
      icons.lineStyle(1.3, pal.paperDim, 0.9);
      switch (wtr) {
        case 'clear':
          icons.strokeCircle(gx, gy, 4);
          break;
        case 'mist':
          icons.lineBetween(gx - 4, gy - 2, gx + 4, gy - 2);
          icons.lineBetween(gx - 4, gy + 2, gx + 4, gy + 2);
          break;
        case 'wind':
          icons.lineBetween(gx - 6, gy - 5, gx + 4, gy - 3);
          icons.lineBetween(gx - 6, gy - 1, gx + 4, gy + 1);
          icons.lineBetween(gx - 6, gy + 3, gx + 4, gy + 5);
          break;
        case 'drizzle':
          icons.lineBetween(gx - 4, gy - 4, gx - 2, gy + 2);
          icons.lineBetween(gx + 2, gy - 4, gx + 4, gy + 2);
          break;
      }
    };

    // 10 列版面預算（Phase 4）：列距維持 44px，詳見上方 ph 定義處的註解。
    const rows: { y: number; key: Parameters<I18n['t']>[0]; icon: (y: number) => void }[] = [
      { y: py0 + 178, key: 'help.footprint', icon: (y) => drawClueToken(icons, rowX, y, 15, 'footprint', pal) },
      { y: py0 + 222, key: 'help.disturbance', icon: (y) => drawClueToken(icons, rowX, y, 15, 'disturbance', pal) },
      { y: py0 + 266, key: 'help.scent', icon: (y) => drawClueToken(icons, rowX, y, 15, 'scent', pal) },
      {
        y: py0 + 310, key: 'help.decoy',
        icon: (y) => {
          drawClueToken(icons, rowX, y, 15, 'footprint', pal);
          icons.lineStyle(2, pal.mark, 0.9);
          icons.lineBetween(rowX + 8, y - 12, rowX + 16, y - 4);
          icons.lineBetween(rowX + 16, y - 12, rowX + 8, y - 4);
        },
      },
      {
        y: py0 + 354, key: 'help.stamina',
        icon: (y) => {
          drawSupply(icons, rowX - 8, y, 34, 0, pal);
          drawSupply(icons, rowX + 10, y, 34, 1, pal);
        },
      },
      {
        y: py0 + 398, key: 'help.marks',
        icon: (y) => {
          // 排除：紅 ✕
          icons.lineStyle(2.4, pal.mark, 0.9);
          icons.lineBetween(rowX - 20, y - 7, rowX - 8, y + 7);
          icons.lineBetween(rowX - 8, y - 7, rowX - 20, y + 7);
          // 存疑：黃圈＋點
          icons.lineStyle(2, pal.supply, 0.9).strokeCircle(rowX, y - 1, 6);
          icons.fillStyle(pal.supply, 0.9).fillCircle(rowX, y + 8, 1.6);
          // 押注：金色雙環
          icons.lineStyle(2.2, pal.gold, 1).strokeCircle(rowX + 18, y, 8);
          icons.fillStyle(pal.gold, 1).fillCircle(rowX + 18, y, 2.4);
        },
      },
      {
        y: py0 + 442, key: 'help.qte',
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
        y: py0 + 486, key: 'help.layer',
        icon: (y) => {
          // 三格由淡到濃的金色方塊，對應熱區的熱度分級
          const sq = 9;
          const gap = 3;
          let x = rowX - (sq * 3 + gap * 2) / 2;
          for (const a of [0.12, 0.24, 0.38]) {
            icons.fillStyle(pal.gold, a).fillRect(x, y - sq / 2, sq, sq);
            x += sq + gap;
          }
          icons.lineStyle(1, pal.gold, 0.5).strokeRect(rowX - 16.5, y - sq / 2, sq * 3 + gap * 2, sq);
        },
      },
      {
        y: py0 + 530, key: 'help.reveal',
        icon: (y) => {
          // 揭曉：生物色實心點＋金色脈動環的靜態版（同 RevealScene 的真實位置圖示）
          icons.fillStyle(pal.glow, 1).fillCircle(rowX, y, 4);
          icons.lineStyle(2, pal.gold, 1).strokeCircle(rowX, y, 10);
        },
      },
      {
        // 第 10 列：與開始按鈕上緣（py0+600）保有 26px 間距，見上方版面預算註解
        y: py0 + 574, key: 'help.weather',
        icon: (y) => {
          const order: Weather[] = ['clear', 'mist', 'wind', 'drizzle'];
          const gap = 20;
          let x = rowX - (gap * (order.length - 1)) / 2;
          for (const wtr of order) {
            drawWeatherGlyph(x, y, wtr);
            x += gap;
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
