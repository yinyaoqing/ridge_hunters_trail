import Phaser from 'phaser';
import { nextSession, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import type { CodexStore } from '../core/codex';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { cssHex, cssRgba, dashedCircle, BRUSH_RADIUS, FONTS } from './paint';
import { fadeIn, fadeToScene } from './fx';

const GLOW_KEY = 'result-glow';

// i18n 按鈕字串帶有括號（清單語境用），繪製成實體按鈕時剝除
const stripBrackets = (s: string) => s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');

export class ResultScene extends Phaser.Scene {
  private pal!: Palette;

  constructor() {
    super('Result');
  }

  create() {
    fadeIn(this);
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;
    this.pal = getPalette(s.round);

    if (outcome === 'caught') codex.addRecord(creature.id, 'bronze');
    // 立刻推進 session，之後所有按鈕只做場景切換，避免重複記錄
    this.registry.set('session', nextSession(s, rng));

    const pal = this.pal;
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = this.scale.width / 2;

    let title: string;
    let body: string;
    let action: string;
    if (outcome === 'caught') {
      this.drawCreaturePortrait(cx, 212, creature.id, creature.color);
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

    this.add.text(cx, 336, title, {
      fontFamily: FONTS.display, fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1);

    const counts = codex.counts();
    const found = CREATURES.filter((c) => (counts[c.id] ?? 0) > 0).length;
    this.add.text(cx, 372, i18n.t('codex.count', { found, total: CREATURES.length }).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(3);

    // 筆觸分隔線（微波形）
    const divider = this.add.graphics();
    divider.lineStyle(1.6, pal.gold, 0.5);
    divider.beginPath();
    divider.moveTo(cx - 105, 402);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, 402 + (i % 2 === 0 ? 1.5 : -1.5));
    }
    divider.strokePath();

    this.add.text(cx, 442, body, {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.paperDim),
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    this.button(cx, 532, 250, 52, stripBrackets(action), true, () => fadeToScene(this, 'Map'));
    this.button(cx, 596, 250, 50, stripBrackets(i18n.t('btn.guide')), false, () => fadeToScene(this, 'Codex'));
  }

  // 收錄成功的生物肖像：發光徑向底＋虛線環＋剪影（設計板）
  private drawCreaturePortrait(cx: number, cy: number, creatureId: string, color: number) {
    const size = 250;
    if (this.textures.exists(GLOW_KEY)) this.textures.remove(GLOW_KEY);
    const tex = this.textures.createCanvas(GLOW_KEY, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, cssRgba(color, 0.28));
      grad.addColorStop(0.7, cssRgba(color, 0.08));
      grad.addColorStop(1, cssRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
      this.add.image(cx, cy, GLOW_KEY);
    }
    const ring = this.add.graphics();
    dashedCircle(ring, cx, cy, 92, color, 0.35, 1.4, 2, 8);
    const silKey = `sil-${creatureId}`;
    if (this.textures.exists(silKey)) {
      this.add.image(cx, cy + 4, silKey).setScale(1.05);
    } else {
      this.add.circle(cx, cy, 60, color);
    }
  }

  private button(
    x: number, y: number, w: number, h: number,
    label: string, filled: boolean, onClick: () => void,
  ) {
    const pal = this.pal;
    const g = this.add.graphics();
    if (filled) {
      g.fillStyle(pal.gold, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
    } else {
      g.lineStyle(1.5, pal.gold, 0.65).strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
    }
    this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: filled ? '17px' : '16px',
      color: filled ? cssHex(pal.bg) : cssHex(pal.gold),
      fontStyle: filled ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, h, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }
}
