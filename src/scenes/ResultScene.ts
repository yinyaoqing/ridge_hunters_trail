import Phaser from 'phaser';
import { newSession, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { notesForRun, MILESTONE_NAME, MILESTONE_DETAIL, type CodexStore } from '../core/codex';
import { qualityFromQte, type Quality } from '../core/quality';
import type { QteState } from '../core/qte';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { dailyKey, type StreakStore } from '../core/daily';
import { shareText } from '../core/share';
import {
  cssHex, cssRgba, dashedCircle, BRUSH_RADIUS, FONTS, QUALITY_COLORS,
} from './paint';
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
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;
    const caught = outcome === 'caught';
    this.pal = getPalette(s.round);

    const qte = this.registry.get('qteOutcome') as QteState | undefined;
    const quality: Quality | null = caught && qte ? qualityFromQte(qte) : null;
    const notes = caught ? 0 : notesForRun(s.readClues.size);

    // 記帳一次（resize 造成的場景重啟不重複）
    if (!s.resolved) {
      s.resolved = true;
      if (caught) {
        codex.addRecord(creature.id, quality ?? 'bronze');
        if (s.mode === 'run') this.registry.set('runRound', s.round + 1);
      } else {
        codex.addNotes(creature.id, notes);
      }
      if (s.mode === 'daily') {
        (this.registry.get('streak') as StreakStore).recordPlay(dailyKey(new Date()));
      }
    }

    const pal = this.pal;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    const cx = this.scale.width / 2;

    let title: string;
    let body: string;
    if (caught) {
      this.drawCreaturePortrait(cx, 212, creature.id, creature.color);
      if (quality) this.stampQuality(cx + 128, 268, quality, i18n);
      title = i18n.t('result.recorded', { name: creature.names[loc] });
      body = creature.descs[loc];
    } else if (outcome === 'escaped') {
      title = i18n.t('result.escaped.title');
      body = i18n.t('result.escaped.body');
    } else {
      title = i18n.t('result.exhausted.title');
      body = i18n.t('result.exhausted.body');
    }

    this.add.text(cx, 336, title, {
      fontFamily: FONTS.display, fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1);

    this.drawCodexDots(cx, 372, codex);

    const divider = this.add.graphics();
    divider.lineStyle(1.6, pal.gold, 0.5);
    divider.beginPath();
    divider.moveTo(cx - 105, 402);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, 402 + (i % 2 === 0 ? 1.5 : -1.5));
    }
    divider.strokePath();

    this.add.text(cx, 438, body, {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.paperDim),
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    if (!caught) this.showNotesDrop(cx, 486, creature.id, notes, codex, i18n);

    // 按鈕列：每日挑戰／主線成功／主線失敗三種分流，皆保底返回營地
    const runRound: number = this.registry.get('runRound');
    if (s.mode === 'daily') {
      const streak: StreakStore = this.registry.get('streak');
      const text = shareText(i18n, {
        dateKey: dailyKey(new Date()), caught, quality,
        steps: s.steps, staminaLeft: Math.max(0, s.stamina), streak: streak.state().streak,
      });
      this.add.text(cx, 500, i18n.t('camp.streak', { n: streak.state().streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(2);
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.copy')), true,
        () => this.copyShare(text, i18n));
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else if (caught) {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.next')), true, () => {
        this.registry.set('session', newSession(runRound, rng));
        fadeToScene(this, 'Map');
      });
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else {
      this.button(cx, 552, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
        this.registry.set('session', newSession(s.round, rng, s.mode));
        fadeToScene(this, 'Map');
      });
      this.button(cx, 614, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    }
  }

  // 剪貼簿優先，失敗退回 textarea+execCommand；成功顯示「已複製！」浮字
  private copyShare(text: string, i18n: I18n) {
    const done = () => {
      const cx = this.scale.width / 2;
      const t = this.add.text(cx, 500, i18n.t('result.copied'), {
        fontFamily: FONTS.body, fontSize: '13px', color: cssHex(this.pal.supply), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
    };
    try {
      navigator.clipboard.writeText(text).then(done, () => this.copyFallback(text, done));
    } catch {
      this.copyFallback(text, done);
    }
  }

  private copyFallback(text: string, done: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      // 複製不可用時靜默；分享卡文字仍顯示於畫面外不可見，不擋流程
    }
  }

  // 品質墨章：蓋印動畫（縮放 1.8 → 1、Back ease）
  private stampQuality(x: number, y: number, q: Quality, i18n: I18n) {
    const color = QUALITY_COLORS[q];
    const g = this.add.graphics();
    g.lineStyle(2.5, color, 0.9).strokeCircle(0, 0, 30);
    g.lineStyle(1, color, 0.4).strokeCircle(0, 0, 24);
    const label = this.add.text(0, 0, i18n.t(QUALITY_KEY[q]).split(' ')[0], {
      fontFamily: FONTS.display, fontSize: '13px', color: cssHex(color),
    }).setOrigin(0.5);
    const holder = this.add.container(x, y, [g, label]).setScale(1.8).setAlpha(0);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 1, duration: 350, delay: 400, ease: 'Back.easeOut',
    });
  }

  // 圖鑑進度點列：8 顆點，已發現者以生物色實心
  private drawCodexDots(cx: number, y: number, codex: CodexStore) {
    const g = this.add.graphics();
    const gap = 22;
    const x0 = cx - ((CREATURES.length - 1) * gap) / 2;
    CREATURES.forEach((c, i) => {
      const x = x0 + i * gap;
      if (codex.entry(c.id).count > 0) g.fillStyle(c.color, 1).fillCircle(x, y, 5);
      else g.lineStyle(1.2, this.pal.paperDim, 0.5).strokeCircle(x, y, 5);
    });
  }

  // 失敗軟著陸：筆記掉落＋該生物研究度（目前值 / 下一里程碑）
  private showNotesDrop(
    cx: number, y: number, creatureId: string, notes: number, codex: CodexStore, i18n: I18n,
  ) {
    const pal = this.pal;
    const e = codex.entry(creatureId);
    const next = e.research >= MILESTONE_DETAIL ? MILESTONE_DETAIL
      : e.research >= MILESTONE_NAME ? MILESTONE_DETAIL : MILESTONE_NAME;
    const t = this.add.text(cx, y, i18n.t('result.notes', { n: notes }), {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.supply), fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 6, duration: 400, delay: 300 });

    const bw = 180;
    const g = this.add.graphics();
    g.fillStyle(0x0d1310, 1).fillRoundedRect(cx - bw / 2, y + 18, bw, 8, 4);
    const ratio = Math.min(1, e.research / next);
    if (ratio > 0) g.fillStyle(pal.glow, 0.9).fillRoundedRect(cx - bw / 2 + 1, y + 19, (bw - 2) * ratio, 6, 3);
    this.add.text(cx, y + 40, i18n.t('result.research', { cur: e.research, next }), {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5).setLetterSpacing(1.5);
  }

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

  // 按鈕：hover 增亮、按下內縮
  private button(
    x: number, y: number, w: number, h: number,
    label: string, filled: boolean, onClick: () => void,
  ) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      if (filled) {
        g.fillStyle(pal.gold, hover ? 1 : 0.92)
          .fillRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      } else {
        g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65)
          .strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      }
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: filled ? '17px' : '16px',
      color: filled ? cssHex(pal.bg) : cssHex(pal.gold),
      fontStyle: filled ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); onClick(); });
  }
}

// 品質字串鍵映射：避免模板字面型別在部分 tsc 設定下無法收斂為 MsgKey 聯集
const QUALITY_KEY = {
  bronze: 'quality.bronze', silver: 'quality.silver', gold: 'quality.gold',
} as const;
