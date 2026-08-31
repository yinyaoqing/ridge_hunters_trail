import Phaser from 'phaser';
import { nextSession, type SessionState } from '../core/session';
import type { CodexStore } from '../core/codex';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;

    if (outcome === 'caught') codex.add(creature.id);
    // 立刻推進 session，之後所有按鈕只做場景切換，避免重複記錄
    this.registry.set('session', nextSession(s, rng));

    const cx = this.scale.width / 2;
    let title: string;
    let body: string;
    let action: string;
    if (outcome === 'caught') {
      this.add.circle(cx, 210, 64, creature.color);
      title = i18n.t('result.recorded', { name: creature.names[loc] });
      body = creature.descs[loc];
      action = i18n.t('btn.next');
    } else if (outcome === 'escaped') {
      title = i18n.t('result.escaped.title');
      body = i18n.t('result.escaped.body');
      action = i18n.t('btn.retry');
    } else {
      title = i18n.t('result.exhausted.title');
      body = i18n.t('result.exhausted.body');
      action = i18n.t('btn.retry');
    }

    this.add.text(cx, 330, title, { fontSize: '28px', color: '#e8e3d5' }).setOrigin(0.5);
    this.add
      .text(cx, 390, body, {
        fontSize: '16px', color: '#9a9a8a', wordWrap: { width: 520 }, align: 'center',
      })
      .setOrigin(0.5);
    this.button(cx, 500, action, () => this.scene.start('Map'));
    this.button(cx, 560, i18n.t('btn.guide'), () => this.scene.start('Codex'));
  }

  private button(x: number, y: number, label: string, onClick: () => void) {
    this.add
      .text(x, y, label, { fontSize: '22px', color: '#f2d98d' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }
}
