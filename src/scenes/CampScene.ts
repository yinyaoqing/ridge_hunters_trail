import Phaser from 'phaser';
import { newSession } from '../core/session';
import { createDailySession, createDailySessionFromKey, dailyKey, type StreakStore } from '../core/daily';
import { getPalette, type Palette } from '../core/palette';
import { CREATURES } from '../data/creatures';
import type { CodexStore } from '../core/codex';
import type { Rng } from '../core/rng';
import type { Weather } from '../core/weather';
import type { I18n, MsgKey } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import {
  dailyCommissions, COMMISSION_REWARD_NOTES, type Commission, type CommissionStore,
} from '../core/commissions';
import { cssHex, BRUSH_RADIUS, FONTS, stripBrackets } from './paint';
import {
  fadeIn, fadeToScene, restartOnResize, motionOK, ensureDotTexture, guardLowFps, PARTICLE_CAPS,
} from './fx';

export class CampScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;

  constructor() {
    super('Camp');
  }

  create() {
    const i18n: I18n = this.registry.get('i18n');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const streak: StreakStore = this.registry.get('streak');
    const runRound: number = this.registry.get('runRound');
    this.audio = this.registry.get('audio');
    this.pal = getPalette(1); // 營地固定霧綠配色
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    this.registry.set('lastUnlocks', []); // 離開 Result 後清空解鎖卡狀態，避免下次 resize/重入殘留
    this.registry.set('lastComms', []); // 同上，清空委託完成行狀態
    // 清空每日挑戰 dateKey 暫存：回到營地代表本次 daily（若有）已結算完畢；
    // 若不清空，下一局若改走主線（run）模式，ResultScene 仍會殘留讀到舊 dailyKey，
    // 一旦跨過 UTC 午夜就會用錯日期的委託/分享 dateKey（見 F2）
    this.registry.remove('dailyKey');
    fadeIn(this);
    restartOnResize(this);
    // F1 audio unlock hook：任何首次指標按下即視為使用者手勢，解除 AudioContext 靜音鎖
    // （unlock() 冪等，MapScene 亦掛同款 hook，兩邊皆可安全觸發）
    // 鍵盤 hook：MapScene 支援方向鍵移動，純鍵盤玩家永遠不會觸發 pointerdown，
    // 需另掛一次性 keydown 才能解鎖（keydown 同為瀏覽器認可的有效手勢）
    this.input.keyboard?.once('keydown', () => this.audio.unlock());
    this.input.once('pointerdown', () => this.audio.unlock());
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

    // 今日天氣：僅生成一次每日 session 取其 weather 欄位（成本可忽略），不存入 registry/session——
    // 真正要玩的 session 仍由下方按鈕的 createDailySession(now) 產生
    const todayWeather = createDailySessionFromKey(today).level.weather;
    const dailyLabel = (dailyDone
      ? `${i18n.t('camp.daily')} · ${i18n.t('camp.dailyDone')} ✓`
      : `${i18n.t('camp.daily')} · ${today}`) + `｜${i18n.t(WEATHER_KEY[todayWeather])}`;
    this.button(cx, by, bw, 50, dailyLabel, false, () => {
      const now = new Date();
      this.registry.set('session', createDailySession(now));
      // 單一取樣：與 ResultScene 記帳/分享卡共用同一 dateKey，避免跨 UTC 午夜時分歧
      this.registry.set('dailyKey', dailyKey(now));
      fadeToScene(this, 'Map');
    });
    by += 64;

    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.button(cx, by, bw, 50,
      `${stripBrackets(i18n.t('btn.guide'))} ${found}/${CREATURES.length}`, false,
      () => fadeToScene(this, 'Codex'));
    by += 72;

    // 委託板：三則每日委託（同 dailyKey 種子，與 ResultScene 結算共用判定邏輯）；
    // 矮視窗（h<692，見 rowH=44 換算）已很擁擠，收合為單行「委託板 n/3」，避免與下方工具列相撞
    const commStore = this.registry.get('commissions') as CommissionStore;
    const comms = dailyCommissions(today);
    const commStatus = commStore.statusFor(today);
    if (h < 692) {
      const doneCount = commStatus.filter(Boolean).length;
      this.add.text(cx, by, `${i18n.t('comm.title')} ${doneCount}/3`, {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5).setLetterSpacing(1);
      by += 28;
    } else {
      this.add.text(cx, by, i18n.t('comm.title'), {
        fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5).setLetterSpacing(1.5);
      by += 20;
      // rowH 34→44：描述加上 wordWrap 後兩行文字需要更高的列高才不會貼邊（見 drawCommissionRow）
      const rowH = 44;
      const rowGap = 6;
      comms.forEach((c, i) => {
        this.drawCommissionRow(cx, by, bw, rowH, c, commStatus[i], i18n);
        by += rowH + rowGap;
      });
      by += 4; // 與工具列留一點呼吸空間
    }

    // 小工具列：靜音＋說明＋語言（三鈕置中排列，18px 間距）
    const xSound = cx - 80;
    const xHelp = cx - 18;
    const xLang = cx + 62;
    this.drawSoundGlyph(xSound, by, this.audio.enabled());
    this.add.rectangle(xSound, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.audio.unlock(); // 保險：確保這次手勢也算數（與 create() 的全域 hook 冪等共存）
        this.audio.toggle();
        this.scene.restart(); // 較簡單一致：與語言鈕相同，用 restart 取代局部重繪
      });
    this.add.text(xHelp, by, '?', {
      fontFamily: FONTS.display, fontSize: '18px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.add.rectangle(xHelp, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('Help', { from: 'Camp' });
        this.scene.pause();
      });
    this.add.text(xLang, by, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.rectangle(xLang, by, 80, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.scene.restart();
      });

    this.audio.ambient(true); // 營地環境風聲（靜音時 ambient 內部自行忽略）
  }

  // ♪ 圖示：開＝金色，關＝暗色＋斜線（與 MapScene 標記 chip 同語彙）
  private drawSoundGlyph(x: number, y: number, enabled: boolean) {
    const pal = this.pal;
    this.add.text(x, y, '♪', {
      fontFamily: FONTS.display, fontSize: '18px', color: cssHex(enabled ? pal.gold : pal.paperDim),
    }).setOrigin(0.5);
    if (!enabled) {
      this.add.graphics().lineStyle(1.5, pal.paperDim, 0.9)
        .lineBetween(x - 9, y + 9, x + 9, y - 9);
    }
  }

  // 委託窄卡：panel 色圓角矩形，左側描述、右側完成勾或獎勵提示
  private drawCommissionRow(
    cx: number, y: number, w: number, h: number, c: Commission, done: boolean, i18n: I18n,
  ) {
    const pal = this.pal;
    this.add.graphics().fillStyle(pal.panel, 0.9).fillRoundedRect(cx - w / 2, y, w, h, 6);
    this.add.text(cx - w / 2 + 12, y + h / 2, this.describeCommission(c, i18n), {
      fontFamily: FONTS.body, fontSize: '11.5px', color: cssHex(done ? pal.paperDim : pal.paper),
      // 完成標籤（✓ 已完成／獎勵提示）保留約 110px 寬度，描述換行寬度扣除該區避免重疊
      wordWrap: { width: w - 110, useAdvancedWrap: true },
    }).setOrigin(0, 0.5);
    if (done) {
      // comm.done 消費點：右側完成勾附上在地化文字（非純符號），符合規格要求的 i18n key 用途
      this.add.text(cx + w / 2 - 14, y + h / 2, `✓ ${i18n.t('comm.done')}`, {
        fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.gold), fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    } else {
      this.add.text(cx + w / 2 - 12, y + h / 2, i18n.t('comm.reward', { n: COMMISSION_REWARD_NOTES }), {
        fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.supply),
      }).setOrigin(1, 0.5);
    }
  }

  // 委託描述組字：與 ResultScene.describeCommission 邏輯相同（依專案「場景自成一體」
  // 慣例於此重複實作，而非跨場景共用私有方法）；{q} 沿用 stampQuality 的
  // 「zh-TW 取首字／en 取首詞」短形式，避免長字串塞爆窄卡
  private describeCommission(c: Commission, i18n: I18n): string {
    switch (c.kind) {
      case 'record-creature': {
        const cr = CREATURES.find((x) => x.id === c.creatureId)!;
        return i18n.t('comm.record', { name: cr.names[i18n.locale()] });
      }
      case 'stamina-finish':
        return i18n.t('comm.stamina', { n: c.min });
      case 'quality-any': {
        const full = i18n.t(QUALITY_KEY[c.quality]);
        const q = i18n.locale() === 'zh-TW' ? full.slice(0, 1) : full.split(' ')[0];
        return i18n.t('comm.quality', { q });
      }
    }
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

    // 營火火星：低密度上飄粒子，減少動態偏好時完全不生成
    if (motionOK()) {
      ensureDotTexture(this, 'dot-ember', 0xe8b06a, 3);
      const emitter = this.add.particles(w / 2, h * 0.9 - 6, 'dot-ember', {
        frequency: 400,
        lifespan: 1400,
        speedY: { min: -40, max: -15 },
        speedX: { min: -8, max: 8 },
        alpha: { start: 0.8, end: 0 },
        maxAliveParticles: PARTICLE_CAPS.ember,
      });
      guardLowFps(this, emitter);
    }
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
      .on('pointerup', () => { txt.setScale(1); this.audio.unlock(); this.audio.play('click'); onClick(); });
  }
}

// 品質字串鍵映射：同 ResultScene 的 QUALITY_KEY，避免模板字面型別無法收斂為 MsgKey 聯集
const QUALITY_KEY = {
  bronze: 'quality.bronze', silver: 'quality.silver', gold: 'quality.gold',
} as const;

// 天氣字串鍵映射：同 MapScene 的 WEATHER_KEY，場景自成一體慣例下重複宣告
const WEATHER_KEY: Record<Weather, MsgKey> = {
  clear: 'weather.clear', mist: 'weather.mist', wind: 'weather.wind', drizzle: 'weather.drizzle',
};
