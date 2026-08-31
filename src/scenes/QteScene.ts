import Phaser from 'phaser';
import { newQte, tick, press, type QteState } from '../core/qte';
import { getDifficulty, type QteParams } from '../core/difficulty';
import { resolveQte, type SessionState } from '../core/session';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';

export class QteScene extends Phaser.Scene {
  private q!: QteState;
  private cfg!: QteParams;
  private g!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private i18n!: I18n;
  private ending = false;

  constructor() {
    super('Qte');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    this.i18n = this.registry.get('i18n');
    this.cfg = getDifficulty(s.round).qte;
    this.q = newQte(this.cfg, this.registry.get('rng') as Rng);
    this.ending = false;
    this.g = this.add.graphics();
    const cx = this.scale.width / 2;
    this.add
      .text(cx, 80, this.i18n.t('qte.title'), { fontSize: '30px', color: '#e8e3d5' })
      .setOrigin(0.5);
    this.add
      .text(cx, 130, this.i18n.t('qte.instruction'), {
        fontSize: '16px', color: '#9a9a8a',
      })
      .setOrigin(0.5);
    this.info = this.add.text(cx, 640, '', { fontSize: '20px', color: '#f2d98d' }).setOrigin(0.5);
    this.input.on('pointerdown', () => this.onPress());
    this.input.keyboard?.on('keydown-SPACE', () => this.onPress());
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
      this.time.delayedCall(500, () => this.scene.start('Result'));
    }
  }

  private draw() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 20;
    const R = 150;
    this.g.clear();
    this.g.lineStyle(6, 0x5c6b73, 1).strokeCircle(cx, cy, R);
    const a0 = Phaser.Math.DegToRad(this.q.arcStart);
    const a1 = Phaser.Math.DegToRad(this.q.arcStart + this.cfg.arcSize);
    this.g.lineStyle(12, 0xf2d98d, 1);
    this.g.beginPath();
    this.g.arc(cx, cy, R, a0, a1);
    this.g.strokePath();
    const pr = Phaser.Math.DegToRad(this.q.pointer);
    this.g.lineStyle(4, 0xe8e3d5, 1);
    this.g.lineBetween(cx, cy, cx + R * Math.cos(pr), cy + R * Math.sin(pr));
    this.info.setText(this.i18n.t('qte.progress', {
      hits: this.q.hits, needed: this.cfg.needed,
      attempt: this.q.attempt, rounds: this.cfg.rounds,
    }));
  }
}
