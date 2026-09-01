import Phaser from 'phaser';
import { newQte, tick, press, type QteState } from '../core/qte';
import { getDifficulty, type QteParams } from '../core/difficulty';
import { resolveQte, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { cssHex, FONTS } from './paint';
import { fadeIn, fadeToScene } from './fx';

const DIAL_BG_KEY = 'qte-dial-bg';
const R = 150;

export class QteScene extends Phaser.Scene {
  private q!: QteState;
  private cfg!: QteParams;
  private g!: Phaser.GameObjects.Graphics;
  private dots!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private i18n!: I18n;
  private pal!: Palette;
  private ending = false;

  constructor() {
    super('Qte');
  }

  create() {
    fadeIn(this);
    const s: SessionState = this.registry.get('session');
    this.i18n = this.registry.get('i18n');
    this.pal = getPalette(s.round);
    this.cfg = getDifficulty(s.round).qte;
    this.q = newQte(this.cfg, this.registry.get('rng') as Rng);
    this.ending = false;
    this.cameras.main.setBackgroundColor(this.pal.bg);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 20;

    this.buildDialBackdrop(cx, cy);

    this.add.text(cx, 78, this.i18n.t('qte.title'), {
      fontFamily: FONTS.display, fontSize: '32px', color: cssHex(this.pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.text(cx, 126, this.i18n.t('qte.instruction'), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(this.pal.paperDim),
    }).setOrigin(0.5);

    // 目標生物的朦朧剪影（設計板：轉盤中央淡影）
    const silKey = `sil-${s.level.creatureId}`;
    if (this.textures.exists(silKey)) {
      this.add.image(cx, cy + 6, silKey).setScale(1.35).setAlpha(0.16);
    }

    this.g = this.add.graphics();
    this.dots = this.add.graphics();
    this.info = this.add.text(cx, cy + R + 62, '', {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(this.pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);

    this.input.on('pointerdown', () => this.onPress());
    this.input.keyboard?.on('keydown-SPACE', () => this.onPress());
  }

  // 靜態盤面：徑向漸層底＋雙墨線圓環＋四方刻度
  private buildDialBackdrop(cx: number, cy: number) {
    const size = (R + 50) * 2;
    if (this.textures.exists(DIAL_BG_KEY)) this.textures.remove(DIAL_BG_KEY);
    const tex = this.textures.createCanvas(DIAL_BG_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, cssHex(this.pal.panel));
      grad.addColorStop(1, cssHex(this.pal.bg));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
      this.add.image(cx, cy, DIAL_BG_KEY);
    }

    const ring = this.add.graphics();
    ring.lineStyle(5, 0x5c6b73, 1).strokeCircle(cx, cy, R);
    ring.lineStyle(1.3, 0x5c6b73, 0.5).strokeCircle(cx, cy, R + 7);
    ring.lineStyle(2, this.pal.paper, 0.18);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      ring.lineBetween(
        cx + dx * (R + 14), cy + dy * (R + 14),
        cx + dx * (R + 26), cy + dy * (R + 26),
      );
    }
  }

  update(_time: number, dt: number) {
    tick(this.q, this.cfg, dt);
    this.draw();
  }

  private onPress() {
    if (this.ending) return;
    press(this.q, this.cfg, this.registry.get('rng') as Rng);
    if (this.q.done) {
      this.ending = true;
      const s: SessionState = this.registry.get('session');
      resolveQte(s, this.q.success === true);
      this.time.delayedCall(500, () => fadeToScene(this, 'Result'));
    }
  }

  private draw() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 20;
    const pal = this.pal;
    this.g.clear();

    // 發光弧區：寬幅低透明度模擬光暈＋窄幅實線
    const a0 = Phaser.Math.DegToRad(this.q.arcStart);
    const a1 = Phaser.Math.DegToRad(this.q.arcStart + this.cfg.arcSize);
    this.g.lineStyle(18, pal.gold, 0.3);
    this.g.beginPath();
    this.g.arc(cx, cy, R, a0, a1);
    this.g.strokePath();
    this.g.lineStyle(8, pal.gold, 1);
    this.g.beginPath();
    this.g.arc(cx, cy, R, a0, a1);
    this.g.strokePath();

    // 指針與軸心
    const pr = Phaser.Math.DegToRad(this.q.pointer);
    this.g.lineStyle(4, pal.paper, 1);
    this.g.lineBetween(
      cx - 22 * Math.cos(pr), cy - 22 * Math.sin(pr),
      cx + (R - 8) * Math.cos(pr), cy + (R - 8) * Math.sin(pr),
    );
    this.g.fillStyle(pal.paper, 1).fillCircle(cx, cy, 7);
    this.g.lineStyle(1.2, pal.paper, 0.4).strokeCircle(cx, cy, 10.5);

    // 命中點列（needed 顆，命中者填金）
    this.dots.clear();
    const gap = 26;
    const startX = cx - ((this.cfg.needed - 1) * gap) / 2;
    for (let i = 0; i < this.cfg.needed; i++) {
      const x = startX + i * gap;
      const y = cy + R + 34;
      if (i < this.q.hits) {
        this.dots.fillStyle(pal.gold, 0.25).fillCircle(x, y, 10);
        this.dots.fillStyle(pal.gold, 1).fillCircle(x, y, 6.5);
      } else {
        this.dots.lineStyle(1.5, pal.paper, 0.4).strokeCircle(x, y, 6.5);
      }
    }

    this.info.setText(this.i18n.t('qte.progress', {
      hits: this.q.hits, needed: this.cfg.needed,
      attempt: this.q.attempt, rounds: this.cfg.rounds,
    }));
  }
}
