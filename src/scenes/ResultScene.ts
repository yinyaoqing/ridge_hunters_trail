import Phaser from 'phaser';
import { newSession, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import {
  notesForRun, MILESTONE_NAME, MILESTONE_DETAIL, MILESTONE_QUIRK, type CodexStore,
} from '../core/codex';
import { qualityFromQte, type Quality } from '../core/quality';
import type { QteState } from '../core/qte';
import { CREATURES } from '../data/creatures';
import type { Rng } from '../core/rng';
import type { I18n } from '../core/i18n';
import { dailyKey, createDailySessionFromKey, type StreakStore } from '../core/daily';
import type { RunState } from '../core/runstate';
import { shareText } from '../core/share';
import type { AudioBus } from '../core/audio';
import type { ToolStore, ToolId } from '../core/tools';
import {
  dailyCommissions, evaluate, COMMISSION_REWARD_NOTES, type Commission, type CommissionStore,
} from '../core/commissions';
import {
  cssHex, cssRgba, dashedCircle, BRUSH_RADIUS, FONTS, QUALITY_COLORS,
  displayFont, stripBrackets, creatureTexKey,
} from './paint';
import {
  fadeIn, fadeToScene, restartOnResize, motionOK, ensureDotTexture, addGlowIfWebGL, PARTICLE_CAPS,
} from './fx';

const GLOW_KEY = 'result-glow';

export class ResultScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;

  constructor() {
    super('Result');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    this.audio = this.registry.get('audio');
    this.audio.ambient(false); // 結算畫面停風聲
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;
    const caught = outcome === 'caught';
    this.pal = getPalette(s.round);

    const qte = this.registry.get('qteOutcome') as QteState | undefined;
    const quality: Quality | null = caught && qte ? qualityFromQte(qte) : null;
    const notes = caught ? 0 : notesForRun(s.readClues.size);
    // 單一取樣：daily 的 dateKey 由 Camp 進入時取樣一次存進 registry，
    // 記帳與分享卡都讀同一值，避免跨 UTC 午夜時分歧（沒有存到值時退回現場取樣）。
    // registry 的 'dailyKey' 只在啟動每日挑戰時才會被設定，且 CampScene.create()
    // 才會清空（見該處 registry.remove 呼叫）——若在此對 run 模式沿用它，一旦玩家
    // 「每日挑戰→未回營地→直接主線」跨過 UTC 午夜，run 模式的委託/分享會誤用到
    // 前一天的 daily dateKey。因此非 daily 模式一律現場取樣，只有 daily 模式才讀 stash。
    const dk = s.mode === 'daily'
      ? ((this.registry.get('dailyKey') as string | undefined) ?? dailyKey(new Date()))
      : dailyKey(new Date());

    // 記帳一次（resize 造成的場景重啟不重複）
    if (!s.resolved) {
      s.resolved = true;
      if (caught) {
        codex.addRecord(creature.id, quality ?? 'bronze');
        const runState = this.registry.get('runState') as RunState;
        runState.addWin();
        if (s.mode === 'run') {
          this.registry.set('runRound', s.round + 1);
          runState.setRound(s.round + 1);
        }
      } else {
        codex.addNotes(creature.id, notes);
      }
      if (s.mode === 'daily') {
        (this.registry.get('streak') as StreakStore).recordPlay(dk);
      }
      // 解鎖判定屬記帳動作（會寫入 storage），須留在 resolved 防護內；渲染解鎖卡則需
      // 每次 create（含 resize 重啟）都執行，故把「本次新解鎖」暫存進 registry，
      // 離開 Result（Camp/Map create()）時再清空，避免下次進場殘留舊卡片
      const newTools = (this.registry.get('tools') as ToolStore).syncUnlocks(codex);
      this.registry.set('lastUnlocks', newTools);

      // 委託判定：只在補獲時可能達成（evaluate 對 !caught 一律回 false），沿用 dk（同一取樣）
      // 避免委託與分享卡對 UTC 午夜產生分歧；本次新完成的索引暫存進 registry，
      // 供離開 create() 後的渲染區塊讀取（含 resize 重啟），離開 Result 時清空
      const commStore = this.registry.get('commissions') as CommissionStore;
      const comms = dailyCommissions(dk);
      const status = commStore.statusFor(dk);
      const ctx = {
        caught, creatureId: creature.id, staminaLeft: Math.max(0, s.stamina), quality, mode: s.mode,
      };
      const newlyDone: number[] = [];
      comms.forEach((c, i) => {
        if (!status[i] && evaluate(c, ctx)) {
          commStore.markDone(dk, i);
          codex.addNotes(creature.id, COMMISSION_REWARD_NOTES);
          newlyDone.push(i);
        }
      });
      this.registry.set('lastComms', newlyDone);
    }

    const pal = this.pal;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);
    const cx = this.scale.width / 2;
    const h = this.scale.height;
    const showTools = (this.registry.get('lastUnlocks') as ToolId[] | undefined) ?? [];
    // h<700 視窗已很擁擠（見既有的 Math.min(…, h-96) 夾限），解鎖卡收窄為僅標題行，
    // 卡片間距與後續按鈕位移量一併縮小，降低與按鈕重疊的機率
    const compactCards = h < 700;
    const cardStep = compactCards ? 22 : 40;
    const toolOffset = cardStep * showTools.length;
    // 委託完成行：緊接道具卡堆疊在下方（只在補獲時可能非空，見 resolved 區塊註解）
    const lastComms = (this.registry.get('lastComms') as number[] | undefined) ?? [];
    const commsToday = dailyCommissions(dk); // 純函式、依 dk 決定性重算，供索引取回描述文字
    const commStep = 24;
    const totalOffset = toolOffset + commStep * lastComms.length;

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
      fontFamily: displayFont(loc), fontSize: '30px', color: cssHex(pal.paper),
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

    // 道具解鎖卡（至多同幀 2 枚）：caught 排在圖鑑點列/分隔線下方；
    // !caught 疊在筆記掉落區之上，筆記掉落再依卡片數往下推 toolOffset
    const toolBaseY = caught ? 470 : 486;
    showTools.forEach((id, i) => {
      this.renderToolCard(cx, toolBaseY + i * cardStep, id, i18n, compactCards);
    });
    // 委託完成行接在道具卡之後（同一堆疊區塊，道具卡在上、委託行在下）
    lastComms.forEach((idx, i) => {
      this.renderCommissionLine(cx, toolBaseY + toolOffset + i * commStep, commsToday[idx], i18n);
    });

    if (!caught) this.showNotesDrop(cx, 486 + totalOffset, creature.id, notes, codex, i18n);

    // 按鈕列：每日挑戰／主線成功／主線失敗三種分流，皆保底返回營地
    // 依視窗高度夾限座標，避免矮視窗（如橫向手機）裁切按鈕；780 全高時維持原座標不變
    const runRound: number = this.registry.get('runRound');
    if (s.mode === 'daily') {
      // 失敗時 showNotesDrop 佔用 486~530 一帶，連勝列往下挪，避免文字互疊；
      // 解鎖卡／委託完成行出現時再疊加 totalOffset，避免卡片與連勝列相撞
      const streakY = caught ? Math.min(500 + totalOffset, h - 148) : Math.min(542 + totalOffset, h - 150);
      const campY = Math.min(caught ? 614 + totalOffset : streakY + 112, h - 30);
      const streak: StreakStore = this.registry.get('streak');
      this.add.text(cx, streakY, i18n.t('camp.streak', { n: streak.state().streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(2);
      if (caught) {
        const copyY = streakY + 52;
        const text = shareText(i18n, {
          dateKey: dk, caught, quality,
          steps: s.steps, staminaLeft: Math.max(0, s.stamina), streak: streak.state().streak,
        });
        this.button(cx, copyY, 250, 52, stripBrackets(i18n.t('btn.copy')), true,
          () => this.copyShare(text, i18n, copyY));
      } else {
        const retryY = streakY + 52;
        this.button(cx, retryY, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
          this.registry.set('session', createDailySessionFromKey(dk));
          fadeToScene(this, 'Map');
        });
      }
      this.button(cx, campY, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else if (caught) {
      const yPrimary = Math.min(552 + totalOffset, h - 96);
      const ySecondary = Math.min(614 + totalOffset, h - 34);
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.next')), true, () => {
        this.registry.set('session', newSession(runRound, rng));
        fadeToScene(this, 'Map');
      });
      this.button(cx, ySecondary, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else {
      // Daily retry lives in the daily branch above; this is run mode only
      const yPrimary = Math.min(552 + toolOffset, h - 96);
      const ySecondary = Math.min(614 + toolOffset, h - 34);
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
        this.registry.set('session', newSession(s.round, rng));
        fadeToScene(this, 'Map');
      });
      this.button(cx, ySecondary, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    }
  }

  // 剪貼簿優先，失敗退回 textarea+execCommand；成功在複製鈕上方顯示「已複製！」浮字
  private copyShare(text: string, i18n: I18n, buttonY: number) {
    const done = () => {
      const cx = this.scale.width / 2;
      const t = this.add.text(cx, buttonY - 46, i18n.t('result.copied'), {
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
    // zh-TW 章印用單字（銅/銀/金），避免 4 個全形字塞進 30px 半徑圓章
    const full = i18n.t(QUALITY_KEY[q]);
    const stampLabel = i18n.locale() === 'zh-TW' ? full.slice(0, 1) : full.split(' ')[0];
    const label = this.add.text(0, 0, stampLabel, {
      fontFamily: displayFont(i18n.locale()), fontSize: '13px', color: cssHex(color),
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
    const next = e.research >= MILESTONE_QUIRK ? MILESTONE_QUIRK
      : e.research >= MILESTONE_DETAIL ? MILESTONE_QUIRK
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

  // 道具解鎖卡：金色標題行（淡入）＋（非窄視窗時）暗色說明副標，逐字鍵對應 i18n
  private renderToolCard(cx: number, y: number, id: ToolId, i18n: I18n, compact: boolean) {
    const pal = this.pal;
    const name = i18n.t('result.toolUnlocked', { name: i18n.t(TOOL_NAME_KEY[id]) });
    const nameText = this.add.text(cx, y, name, {
      fontFamily: FONTS.body, fontSize: '15px', color: cssHex(pal.gold), fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: nameText, alpha: 1, duration: 400, delay: 500 });
    if (!compact) {
      const descText = this.add.text(cx, y + 16, i18n.t(TOOL_DESC_KEY[id]), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: descText, alpha: 1, duration: 400, delay: 550 });
    }
  }

  // 委託完成行：單行淡入（供給綠），格式「✓ 描述 — 獎勵」
  // 這裡不套用 comm.done（該 key 由 CampScene.drawCommissionRow 的完成勾消費）——本行已含描述＋
  // 獎勵文字，語意自明，「✓ 已完成 描述 — 獎勵」會顯得冗長重複，故刻意不重複標示「已完成」
  private renderCommissionLine(cx: number, y: number, comm: Commission, i18n: I18n) {
    const text = `✓ ${this.describeCommission(comm, i18n)} — ${i18n.t('comm.reward', { n: COMMISSION_REWARD_NOTES })}`;
    const t = this.add.text(cx, y, text, {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(this.pal.supply),
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 400, delay: 500 });
  }

  // 委託描述組字：依 kind 套用對應 i18n 樣板；quality 的 {q} 沿用 stampQuality
  // 同款「zh-TW 取首字／en 取首詞」邏輯，避免長字串塞爆窄卡
  // 註：CampScene 需要同一段邏輯繪製委託卡，依本專案「場景自成一體」慣例於該處重複實作
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
    const texKey = creatureTexKey(this, creatureId);
    if (this.textures.exists(texKey)) {
      const sil = this.add.image(cx, cy + 4, texKey).setScale(1.05);
      addGlowIfWebGL(this, sil, this.pal.glow);
    } else {
      this.add.circle(cx, cy, 60, color);
    }

    // 補獲慶祝孢子：一次性 explode，texture 依生物上色（key 帶 id 避免跨生物撞色沿用舊材質）
    if (motionOK()) {
      const sporeKey = `dot-spore-${creatureId}`;
      ensureDotTexture(this, sporeKey, color, 4);
      const spores = this.add.particles(cx, cy, sporeKey, {
        lifespan: 1800,
        speedY: { min: 20, max: 60 },
        speedX: { min: -30, max: 30 },
        alpha: { start: 0.9, end: 0 },
        scale: { start: 1, end: 0.4 },
        emitting: false,
      });
      spores.explode(PARTICLE_CAPS.spore);
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
      .on('pointerup', () => { txt.setScale(1); this.audio.unlock(); this.audio.play('click'); onClick(); });
  }
}

// 品質字串鍵映射：避免模板字面型別在部分 tsc 設定下無法收斂為 MsgKey 聯集
const QUALITY_KEY = {
  bronze: 'quality.bronze', silver: 'quality.silver', gold: 'quality.gold',
} as const;

// 道具字串鍵映射：同上，避免 `tool.${id}.name` 模板字面型別無法收斂為 MsgKey 聯集
const TOOL_NAME_KEY = { windstone: 'tool.windstone.name', glowbell: 'tool.glowbell.name' } as const;
const TOOL_DESC_KEY = { windstone: 'tool.windstone.desc', glowbell: 'tool.glowbell.desc' } as const;
