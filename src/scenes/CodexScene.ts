import Phaser from 'phaser';
import type { CodexStore } from '../core/codex';
import type { SessionState } from '../core/session';
import { getPalette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { I18n } from '../core/i18n';
import { cssHex, BRUSH_RADIUS, FONTS } from './paint';
import { fadeIn, fadeToScene } from './fx';

export class CodexScene extends Phaser.Scene {
  constructor() {
    super('Codex');
  }

  create() {
    fadeIn(this);
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const session: SessionState = this.registry.get('session');
    const pal = getPalette(session.round);
    const loc = i18n.locale();
    const counts = codex.counts();
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(pal.bg);

    this.add.text(cx, 42, i18n.t('codex.title'), {
      fontFamily: FONTS.display, fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1.5);
    const found = CREATURES.filter((c) => (counts[c.id] ?? 0) > 0).length;
    this.add.text(cx, 80, i18n.t('codex.count', { found, total: CREATURES.length }).toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(3);

    const rows = this.add.graphics();
    CREATURES.forEach((c, i) => {
      const y = 138 + i * 68;
      const seen = counts[c.id] ?? 0;
      const discovered = seen > 0;

      rows.fillStyle(pal.panel, 1).fillCircle(92, y, 24);
      if (i < CREATURES.length - 1) {
        rows.lineStyle(1, pal.paper, 0.09).lineBetween(60, y + 34, 660, y + 34);
      }

      const silKey = `sil-${c.id}`;
      if (discovered && this.textures.exists(silKey)) {
        this.add.image(92, y + 2, silKey).setScale(0.28);
      } else if (discovered) {
        this.add.circle(92, y, 16, c.color);
      } else {
        this.add.text(92, y, '?', {
          fontFamily: FONTS.display, fontSize: '19px', color: cssHex(pal.paperDim),
        }).setOrigin(0.5).setAlpha(0.6);
      }

      this.add.text(134, y - 19, discovered ? c.names[loc] : i18n.t('codex.unknown'), {
        fontFamily: FONTS.display, fontSize: '19px',
        color: discovered ? cssHex(pal.paper) : cssHex(pal.paperDim),
      }).setAlpha(discovered ? 1 : 0.75);

      const detail = discovered
        ? `${c.descs[loc]}  (${i18n.t('codex.times', { n: seen })})`
        : i18n.t('codex.notRecorded');
      this.add.text(134, y + 6, detail, {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.paperDim),
        wordWrap: { width: 470, useAdvancedWrap: true },
      }).setAlpha(discovered ? 1 : 0.6);

      if (discovered) {
        this.add.text(652, y, `×${seen}`, {
          fontFamily: FONTS.body, fontSize: '14px', color: cssHex(pal.gold),
        }).setOrigin(1, 0.5);
      }
    });

    // 返回按鈕（金邊描線，設計板樣式）
    const bw = 230;
    const bh = 46;
    const by = 736;
    const btn = this.add.graphics();
    btn.lineStyle(1.5, pal.gold, 0.65).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, BRUSH_RADIUS);
    this.add.text(cx, by, i18n.t('btn.back').replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '').toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(cx, by, bw, bh, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => fadeToScene(this, 'Map'));
  }
}
