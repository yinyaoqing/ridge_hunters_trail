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
import type { ScoreStore } from '../core/score';
import type { CoachId, CoachStore } from '../core/coach';
import { cssHex, BRUSH_RADIUS, FONTS, stripBrackets } from './paint';
import {
  fadeIn, fadeToScene, restartOnResize, motionOK, ensureDotTexture, guardLowFps, PARTICLE_CAPS,
} from './fx';
import { flowY, type FlowBlock } from '../core/layout';

export class CampScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;
  // 首見提示的挑選結果，記在場景實例上（B2）：undefined＝這次造訪還沒決定過，
  // null／[id,key]＝已經決定（含「這次沒有候選」的 null）。scene.restart() 沿用同一個
  // Scene 實例，欄位值會存活——只要呼叫端在「同一次造訪內的重啟」（靜音／語言切換、
  // Help／Demo 關閉、resize）都經由 init() 帶入 preserveCoachPick:true，這個欄位就不會被
  // 清空，campCandidates 也就不會在 coach.seen 被前一輪標記之後，於同一次造訪內改挑下一個
  // 候選——那正是舊版的 bug：一次意圖之外的重啟會把下一則提示也一併燒掉，玩家卻從未
  // 真正看過它。只有在真正離開營地、之後再重新 start('Camp') 的造訪，才會拿到全新的欄位
  // （init() 沒收到旗標即歸零），依當時的 coach.seen 狀態重新挑一次。
  private coachPick: [CoachId, MsgKey] | null | undefined = undefined;

  constructor() {
    super('Camp');
  }

  init(data: { preserveCoachPick?: boolean }) {
    if (!data?.preserveCoachPick) this.coachPick = undefined;
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
    this.registry.remove('lastGain'); // 同上，清空押注押分暫存（score.gain 顯示用）
    this.registry.remove('lastLoss'); // 同上，清空押注損失暫存（score.lost 顯示用）
    // 清空每日挑戰 dateKey 暫存：回到營地代表本次 daily（若有）已結算完畢；
    // 若不清空，下一局若改走主線（run）模式，ResultScene 仍會殘留讀到舊 dailyKey，
    // 一旦跨過 UTC 午夜就會用錯日期的委託/分享 dateKey（見 F2）
    this.registry.remove('dailyKey');
    fadeIn(this);
    restartOnResize(this, { preserveCoachPick: true });
    // F1 audio unlock hook：任何首次指標按下即視為使用者手勢，解除 AudioContext 靜音鎖
    // （unlock() 冪等，MapScene 亦掛同款 hook，兩邊皆可安全觸發）
    // 鍵盤 hook：MapScene 支援方向鍵移動，純鍵盤玩家永遠不會觸發 pointerdown，
    // 需另掛一次性 keydown 才能解鎖（keydown 同為瀏覽器認可的有效手勢）
    this.input.keyboard?.once('keydown', () => this.audio.unlock());
    this.input.once('pointerdown', () => this.audio.unlock());
    // Help/Demo 關閉後刷新語言；帶 preserveCoachPick，理由同 restartOnResize 那一行
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.scene.restart({ preserveCoachPick: true }));

    this.drawRidges(w, h);

    // 右上角的連勝／戰績 chip 用固定座標，不在 flowY 的流裡。標題置中、寬約 440px，
    // 在手機直向的寬度下必定與它們水平重疊，因此下方要把流的起點推到 chip 之下。
    let chipsBottom = 0;
    const st = streak.state();
    if (st.streak > 0) {
      this.add.text(w - 20, 24, i18n.t('camp.streak', { n: st.streak }).toUpperCase(), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5).setLetterSpacing(2);
      chipsBottom = 32;
    }
    const score: ScoreStore = this.registry.get('score');
    const sc = score.state();
    let scoreY = st.streak > 0 ? 42 : 24;
    if (sc.bestRun > 0) {
      this.add.text(w - 20, scoreY, i18n.t('camp.best', { n: sc.bestRun }), {
        fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.gold),
      }).setOrigin(1, 0.5).setLetterSpacing(1);
      chipsBottom = scoreY + 8;
      scoreY += 16;
    }
    if (sc.banked + sc.pot > 0) {
      this.add.text(w - 20, scoreY, i18n.t('camp.carry', { b: sc.banked, p: sc.pot }), {
        fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
      }).setOrigin(1, 0.5).setLetterSpacing(1);
      chipsBottom = scoreY + 8;
    }

    // 版面改由 flowY 排定（見 src/core/layout.ts）。舊版標題釘在 0.16h、按鈕列從 0.42h
    // 起算，兩者之間因此恆有 26% 的高度是空的；而下半部又是流式累加，內容一長就撞進
    // 營火光暈。現在整疊由同一套規則排列，寬裕平均分給各道間距，不足時等比壓縮。
    // 教學掛點所需的門檻資料在此提前算好（原本 today/dailyDone 在按鈕繪製處才算、
    // commStore/comms/commStatus 在委託板繪製處才算）——純函式、無副作用，提前算不改變
    // 語意，但 blocks 陣列組裝時必須已經知道 campPick 是否非 null 才能決定要不要插入
    // 教學區塊，因此得先移到這裡。
    const today = dailyKey(new Date());
    const dailyDone = st.lastPlayed === today;
    const commStore = this.registry.get('commissions') as CommissionStore;
    const comms = dailyCommissions(today);
    const commStatus = commStore.statusFor(today);
    const doneCount = commStatus.filter(Boolean).length;

    // 營地教學：委託／每日首見，一次只教一則——與 ResultScene 同款做法。候選未被選中者
    // 保持未標記（coach.seen 不受影響），下次符合條件時仍會被重新列入候選。
    // 挑選只在這次造訪第一次 create() 時做一次（見 this.coachPick 欄位註解與 init()）；
    // 同一次造訪內的後續重啟一律沿用同一個結果，不重新評估 coach.seen。
    const coach: CoachStore = this.registry.get('coach');
    if (this.coachPick === undefined) {
      const campCandidates: [CoachId, MsgKey][] = [];
      if (!dailyDone) campCandidates.push(['daily', 'coach.daily']);
      if (doneCount < 3) campCandidates.push(['commission', 'coach.commission']);
      this.coachPick = campCandidates.find(([id]) => !coach.seen(id)) ?? null;
    }
    const campPick = this.coachPick;

    const showRows = h >= 692; // 委託板是否展開成三列（矮視窗收合為單行）
    const blocks: FlowBlock[] = [
      { h: 44, gap: 40, maxGap: 96 },          // 標題
      { h: 54, gap: 56, minGap: 24 },          // 上山追蹤
      { h: 50, gap: 14, minGap: 10 },          // 今日行蹤
      { h: 50, gap: 14, minGap: 10 },          // 生態圖鑑
      ...(showRows
        ? [
          { h: 14, gap: 34, minGap: 16 } as FlowBlock, // 「委託板」小標
          { h: 44, gap: 8, minGap: 6 } as FlowBlock,
          { h: 44, gap: 6, minGap: 6 } as FlowBlock,
          { h: 44, gap: 6, minGap: 6 } as FlowBlock,
        ]
        : [{ h: 16, gap: 34, minGap: 16 } as FlowBlock]), // 收合成單行「委託板 n/3」
      // 教學行排在工具列之前（僅當有候選首見提示時才插入這個區塊）：工具列是唯一出口，
      // 不能被推出畫面，見下方 by 的夾回註解；教學行本身不夾，讓它在極矮視窗誠實地
      // 被壓縮／甚至被工具列蓋住，也不犧牲工具列的可點擊性。
      ...(campPick ? [{ h: 32, gap: 14, minGap: 8 } as FlowBlock] : []),
      { h: 44, gap: 26, minGap: 16 },          // 工具列（命中區高 44）
    ];
    // 底界留 150px 給營火。光暈半徑 60，所以它的中心至少要離工具列底緣 72px
    // （60 的半徑加 12px 淨空），而中心本身又要離畫面底部 64px 才不會被裁掉——
    // 兩者相加就是 136，留 150 才有餘裕。舊版只留 96，於是光暈永遠貼著工具列，
    // 而且外圈固定被畫面底部切掉約 24px。
    // 起點推到 chip 之下（沒有 chip 時就是 8）。底界保留給營火，
    // 但矮視窗本來就放不下營火（drawCampfire 會自行略過），保留額度因此跟著縮小，
    // 把空間還給內容——否則矮視窗會為了一團畫不出來的火犧牲 150px。
    const ys = flowY(blocks, chipsBottom + 8, h - (h >= 600 ? 150 : 40));
    let bi = 0;

    this.add.text(cx, ys[bi++], "RIDGE HUNTER'S TRAIL", {
      fontFamily: FONTS.display, fontSize: '34px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(3);

    const bw = Math.min(320, w - 48);

    this.button(cx, ys[bi++], bw, 54, stripBrackets(i18n.t('camp.continue', { n: runRound })), true, () => {
      this.registry.set('session', newSession(runRound, rng));
      fadeToScene(this, 'Map');
    });

    // 今日天氣：僅生成一次每日 session 取其 weather 欄位（成本可忽略），不存入 registry/session——
    // 真正要玩的 session 仍由下方按鈕的 createDailySession(now) 產生
    const todayWeather = createDailySessionFromKey(today).level.weather;
    // 分隔符依語系而定：zh-TW 用全形｜、en 用半形 ·，避免英文行讀出「Clear｜」這種混排斷句
    const sep = i18n.locale() === 'zh-TW' ? '｜' : ' · ';
    const dailyLabel = (dailyDone
      ? `${i18n.t('camp.daily')} · ${i18n.t('camp.dailyDone')} ✓`
      : `${i18n.t('camp.daily')} · ${today}`) + `${sep}${i18n.t(WEATHER_KEY[todayWeather])}`;
    this.button(cx, ys[bi++], bw, 50, dailyLabel, false, () => {
      const now = new Date();
      this.registry.set('session', createDailySession(now));
      // 單一取樣：與 ResultScene 記帳/分享卡共用同一 dateKey，避免跨 UTC 午夜時分歧
      this.registry.set('dailyKey', dailyKey(now));
      fadeToScene(this, 'Map');
    });

    const found = CREATURES.filter((c) => codex.entry(c.id).count > 0).length;
    this.button(cx, ys[bi++], bw, 50,
      `${stripBrackets(i18n.t('btn.guide'))} ${found}/${CREATURES.length}`, false,
      () => fadeToScene(this, 'Codex'));

    // 委託板：三則每日委託（同 dailyKey 種子，與 ResultScene 結算共用判定邏輯）；
    // 矮視窗（h<692，見 rowH=44 換算）已很擁擠，收合為單行「委託板 n/3」，避免與下方工具列相撞
    if (!showRows) {
      this.add.text(cx, ys[bi++], `${i18n.t('comm.title')} ${doneCount}/3`, {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5).setLetterSpacing(1);
    } else {
      this.add.text(cx, ys[bi++], i18n.t('comm.title'), {
        fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
      }).setOrigin(0.5).setLetterSpacing(1.5);
      // rowH 34→44：描述加上 wordWrap 後兩行文字需要更高的列高才不會貼邊（見 drawCommissionRow）
      const rowH = 44;
      comms.forEach((c, i) => {
        // drawCommissionRow 的 y 是卡片「上緣」，flowY 回傳的是中心，故減去半高
        this.drawCommissionRow(cx, ys[bi++] - rowH / 2, bw, rowH, c, commStatus[i], i18n);
      });
    }

    // 委託／每日首見教學：blocks 陣列已依 campPick 是否非 null 決定要不要留這個 ys 位，
    // 這裡的消費必須嚴格對齊——只有 campPick 非 null 時才會呼叫 ys[bi++]。
    if (campPick) {
      const [id, msgKey] = campPick;
      // markSeen 冪等：這次造訪第一次顯示時才真的寫入，同一次造訪內的重啟重繪
      // 只是重覆一次已經寫過的值，不會被 coachOnce 的「已見過就跳過顯示」擋下來
      // ——那正是舊版的 bug（見 this.coachPick 欄位註解）。
      coach.markSeen(id);
      this.add.text(cx, ys[bi++], i18n.t(msgKey), {
        fontFamily: FONTS.body, fontSize: '12px', color: cssHex(pal.paperDim),
        wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
      }).setOrigin(0.5);
    }

    // 小工具列：靜音＋說明＋示範＋語言（四鈕置中排列）。
    // x 座標重排以容納示範入口，整列的視覺跨距維持對稱（-123 到 +123）。
    // 工具列夾回畫面內。它是靜音／說明／示範／語言的唯一入口，而 flowY 在空間不足時
    // 會誠實地把區塊排到 bottom 之外——那對背景與說明文字是對的，對唯一入口卻不是。
    // 與結算畫面的按鈕同一個取捨：寧可讓它壓住上方的委託列，也不能讓它整排消失。
    // 命中區高 44，中心夾在 h-26 讓底緣還留 4px。
    const by = Math.min(ys[bi++], h - 26);
    const xSound = cx - 101;
    const xHelp = cx - 45;
    const xDemo = cx + 11;
    const xLang = cx + 83;
    this.drawSoundGlyph(xSound, by, this.audio.enabled());
    this.add.rectangle(xSound, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.audio.unlock(); // 保險：確保這次手勢也算數（與 create() 的全域 hook 冪等共存）
        this.audio.toggle();
        // 較簡單一致：與語言鈕相同，用 restart 取代局部重繪；preserveCoachPick 理由同上
        this.scene.restart({ preserveCoachPick: true });
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
    // 示範入口：金色播放三角。營地是玩家在兩局之間停留的地方，
    // 也是唯一不會打斷任何進行中狩獵的入口。
    const demoG = this.add.graphics();
    demoG.fillStyle(pal.gold, 1);
    demoG.fillTriangle(xDemo - 6, by - 9, xDemo - 6, by + 9, xDemo + 10, by);
    this.add.rectangle(xDemo, by, 44, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('Demo', { from: 'Camp' });
        this.scene.pause();
      });
    this.add.text(xLang, by, 'EN / 中', {
      fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.add.rectangle(xLang, by, 80, 44, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.scene.restart({ preserveCoachPick: true }); // 理由同上：語言切換不算離開營地
      });

    // 營火最後畫：它的位置取決於工具列落在哪裡（見 drawCampfire）。
    // 它是背景美術，畫在最上層不影響觀感——三層山稜仍由 drawRidges 在最開頭畫好。
    this.drawCampfire(w, h, by + 22);

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
  }

  // 營火：位置由版面決定而非固定在 0.9h——工具列在內容變長時會下移，
  // 舊版的百分比定位因此會讓工具列坐進營火光暈裡（h=840 時工具列 730.8、光暈 696–816）。
  private drawCampfire(w: number, h: number, minY: number) {
    const pal = this.pal;
    // 光暈半徑 60。中心至少要在 minY + 72，才能在光暈上緣與上方元素之間留 12px 淨空
    // （用 60 會讓兩者正好相貼，等於沒有淨空）。
    // 只保留下限，不再用 h-64 夾回來：那個 min 會在矮視窗覆蓋掉下限，
    // 把營火拉回工具列上——正是上一版要修掉的缺陷。
    const fy = Math.max(h * 0.9, minY + 72);
    // 放不下就整個不畫。營火是背景美術，缺席遠好過擋住按鈕。
    if (fy + 60 > h) return;
    const glow = this.add.graphics();
    glow.fillStyle(pal.gold, 0.12).fillCircle(w / 2, fy, 60);
    glow.fillStyle(pal.gold, 0.25).fillCircle(w / 2, fy, 22);
    glow.fillStyle(0xe8b06a, 0.9).fillTriangle(w / 2 - 7, fy + 8, w / 2 + 7, fy + 8, w / 2, fy - 12);

    // 營火火星：低密度上飄粒子，減少動態偏好時完全不生成
    if (motionOK()) {
      ensureDotTexture(this, 'dot-ember', 0xe8b06a, 3);
      const emitter = this.add.particles(w / 2, fy - 6, 'dot-ember', {
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
