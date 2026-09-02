import Phaser from 'phaser';
import type { SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { wagerKey, parseKey } from '../core/marks';
import { infoCompleteStep, misleadingDecoy } from '../core/deduction';
import { cheb, type Vec2 } from '../core/geometry';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import { cssHex, FONTS, displayFont, BRUSH_RADIUS, stripBrackets } from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

// 揭曉畫面（診斷 D-01）：不論成敗都在結算前先看見真相——牠在哪、你差幾格、
// 哪條假蹤跡騙了你、資訊在第幾步就已完備。失敗不再只是「牠溜進霧裡了」。
export class RevealScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;

  constructor() {
    super('Reveal');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const i18n: I18n = this.registry.get('i18n');
    this.audio = this.registry.get('audio');
    this.audio.ambient(false); // 揭曉畫面停風聲，與結算一致
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);

    this.add.text(cx, 54, i18n.t('reveal.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(2);

    // 每日挑戰失敗時不揭真實位置（F3，專案負責人裁定）：daily 的重試是同一顆種子，
    // 揭曉真相等於把答案直接遞給重玩——品質改用 Chebyshev 距離後，重玩必得金級，
    // 汙染 catchScore／quality-any 委託／分享卡。caught 時仍照常揭曉（不影響已結算的這一局）。
    const hideAnswer = s.mode === 'daily' && s.phase !== 'caught';

    // 小地圖：夾在標題與文字區之間，正方形，最大 300px
    // F6：Math.max(4, ...) 這個下限會讓 span 超出 mapMax 的版面預算——矮視窗＋大地圖時
    // （例如 h=390 時 mapMax=50，若 size=25 則 floor(50/25)=2 被下限 4 蓋過，span=4*25=100，
    // 是預算的兩倍）。span 沒有回頭夾回 mapMax，下面 ty/legendY 的版面預算全部建立在
    // 「span ≤ mapMax」這個不成立的假設上，這正是既有 legendY（見下方 Math.min(ty+14, h-108)）
    // 重疊風險的真正成因，不是 legendY 那行本身算錯。此處只記門檻與機制，不改動數值。
    const mapTop = 92;
    const mapMax = Math.min(300, w - 48, h - 340);
    const size = s.level.mapSize;
    const cell = Math.max(4, Math.floor(mapMax / size));
    const span = cell * size;
    const ox = Math.floor(cx - span / 2);
    const oy = mapTop;
    this.drawMinimap(s, ox, oy, cell, hideAnswer);

    // 文字區：距離、假蹤跡、資訊完備步數，三行由上而下堆疊（缺項自動不佔位）
    const wk = wagerKey(s.marks);
    const wager: Vec2 | null = wk === null ? null : parseKey(wk);
    let ty = oy + span + 30;

    if (wager === null) {
      // 未押注時本來就不揭露任何座標資訊，hideAnswer 與否都可安全保留
      ty = this.line(cx, ty, i18n.t('reveal.noCall'), pal.paperDim, 14);
    } else if (hideAnswer) {
      // 用一行說明取代距離／假蹤跡行，否則畫面看起來像壞掉（F3）
      ty = this.line(cx, ty, i18n.t('reveal.dailyHidden'), pal.paperDim, 14);
    } else {
      const off = cheb(wager, s.level.targetPos);
      const msg = off === 0 ? i18n.t('reveal.exact') : i18n.t('reveal.offBy', { n: off });
      ty = this.line(cx, ty, msg, off === 0 ? pal.gold : pal.paper, 17);
    }

    if (!hideAnswer) {
      const decoy = misleadingDecoy(s.level, s.readLog, wager);
      if (decoy) ty = this.line(cx, ty, i18n.t('reveal.decoy'), pal.mark, 14);
    }

    const infoStep = infoCompleteStep(s.level, s.readLog);
    if (infoStep !== null && s.steps > infoStep) {
      ty = this.line(cx, ty, i18n.t('reveal.infoAt', { n: infoStep, m: s.steps }), pal.paperDim, 13);
    }

    // 圖例：牠在這裡／你的押注。hideAnswer 時不畫「牠在這裡」——否則圖例文字本身就洩漏答案
    const legendY = Math.min(ty + 14, h - 108);
    if (!hideAnswer) this.legend(cx - 78, legendY, i18n.t('reveal.wasHere'), pal.gold, true);
    if (wager) this.legend(cx + 62, legendY, i18n.t('reveal.yourCall'), pal.paper, false);

    this.button(cx, h - 52, 250, 50, stripBrackets(i18n.t('btn.continue')),
      () => fadeToScene(this, 'Result'));
  }

  // 小地圖：地形底色 → 玩家路徑 → 已判讀線索（幌子在此才揭穿）→ 押注格 → 真實位置
  // hideAnswer 時（F3）真假線索一律畫成金色、且不畫真實位置，避免顏色差異或色點洩漏答案
  private drawMinimap(s: SessionState, ox: number, oy: number, cell: number, hideAnswer: boolean) {
    const pal = this.pal;
    const L = s.level;
    const g = this.add.graphics();
    const px = (v: Vec2) => ({ x: ox + v.x * cell + cell / 2, y: oy + v.y * cell + cell / 2 });

    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        g.fillStyle(pal.terrain[L.terrain[y][x]], 1).fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    g.lineStyle(1, pal.paperDim, 0.25).strokeRect(ox, oy, cell * L.mapSize, cell * L.mapSize);

    // 玩家路徑：連續折線，讓玩家看見自己繞了多遠
    if (s.path.length > 1) {
      g.lineStyle(Math.max(1.2, cell * 0.16), pal.paper, 0.4);
      for (let i = 1; i < s.path.length; i++) {
        const a = px(s.path[i - 1]);
        const b = px(s.path[i]);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // 已判讀的線索：真線索金點、幌子紅點——真假在此刻才第一次公開（診斷 B-03 的學習迴圈）
    // hideAnswer 時一律畫成金色（即真線索的畫法），不得用 pal.mark 洩漏哪條是幌子（F3）
    L.clues.forEach((c, i) => {
      if (!s.readLog.some((e) => e.clueIndex === i)) return;
      const p = px(c.position);
      const color = hideAnswer ? pal.gold : (c.isDecoy ? pal.mark : pal.gold);
      g.fillStyle(color, 0.9).fillCircle(p.x, p.y, Math.max(2, cell * 0.26));
    });

    // 玩家押注格：紙墨白空心方框
    const wk = wagerKey(s.marks);
    if (wk !== null) {
      const wp = parseKey(wk);
      g.lineStyle(2, pal.paper, 0.95)
        .strokeRect(ox + wp.x * cell, oy + wp.y * cell, cell, cell);
    }

    if (hideAnswer) return; // 真實位置本身就是答案，daily 未捕獲時整段不畫（F3）

    // 真實位置：生物色實心點＋金色脈動環
    const creature = CREATURES.find((c) => c.id === L.creatureId)!;
    const t = px(L.targetPos);
    g.fillStyle(creature.color, 1).fillCircle(t.x, t.y, Math.max(3, cell * 0.34));
    const ring = this.add.graphics();
    ring.lineStyle(2, pal.gold, 1).strokeCircle(t.x, t.y, Math.max(6, cell * 0.7));
    this.tweens.add({
      targets: ring, alpha: { from: 1, to: 0.25 },
      duration: 900, yoyo: true, repeat: -1,
    });
  }

  // 單行置中文字，回傳下一行的 y（行距隨字級調整）
  private line(cx: number, y: number, text: string, color: number, fontSize: number): number {
    const t = this.add.text(cx, y, text, {
      fontFamily: FONTS.body, fontSize: `${fontSize}px`, color: cssHex(color),
      wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    return y + t.height + 10;
  }

  // 圖例項：小色點＋標籤
  private legend(x: number, y: number, label: string, color: number, filled: boolean) {
    const g = this.add.graphics();
    if (filled) g.fillStyle(color, 1).fillCircle(x, y, 5);
    else g.lineStyle(1.8, color, 0.95).strokeRect(x - 5, y - 5, 10, 10);
    this.add.text(x + 12, y, label, {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(this.pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1);
  }

  // 按鈕：與 ResultScene 同款描邊樣式（hover 增亮、按下內縮）
  private button(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65)
        .strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); this.audio.unlock(); this.audio.play('click'); onClick(); });
  }
}
