import Phaser from 'phaser';
import {
  MILESTONE_NAME, MILESTONE_DETAIL, MILESTONE_QUIRK, type CodexStore,
} from '../core/codex';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';
import type { Locale } from '../core/types';
import {
  cssHex, BRUSH_RADIUS, FONTS, QUALITY_COLORS, displayFont, stripBrackets, creatureTexKey,
  creatureScale,
} from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';
import type { CoachStore } from '../core/coach';

const ROW_H = 96;

export class CodexScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private minY = 0;
  private listTop = 112;
  private listBottom = 0;
  // 首見提示是否要顯示，記在場景實例上（B2，同 CampScene.coachPick 的做法與理由）：
  // undefined＝這次造訪還沒決定過。resize 觸發的 restart 經由 restartOnResize 的
  // beforeRestart 回呼把 pendingPreserveCoachPick 設成 true，不會清掉這個欄位，因此不會
  // 在同一次造訪內把提示的顯示與否重新評估一次——這裡只有單一 id，重新評估的後果是
  // 「顯示一瞬間就被判定已見、之後永遠不再出現」，同樣違反「標記＝玩家看過」的不變量。
  private showCoachHint: boolean | undefined = undefined;
  // 同 CampScene.pendingPreserveCoachPick：不透過 scene.restart(data) 傳遞，避免 Phaser 的
  // settings.data 在下一次不帶 data 的 scene.start('Codex') 繼續讀到舊值，讓這個旗標永久
  // 卡在「保留」，圖鑑首見提示從此再也不會在真正的新一次造訪重新判斷。
  private pendingPreserveCoachPick = false;

  constructor() {
    super('Codex');
  }

  init() {
    const preserve = this.pendingPreserveCoachPick;
    this.pendingPreserveCoachPick = false;
    if (!preserve) this.showCoachHint = undefined;
  }

  create() {
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const session: SessionState = this.registry.get('session');
    const pal = getPalette(session.round);
    const loc = i18n.locale();
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this, () => { this.pendingPreserveCoachPick = true; });

    this.add.text(cx, 42, i18n.t('codex.title'), {
      fontFamily: displayFont(loc), fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);
    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.add.text(cx, 80, i18n.t('codex.count', { found, total: CREATURES.length }).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(3);

    this.listBottom = h - 84;
    this.list = this.add.container(0, this.listTop);
    CREATURES.forEach((c, i) => this.list.add(this.buildRow(c.id, i, pal, codex, i18n, loc, w)));

    const viewH = this.listBottom - this.listTop;
    this.minY = Math.min(0, viewH - CREATURES.length * ROW_H) + this.listTop;

    // 遮罩：列表只在標題與返回鈕之間可見
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(0, this.listTop, w, viewH);
    this.list.setMask(maskShape.createGeometryMask());

    // 滾輪與拖曳捲動
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

    this.backButton(cx, h - 44, pal, i18n);

    // 研究首見：底部說明退到返回鈕之上。backButton 以 (cx, h-44) 為中心、高 46，
    // 上緣落在 h-67；用 origin(0.5, 1) 底部錨定於 h-77（上緣再退 10px 淨空），文字
    // 不論折成幾行都只會往上長，底緣固定不變——不會壓到返回鈕，且不必依版面高度另行判斷。
    const coach: CoachStore = this.registry.get('coach');
    if (this.showCoachHint === undefined) this.showCoachHint = !coach.seen('codex');
    if (this.showCoachHint) {
      // markSeen 冪等：理由同 CampScene 的同款寫法（見 this.showCoachHint 欄位註解）。
      coach.markSeen('codex');
      this.add.text(cx, h - 77, i18n.t('coach.codex'), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
        wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
      }).setOrigin(0.5, 1).setDepth(90);
    }
  }

  private scrollBy(dy: number) {
    this.list.y = Phaser.Math.Clamp(this.list.y + dy, this.minY, this.listTop);
  }

  // 單行：底盤圓＋剪影／名稱＋品質章／細節／研究度條／次數
  private buildRow(
    id: string, index: number, pal: Palette, codex: CodexStore,
    i18n: I18n, loc: Locale, w: number,
  ): Phaser.GameObjects.Container {
    const c = CREATURES.find((x) => x.id === id)!;
    const e = codex.entry(id);
    const discovered = e.count > 0;
    const nameKnown = discovered || e.research >= MILESTONE_NAME;
    const detailKnown = discovered || e.research >= MILESTONE_DETAIL;
    const y = index * ROW_H + ROW_H / 2;
    const row = this.add.container(0, 0);
    const g = this.add.graphics();
    row.add(g);

    g.fillStyle(pal.panel, 1).fillCircle(92, y, 26);
    if (index < CREATURES.length - 1) {
      g.lineStyle(1, pal.paper, 0.09).lineBetween(60, y + ROW_H / 2, w - 60, y + ROW_H / 2);
    }

    const texKey = creatureTexKey(this, id);
    if (this.textures.exists(texKey)) {
      const img = this.add.image(92, y + 2, texKey).setScale(creatureScale(texKey, 0.3));
      if (!discovered) img.setTintFill(0x10160f).setAlpha(0.85); // 墨影 teaser
      row.add(img);
    } else {
      row.add(this.add.circle(92, y, 16, discovered ? c.color : 0x10160f));
    }

    const name = nameKnown ? c.names[loc] : i18n.t('codex.unknown');
    const nameText = this.add.text(134, y - 26, name, {
      fontFamily: displayFont(loc), fontSize: '19px',
      color: discovered ? cssHex(pal.paper) : cssHex(pal.paperDim),
    });
    row.add(nameText);

    if (e.bestQuality) {
      const qg = this.add.graphics();
      qg.fillStyle(QUALITY_COLORS[e.bestQuality], 1)
        .fillCircle(140 + nameText.width + 14, y - 16, 6);
      row.add(qg);
    }

    const quirkKnown = e.research >= MILESTONE_QUIRK;
    const detail = detailKnown
      ? c.descs[loc]
      : e.research > 0 ? i18n.t('codex.rumored') : i18n.t('codex.notRecorded');
    row.add(this.add.text(134, y - 2, detail, {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.paperDim),
      wordWrap: { width: w - 300, useAdvancedWrap: true },
    }).setAlpha(detailKnown ? 1 : 0.6));

    // 判讀心得：獨立文字物件，金色小字，與細節行、研究度條分開排版
    if (quirkKnown) {
      row.add(this.add.text(134, y + 16, `${i18n.t('codex.quirk')} · ${c.quirkHints[loc]}`, {
        fontFamily: FONTS.body, fontSize: '10.5px', color: cssHex(pal.gold),
        wordWrap: { width: w - 300, useAdvancedWrap: true },
      }));
    }

    // 研究度條：滿檔 = MILESTONE_QUIRK，兩道里程碑刻度（名稱／描述）
    const bw = 150;
    const ratio = Math.min(1, e.research / MILESTONE_QUIRK);
    g.fillStyle(0x0d1310, 1).fillRoundedRect(134, y + 32, bw, 6, 3);
    if (ratio > 0) g.fillStyle(pal.glow, 0.9).fillRoundedRect(135, y + 33, (bw - 2) * ratio, 4, 2);
    g.lineStyle(1, pal.paper, 0.25)
      .lineBetween(134 + bw * (MILESTONE_NAME / MILESTONE_QUIRK), y + 30,
        134 + bw * (MILESTONE_NAME / MILESTONE_QUIRK), y + 40) // 里程碑刻度：名稱
      .lineBetween(134 + bw * (MILESTONE_DETAIL / MILESTONE_QUIRK), y + 30,
        134 + bw * (MILESTONE_DETAIL / MILESTONE_QUIRK), y + 40); // 里程碑刻度：描述
    row.add(this.add.text(134 + bw + 10, y + 35, i18n.t('codex.research'), {
      fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1.5));

    if (discovered) {
      const countText = this.add.text(w - 68, y, `×${e.count}`, {
        fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5);
      row.add(countText);

      // 異彩星標：定位在 ×count 實際左緣再退 14px（而非固定座標），
      // 避免二位數以上的次數（如 ×10）把星標擠壓／重疊——
      // countText 為 origin(1, 0.5)，其左緣 = countText.x - countText.width
      const starX = countText.x - countText.width - 14;
      if (e.irisSeen) {
        row.add(this.add.text(starX, y, '★', {
          fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.iris),
        }).setOrigin(0.5));
      } else {
        row.add(this.add.text(starX, y, '☆', {
          fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.paperDim),
        }).setOrigin(0.5).setAlpha(0.5));
      }
    }
    // 未發現：不顯示 ×count，亦不顯示星標（irisSeen 必伴隨 discovered，無需額外分支）
    return row;
  }

  private backButton(cx: number, by: number, pal: Palette, i18n: I18n) {
    const bw = 230;
    const bh = 46;
    const btn = this.add.graphics();
    btn.lineStyle(1.5, pal.gold, 0.65).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, BRUSH_RADIUS);
    this.add.text(cx, by, stripBrackets(i18n.t('btn.camp')).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx, by, bw, bh, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => fadeToScene(this, 'Camp'));
  }
}
