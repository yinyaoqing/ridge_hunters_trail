import Phaser from 'phaser';
import { newSession, currentTarget, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import {
  notesForRun, MILESTONE_NAME, MILESTONE_DETAIL, MILESTONE_QUIRK, type CodexStore,
} from '../core/codex';
import { qualityFromAccuracy, type Quality } from '../core/quality';
import { wagerKey, parseKey } from '../core/marks';
import { catchScore, MULTIPLIERS, type ScoreStore } from '../core/score';
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
  displayFont, stripBrackets, creatureTexKey, creatureScale,
} from './paint';
import {
  fadeIn, fadeToScene, restartOnResize, motionOK, ensureDotTexture, addGlowIfWebGL, PARTICLE_CAPS,
} from './fx';
import { flowY, type FlowBlock } from '../core/layout';

const GLOW_KEY = 'result-glow';

export class ResultScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;
  private choiceMade = false;

  constructor() {
    super('Result');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    const rng: Rng = this.registry.get('rng');
    const codex: CodexStore = this.registry.get('codex');
    const i18n: I18n = this.registry.get('i18n');
    const score: ScoreStore = this.registry.get('score');

    // 淡出期間若被 resize 重啟，registry 中已是下一局的全新 session（explore 階段）——
    // 直接續走地圖，避免以新局資料誤跑結算記帳。
    if (s.phase === 'explore') {
      fadeToScene(this, 'Map');
      return;
    }

    this.choiceMade = false; // 場景實例會跨局重用，每次 create()（含 resize 重啟）都要重置押注互斥旗標
    this.audio = this.registry.get('audio');
    this.audio.ambient(false); // 結算畫面停風聲
    const loc = i18n.locale();
    const creature = CREATURES.find((c) => c.id === s.level.creatureId)!;
    const outcome = s.phase;
    const caught = outcome === 'caught';
    this.pal = getPalette(s.round);

    // 品質改由本局判讀精準度決定（Phase 4／診斷 C-03）：QTE 仍決定成敗，但不再決定品質
    const wk = wagerKey(s.marks);
    const wager = wk === null ? null : parseKey(wk);
    const quality: Quality | null = caught ? qualityFromAccuracy(wager, currentTarget(s)) : null;
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
        codex.addRecord(creature.id, quality ?? 'bronze', s.level.iris);
        const runState = this.registry.get('runState') as RunState;
        runState.addWin();
        if (s.mode === 'run') {
          this.registry.set('runRound', s.round + 1);
          runState.setRound(s.round + 1);
          // 押注記帳：以本局品質＋異彩加成算得分，累入未入袋的 pot（乘上目前連追倍率）
          const gained = score.addCatch(catchScore(s.round, quality ?? 'bronze', s.level.iris));
          this.registry.set('lastGain', gained);
        }
      } else {
        codex.addNotes(creature.id, notes);
        // 押注記帳：失手清空 pot——須在 loseRun() 歸零前先讀出待入袋金額，供下方顯示 score.lost
        if (s.mode === 'run') {
          this.registry.set('lastLoss', score.state().pot);
          score.loseRun();
        }
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
    // h<700 視窗已很擁擠，解鎖卡收窄為僅標題行——卡片間距縮小，降低與按鈕重疊的機率；
    // 版面本身已改由下方 flowY 排定，這裡只留下「畫不畫副標」與「區塊多高」兩個決定
    // 斷點取 720 而非 700：離開精簡模式時肖像 132→194、道具卡 18→32，一口氣多出 76px，
    // 若斷點壓在剛好放得下的高度上，把視窗拉高一像素反而會讓版面更擠。
    const compactCards = h < 720;
    // 肖像在矮視窗縮小，沿用道具卡同一個斷點。實際畫出來的硬範圍是
    // cy-92（虛線環）到 cy+96.4（剪影後備貼圖 208x176 縮放 1.05 畫在 cy+4），
    // 合計 188.4px——舊版宣告 150，等於對版面謊報了近 40px，flowY 因此把標題
    // 排得比實際能容納的還近，滿載的補獲畫面在矮視窗會讓金色虛線環穿過生物名稱。
    // 但誠實地宣告 194 又會讓「兩張道具卡＋三則委託」的滿載組合在 600px 高的視窗
    // 溢出、把次鈕推出畫面，所以矮視窗連同繪製一起縮到 0.68。
    const portraitScale = compactCards ? 0.68 : 1;
    const portraitH = compactCards ? 132 : 194;
    // run 且失手時，未入袋的 score.lost 軟著陸訊息併入同一疊層（視為多一個 flowY 區塊）
    const lastLoss = (this.registry.get('lastLoss') as number | undefined) ?? 0;
    const showLoss = !caught && s.mode === 'run' && lastLoss > 0;
    // 委託完成行：緊接道具卡堆疊在下方（只在補獲時可能非空，見 resolved 區塊註解）
    const lastComms = (this.registry.get('lastComms') as number[] | undefined) ?? [];
    const commsToday = dailyCommissions(dk); // 純函式、依 dk 決定性重算，供索引取回描述文字
    // run 且補獲時，score.gain/score.pot 兩行也併入同一疊層
    const showScoreGain = caught && s.mode === 'run';

    let title: string;
    let body: string;
    if (caught) {
      // 異彩變種：肖像光暈／虛線環／剪影 tint 改用 pal.iris；標題名稱前綴異彩字樣（見下方 name 組字）
      const name = (s.level.iris ? i18n.t('iris.prefix') : '') + creature.names[loc];
      title = i18n.t('result.recorded', { name });
      body = creature.descs[loc];
    } else if (outcome === 'escaped') {
      title = i18n.t('result.escaped.title');
      body = i18n.t('result.escaped.body');
    } else {
      title = i18n.t('result.exhausted.title');
      body = i18n.t('result.exhausted.body');
    }

    // 內文行高：16px 字、lineSpacing 6，wordWrap 460。中文多為 1 行、英文常 2 行，
    // 失敗文案最長 3 行。以量測值決定區塊高度，避免用猜的。
    const bodyProbe = this.add.text(0, -999, body, {
      fontFamily: FONTS.body, fontSize: '16px',
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    });
    const bodyH = bodyProbe.height;
    bodyProbe.destroy();

    // 版面改由 flowY 排定（見 src/core/layout.ts）。舊版自 y=336 起全是固定座標，
    // 只有按鈕列有 h-96 這類夾限，於是內容一長就從下方溢出撞進按鈕——實測截圖裡
    // 「研究度 n / m」正好被主鈕蓋掉一半（兩者都落在 y=526）。現在整疊同一套規則。
    const blocks: FlowBlock[] = [];
    const slot: Record<string, number> = {};
    const add = (name: string, b: FlowBlock) => { slot[name] = blocks.length; blocks.push(b); };

    if (caught) add('portrait', { h: portraitH, gap: 24, maxGap: 60 });
    add('title', { h: 38, gap: caught ? 20 : 56, maxGap: 96 });
    add('dots', { h: 14, gap: 18, minGap: 10 });
    add('divider', { h: 6, gap: 18, minGap: 10 });
    add('body', { h: bodyH, gap: 22, minGap: 12 });
    // 非精簡時卡片是「名稱 ＋ 其下 16px 的說明」，實際範圍 y-8.5 到 y+23.5，
    // 中心在 y+7.5；精簡時只有名稱，中心就在 y。高度直接寫出量到的值，
    // 不再由舊版累加版面的步進值減去一個常數推導。
    showTools.forEach((_, i) => add(`tool${i}`, { h: compactCards ? 18 : 32, gap: 14, minGap: 8 }));
    // 高度直接寫出量到的值（13px 單行字約 15px 高，18 涵蓋得住），
    // 不再由舊版累加版面的步進值減去一個常數推導
    lastComms.forEach((_, i) => add(`comm${i}`, { h: 18, gap: 10, minGap: 6 }));
    if (showLoss) add('loss', { h: 30, gap: 14, minGap: 8 });
    if (showScoreGain) add('gain', { h: 40, gap: 16, minGap: 10 });
    // 真實高度 61：計數行補間後停在 y-6（字框上緣 y-14.5）、進度條在 y+18…y+26、
    // 研究度說明在 y+40（字框下緣 y+46.5），合計 y-14.5 … y+46.5，中心在 y+16。
    // 因此下方繪製時傳入的錨點要比區塊中心往上退 16。
    if (!caught) add('notes', { h: 62, gap: 18, minGap: 10 });
    if (s.mode === 'daily') add('streak', { h: 16, gap: 18, minGap: 10 });
    add('primary', { h: 52, gap: 26, minGap: 16 });
    add('secondary', { h: 48, gap: 14, minGap: 12 });
    // 這個區塊只用來替示範連結預留尾端空間，位置並不會被讀取——連結實際錨在
    // 畫出來的次鈕之下（見下方 demoLinkY），因為次鈕被夾上來時它必須跟著上來。
    // 高度取 36，與那塊 420x36 的點擊矩形一致。
    if (!caught && s.mode === 'run') add('demo', { h: 36, gap: 16, minGap: 10 });

    const ys = flowY(blocks, 24, h - 20);
    const at = (name: string): number => ys[slot[name]];
    // 按鈕是這個畫面唯一的出口——每日挑戰補獲時，「返回營地」更是唯一能離開的路。
    // flowY 在空間不足時會誠實地把區塊排到 bottom 之外，那對內容區塊是對的選擇，
    // 對按鈕卻是死路：玩家會被困在結算畫面，只能重新載入頁面。因此按鈕最後夾回畫面內。
    // 極矮視窗下寧可讓按鈕蓋住上方的文字，也不能讓按鈕自己消失——
    // 被蓋住的說明還讀得到一部分，按不到的按鈕沒有任何替代方案。
    // 次鈕高 48，中心夾在 h-32 讓底緣留 8px；主鈕高 52，中心再往上 62 讓兩者至少相距 12px。
    const btnSecondaryY = Math.min(at('secondary'), h - 32);
    const btnPrimaryY = Math.min(at('primary'), btnSecondaryY - 62);

    if (caught) {
      this.drawCreaturePortrait(
        cx, at('portrait'), creature.id, s.level.iris ? pal.iris : creature.color, s.level.iris, portraitScale);
      // 蓋印隨肖像等比移位，否則縮小後它會浮在肖像外面
      if (quality) {
        this.stampQuality(
          cx + 128 * portraitScale, at('portrait') + 56 * portraitScale, quality, i18n, portraitScale);
      }
    }

    this.add.text(cx, at('title'), title, {
      fontFamily: displayFont(loc), fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(1);

    this.drawCodexDots(cx, at('dots'), codex);

    const divider = this.add.graphics();
    divider.lineStyle(1.6, pal.gold, 0.5);
    divider.beginPath();
    const dy = at('divider');
    divider.moveTo(cx - 105, dy);
    for (let i = 1; i <= 6; i++) {
      divider.lineTo(cx - 105 + i * 35, dy + (i % 2 === 0 ? 1.5 : -1.5));
    }
    divider.strokePath();

    this.add.text(cx, at('body'), body, {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.paperDim),
      wordWrap: { width: 460, useAdvancedWrap: true }, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    // 道具解鎖卡（至多同幀 2 枚）：caught 排在圖鑑點列/分隔線下方；
    // !caught 疊在筆記掉落區之上——確切位置全數改由 flowY 決定
    showTools.forEach((id, i) => {
      this.renderToolCard(cx, at(`tool${i}`) - (compactCards ? 0 : 7.5), id, i18n, compactCards);
    });
    // 委託完成行接在道具卡之後（同一堆疊區塊，道具卡在上、委託行在下）
    lastComms.forEach((idx, i) => {
      this.renderCommissionLine(cx, at(`comm${i}`), commsToday[idx], i18n);
    });

    // 押注顯示：補獲時接在道具卡／委託行之後顯示本次入袋收穫＋目前未入袋總額
    if (showScoreGain) {
      const lastGain = (this.registry.get('lastGain') as number | undefined) ?? 0;
      const gy = at('gain');
      this.add.text(cx, gy - 10, i18n.t('score.gain', { n: lastGain }), {
        fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.gold), fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(cx, gy + 10, i18n.t('score.pot', { n: score.state().pot }), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5);
    }

    // 押注軟著陸：未入袋收穫散進霧裡的溫柔提示，接在道具卡之後、筆記掉落區之上
    if (showLoss) {
      this.add.text(cx, at('loss'), i18n.t('score.lost'), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
        wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
      }).setOrigin(0.5);
    }
    // showNotesDrop 的 y 是它第一行文字的中心，真實範圍是 y-14.75（計數行補間後的
    // 落點）到 y+46.5（研究度說明），中心在 y+15.9，因此傳入 at('notes') - 16
    // 讓整塊以 flowY 給的中心對齊。不改 showNotesDrop 內部的相對位移——那組數字
    // 本身沒有問題，出事的是整塊被放得太低
    if (!caught) this.showNotesDrop(cx, at('notes') - 16, creature.id, notes, codex, i18n);

    // 按鈕列：每日挑戰／主線成功／主線失敗三種分流，皆保底返回營地
    // 按鈕列座標由 flowY 排定，再由上方的 btnPrimaryY／btnSecondaryY 夾回畫面內——
    // 內容可以誠實地溢出，唯一的出口不行。
    const runRound: number = this.registry.get('runRound');
    if (s.mode === 'daily') {
      const streak: StreakStore = this.registry.get('streak');
      this.add.text(cx, at('streak'), i18n.t('camp.streak', { n: streak.state().streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(2);
      if (caught) {
        const copyY = btnPrimaryY;
        const text = shareText(i18n, {
          dateKey: dk, caught, quality,
          steps: s.steps, staminaLeft: Math.max(0, s.stamina), streak: streak.state().streak,
          iris: s.level.iris,
        });
        this.button(cx, copyY, 250, 52, stripBrackets(i18n.t('btn.copy')), true,
          () => this.copyShare(text, i18n, copyY));
      } else {
        this.button(cx, btnPrimaryY, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
          this.registry.set('session', createDailySessionFromKey(dk));
          fadeToScene(this, 'Map');
        });
      }
      this.button(cx, btnSecondaryY, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
    } else if (caught) {
      // 押注雙卡：[安全歇腳] 入袋收工回營地／[乘勝續追] 疊高倍率繼續下一局，
      // 歇腳即回營地取代原本的 [下一場狩獵]+[返回營地] 雙鈕，故 btn.camp 次鈕移除
      const yPrimary = btnPrimaryY;
      const ySecondary = btnSecondaryY;
      const curMult = score.state().multiplier;
      const nextIdx = Math.min((MULTIPLIERS as readonly number[]).indexOf(curMult) + 1, MULTIPLIERS.length - 1);
      const nextMult = MULTIPLIERS[nextIdx];
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.bank')), true, () => {
        // 押注雙鈕互斥——防 fade 窗內連點造成雙重寫入
        if (this.choiceMade) return;
        this.choiceMade = true;
        this.audio.play('bank');
        score.bank();
        fadeToScene(this, 'Camp');
      });
      this.button(cx, ySecondary, 250, 48, stripBrackets(i18n.t('btn.push', { m: nextMult })), false, () => {
        // 押注雙鈕互斥——防 fade 窗內連點造成雙重寫入
        if (this.choiceMade) return;
        this.choiceMade = true;
        this.audio.play('push');
        score.push();
        this.registry.set('session', newSession(runRound, rng));
        fadeToScene(this, 'Map');
      });
    } else {
      // Daily retry lives in the daily branch above; this is run mode only
      const yPrimary = btnPrimaryY;
      const ySecondary = btnSecondaryY;
      this.button(cx, yPrimary, 250, 52, stripBrackets(i18n.t('btn.retry')), true, () => {
        this.registry.set('session', newSession(s.round, rng));
        fadeToScene(this, 'Map');
      });
      this.button(cx, ySecondary, 250, 48, stripBrackets(i18n.t('btn.camp')), false,
        () => fadeToScene(this, 'Camp'));
      // 示範入口：剛失敗、最想知道「我到底該怎麼想」的那一刻。做成文字連結而非
      // 第三顆按鈕，是因為本畫面的按鈕列已經沒有再加一列的預算。
      // 點擊區高 36 而非 32：英文字串在 420px 寬會折成兩行，36 才涵蓋得住；
      // 因此這裡用半高 18 判斷它是否還在畫面內，放不下就整個不畫——
      // 少一個入口，好過一個被裁掉一半的入口。
      // 錨在實際畫出來的次鈕之下，而不是自己的區塊位置——次鈕被夾上來時，
      // 連結必須跟著上來，否則會疊在按鈕上
      const demoLinkY = btnSecondaryY + 44;
      if (demoLinkY + 18 <= h) {
        this.add.text(cx, demoLinkY, i18n.t('demo.fromResult'), {
          fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
          wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        this.add.rectangle(cx, demoLinkY, 420, 36, 0, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            this.scene.launch('Demo', { from: 'Result' });
            this.scene.pause();
          });
      }
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
  // scale 與肖像同一個係數：位置與尺寸一起縮放，整個配置才與滿版時幾何相似，
  // 原本章印與虛線環之間的淨空關係就原封不動地保留下來。
  // 只縮位置不縮尺寸的話，矮視窗下章印會貼上虛線環、壓在生物身上。
  private stampQuality(x: number, y: number, q: Quality, i18n: I18n, scale: number) {
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
    const holder = this.add.container(x, y, [g, label]).setScale(1.8 * scale).setAlpha(0);
    this.tweens.add({
      targets: holder, scale, alpha: 1, duration: 350, delay: 400, ease: 'Back.easeOut',
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

  // color：一般為生物色，異彩變種時呼叫端傳入 pal.iris（driving 輻射光暈與虛線環）；
  // iris 旗標另外決定是否對剪影疊染 setTint（非異彩時剪影維持原始貼圖明暗，不作全染）
  private drawCreaturePortrait(
    cx: number, cy: number, creatureId: string, color: number, iris: boolean, scale: number,
  ) {
    const size = 250 * scale;
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
    dashedCircle(ring, cx, cy, 92 * scale, color, 0.35, 1.4, 2, 8);
    const texKey = creatureTexKey(this, creatureId);
    if (this.textures.exists(texKey)) {
      const sil = this.add.image(cx, cy + 4 * scale, texKey).setScale(creatureScale(texKey, 1.05 * scale));
      // setTint（非 tintFill）疊染異彩色，保留貼圖原始形狀明暗
      if (iris) sil.setTint(color);
      addGlowIfWebGL(this, sil, this.pal.glow);
    } else {
      this.add.circle(cx, cy, 60 * scale, color);
    }

    // 補獲慶祝孢子：一次性 explode，texture 依生物上色（key 帶 id 避免跨生物撞色沿用舊材質）
    if (motionOK()) {
      const sporeKey = `dot-spore-${creatureId}`;
      ensureDotTexture(this, sporeKey, color, 4);
      const spores = this.add.particles(cx, cy, sporeKey, {
        lifespan: 1800,
        // 噴散速度隨肖像縮放，否則縮小後的肖像會噴出與它不成比例的孢子。
        // 粒子本身的貼圖半徑不縮——它的材質 key 不含縮放值，改動半徑會讓不同
        // 縮放下共用到同一張快取材質。
        speedY: { min: 20 * scale, max: 60 * scale },
        speedX: { min: -30 * scale, max: 30 * scale },
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
