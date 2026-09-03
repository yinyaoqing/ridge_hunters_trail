import Phaser from 'phaser';
import { currentTarget, type SessionState } from '../core/session';
import { getPalette, type Palette } from '../core/palette';
import { wagerKey, parseKey } from '../core/marks';
import { infoCompleteStep, misleadingDecoy } from '../core/deduction';
import { cheb, type Vec2 } from '../core/geometry';
import { key } from '../core/clues';
import { CREATURES } from '../data/creatures';
import type { I18n, MsgKey } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import { MOVE_EVERY, ROUTE_START_INDEX, type RouteRule } from '../core/route';
import {
  cssHex, FONTS, displayFont, BRUSH_RADIUS, stripBrackets, dashedLine,
} from './paint';
import { fadeIn, fadeToScene, restartOnResize } from './fx';

// 揭曉畫面（診斷 D-01）：不論成敗都在結算前先看見真相——牠在哪、你差幾格、
// 哪條假蹤跡騙了你、資訊在第幾步就已完備。失敗不再只是「牠溜進霧裡了」。
export class RevealScene extends Phaser.Scene {
  private pal!: Palette;
  private audio!: AudioBus;

  constructor() {
    super('Reveal');
  }

  create() {
    const s: SessionState = this.registry.get('session');
    // 只取一次存成區域常數：獵物位置是 steps 的函式，本畫面渲染期間 steps 不會再變，
    // 重複呼叫 currentTarget(s) 沒有錯，但用同一個值能讓下面每一處讀到的都是同一刻的牠在哪。
    // F5：優先採用 s.capturePos——逼近判定對「移動前／移動後」任一相距 1 格都寬容通過，
    // 只看 currentTarget(s)（移動後）會在僅靠移動前位置逼近成功的那 6.2% 局裡，
    // 把「牠在這裡」畫在玩家實際搆到的格子以外平均 3.18 格的地方。未觸發過逼近
    // （理論上不會發生在已進入揭曉畫面的局，capturePos 必已寫入）時退回 currentTarget。
    const target = s.capturePos ?? currentTarget(s);
    const i18n: I18n = this.registry.get('i18n');
    this.audio = this.registry.get('audio');
    this.audio.ambient(false); // 揭曉畫面停風聲，與結算一致
    this.pal = getPalette(s.round);
    const pal = this.pal;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    this.cameras.main.setBackgroundColor(pal.bg);
    fadeIn(this);
    restartOnResize(this);

    this.add.text(cx, 54, i18n.t('reveal.title'), {
      fontFamily: displayFont(i18n.locale()), fontSize: '30px', color: cssHex(pal.paper),
    }).setOrigin(0.5).setLetterSpacing(2);

    // 每日挑戰失敗時不揭真實位置（F3，專案負責人裁定）：daily 的重試是同一顆種子，
    // 揭曉真相等於把答案直接遞給重玩——品質改用 Chebyshev 距離後，重玩必得金級，
    // 汙染 catchScore／quality-any 委託／分享卡。caught 時仍照常揭曉（不影響已結算的這一局）。
    const hideAnswer = s.mode === 'daily' && s.phase !== 'caught';

    // 小地圖：夾在標題與文字區之間，正方形，最大 300px
    // F6：Math.max(4, ...) 這個下限會讓 span 超出 mapMax 的版面預算——矮視窗＋大地圖時
    // （例如 h=390 時 mapMax=50，若 size=25 則 floor(50/25)=2 被下限 4 蓋過，span=4*25=100，
    // 是預算的兩倍）。span 沒有回頭夾回 mapMax，下面 ty/legendY 的版面預算全部建立在
    // 「span ≤ mapMax」這個不成立的假設上，這正是既有 legendY（見下方 Math.min(ty+14, h-108)）
    // 重疊風險的真正成因，不是 legendY 那行本身算錯。此處只記門檻與機制，不改動數值。
    const mapTop = 92;
    const mapMax = Math.min(300, w - 48, h - 340);
    const size = s.level.mapSize;
    const cell = Math.max(4, Math.floor(mapMax / size));
    const span = cell * size;
    const ox = Math.floor(cx - span / 2);
    const oy = mapTop;
    this.drawMinimap(s, ox, oy, cell, hideAnswer, target);

    // 文字區：距離、假蹤跡、資訊完備步數，三行由上而下堆疊（缺項自動不佔位）
    const wk = wagerKey(s.marks);
    const wager: Vec2 | null = wk === null ? null : parseKey(wk);
    let ty = oy + span + 30;

    if (wager === null) {
      // 未押注時本來就不揭露任何座標資訊，hideAnswer 與否都可安全保留
      ty = this.line(cx, ty, i18n.t('reveal.noCall'), pal.paperDim, 14);
    }
    // C3：daily 失敗且無押注時，「沒押注」與「daily 隱藏答案」是兩件互不排斥的事實——
    // 前者說明沒有距離可算，後者說明地圖上看不到真實位置為什麼。原本 else if 讓
    // 兩者互斥，玩家在兩者都成立時反而什麼解釋都看不到，像壞掉一樣。改成各自獨立判斷。
    if (hideAnswer) {
      // 用一行說明取代距離／假蹤跡行，否則畫面看起來像壞掉（F3）
      ty = this.line(cx, ty, i18n.t('reveal.dailyHidden'), pal.paperDim, 14);
    } else if (wager !== null) {
      const off = cheb(wager, target);
      const msg = off === 0 ? i18n.t('reveal.exact') : i18n.t('reveal.offBy', { n: off });
      ty = this.line(cx, ty, msg, off === 0 ? pal.gold : pal.paper, 17);
    }

    if (!hideAnswer) {
      const decoy = misleadingDecoy(s.level, s.readLog, wager, target);
      if (decoy) ty = this.line(cx, ty, i18n.t('reveal.decoy'), pal.mark, 14);
    }

    // C2：infoCompleteStep 只看真線索的交集，這一行等於指名「第幾步讀到的是真線索」
    // ——玩家自己知道每一步讀了什麼，等於把真假線索的判別洩漏給失敗的 daily 玩家
    // （見再審報告 C2）。跟上面的幌子行一樣，用 hideAnswer 蓋住。
    if (!hideAnswer) {
      const infoStep = infoCompleteStep(s.level, s.readLog);
      if (infoStep !== null && s.steps > infoStep) {
        ty = this.line(cx, ty, i18n.t('reveal.infoAt', { n: infoStep, m: s.steps }), pal.paperDim, 13);
      }
    }

    // 覓食路線說明：規格 §7——沒有這一行，doubling／straight 對玩家而言只是隨機，
    // 這是玩家唯一能學會物種走法的地方。跟上面幾行一樣受 hideAnswer 保護：路線本身
    // 就是答案的一部分（等於指出目前所在的候選格），daily 未捕獲時不能洩漏。
    // 文字區版面已有 3 行變動空間（noCall/dailyHidden、offBy/exact、decoy、infoAt 最多疊 3 行），
    // 兩行式（reveal.route＋物種走法各一行）會把小視窗擠出下方圖例／按鈕的預算，
    // 因此依規格容許的做法併成一行，用破折號連接。
    if (!hideAnswer) {
      const rule = s.level.route.rule;
      ty = this.line(cx, ty, `${i18n.t('reveal.route')} — ${i18n.t(RULE_KEY[rule])}`, pal.paperDim, 13);
    }

    // 圖例：牠在這裡／你的押注。hideAnswer 時不畫「牠在這裡」——否則圖例文字本身就洩漏答案
    const legendY = Math.min(ty + 14, h - 108);
    if (!hideAnswer) this.legend(cx - 78, legendY, i18n.t('reveal.wasHere'), pal.gold, true);
    if (wager) this.legend(cx + 62, legendY, i18n.t('reveal.yourCall'), pal.paper, false);

    this.button(cx, h - 52, 250, 50, stripBrackets(i18n.t('btn.continue')),
      () => fadeToScene(this, 'Result'));
  }

  // 小地圖：地形底色 → 玩家路徑 → 已判讀線索（幌子在此才揭穿）→ 押注格 → 真實位置
  // hideAnswer 時（F3）真假線索一律畫成金色、且不畫真實位置，避免顏色差異或色點洩漏答案
  private drawMinimap(
    s: SessionState, ox: number, oy: number, cell: number, hideAnswer: boolean, target: Vec2,
  ) {
    const pal = this.pal;
    const L = s.level;
    const g = this.add.graphics();
    const px = (v: Vec2) => ({ x: ox + v.x * cell + cell / 2, y: oy + v.y * cell + cell / 2 });

    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        g.fillStyle(pal.terrain[L.terrain[y][x]], 1).fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    g.lineStyle(1, pal.paperDim, 0.25).strokeRect(ox, oy, cell * L.mapSize, cell * L.mapSize);

    // 未探索區壓暗：讓玩家看見自己漏掉了多少山域。
    // 失敗的每日挑戰同樣要畫——這是玩家自己的探索紀錄，不洩漏答案。
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        if (s.seen.has(key({ x, y }))) continue;
        g.fillStyle(0x000000, 0.45).fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    // 覓食路線：由舊到新連成一線，節點越新畫得越亮。這是玩家唯一能學會
    // 「這個物種怎麼走」的地方——看不到路線，折返與直行對他而言只是隨機。
    // 畫在壓暗層之後（不被未探索的暗色蓋掉）、玩家路徑／線索／押注框／真實位置之前
    // ——這條線是新揭露的背景資訊，不能蓋掉本畫面原本就有、玩家第一眼要看的
    // 「牠在這裡」與「你的押注」，所以必須疊在它們下面。
    // hideAnswer 時整段不畫：五個節點等於指出目前所在的候選格，比色點洩漏更多（同 F3），
    // 揭曉真相等於把答案遞給 daily 的重玩。
    //
    // F4：獵物走到哪個節點就停在那裡，不會五個節點都走完——原本不分青紅皂白把全部五個
    // 節點畫成同一套「越新越亮」，最新（最亮）的那個節點在 69%（978 局實測 620+302／978）
    // 的補獲局裡其實是牠從沒去過的地方，跟旁邊那圈「牠在這裡」的金環對不上，同一張小
    // 地圖上兩個東西各說各話。獵物現在的位置（capturePos ?? currentTarget）對應的節點
    // 索引，由 steps／MOVE_EVERY 反推出來——與 targetAt() 內部算法一致，只是這裡要的
    // 是索引本身而非座標，用來分段：已走過的（含牠現在所在的那一段）維持原本實線＋
    // 漸亮；還沒走到的部分換一套明顯更淡、改虛線的畫法，讀起來是「牠正要往那邊去」，
    // 不是「牠去過那邊」。
    if (!hideAnswer) {
      const w = L.route.waypoints;
      const reachedIdx = Math.min(ROUTE_START_INDEX + Math.floor(s.steps / MOVE_EVERY), w.length - 1);
      for (let i = 1; i < w.length; i++) {
        const a = px(w[i - 1]);
        const b = px(w[i]);
        if (i <= reachedIdx) {
          g.lineStyle(2, pal.glow, 0.25 + 0.15 * i);
          g.lineBetween(a.x, a.y, b.x, b.y);
        } else {
          dashedLine(g, a.x, a.y, b.x, b.y, pal.glow, 0.16, 1.5, 3, 6);
        }
      }
      w.forEach((p, i) => {
        const q = px(p);
        if (i <= reachedIdx) {
          g.fillStyle(pal.glow, 0.3 + 0.17 * i).fillCircle(q.x, q.y, cell * 0.16);
        } else {
          // 未走到的節點：空心、固定淡透明度，不隨索引漸亮——漸亮這件事本身在暗示
          // 「越新越接近現在」，套用在牠根本沒走到的節點上會誤導成牠正在接近那裡。
          g.lineStyle(1.2, pal.glow, 0.22).strokeCircle(q.x, q.y, cell * 0.13);
        }
      });
    }

    // 玩家路徑：連續折線，讓玩家看見自己繞了多遠
    if (s.path.length > 1) {
      g.lineStyle(Math.max(1.2, cell * 0.16), pal.paper, 0.4);
      for (let i = 1; i < s.path.length; i++) {
        const a = px(s.path[i - 1]);
        const b = px(s.path[i]);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // 已判讀的線索：真線索金點、幌子紅點——真假在此刻才第一次公開（診斷 B-03 的學習迴圈）
    // hideAnswer 時一律畫成金色（即真線索的畫法），不得用 pal.mark 洩漏哪條是幌子（F3）
    L.clues.forEach((c, i) => {
      if (!s.readLog.some((e) => e.clueIndex === i)) return;
      const p = px(c.position);
      const color = hideAnswer ? pal.gold : (c.isDecoy ? pal.mark : pal.gold);
      g.fillStyle(color, 0.9).fillCircle(p.x, p.y, Math.max(2, cell * 0.26));
    });

    // 玩家押注格：紙墨白空心方框
    const wk = wagerKey(s.marks);
    if (wk !== null) {
      const wp = parseKey(wk);
      g.lineStyle(2, pal.paper, 0.95)
        .strokeRect(ox + wp.x * cell, oy + wp.y * cell, cell, cell);
    }

    if (hideAnswer) return; // 真實位置本身就是答案，daily 未捕獲時整段不畫（F3）

    // 真實位置：生物色實心點＋金色脈動環
    const creature = CREATURES.find((c) => c.id === L.creatureId)!;
    const t = px(target);
    g.fillStyle(creature.color, 1).fillCircle(t.x, t.y, Math.max(3, cell * 0.34));
    const ring = this.add.graphics();
    ring.lineStyle(2, pal.gold, 1).strokeCircle(t.x, t.y, Math.max(6, cell * 0.7));
    this.tweens.add({
      targets: ring, alpha: { from: 1, to: 0.25 },
      duration: 900, yoyo: true, repeat: -1,
    });
  }

  // 單行置中文字，回傳下一行的 y（行距隨字級調整）
  private line(cx: number, y: number, text: string, color: number, fontSize: number): number {
    const t = this.add.text(cx, y, text, {
      fontFamily: FONTS.body, fontSize: `${fontSize}px`, color: cssHex(color),
      wordWrap: { width: 420, useAdvancedWrap: true }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    return y + t.height + 10;
  }

  // 圖例項：小色點＋標籤
  private legend(x: number, y: number, label: string, color: number, filled: boolean) {
    const g = this.add.graphics();
    if (filled) g.fillStyle(color, 1).fillCircle(x, y, 5);
    else g.lineStyle(1.8, color, 0.95).strokeRect(x - 5, y - 5, 10, 10);
    this.add.text(x + 12, y, label, {
      fontFamily: FONTS.body, fontSize: '11px', color: cssHex(this.pal.paperDim),
    }).setOrigin(0, 0.5).setLetterSpacing(1);
  }

  // 按鈕：與 ResultScene 同款描邊樣式（hover 增亮、按下內縮）
  private button(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const pal = this.pal;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.lineStyle(1.5, pal.gold, hover ? 1 : 0.65)
        .strokeRoundedRect(x - w / 2, y - h / 2, w, h, BRUSH_RADIUS);
    };
    draw(false);
    const txt = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: FONTS.body, fontSize: '16px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(2);
    this.add.rectangle(x, y, w, Math.max(h, 44), 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => { draw(false); txt.setScale(1); })
      .on('pointerdown', () => txt.setScale(0.96))
      .on('pointerup', () => { txt.setScale(1); this.audio.unlock(); this.audio.play('click'); onClick(); });
  }
}

// 走法字串鍵映射：同 MapScene WEATHER_KEY／ResultScene QUALITY_KEY 手法，
// 避免模板字面型別（`rule.${RouteRule}`）無法收斂為 MsgKey 聯集
const RULE_KEY: Record<RouteRule, MsgKey> = {
  lowland: 'rule.lowland', highland: 'rule.highland', cover: 'rule.cover',
  straight: 'rule.straight', doubling: 'rule.doubling',
};
