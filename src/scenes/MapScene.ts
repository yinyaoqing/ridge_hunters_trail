import Phaser from 'phaser';
import { canMove, move, toggleMark, TERRAIN_COST, type SessionState } from '../core/session';
import { getDifficulty } from '../core/difficulty';
import { getPalette, type Palette } from '../core/palette';
import { key } from '../core/clues';
import type { Vec2 } from '../core/geometry';
import type { Clue } from '../core/types';
import type { I18n } from '../core/i18n';
import {
  cssHex, cssRgba, dashedCircle, dashedLine, drawClueToken, drawSupply,
  BRUSH_RADIUS, FONTS,
} from './paint';
import { restartOnResize, fadeIn, fadeToScene, floatText } from './fx';

const HUD_HEIGHT = 56;
const BG_KEY = 'map-bg';

export class MapScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private pg!: Phaser.GameObjects.Graphics; // 玩家專用層
  private animating = false;
  private lowTween?: Phaser.Tweens.Tween;
  private hudG!: Phaser.GameObjects.Graphics;
  private roundText!: Phaser.GameObjects.Text;
  private stamLabel!: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private pal!: Palette;
  private cell = 0;
  private ox = 0;
  private oy = 0;
  private markMode = false;
  private pressAt: { t: number; x: number; y: number } | null = null;
  private markChipG?: Phaser.GameObjects.Graphics;
  private markChipText?: Phaser.GameObjects.Text;
  private markChipX = 0;
  private markChipY = 0;

  constructor() {
    super('Map');
  }

  create() {
    const s = this.session();
    // 防護：Codex 只能從 Camp 進入，若 session 已結束（非 explore）誤導回 Map 會卡死畫面
    if (s.phase !== 'explore') {
      this.scene.start('Camp');
      return;
    }
    const w = this.scale.width;
    const h = this.scale.height;
    this.pal = getPalette(s.round);
    this.cell = Math.max(10, Math.floor(Math.min(
      (h - HUD_HEIGHT - 12) / s.level.mapSize,
      (w - 8) / s.level.mapSize,
    )));
    this.ox = Math.floor((w - this.cell * s.level.mapSize) / 2);
    this.oy = HUD_HEIGHT + Math.max(4, Math.floor((h - HUD_HEIGHT - this.cell * s.level.mapSize) / 2));
    this.cameras.main.setBackgroundColor(this.pal.bg);

    this.buildBackground(s);
    this.buildHud();
    this.g = this.add.graphics();
    this.pg = this.add.graphics();

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pressAt = { t: p.time, x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.redraw());
    this.redraw();
    restartOnResize(this);
    fadeIn(this);
    this.maybeShowFirstRunHelp();
  }

  // 首次啟動自動彈出玩法說明（localStorage 記憶，不可用時僅本次顯示）
  private maybeShowFirstRunHelp() {
    const storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = this.registry.get('storage');
    let seen = false;
    try {
      seen = storage?.getItem('rht.help.v1') === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    try {
      storage?.setItem('rht.help.v1', '1');
    } catch {
      // 無法記憶時每次啟動都會顯示，可接受
    }
    this.openHelp();
  }

  private openHelp() {
    this.scene.launch('Help', { from: 'Map' });
    this.scene.pause();
  }

  update() {
    if (!this.cursors) return;
    const s = this.session();
    if (s.phase !== 'explore') return;
    const jd = Phaser.Input.Keyboard.JustDown;
    let to: Vec2 | null = null;
    if (jd(this.cursors.left)) to = { x: s.player.x - 1, y: s.player.y };
    else if (jd(this.cursors.right)) to = { x: s.player.x + 1, y: s.player.y };
    else if (jd(this.cursors.up)) to = { x: s.player.x, y: s.player.y - 1 };
    else if (jd(this.cursors.down)) to = { x: s.player.x, y: s.player.y + 1 };
    if (to) this.doMove(to);
  }

  private session(): SessionState {
    return this.registry.get('session');
  }

  private i18n(): I18n {
    return this.registry.get('i18n');
  }

  // 水墨底圖：地形色塊經輕度模糊成暈染感＋淡格線＋暗角（美術方向板「地形筆觸」）
  private buildBackground(s: SessionState) {
    const L = s.level;
    const cs = this.cell;
    const w = cs * L.mapSize;
    const h = cs * L.mapSize;
    if (this.textures.exists(BG_KEY)) this.textures.remove(BG_KEY);
    const tex = this.textures.createCanvas(BG_KEY, w, h);
    if (!tex) return;
    const ctx = tex.getContext();

    ctx.fillStyle = cssHex(this.pal.base);
    ctx.fillRect(0, 0, w, h);

    try {
      ctx.filter = `blur(${Math.max(2, cs * 0.08)}px)`;
    } catch {
      // 不支援 canvas filter 的環境退回硬邊色塊
    }
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        ctx.fillStyle = cssHex(this.pal.terrain[L.terrain[y][x]]);
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
    }
    ctx.filter = 'none';

    ctx.strokeStyle = cssRgba(this.pal.paper, 0.06);
    ctx.lineWidth = 1;
    for (let i = 0; i <= L.mapSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(w, i * cs);
      ctx.stroke();
    }

    const vig = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.45, w / 2, h * 0.45, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    tex.refresh();
    this.add.image(this.ox, this.oy, BG_KEY).setOrigin(0);
  }

  private buildHud() {
    const compact = this.scale.width < 560;
    const pal = this.pal;
    const w = this.scale.width;

    // 羅盤
    const compass = this.add.graphics();
    const cx = 28;
    const cy = 28;
    compass.lineStyle(1.6, pal.gold, 1).strokeCircle(cx, cy, 13);
    compass.lineStyle(0.8, pal.gold, 0.5).strokeCircle(cx, cy, 9.5);
    compass.fillStyle(pal.gold, 1);
    compass.fillTriangle(cx, cy - 9, cx + 2.4, cy, cx - 2.4, cy);
    compass.fillTriangle(cx, cy + 9, cx + 2.4, cy, cx - 2.4, cy);
    compass.fillStyle(pal.bg, 1).fillCircle(cx, cy, 1.6);

    this.roundText = this.add.text(50, 8, '', {
      fontFamily: FONTS.display, fontSize: '20px', color: cssHex(pal.paper),
    });
    if (!compact) {
      this.add.text(50, 34, "RIDGE HUNTER'S TRAIL", {
        fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
      }).setLetterSpacing(2.5);
    }

    // 體力條（筆觸感不規則圓角，動態填色於 redraw）
    this.stamLabel = this.add.text(w / 2, 8, '', {
      fontFamily: FONTS.body, fontSize: '10.5px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5, 0).setLetterSpacing(2);
    this.hudG = this.add.graphics();

    // 操作提示（兩行右對齊）
    if (!compact) {
      this.hintText = this.add.text(w - 136, 15, '', {
        fontFamily: FONTS.body, fontSize: '11.5px', color: cssHex(pal.paperDim),
        align: 'right', lineSpacing: 4,
      }).setOrigin(1, 0);
    }

    // 語言切換鈕、玩法說明鈕與標記模式鈕（設計板：金邊小chip，由右至左排列）
    const chipY = 13;
    const chipH = 30;
    const xHelp = w - 12 - 32;        // '?' chip 左緣
    const xLang = xHelp - 8 - 72;     // 語言 chip 左緣
    const xMark = xLang - 8 - 60;     // 標記 chip 左緣
    const chip = this.add.graphics();
    chip.lineStyle(1.2, pal.gold, 0.55);
    chip.strokeRoundedRect(xLang, chipY, 72, chipH, BRUSH_RADIUS);
    chip.strokeRoundedRect(xHelp, chipY, 32, chipH, { tl: 5, tr: 9, br: 4, bl: 8 });
    this.add.text(xLang + 36, chipY + chipH / 2, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.rectangle(xLang + 36, chipY + chipH / 2, 72, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        const i18n = this.i18n();
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.redraw();
      });
    this.add.text(xHelp + 16, chipY + chipH / 2, '?', {
      fontFamily: FONTS.display, fontSize: '16px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.add.rectangle(xHelp + 16, chipY + chipH / 2, 32, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.openHelp();
      });

    // 標記模式鈕（開/關填色不同，需獨立 Graphics 供重繪；座標存為欄位供 updateHud 重繪標籤時使用）
    this.markChipX = xMark;
    this.markChipY = chipY;
    this.markChipG = this.add.graphics();
    this.markChipText = this.add.text(xMark + 30, chipY + chipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.drawMarkChip(xMark, chipY, 60, chipH);
    this.add.rectangle(xMark + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.markMode = !this.markMode;
        this.drawMarkChip(xMark, chipY, 60, chipH);
      });
  }

  private drawMarkChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.markChipG!;
    g.clear();
    if (this.markMode) {
      g.fillStyle(pal.mark, 0.85).fillRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.bg)).setText(this.i18n().t('hud.mark'));
    } else {
      g.lineStyle(1.2, pal.mark, 0.7).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.mark)).setText(this.i18n().t('hud.mark'));
    }
  }

  private toGrid(px: number, py: number): Vec2 | null {
    const x = Math.floor((px - this.ox) / this.cell);
    const y = Math.floor((py - this.oy) / this.cell);
    const size = this.session().level.mapSize;
    return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const s = this.session();
    if (s.phase !== 'explore' || !this.pressAt) return;
    const held = p.time - this.pressAt.t;
    const moved = Math.hypot(p.x - this.pressAt.x, p.y - this.pressAt.y);
    this.pressAt = null;
    if (moved > 12) return; // 拖曳不動作
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) return;
    const wantMark = (p.event as MouseEvent).shiftKey || this.markMode || held >= 350;
    if (wantMark) {
      toggleMark(s, cellPos);
      this.redraw();
      return;
    }
    this.doMove(cellPos);
  }

  private doMove(to: Vec2) {
    const s = this.session();
    if (this.animating || !canMove(s, to)) return;
    const cs = this.cell;
    const from = { x: this.ox + s.player.x * cs + cs / 2, y: this.oy + s.player.y * cs + cs / 2 };
    const dest = { x: this.ox + to.x * cs + cs / 2, y: this.oy + to.y * cs + cs / 2 };
    const cost = TERRAIN_COST[s.level.terrain[to.y][to.x]];
    const suppliesBefore = s.level.supplies.length;
    const readBefore = s.readClues.size;
    move(s, to);
    const gotSupply = s.level.supplies.length < suppliesBefore;

    this.animating = true;
    const pos = { ...from };
    this.tweens.add({
      targets: pos, x: dest.x, y: dest.y, duration: 100, ease: 'Sine.easeOut',
      onUpdate: () => this.drawPlayer(pos.x, pos.y),
      onComplete: () => {
        this.animating = false;
        floatText(this, dest.x, dest.y - cs * 0.5, `-${cost}`, cssRgba(this.pal.paper, 0.75));
        if (gotSupply) {
          floatText(this, dest.x, dest.y - cs, `+${getDifficulty(s.round).supplyRestore}`, cssHex(this.pal.supply));
        }
        if (s.readClues.size > readBefore) {
          const clue = s.level.clues.find((c) => key(c.position) === key(to));
          if (clue) this.playReveal(clue);
        }
        this.redraw();
        this.afterMove();
      },
    });
  }

  // 線索揭示：以容器縮放模擬形狀擴散，結束時 redraw 已畫出常駐覆蓋層
  private playReveal(c: Clue) {
    const cs = this.cell;
    const pal = this.pal;
    const center = {
      x: this.ox + c.position.x * cs + cs / 2,
      y: this.oy + c.position.y * cs + cs / 2,
    };
    const g = this.add.graphics();
    if (c.type === 'footprint') {
      const len = cs * 5;
      const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
      const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
      g.fillStyle(pal.gold, 0.35).fillTriangle(
        0, 0, len * Math.cos(a1), len * Math.sin(a1), len * Math.cos(a2), len * Math.sin(a2));
    } else if (c.type === 'disturbance') {
      g.lineStyle(3, pal.gold, 0.8).strokeCircle(0, 0, c.data.radius * cs);
    } else {
      g.lineStyle(3, pal.glow, 0.8).strokeCircle(0, 0, c.data.distance * cs);
    }
    const holder = this.add.container(center.x, center.y, [g]).setScale(0.25).setAlpha(0.9);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => holder.destroy(),
    });
  }

  private afterMove() {
    const s = this.session();
    if (s.phase === 'qte') fadeToScene(this, 'Qte');
    else if (s.phase === 'exhausted') fadeToScene(this, 'Result');
  }

  private redraw() {
    const s = this.session();
    const L = s.level;
    const cs = this.cell;
    const pal = this.pal;
    const px = (v: Vec2) => ({ x: this.ox + v.x * cs + cs / 2, y: this.oy + v.y * cs + cs / 2 });

    this.g.clear();

    L.supplies.forEach((sup, i) => {
      const p = px(sup);
      drawSupply(this.g, p.x, p.y, cs, sup.x + sup.y + i, pal);
    });

    for (const c of L.clues) {
      if (s.readClues.has(key(c.position))) this.drawClueOverlay(c, px);
    }
    for (const c of L.clues) {
      const p = px(c.position);
      drawClueToken(this.g, p.x, p.y, Math.max(8, cs * 0.34), c.type, pal);
    }

    for (const m of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      const r = cs * 0.32;
      this.g.lineStyle(3, pal.mark, 0.9);
      this.g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
      this.g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
    }

    // 玩家：光暈＋紙墨白圓點（設計板）
    const pp = px(s.player);
    this.drawPlayer(pp.x, pp.y);

    this.updateHud(s);
  }

  private drawPlayer(x: number, y: number) {
    const cs = this.cell;
    const pal = this.pal;
    this.pg.clear();
    this.pg.fillStyle(pal.gold, 0.1).fillCircle(x, y, cs * 0.62);
    this.pg.fillStyle(pal.gold, 0.16).fillCircle(x, y, cs * 0.44);
    this.pg.lineStyle(1.2, pal.paper, 0.5).strokeCircle(x, y, cs * 0.36);
    this.pg.fillStyle(pal.paper, 1).fillCircle(x, y, cs * 0.26);
  }

  private updateHud(s: SessionState) {
    const i18n = this.i18n();
    const pal = this.pal;
    const w = this.scale.width;
    const budget = getDifficulty(s.round).staminaBudget;

    this.roundText.setText(i18n.t('hud.round', { n: s.round }));
    this.stamLabel.setText(`${i18n.t('hud.stamina', { n: s.stamina })} / ${budget}`.toUpperCase());
    this.hintText?.setText(i18n.t('hud.hint').split(' · ').join('\n'));
    if (this.markChipG) this.drawMarkChip(this.markChipX, this.markChipY, 60, 30);

    // 窄螢幕（手機直向）：置中條會撞上右側 chip（chip 左緣 = w-192）。
    // 左靠齊改在 roundText 下方另起一列（label 於 y30、bar 於 y46），與 buildHud
    // 的 compact 斷點（w<560）一致，避免產生第二個斷點造成 560~599 間的縫隙碰撞。
    const compact = w < 560;
    const bw = compact
      ? Math.max(60, Math.min(210, w - 250)) // 確保 bx+bw ≤ (w-192)-8，與 mark chip 保持 8px 間距
      : Math.max(120, Math.min(210, w - 400)); // w∈[560,610) 置中條同樣需與 chip 保持 ≥8px 間距
    const bh = compact ? 10 : 12;
    const bx = compact ? 50 : w / 2 - bw / 2;
    const by = compact ? 46 : 27;
    this.stamLabel.setPosition(compact ? bx + bw / 2 : w / 2, compact ? 30 : 8);
    this.hudG.clear();
    this.hudG.fillStyle(0x0d1310, 1).fillRoundedRect(bx, by, bw, bh, BRUSH_RADIUS);
    this.hudG.lineStyle(1, pal.paper, 0.18).strokeRoundedRect(bx, by, bw, bh, BRUSH_RADIUS);
    const ratio = Math.max(0, Math.min(1, s.stamina / budget));
    const low = ratio > 0 && ratio < 0.25;
    if (ratio > 0) {
      this.hudG.fillStyle(low ? pal.mark : pal.gold, 1)
        .fillRoundedRect(bx + 1, by + 1, Math.max(6, (bw - 2) * ratio), bh - 2, { tl: 7, tr: 2, br: 6, bl: 3 });
    }
    if (low && !this.lowTween) {
      this.lowTween = this.tweens.add({
        targets: this.hudG, alpha: { from: 1, to: 0.55 },
        duration: 700, yoyo: true, repeat: -1,
      });
    } else if (!low && this.lowTween) {
      this.lowTween.stop();
      this.lowTween = undefined;
      this.hudG.setAlpha(1);
    }
  }

  // 已判讀線索覆蓋層（設計板）：足跡=金色錐形（淡填色＋點描邊線）、
  // 擾動=金色虛線圓域、氣味=發光色虛線距離環
  private drawClueOverlay(c: Clue, px: (v: Vec2) => { x: number; y: number }) {
    const cs = this.cell;
    const pal = this.pal;
    const center = px(c.position);
    if (c.type === 'footprint') {
      const len = cs * 5;
      const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
      const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
      const p1 = { x: center.x + len * Math.cos(a1), y: center.y + len * Math.sin(a1) };
      const p2 = { x: center.x + len * Math.cos(a2), y: center.y + len * Math.sin(a2) };
      this.g.fillStyle(pal.gold, 0.1).fillTriangle(center.x, center.y, p1.x, p1.y, p2.x, p2.y);
      dashedLine(this.g, center.x, center.y, p1.x, p1.y, pal.gold, 0.55);
      dashedLine(this.g, center.x, center.y, p2.x, p2.y, pal.gold, 0.55);
    } else if (c.type === 'disturbance') {
      this.g.fillStyle(pal.gold, 0.05).fillCircle(center.x, center.y, c.data.radius * cs);
      dashedCircle(this.g, center.x, center.y, c.data.radius * cs, pal.gold, 0.45, 2, 6, 9);
    } else {
      dashedCircle(this.g, center.x, center.y, c.data.distance * cs, pal.glow, 0.5, 2, 3, 8);
    }
  }
}
