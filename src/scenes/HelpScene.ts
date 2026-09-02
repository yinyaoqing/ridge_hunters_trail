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
  // 說明列表捲動狀態（比照 CodexScene）：list 是列表容器，listTop 為未捲動時的 y
  // （同時是捲動上限），minY 是捲到底時的 y（下限，依 rows 總高度與可視窗算出）。
  private list!: Phaser.GameObjects.Container;
  private listTop = 0;
  private minY = 0;

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
    // 面板高度：Phase 5 起說明列改為可捲動列表（比照 CodexScene 的遮罩＋拖曳手法），
    // 面板本身不再需要隨列數增高，固定版面預算的舊限制已解除。
    // 面板底緣 py0+ph = 78+636 = 714，仍在規格書 §11.1 的 720×780 embed 視窗內，
    // 且比舊版（758）更寬裕。之後若再增加說明列，只需在下方 rows 陣列多加一筆，
    // 捲動範圍會依 rows.length 自動重新計算，不必再動 ph。
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

    // 13 列已超出固定面板的版面預算，比照 CodexScene 改為可捲動列表：
    // 容器 y 起點在 py0+160（標題／簡介之下），列距維持 44px，
    // 但 y 值改為相對容器的 i*44，不再是絕對的 py0+…。
    const rows: { y: number; key: Parameters<I18n['t']>[0]; icon: (y: number) => void }[] = [
      { y: 0 * 44, key: 'help.footprint', icon: (y) => drawClueToken(icons, rowX, y, 15, 'footprint', pal) },
      { y: 1 * 44, key: 'help.disturbance', icon: (y) => drawClueToken(icons, rowX, y, 15, 'disturbance', pal) },
      { y: 2 * 44, key: 'help.scent', icon: (y) => drawClueToken(icons, rowX, y, 15, 'scent', pal) },
      {
        y: 3 * 44, key: 'help.decoy',
        icon: (y) => {
          drawClueToken(icons, rowX, y, 15, 'footprint', pal);
          icons.lineStyle(2, pal.mark, 0.9);
          icons.lineBetween(rowX + 8, y - 12, rowX + 16, y - 4);
          icons.lineBetween(rowX + 16, y - 12, rowX + 8, y - 4);
        },
      },
      {
        y: 4 * 44, key: 'help.stamina',
        icon: (y) => {
          drawSupply(icons, rowX - 14, y, 34, 0, pal);
          drawSupply(icons, rowX + 2, y, 34, 1, pal);
          // 崖壁小方塊＋叉：與 HUD 圖例同一套語彙
          icons.fillStyle(pal.terrain.cliff, 1).fillRect(rowX + 14, y - 5, 10, 10);
          icons.lineStyle(1.4, pal.paperDim, 0.9);
          icons.lineBetween(rowX + 16, y - 3, rowX + 22, y + 3);
          icons.lineBetween(rowX + 22, y - 3, rowX + 16, y + 3);
        },
      },
      {
        y: 5 * 44, key: 'help.marks',
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
        y: 6 * 44, key: 'help.qte',
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
        y: 7 * 44, key: 'help.layer',
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
        y: 8 * 44, key: 'help.reveal',
        icon: (y) => {
          // 揭曉：生物色實心點＋金色脈動環的靜態版（同 RevealScene 的真實位置圖示）
          icons.fillStyle(pal.glow, 1).fillCircle(rowX, y, 4);
          icons.lineStyle(2, pal.gold, 1).strokeCircle(rowX, y, 10);
        },
      },
      {
        y: 9 * 44, key: 'help.weather',
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
      {
        y: 10 * 44, key: 'help.vision',
        icon: (y) => {
          // 由亮到暗的三格，對應「近處看得見、遠處是暗的」
          const sq = 9;
          let x = rowX - 16;
          for (const a of [1, 0.45, 0.18]) {
            icons.fillStyle(pal.paper, a).fillRect(x, y - sq / 2, sq, sq);
            x += sq + 3;
          }
        },
      },
      {
        y: 11 * 44, key: 'help.survey',
        icon: (y) => {
          icons.fillStyle(pal.supply, 1).fillCircle(rowX, y, 3);
          icons.lineStyle(1.6, pal.supply, 0.85).strokeCircle(rowX, y, 8);
          icons.lineStyle(1.2, pal.supply, 0.45).strokeCircle(rowX, y, 13);
        },
      },
      {
        y: 12 * 44, key: 'help.route',
        icon: (y) => {
          icons.lineStyle(2, pal.gold, 0.85);
          icons.lineBetween(rowX - 14, y + 6, rowX - 4, y - 4);
          icons.lineBetween(rowX - 4, y - 4, rowX + 6, y + 2);
          icons.lineBetween(rowX + 6, y + 2, rowX + 14, y - 6);
          icons.fillStyle(pal.gold, 1).fillCircle(rowX + 14, y - 6, 3);
        },
      },
    ];

    // 列表容器：y 起點 py0+160，與下方遮罩可視區上緣對齊
    this.listTop = py0 + 160;
    this.list = this.add.container(0, this.listTop);
    this.list.add(icons);
    for (const row of rows) {
      row.icon(row.y);
      this.list.add(this.add.text(textX, row.y, i18n.t(row.key), {
        fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paperDim),
        wordWrap: { width: pw - (textX - px0) - 40, useAdvancedWrap: true }, lineSpacing: 4,
      }).setOrigin(0, 0.5));
    }

    // 可視區：py0+160 到 py0+ph-92，之下留給開始按鈕
    const viewH = (py0 + ph - 92) - this.listTop;
    this.minY = Math.min(0, viewH - rows.length * 44) + this.listTop;

    // 遮罩：列表只在可視區內顯示，擋住捲出範圍的列
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(0, this.listTop, w, viewH);
    this.list.setMask(maskShape.createGeometryMask());

    // 滾輪與拖曳捲動（比照 CodexScene）
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollBy(-dy * 0.6));
    let dragY: number | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY !== null && p.isDown) {
        this.scrollBy(p.y - dragY);
        dragY = p.y;
      }
    });
    this.input.on('pointerup', () => { dragY = null; });

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

  // 捲動列表：夾限在 [minY, listTop]（同 CodexScene.scrollBy）
  private scrollBy(dy: number) {
    this.list.y = Phaser.Math.Clamp(this.list.y + dy, this.minY, this.listTop);
  }
}
