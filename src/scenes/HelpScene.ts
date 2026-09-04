import Phaser from 'phaser';
import type { SessionState } from '../core/session';
import type { Weather } from '../core/weather';
import { getPalette, type Palette } from '../core/palette';
import type { I18n } from '../core/i18n';
import type { DemoScriptId } from '../core/demo';
import { cssHex, drawClueToken, drawSupply, BRUSH_RADIUS, FONTS, displayFont, stripBrackets } from './paint';

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
  private viewH = 0;
  // 收合標題列的命中矩形（在 this.list 本地座標系的上下緣），捲動時用來判斷
  // 是否捲出可視區、要不要停用互動——遮罩只擋畫面顯示，不擋輸入命中測試。
  private titleHits: { rect: Phaser.GameObjects.Rectangle; top: number; bottom: number }[] = [];

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

    // 固定面板 UI（關閉鈕、語言切換、示範鈕、開始鈕）在輸入判定上要永遠贏過
    // this.list 這個會捲動的遮罩容器：Phaser 的幾何遮罩只擋「畫面顯示」，不擋
    // 「命中測試」，捲出可視區、肉眼看不到的列表內容（例如收合標題列的命中矩形）
    // 一樣會被點到。這裡明確排出 depth，不依賴「誰先加進場景」的隱性順序
    // ——上一次就是這樣悄悄壞掉的：this.list 比關閉鈕／示範鈕晚加入，捲動時
    // 標題列的命中矩形疊在它們上面，把點擊吃掉。
    const DEPTH_LIST = 0;
    const DEPTH_CHROME = 10;

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
      .setDepth(DEPTH_CHROME)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    // 語言切換（首次開啟的玩家需要能在這裡換語言）
    this.add.text(px0 + 30, py0 + 22, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setLetterSpacing(1)
      .setDepth(DEPTH_CHROME)
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

    // 示範入口：說明頁只能「告訴」，示範才能「示範」。放在列表之上、簡介之下，
    // 是進入這個畫面的人第一眼會看到的可點擊物件。上下兩顆：第一課教推理四步驟，
    // 第二課教會走的獵物（新鮮度）；各高 32、間距 8，比舊版單顆多吃 40px，
    // 下面的 listTop／viewH 已跟著往下 48px 讓出版面。
    const dbw = 210;
    const demoButtons: { key: Parameters<I18n['t']>[0]; scriptId: DemoScriptId }[] = [
      { key: 'btn.demo', scriptId: 'deduction' },
      { key: 'btn.demo2', scriptId: 'quarry' },
    ];
    demoButtons.forEach((b, i) => {
      const by = py0 + 168 + i * 40;
      const g = this.add.graphics();
      g.lineStyle(1.5, pal.gold, 0.8).strokeRoundedRect(cx - dbw / 2, by - 16, dbw, 32, BRUSH_RADIUS);
      this.add.text(cx, by, stripBrackets(i18n.t(b.key)).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(1.5);
      this.add.rectangle(cx, by, dbw, Math.max(32, 44), 0, 0)
        .setDepth(DEPTH_CHROME)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          // 先 launch 再 stop：兩者都是排進 SceneManager 的操作，
          // 依序處理；反過來寫會在自己已被標記關閉之後才要求開啟新場景。
          this.scene.launch('Demo', { from: this.from, scriptId: b.scriptId });
          this.scene.stop();
        });
    });

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

    // 覓食路線：三個由淡到濃的節點連成一條折線，末端箭頭指向「牠要去的地方」
    const drawRouteGlyph = (gy: number) => {
      const pts = [[rowX - 16, gy + 6], [rowX - 4, gy - 4], [rowX + 8, gy + 2]];
      icons.lineStyle(1.6, pal.gold, 0.8);
      icons.lineBetween(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      icons.lineBetween(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      icons.lineStyle(1.4, pal.gold, 0.4);
      icons.lineBetween(pts[2][0], pts[2][1], rowX + 18, gy - 5);
      pts.forEach(([px, py], i) => {
        icons.fillStyle(pal.gold, 0.3 + i * 0.35).fillCircle(px, py, 3);
      });
    };

    // 新鮮度：三格由淡到濃，最濃的加一圈外框代表「目前選中這一齡」
    const drawAgeGlyph = (gy: number) => {
      const sq = 9;
      let x = rowX - 16;
      for (const a of [0.2, 0.45, 0.9]) {
        icons.fillStyle(pal.gold, a).fillRect(x, gy - sq / 2, sq, sq);
        x += sq + 3;
      }
      icons.lineStyle(1.2, pal.paper, 0.9).strokeRect(rowX - 16 + (sq + 3) * 2, gy - sq / 2 - 2, sq + 4, sq + 4);
    };

    // 分數：三枚由小到大的金點，代表倍率疊高
    const drawScoreGlyph = (gy: number) => {
      icons.fillStyle(pal.gold, 0.5).fillCircle(rowX - 14, gy, 2.5);
      icons.fillStyle(pal.gold, 0.75).fillCircle(rowX, gy, 4);
      icons.fillStyle(pal.gold, 1).fillCircle(rowX + 16, gy, 5.5);
    };

    // 13 列已超出固定面板的版面預算，比照 CodexScene 改為可捲動列表，
    // 並依用途分成四組（各有金色標題列），組內列距維持 44px。
    type HelpRow = { key: Parameters<I18n['t']>[0]; icon: (y: number) => void };
    const sections: { titleKey: Parameters<I18n['t']>[0]; rows: HelpRow[] }[] = [
      {
        titleKey: 'help.sec.track',
        rows: [
          { key: 'help.footprint', icon: (y) => drawClueToken(icons, rowX, y, 15, 'footprint', pal) },
          { key: 'help.disturbance', icon: (y) => drawClueToken(icons, rowX, y, 15, 'disturbance', pal) },
          { key: 'help.scent', icon: (y) => drawClueToken(icons, rowX, y, 15, 'scent', pal) },
          {
            key: 'help.decoy',
            icon: (y) => {
              drawClueToken(icons, rowX, y, 15, 'footprint', pal);
              icons.lineStyle(2, pal.mark, 0.9);
              icons.lineBetween(rowX + 8, y - 12, rowX + 16, y - 4);
              icons.lineBetween(rowX + 16, y - 12, rowX + 8, y - 4);
            },
          },
          {
            key: 'help.weather',
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
          { key: 'help.quarry', icon: (y) => drawRouteGlyph(y) },
          { key: 'help.habit', icon: (y) => drawRouteGlyph(y) },
          { key: 'help.events', icon: (y) => {
            icons.lineStyle(1.6, pal.mark, 0.9);
            icons.lineBetween(rowX, y - 8, rowX, y + 2);
            icons.fillStyle(pal.mark, 0.9).fillCircle(rowX, y + 7, 1.6);
          } },
          { key: 'help.wx.clear', icon: (y) => drawWeatherGlyph(rowX, y, 'clear') },
          { key: 'help.wx.mist', icon: (y) => drawWeatherGlyph(rowX, y, 'mist') },
          { key: 'help.wx.wind', icon: (y) => drawWeatherGlyph(rowX, y, 'wind') },
          { key: 'help.wx.drizzle', icon: (y) => drawWeatherGlyph(rowX, y, 'drizzle') },
        ],
      },
      {
        titleKey: 'help.sec.deduce',
        rows: [
          {
            key: 'help.marks',
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
            key: 'help.layer',
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
            key: 'help.reveal',
            icon: (y) => {
              // 揭曉：生物色實心點＋金色脈動環的靜態版（同 RevealScene 的真實位置圖示）
              icons.fillStyle(pal.glow, 1).fillCircle(rowX, y, 4);
              icons.lineStyle(2, pal.gold, 1).strokeCircle(rowX, y, 10);
            },
          },
          { key: 'help.age', icon: (y) => drawAgeGlyph(y) },
          { key: 'help.mute', icon: (y) => {
            drawClueToken(icons, rowX, y, 15, 'scent', pal);
            icons.lineStyle(2, pal.paperDim, 0.8).lineBetween(rowX - 14, y + 12, rowX + 14, y - 12);
          } },
          { key: 'help.infoAt', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.85).lineBetween(rowX - 16, y + 6, rowX + 16, y + 6);
            icons.fillStyle(pal.gold, 1).fillCircle(rowX - 2, y + 6, 3.5);
          } },
          { key: 'help.quirk', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeCircle(rowX - 8, y, 5);
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeCircle(rowX + 8, y, 9);
          } },
        ],
      },
      {
        titleKey: 'help.sec.ground',
        rows: [
          {
            key: 'help.stamina',
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
            key: 'help.vision',
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
            key: 'help.survey',
            icon: (y) => {
              icons.fillStyle(pal.supply, 1).fillCircle(rowX, y, 3);
              icons.lineStyle(1.6, pal.supply, 0.85).strokeCircle(rowX, y, 8);
              icons.lineStyle(1.2, pal.supply, 0.45).strokeCircle(rowX, y, 13);
            },
          },
          {
            key: 'help.route',
            icon: (y) => {
              icons.lineStyle(2, pal.gold, 0.85);
              icons.lineBetween(rowX - 14, y + 6, rowX - 4, y - 4);
              icons.lineBetween(rowX - 4, y - 4, rowX + 6, y + 2);
              icons.lineBetween(rowX + 6, y + 2, rowX + 14, y - 6);
              icons.fillStyle(pal.gold, 1).fillCircle(rowX + 14, y - 6, 3);
            },
          },
          { key: 'help.supply', icon: (y) => {
            drawSupply(icons, rowX - 10, y, 34, 0, pal);
            drawSupply(icons, rowX + 10, y, 34, 1, pal);
          } },
        ],
      },
      {
        titleKey: 'help.sec.longRun',
        rows: [
          {
            key: 'help.qte',
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
          { key: 'help.score', icon: (y) => drawScoreGlyph(y) },
          { key: 'help.iris', icon: (y) => {
            icons.fillStyle(pal.iris, 1).fillCircle(rowX, y, 5);
            icons.lineStyle(1.4, pal.iris, 0.5).strokeCircle(rowX, y, 10);
          } },
          { key: 'help.progress', icon: (y) => {
            let x = rowX - 18;
            for (const sz of [7, 10, 13]) {
              icons.lineStyle(1.2, pal.paperDim, 0.85).strokeRect(x, y - sz / 2, sz, sz);
              x += sz + 4;
            }
          } },
          { key: 'help.tools', icon: (y) => {
            icons.lineStyle(1.5, pal.gold, 0.9).strokeCircle(rowX - 8, y, 5);
            icons.lineStyle(1.5, pal.gold, 0.9);
            icons.beginPath();
            icons.arc(rowX + 8, y, 6, Math.PI, Math.PI * 2);
            icons.strokePath();
            icons.fillStyle(pal.gold, 1).fillCircle(rowX + 8, y + 3, 1.8);
          } },
          { key: 'help.codex', icon: (y) => {
            icons.lineStyle(1.4, pal.paperDim, 0.9).strokeRect(rowX - 10, y - 8, 20, 16);
            icons.lineBetween(rowX, y - 8, rowX, y + 8);
          } },
          { key: 'help.commission', icon: (y) => {
            for (let i = 0; i < 3; i++) {
              icons.lineStyle(1.3, pal.paperDim, 0.85).lineBetween(rowX - 12, y - 5 + i * 5, rowX + 12, y - 5 + i * 5);
            }
          } },
          { key: 'help.daily', icon: (y) => {
            icons.lineStyle(1.4, pal.supply, 0.9).strokeCircle(rowX, y, 8);
            icons.lineStyle(1.4, pal.supply, 0.9).lineBetween(rowX, y - 4, rowX, y);
            icons.lineBetween(rowX, y, rowX + 4, y + 2);
          } },
        ],
      },
    ];

    // 列表容器：y 起點 py0+248，與下方遮罩可視區上緣對齊
    // 示範按鈕現在有上下兩顆，佔用 py0+152 到 py0+224 一帶，列表起點讓出 48px。
    // viewH 與 minY 都由 listTop 推導，列表本來就可捲動，因此不需要調整 ph。
    const TITLE_H = 30;
    const ROW_H = 44;
    this.listTop = py0 + 248;
    this.list = this.add.container(0, this.listTop);
    // 明確標成 DEPTH_LIST（雖然數值等於預設值 0）：這是「捲動列表永遠墊在固定
    // UI 之下」這條規則的落地處，寫出來讓下一個在這個容器裡加互動物件的人
    // 一眼看到這個約束，而不是要讀完整個檔案才發現。
    this.list.setDepth(DEPTH_LIST);
    this.list.add(icons);

    // 可視區：py0+248 到 py0+ph-92，之下留給開始按鈕。這個高度只由面板版面決定，
    // 與分組是否收合無關，所以只算一次；隨 cursor（內容總高）變動的只有 minY。
    const viewH = (py0 + ph - 92) - this.listTop;
    this.viewH = viewH;

    // 分組預設全展開；點標題收合／展開該組，不落地保存（關閉面板重開就重置）。
    const collapsed = sections.map(() => false);

    const rebuildList = () => {
      icons.clear();
      for (const child of [...this.list.list]) {
        if (child !== icons) child.destroy();
      }
      this.titleHits = [];
      let cursor = 0;
      sections.forEach((sec, i) => {
        // 標題基線落在該區塊垂直中央，與圖例列同一套 origin(0, 0.5) 慣例
        const titleY = cursor + TITLE_H / 2;
        this.list.add(this.add.text(px0 + 30, titleY, i18n.t(sec.titleKey), {
          fontFamily: FONTS.body, fontSize: '11.5px', color: cssHex(pal.gold),
        }).setOrigin(0, 0.5).setLetterSpacing(1.5));
        // 可點擊的整列命中區（比文字本身寬鬆，比照檔內其他按鈕的透明矩形慣例）。
        // 這個矩形掛在 this.list 底下，depth 排序拿它沒辦法（depth 只在同一層
        // 容器內比較，贏不過容器外的固定 UI，但也讓它贏不了列表捲動本身）——
        // 真正擋住它在捲出可視區時誤觸的是 rebuildList/scrollBy 都會呼叫的
        // updateTitleInteractivity()，依 top/bottom 是否還落在可視窗內來停用互動。
        const titleRect = this.add.rectangle(px0 + pw / 2, titleY, pw, TITLE_H, 0, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            collapsed[i] = !collapsed[i];
            rebuildList();
          });
        this.list.add(titleRect);
        this.titleHits.push({ rect: titleRect, top: cursor, bottom: cursor + TITLE_H });
        cursor += TITLE_H;
        if (!collapsed[i]) {
          for (const row of sec.rows) {
            const y = cursor + ROW_H / 2;
            row.icon(y);
            this.list.add(this.add.text(textX, y, i18n.t(row.key), {
              fontFamily: FONTS.body, fontSize: '13.5px', color: cssHex(pal.paperDim),
              wordWrap: { width: pw - (textX - px0) - 40, useAdvancedWrap: true }, lineSpacing: 4,
            }).setOrigin(0, 0.5));
            cursor += ROW_H;
          }
        }
      });
      // 總高度改由 cursor 累加而來（標題 30 + 圖例 44），不再是 rows.length * 44 + 22——
      // 新增列、新增分組或收合分組時這裡自動跟上，不必再動任何常數。
      this.minY = Math.min(0, viewH - cursor) + this.listTop;
      this.list.y = Phaser.Math.Clamp(this.list.y, this.minY, this.listTop);
      // 收合／展開會整批重建標題矩形，重建後（以及上面 clamp 完 list.y 後）
      // 要立刻依新的 cursor 版面重算一次可見性，不然舊的停用狀態會殘留。
      this.updateTitleInteractivity();
    };
    rebuildList();

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
      .setDepth(DEPTH_CHROME)
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
    this.updateTitleInteractivity();
  }

  // 標題列的命中矩形捲出可視區 [listTop, listTop+viewH] 時停用互動，捲回來再復原。
  // 遮罩（geometry mask）只影響畫面顯示，不影響輸入命中測試，Phaser 選中最上層
  // 互動物件時完全不理會遮罩——這裡才是真正擋住「點到看不見的標題列」的地方，
  // 跟上面 DEPTH_CHROME 的固定 UI 疊層是兩道獨立的防線，缺一不可：depth 只保證
  // 固定 UI 贏過列表整體，這裡才管列表「自己」的哪一段當下算不算看得到。
  private updateTitleInteractivity() {
    const viewTop = this.listTop;
    const viewBottom = this.listTop + this.viewH;
    for (const { rect, top, bottom } of this.titleHits) {
      const worldTop = this.list.y + top;
      const worldBottom = this.list.y + bottom;
      const visible = worldBottom > viewTop && worldTop < viewBottom;
      if (visible) {
        rect.setInteractive({ useHandCursor: true });
      } else {
        rect.disableInteractive();
      }
    }
  }
}
