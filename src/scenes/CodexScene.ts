import Phaser from 'phaser';
import type { CodexStore } from '../core/codex';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';

export class CodexScene extends Phaser.Scene {
  constructor() {
    super('Codex');
  }

  create() {
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const counts = codex.counts();
    const cx = this.scale.width / 2;

    this.add.text(cx, 44, i18n.t('codex.title'), { fontSize: '30px', color: '#e8e3d5' }).setOrigin(0.5);
    const found = CREATURES.filter((c) => (counts[c.id] ?? 0) > 0).length;
    this.add
      .text(cx, 84, i18n.t('codex.count', { found, total: CREATURES.length }), {
        fontSize: '16px', color: '#9a9a8a',
      })
      .setOrigin(0.5);

    CREATURES.forEach((c, i) => {
      const y = 140 + i * 70;
      const seen = counts[c.id] ?? 0;
      this.add.circle(90, y, 22, seen > 0 ? c.color : 0x333833);
      this.add.text(140, y - 18, seen > 0 ? c.names[loc] : i18n.t('codex.unknown'), {
        fontSize: '20px', color: '#e8e3d5',
      });
      const detail = seen > 0
        ? `${c.descs[loc]}  (${i18n.t('codex.times', { n: seen })})`
        : i18n.t('codex.notRecorded');
      this.add.text(140, y + 8, detail, {
        fontSize: '13px', color: '#9a9a8a', wordWrap: { width: 500 },
      });
    });

    this.add
      .text(cx, 730, i18n.t('btn.back'), { fontSize: '22px', color: '#f2d98d' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Map'));
  }
}
