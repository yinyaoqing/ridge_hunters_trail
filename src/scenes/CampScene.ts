import Phaser from 'phaser';
import { newSession } from '../core/session';
import { createDailySession, dailyKey, type StreakStore } from '../core/daily';
import { getPalette, type Palette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { CodexStore } from '../core/codex';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { cssHex, BRUSH_RADIUS, FONTS } from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

const stripBrackets = (s: string) => s.replace(/^[[［]\s*/, '').replace(/\s*[\]］]$/, '');

export class CampScene extends Phaser.Scene {
  private pal!: Palette;

  constructor() {
    super('Camp');
  }

  create() {
    const i18n: I18n = this.registry.get('i18n');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const streak: StreakStore = this.registry.get('streak');
    const runRound: number = this.registry.get('runRound');
    this.pal = getPalette(1); // 營地固定霧綠配色
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.scene.restart()); // Help 關閉後刷新語言

    this.drawRidges(w, h);

    this.add.text(cx, h * 0.16, "RIDGE HUNTER'S TRAIL", {
      fontFamily: FONTS.display, fontSize: '34px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(3);

    // 連勝 chip（右上，>0 才顯示）
    const st = streak.state();
    if (st.streak > 0) {
      this.add.text(w - 20, 24, i18n.t('camp.streak', { n: st.streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5).setLetterSpacing(2);
    }

    const today = dailyKey(new Date());
    const dailyDone = st.lastPlayed === today;
    const bw = Math.min(320, w - 48);
    let by = h * 0.42;

    this.button(cx, by, bw, 54, stripBrackets(i18n.t('camp.continue', { n: runRound })), true, () => {
      this.registry.set('session', newSession(runRound, rng));
      fadeToScene(this, 'Map');
    });
    by += 68;

    const dailyLabel = dailyDone
      ? `${i18n.t('camp.daily')} · ${i18n.t('camp.dailyDone')} ✓`
      : `${i18n.t('camp.daily')} · ${today}`;
    this.button(cx, by, bw, 50, dailyLabel, false, () => {
      this.registry.set('session', createDailySession(new Date()));
      fadeToScene(this, 'Map');
    });
    by += 64;

    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.button(cx, by, bw, 50,
      `${stripBrackets(i18n.t('btn.guide'))} ${found}/${CREATURES.length}`, false,
      () => fadeToScene(this, 'Codex'));
    by += 72;

    // 小工具列：說明＋語言
    this.add.text(cx - 40, by, '?', {
      fontFamily: FONTS.display, fontSize: '18px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.add.rectangle(cx - 40, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('Help', { from: 'Camp' });
        this.scene.pause();
      });
    this.add.text(cx + 40, by, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.rectangle(cx + 40, by, 80, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.scene.restart();
      });
  }

  // 山稜背景：三層漸遠剪影（程式繪製，延續水墨方向）
  private drawRidges(w: number, h: number) {
    const pal = this.pal;
    const layers: { color: number; alpha: number; base: number; amp: number }[] = [
      { color: pal.panel, alpha: 1, base: 0.62, amp: 0.1 },
      { color: pal.terrain.mist, alpha: 0.7, base: 0.72, amp: 0.08 },
      { color: pal.terrain.meadow, alpha: 0.9, base: 0.84, amp: 0.05 },
    ];
    const g = this.add.graphics();
    layers.forEach((l, li) => {
      g.fillStyle(l.color, l.alpha);
      const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: h }];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = (w / n) * i;
        const jag = Math.sin(i * 2.7 + li * 1.3) * l.amp * h;
        pts.push({ x, y: h * l.base + jag });
      }
      pts.push({ x: w, y: h });
      g.fillPoints(pts, true);
    });
    // 營火微光（靜態，不做循環動畫）
    const glow = this.add.graphics();
    glow.fillStyle(pal.gold, 0.12).fillCircle(w / 2, h * 0.9, 60);
    glow.fillStyle(pal.gold, 0.25).fillCircle(w / 2, h * 0.9, 22);
    glow.fillStyle(0xe8b06a, 0.9).fillTriangle(
      w / 2 - 7, h * 0.9 + 8, w / 2 + 7, h * 0.9 + 8, w / 2, h * 0.9 - 12);
  }

  // 與 ResultScene.button 同樣式（hover 增亮、按下微縮）
  private button(
    x: number, y: number, w: number, h: number,
    label: string, filled: boolean, onClick: () => void,
  ) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      if (filled) {
        g.fillStyle(pal.gold, hover ? 1 : 0.92).fillRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      } else {
        g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65).strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
      }
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: filled ? '16px' : '14.5px',
      color: filled ? cssHex(pal.bg) : cssHex(pal.gold),
      fontStyle: filled ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(1.5);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); onClick(); });
  }
}
