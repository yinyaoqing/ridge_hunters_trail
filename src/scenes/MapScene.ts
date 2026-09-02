import Phaser from 'phaser';
import { canMove, move, cycleMarkAt, useBell, TERRAIN_COST, type SessionState } from '../core/session';
import { getDifficulty } from '../core/difficulty';
import { getPalette, type Palette } from '../core/palette';
import { TERRAIN_TYPES } from '../core/types';
import { key, intersect } from '../core/clues';
import { cheb, dist, type Vec2 } from '../core/geometry';
import { rollMicroEvent, type MicroEvent } from '../core/events';
import type { Clue, TerrainType } from '../core/types';
import type { Weather } from '../core/weather';
import type { I18n, MsgKey } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import type { Rng } from '../core/rng';
import type { ToolStore } from '../core/tools';
import type { RunState } from '../core/runstate';
import {
  cssHex, cssRgba, dashedCircle, dashedArc, dashedLine, drawClueToken, drawSupply,
  BRUSH_RADIUS, FONTS, displayFont, terrainTexImage,
} from './paint';
import {
  restartOnResize, fadeIn, fadeToScene, floatText, pulseHighlight,
  PARTICLE_CAPS, motionOK, ensureDotTexture, guardLowFps,
} from './fx';

const HUD_HEIGHT = 56;
const BG_KEY = 'map-bg';

export class MapScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private pg!: Phaser.GameObjects.Graphics; // 玩家專用層
  private hoverG!: Phaser.GameObjects.Graphics; // hover 高亮專用層（建於 pg 之後，疊在最上層）
  private hoverCostText?: Phaser.GameObjects.Text; // 重用單一 Text，hover 時移動＋顯示，不逐格重建
  private hoverCell: Vec2 | null = null;
  private animating = false;
  private lowTween?: Phaser.Tweens.Tween;
  private hudG!: Phaser.GameObjects.Graphics;
  private roundText!: Phaser.GameObjects.Text;
  private weatherG!: Phaser.GameObjects.Graphics; // 天氣徽章圖形（roundText 右側，每次 updateHud 依文字寬度重新定位）
  private weatherText?: Phaser.GameObjects.Text; // compact（<560）不建立，僅顯示圖形
  private stamLabel!: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private pal!: Palette;
  private cell = 0;
  private ox = 0;
  private oy = 0;
  private markMode = false;
  private pressAt: { t: number; x: number; y: number } | null = null;
  private markChipG?: Phaser.GameObjects.Graphics;
  private markChipText?: Phaser.GameObjects.Text;
  private markChipX = 0;
  private markChipY = 0;
  private soundChipG?: Phaser.GameObjects.Graphics;
  private soundChipText?: Phaser.GameObjects.Text;
  private soundChipX = 0;
  private soundChipY = 0;
  private bellChipG?: Phaser.GameObjects.Graphics;
  private bellChipText?: Phaser.GameObjects.Text;
  private bellChipX = 0;
  private bellChipY = 0;
  private chipRowLeft = 0; // chip 列最左緣（鈴／靜音 chip 左緣）：體力條需與其保持 ≥8px 間距
  private skipFirstRunHelp = false;
  private audio!: AudioBus;
  private tools!: ToolStore;
  // 互動式新手引導：-1=未啟動/已結束，0..3=引導步驟（見 startTutStep0 起各步驟方法）
  private tutStep = -1;
  private tutText?: Phaser.GameObjects.Text;
  private tutBg?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Map');
  }

  // 語言切換造成的 restart 會帶入此旗標，避免在儲存降級（無法記憶 rht.help.v1）的
  // 情境下，每次切換語言都重新觸發 maybeShowFirstRunHelp 彈出玩法說明並暫停地圖
  init(data: { skipFirstRunHelp?: boolean }) {
    this.skipFirstRunHelp = data?.skipFirstRunHelp === true;
  }

  create() {
    const s = this.session();
    // 防護：Codex 只能從 Camp 進入，若 session 已結束（非 explore）誤導回 Map 會卡死畫面
    if (s.phase !== 'explore') {
      this.scene.start('Camp');
      return;
    }
    const w = this.scale.width;
    const h = this.scale.height;
    this.pal = getPalette(s.round);
    this.cell = Math.max(10, Math.floor(Math.min(
      (h - HUD_HEIGHT - 12) / s.level.mapSize,
      (w - 8) / s.level.mapSize,
    )));
    this.ox = Math.floor((w - this.cell * s.level.mapSize) / 2);
    this.oy = HUD_HEIGHT + Math.max(4, Math.floor((h - HUD_HEIGHT - this.cell * s.level.mapSize) / 2));
    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.audio = this.registry.get('audio');
    this.tools = this.registry.get('tools');
    this.registry.set('lastUnlocks', []); // 離開 Result 後清空解鎖卡狀態，避免下次 resize/重入殘留
    this.registry.set('lastComms', []); // 同上，清空委託完成行狀態
    this.registry.remove('lastGain'); // 同上，清空押注押分暫存（score.gain 顯示用）
    this.registry.remove('lastLoss'); // 同上，清空押注損失暫存（score.lost 顯示用）
    this.initTutorialFlag(s);

    this.buildBackground(s);
    this.spawnMistParticles(s);
    this.buildHud();
    this.g = this.add.graphics();
    this.pg = this.add.graphics();
    this.hoverG = this.add.graphics(); // 建於 pg 之後，確保 hover 外框畫在玩家層之上
    this.hoverCostText = this.add.text(0, 0, '', {
      fontFamily: FONTS.body, fontSize: '10px', color: cssHex(this.pal.paperDim),
    }).setOrigin(1, 1).setVisible(false);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pressAt = { t: p.time, x: p.x, y: p.y };
      this.clearHover(); // 按下後（可能拖曳/移動）暫時隱藏 hover，避免殘影
    });
    // F1 audio unlock hook：任何首次指標按下即視為使用者手勢，解除 AudioContext 靜音鎖
    // （unlock() 冪等，CampScene 亦掛同款 hook，兩邊皆可安全觸發）
    this.input.once('pointerdown', () => this.audio.unlock());
    // 鍵盤 hook：本場景方向鍵可直接移動玩家，純鍵盤玩家永遠不會觸發 pointerdown，
    // 需另掛一次性 keydown 才能解鎖（keydown 同為瀏覽器認可的有效手勢）
    this.input.keyboard?.once('keydown', () => this.audio.unlock());
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.clearHover(); this.redraw(); });
    this.redraw();
    restartOnResize(this);
    fadeIn(this);
    if (this.tutStep === 0) this.startTutStep0(s);
    else this.maybeShowFirstRunHelp(); // 引導進行中時跳過彈窗，改由 ? chip 手動開啟
    // 探索環境音：依本局天氣選變體（風日較強風聲、細雨日雨感噪音）；其餘天氣沿用預設風聲
    // （靜音時 ambient 內部自行忽略）
    this.audio.ambient(true, this.ambientVariant());
  }

  // 判斷本局是否啟動新手引導：旗標未設且為主線第 1 局（探索階段）
  private initTutorialFlag(s: SessionState) {
    const storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = this.registry.get('storage');
    let done = false;
    try {
      done = storage?.getItem('rht.tut.v1') === '1';
    } catch {
      done = false;
    }
    this.tutStep = (!done && s.mode === 'run' && s.round === 1 && s.phase === 'explore') ? 0 : -1;
  }

  // 引導 step0：高亮離玩家最近的未讀真線索（round1 無幌子，全部皆為真線索）＋顯示引導字
  private startTutStep0(s: SessionState) {
    const unread = s.level.clues.filter((c) => !c.isDecoy && !s.readClues.has(key(c.position)));
    if (unread.length === 0) return; // 防禦：理論上不會發生（round1 一定有未讀真線索）
    let nearest = unread[0];
    let best = dist(s.player, nearest.position);
    for (const c of unread.slice(1)) {
      const d = dist(s.player, c.position);
      if (d < best) { best = d; nearest = c; }
    }
    const cs = this.cell;
    const p = { x: this.ox + nearest.position.x * cs + cs / 2, y: this.oy + nearest.position.y * cs + cs / 2 };
    pulseHighlight(this, p.x, p.y, cs * 0.6, this.pal.gold);
    this.showTut('tut.move');
  }

  // 引導 step1→2：讀滿 2 條線索後計算交集格並閃色提示；在 3 秒延遲與後續移動中都會檢查
  private checkTutStep1to2(s: SessionState) {
    if (this.tutStep !== 1 || s.readClues.size < 2) return;
    this.tutStep = 2;
    // 防禦性——round1 現無 decoy，但交集計算本應僅用真線索，避免未來若 round1 引入
    // 幌子線索時誤把它算進交集
    const readReal = s.level.clues.filter((c) => !c.isDecoy && s.readClues.has(key(c.position)));
    const cells = intersect(readReal, s.level.mapSize);
    const cs = this.cell;
    const g = this.add.graphics();
    for (const ck of cells) {
      const [cx, cy] = ck.split(',').map(Number);
      g.fillStyle(this.pal.gold, 0.25).fillRect(this.ox + cx * cs, this.oy + cy * cs, cs, cs);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 1500, onComplete: () => g.destroy() });
    this.showTut('tut.cross');
  }

  // 引導文字：底部置中，共用單一 Text/Graphics（切換文案時重繪底條），全程不攔截輸入
  private showTut(msgKey: MsgKey) {
    const pal = this.pal;
    if (!this.tutText) {
      this.tutBg = this.add.graphics().setDepth(80);
      this.tutText = this.add.text(0, 0, '', {
        fontFamily: FONTS.body, fontSize: '13px', color: cssHex(pal.paper),
      }).setOrigin(0.5).setDepth(81);
    }
    this.tutText.setText(this.i18n().t(msgKey));
    const w = this.scale.width;
    const y = this.scale.height - 24;
    this.tutText.setPosition(w / 2, y);
    const bw = this.tutText.width + 24;
    const bh = this.tutText.height + 12;
    this.tutBg!.clear().fillStyle(pal.panel, 0.88)
      .fillRoundedRect(w / 2 - bw / 2, y - bh / 2, bw, bh, BRUSH_RADIUS);
  }

  private hideTut() {
    this.tutText?.destroy();
    this.tutBg?.destroy();
    this.tutText = undefined;
    this.tutBg = undefined;
  }

  // 引導完成：與玩法說明共用旗標寫入邏輯（? chip 之後仍可手動開啟 Help）
  private finishTutorial() {
    this.hideTut();
    this.tutStep = -1;
    const storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = this.registry.get('storage');
    try {
      storage?.setItem('rht.tut.v1', '1');
      storage?.setItem('rht.help.v1', '1');
    } catch {
      // 無法記憶時下次 round1 仍會重新引導，可接受
    }
  }

  // 首次啟動自動彈出玩法說明（localStorage 記憶，不可用時僅本次顯示）
  private maybeShowFirstRunHelp() {
    if (this.skipFirstRunHelp) return;
    const storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = this.registry.get('storage');
    let seen = false;
    try {
      seen = storage?.getItem('rht.help.v1') === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    try {
      storage?.setItem('rht.help.v1', '1');
    } catch {
      // 無法記憶時每次啟動都會顯示，可接受
    }
    this.openHelp();
  }

  private openHelp() {
    this.scene.launch('Help', { from: 'Map' });
    this.scene.pause();
  }

  update() {
    if (!this.cursors) return;
    const s = this.session();
    if (s.phase !== 'explore') return;
    const c = this.cursors;
    const jd = Phaser.Input.Keyboard.JustDown;
    // 任一方向鍵按下的那一幀才動作（維持既有「一次按鍵走一格」手感）
    if (!(jd(c.left) || jd(c.right) || jd(c.up) || jd(c.down))) return;
    // 八方向（A-07）：以「此刻按住」的四鍵合成位移向量，讓「上＋右」這類同時按住的組合
    // 走對角，與滑鼠點擊的 Chebyshev 相鄰規則一致。原本四方向版本會讓純鍵盤玩家
    // 走同一段對角路多付約四成體力。
    const dx = (c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0);
    const dy = (c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) return; // 左右或上下同時按住互相抵消
    this.doMove({ x: s.player.x + dx, y: s.player.y + dy });
  }

  private session(): SessionState {
    return this.registry.get('session');
  }

  // 本局天氣→環境音變體映射：風日/細雨日各自對應音效變體，其餘天氣沿用預設風聲。
  // 抽出為單一方法，供 create() 首次啟動與靜音鈕重新開啟時共用，避免兩處各自硬編邏輯導致
  // 「靜音→取消靜音」後環境音悄悄退回預設風聲、與當下天氣不一致的問題。
  private ambientVariant(): 'wind' | 'drizzle' | undefined {
    const weather = this.session().level.weather;
    if (weather === 'wind') return 'wind';
    if (weather === 'drizzle') return 'drizzle';
    return undefined;
  }

  private i18n(): I18n {
    return this.registry.get('i18n');
  }

  // 水墨底圖：地形色塊經輕度模糊成暈染感＋淡格線＋暗角（美術方向板「地形筆觸」）
  private buildBackground(s: SessionState) {
    const L = s.level;
    const cs = this.cell;
    const w = cs * L.mapSize;
    const h = cs * L.mapSize;
    if (this.textures.exists(BG_KEY)) this.textures.remove(BG_KEY);
    const tex = this.textures.createCanvas(BG_KEY, w, h);
    if (!tex) return;
    const ctx = tex.getContext();

    ctx.fillStyle = cssHex(this.pal.base);
    ctx.fillRect(0, 0, w, h);

    try {
      ctx.filter = `blur(${Math.max(2, cs * 0.08)}px)`;
    } catch {
      // 不支援 canvas filter 的環境退回硬邊色塊
    }
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        ctx.fillStyle = cssHex(this.pal.terrain[L.terrain[y][x]]);
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
    }
    ctx.filter = 'none';

    this.paintTerrainTexture(ctx, s);

    ctx.strokeStyle = cssRgba(this.pal.paper, 0.06);
    ctx.lineWidth = 1;
    for (let i = 0; i <= L.mapSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(w, i * cs);
      ctx.stroke();
    }

    const vig = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.45, w / 2, h * 0.45, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    tex.refresh();
    this.add.image(this.ox, this.oy, BG_KEY).setOrigin(0);
  }

  // 霧氣氛圍粒子：僅在有「霧」地形格時生成，抽樣 ≤12 個格中心作為發射點。
  // 用 RandomZoneSource（而非單一 Rectangle 區域）是因為霧格散落於地圖各處、
  // 形狀不規則，Rectangle 會覆蓋非霧格；改成從抽樣格中心 ±半格 jitter 隨機取點，
  // 讓粒子只在真正的霧地形附近飄，且抽樣上限 12 個發射點避免大地圖時逐格建 emitter。
  private spawnMistParticles(s: SessionState) {
    if (!motionOK()) return;
    const L = s.level;
    const cs = this.cell;
    const cells: Vec2[] = [];
    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        if (L.terrain[y][x] === 'mist') cells.push({ x, y });
      }
    }
    if (cells.length === 0) return;
    const sampleCount = Math.min(12, cells.length);
    const step = cells.length / sampleCount;
    const centers = Array.from({ length: sampleCount }, (_, i) => {
      const c = cells[Math.floor(i * step)];
      return { x: this.ox + c.x * cs + cs / 2, y: this.oy + c.y * cs + cs / 2 };
    });

    ensureDotTexture(this, 'dot-mist', 0xcfe0da, 12);
    // 霧日密度倍增、上限不變：frequency 900→450（caps/maxAliveParticles 沿用 PARTICLE_CAPS.mist）
    const frequency = s.level.weather === 'mist' ? 450 : 900;
    const emitter = this.add.particles(0, 0, 'dot-mist', {
      quantity: 1,
      frequency,
      lifespan: 4000,
      alpha: { start: 0.08, end: 0 },
      scale: { start: 1.4, end: 2.2 },
      speedY: { min: -6, max: -2 },
      maxAliveParticles: PARTICLE_CAPS.mist,
      emitZone: {
        type: 'random',
        source: {
          // Math.random 僅用於粒子視覺散佈，非遊戲邏輯隨機性（同 audio 噪音豁免）
          getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
            const c = centers[Math.floor(Math.random() * centers.length)];
            p.x = c.x + (Math.random() - 0.5) * cs;
            p.y = c.y + (Math.random() - 0.5) * cs;
          },
        },
      },
    });
    guardLowFps(this, emitter);
  }

  // 選配地形紋理（docs/ASSETS.md §2）：逐地形把該型別所有格子設為裁切區，
  // 再以「整張畫布連續平鋪」填入紋理——不逐格重畫，故同型別相鄰格的紋理彼此接續，
  // 不會出現每格一模一樣的重複感。紋理本身無色相（僅明暗），色相仍由 pal.terrain 決定，
  // 配色循環不受影響。任一地形缺檔即略過該型別，維持原本的純色塊。
  private paintTerrainTexture(ctx: CanvasRenderingContext2D, s: SessionState) {
    const L = s.level;
    const cs = this.cell;
    for (const type of TERRAIN_TYPES) {
      const img = terrainTexImage(this, type);
      if (!img) continue;
      const pattern = ctx.createPattern(img, 'repeat');
      if (!pattern) continue;

      ctx.save();
      ctx.beginPath();
      let any = false;
      for (let y = 0; y < L.mapSize; y++) {
        for (let x = 0; x < L.mapSize; x++) {
          if (L.terrain[y][x] !== type) continue;
          ctx.rect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
          any = true;
        }
      }
      if (any) {
        ctx.clip();
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, cs * L.mapSize, cs * L.mapSize);
      }
      ctx.restore();
    }
  }

  private buildHud() {
    const compact = this.scale.width < 560;
    const pal = this.pal;
    const w = this.scale.width;

    // 羅盤
    const compass = this.add.graphics();
    const cx = 28;
    const cy = 28;
    compass.lineStyle(1.6, pal.gold, 1).strokeCircle(cx, cy, 13);
    compass.lineStyle(0.8, pal.gold, 0.5).strokeCircle(cx, cy, 9.5);
    compass.fillStyle(pal.gold, 1);
    compass.fillTriangle(cx, cy - 9, cx + 2.4, cy, cx - 2.4, cy);
    compass.fillTriangle(cx, cy + 9, cx + 2.4, cy, cx - 2.4, cy);
    compass.fillStyle(pal.bg, 1).fillCircle(cx, cy, 1.6);

    this.roundText = this.add.text(50, 8, '', {
      fontFamily: displayFont(this.i18n().locale()), fontSize: '20px', color: cssHex(pal.paper),
    });
    // 天氣徽章：緊接 roundText 之後（座標於 updateHud 依當前文字寬度重算，見該處註解）；
    // compact 版面僅留圖形，省去文字避免與右側 chip 列搶版面
    this.weatherG = this.add.graphics();
    if (!compact) {
      this.weatherText = this.add.text(0, 0, '', {
        fontFamily: FONTS.body, fontSize: '11px', color: cssHex(pal.paperDim),
      }).setOrigin(0, 0.5).setLetterSpacing(1);
      this.add.text(50, 34, "RIDGE HUNTER'S TRAIL", {
        fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
      }).setLetterSpacing(2.5);
    }

    // 迷你地形圖例（僅寬螢幕：副標題右側，四色塊＋成本數字；窄螢幕圖例改放 HelpScene）
    if (w >= 900) {
      const legendG = this.add.graphics();
      const legendY = 36;
      const order: TerrainType[] = ['meadow', 'mist', 'thicket', 'rock'];
      const costs = order.map((t) => String(TERRAIN_COST[t])); // 由 TERRAIN_COST 推導，避免與實際成本脫鉤
      let lx = 250;
      order.forEach((t, i) => {
        legendG.fillStyle(pal.terrain[t], 1).fillRect(lx, legendY, 12, 12);
        this.add.text(lx + 16, legendY + 6, costs[i], {
          fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
        }).setOrigin(0, 0.5);
        lx += 16 + 12 + 12; // 色塊(12)+間距(4)+數字寬+組間距
      });
    }

    // 體力條（筆觸感不規則圓角，動態填色於 redraw）
    this.stamLabel = this.add.text(w / 2, 8, '', {
      fontFamily: FONTS.body, fontSize: '10.5px', color: cssHex(pal.paperDim),
    }).setOrigin(0.5, 0).setLetterSpacing(2);
    this.hudG = this.add.graphics();

    // 操作提示（兩行右對齊）：熟練玩家（累積 3 勝以上）自動退場，不再佔用版面
    const wins = (this.registry.get('runState') as RunState).wins();
    if (!compact && wins < 3) {
      this.hintText = this.add.text(w - 136, 15, '', {
        fontFamily: FONTS.body, fontSize: '11.5px', color: cssHex(pal.paperDim),
        align: 'right', lineSpacing: 4,
      }).setOrigin(1, 0);
    }

    // 語言切換鈕、玩法說明鈕、標記模式鈕與靜音鈕（設計板：金邊小chip，由右至左排列）
    // 窄螢幕（w<560）隱藏語言 chip 並將標記／靜音 chip 右移，避免與置中體力條相撞
    // （語言切換仍可從 Camp/Help 進行）
    const chipY = 13;
    const chipH = 30;
    const xHelp = w - 12 - 32;                            // '?' chip 左緣
    const xLang = xHelp - 8 - 72;                         // 語言 chip 左緣（僅非 compact 顯示）
    const xMark = compact ? xHelp - 8 - 60 : xLang - 8 - 60; // 標記 chip 左緣
    const xSound = xMark - 8 - 32;                        // 靜音 chip 左緣
    const hasBell = this.tools.has('glowbell');
    const xBell = xSound - 8 - 60;                        // 鈴 chip 左緣（僅持有微光鈴時顯示）
    this.chipRowLeft = hasBell ? xBell : xSound; // 供 updateHud 計算體力條寬度時保持間距
    const chip = this.add.graphics();
    chip.lineStyle(1.2, pal.gold, 0.55);
    if (!compact) {
      chip.strokeRoundedRect(xLang, chipY, 72, chipH, BRUSH_RADIUS);
      this.add.text(xLang + 36, chipY + chipH / 2, 'EN / 中', {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
      }).setOrigin(0.5).setLetterSpacing(1);
      this.add.rectangle(xLang + 36, chipY + chipH / 2, 72, 44, 0, 0) // 44px 命中區
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          const i18n = this.i18n();
          i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
          // roundText 的展示字體隨語系而異且僅在 create() 時設定，
          // 用 restart（既有的 resize 重建機制）取代 redraw 以確保字體刷新；
          // 帶入 skipFirstRunHelp 避免儲存降級時每次切語言都重新彈出玩法說明
          this.scene.restart({ skipFirstRunHelp: true });
        });
    }
    chip.strokeRoundedRect(xHelp, chipY, 32, chipH, { tl: 5, tr: 9, br: 4, bl: 8 });
    chip.strokeRoundedRect(xSound, chipY, 32, chipH, { tl: 5, tr: 9, br: 4, bl: 8 });
    this.add.text(xHelp + 16, chipY + chipH / 2, '?', {
      fontFamily: FONTS.display, fontSize: '16px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.add.rectangle(xHelp + 16, chipY + chipH / 2, 32, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.openHelp();
      });

    // 靜音鈕（開＝金色 ♪、關＝暗色 ♪＋斜線；獨立 Graphics 供重繪，座標存為欄位）
    this.soundChipX = xSound;
    this.soundChipY = chipY;
    this.soundChipG = this.add.graphics();
    this.soundChipText = this.add.text(xSound + 16, chipY + chipH / 2, '♪', {
      fontFamily: FONTS.display, fontSize: '15px', color: cssHex(pal.gold),
    }).setOrigin(0.5);
    this.drawSoundChip(xSound, chipY, 32, chipH);
    this.add.rectangle(xSound + 16, chipY + chipH / 2, 32, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.audio.unlock(); // 保險：確保這次手勢也算數（與 create() 的全域 hook 冪等共存）
        this.audio.toggle();
        // 重新開啟時風聲需立刻恢復，不能等到下次進場；ambient() 內建 windGain 防重入。
        // 帶回本局天氣對應的變體，避免靜音→取消靜音後悄悄退回預設風聲（與當下天氣不一致）
        if (this.audio.enabled()) this.audio.ambient(true, this.ambientVariant());
        this.drawSoundChip(xSound, chipY, 32, chipH);
      });

    // 標記模式鈕（開/關填色不同，需獨立 Graphics 供重繪；座標存為欄位供 updateHud 重繪標籤時使用）
    this.markChipX = xMark;
    this.markChipY = chipY;
    this.markChipG = this.add.graphics();
    this.markChipText = this.add.text(xMark + 30, chipY + chipH / 2, '', {
      fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.gold),
    }).setOrigin(0.5).setLetterSpacing(1);
    this.drawMarkChip(xMark, chipY, 60, chipH);
    this.add.rectangle(xMark + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.markMode = !this.markMode;
        this.drawMarkChip(xMark, chipY, 60, chipH);
      });

    // 微光鈴 chip（僅持有 glowbell 時建立）：位於 ♪ chip 左側，可用態＝標記色系描邊，
    // 已用/無幌子線索時呈暗色描邊——視覺上停用，但點擊仍走同一路徑，由 useBell 內部 no-op
    if (hasBell) {
      this.bellChipX = xBell;
      this.bellChipY = chipY;
      this.bellChipG = this.add.graphics();
      this.bellChipText = this.add.text(xBell + 30, chipY + chipH / 2, this.i18n().t('hud.bell'), {
        fontFamily: FONTS.body, fontSize: '12.5px', color: cssHex(pal.mark),
      }).setOrigin(0.5).setLetterSpacing(1);
      this.drawBellChip(xBell, chipY, 60, chipH);
      this.add.rectangle(xBell + 30, chipY + chipH / 2, 60, 44, 0, 0) // 44px 命中區
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          const s = this.session();
          const pos = useBell(s, this.registry.get('rng') as Rng);
          if (pos) {
            this.audio.play('reveal');
            this.redraw();
            const cs = this.cell;
            const cell = { x: this.ox + pos.x * cs + cs / 2, y: this.oy + pos.y * cs + cs / 2 };
            floatText(this, cell.x, cell.y - cs * 0.5, this.i18n().t('hud.bell'), cssHex(this.pal.mark));
            this.drawBellChip(xBell, chipY, 60, chipH);
          }
        });
    }
  }

  // 鈴 chip：可用＝標記色描邊＋亮字；不可用（已用本局/無幌子線索）＝暗描邊＋暗字（僅視覺停用，
  // 命中區仍在，但 pointerdown 中 useBell 對已用/無幌子情境回傳 null，等同 no-op）
  private drawBellChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.bellChipG!;
    g.clear();
    if (this.bellUsable()) {
      g.lineStyle(1.2, pal.mark, 0.7).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.bellChipText!.setColor(cssHex(pal.mark));
    } else {
      g.lineStyle(1.2, pal.paperDim, 0.4).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.bellChipText!.setColor(cssHex(pal.paperDim));
    }
  }

  private bellUsable(): boolean {
    const s = this.session();
    return this.tools.has('glowbell') && !s.bellUsed && s.level.clues.some((c) => c.isDecoy);
  }

  // 靜音 chip 圖示：邊框已由 buildHud 靜態繪製（同 '?' chip），此處僅切換字色與斜線
  private drawSoundChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.soundChipG!;
    g.clear();
    const enabled = this.audio.enabled();
    this.soundChipText!.setColor(cssHex(enabled ? pal.gold : pal.paperDim));
    if (!enabled) {
      g.lineStyle(1.3, pal.paperDim, 0.85);
      g.lineBetween(x + 8, y + h - 7, x + w - 8, y + 7);
    }
  }

  private drawMarkChip(x: number, y: number, w: number, h: number) {
    const pal = this.pal;
    const g = this.markChipG!;
    g.clear();
    if (this.markMode) {
      g.fillStyle(pal.mark, 0.85).fillRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.bg)).setText(this.i18n().t('hud.mark'));
    } else {
      g.lineStyle(1.2, pal.mark, 0.7).strokeRoundedRect(x, y, w, h, BRUSH_RADIUS);
      this.markChipText!.setColor(cssHex(pal.mark)).setText(this.i18n().t('hud.mark'));
    }
  }

  private toGrid(px: number, py: number): Vec2 | null {
    const x = Math.floor((px - this.ox) / this.cell);
    const y = Math.floor((py - this.oy) / this.cell);
    const size = this.session().level.mapSize;
    return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
  }

  // Hover 地形成本：僅桌面裝置（觸控裝置以 device.os.desktop 判斷，避免與拖曳移動手勢衝突）、
  // 僅 explore 階段、指標未按下時，於目前格畫 1px 金框並在右下角顯示地形成本數字
  private onPointerMove(p: Phaser.Input.Pointer) {
    if (!this.sys.game.device.os.desktop) return;
    const s = this.session();
    if (s.phase !== 'explore' || p.isDown) {
      this.clearHover();
      return;
    }
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) {
      this.clearHover();
      return;
    }
    if (this.hoverCell && this.hoverCell.x === cellPos.x && this.hoverCell.y === cellPos.y) return;
    this.hoverCell = cellPos;
    this.drawHover(cellPos, s);
  }

  private clearHover() {
    if (this.hoverCell === null) return;
    this.hoverCell = null;
    this.hoverG.clear();
    this.hoverCostText?.setVisible(false);
  }

  private drawHover(c: Vec2, s: SessionState) {
    const cs = this.cell;
    const pal = this.pal;
    const x = this.ox + c.x * cs;
    const y = this.oy + c.y * cs;
    this.hoverG.clear();
    this.hoverG.lineStyle(1, pal.gold, 0.5).strokeRect(x, y, cs, cs);
    const cost = TERRAIN_COST[s.level.terrain[c.y][c.x]];
    this.hoverCostText?.setText(String(cost)).setPosition(x + cs - 3, y + cs - 3).setVisible(true);
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const s = this.session();
    if (s.phase !== 'explore' || !this.pressAt) return;
    const held = p.time - this.pressAt.t;
    const moved = Math.hypot(p.x - this.pressAt.x, p.y - this.pressAt.y);
    this.pressAt = null;
    if (moved > 12) return; // 拖曳不動作
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) return;
    const wantMark = (p.event as MouseEvent).shiftKey || this.markMode || held >= 350;
    if (wantMark) {
      cycleMarkAt(s, cellPos);
      this.redraw();
      return;
    }
    this.doMove(cellPos);
  }

  private doMove(to: Vec2) {
    const s = this.session();
    if (this.animating || !canMove(s, to)) return;
    const cs = this.cell;
    const from = { x: this.ox + s.player.x * cs + cs / 2, y: this.oy + s.player.y * cs + cs / 2 };
    const dest = { x: this.ox + to.x * cs + cs / 2, y: this.oy + to.y * cs + cs / 2 };
    const cost = TERRAIN_COST[s.level.terrain[to.y][to.x]];
    const suppliesBefore = s.level.supplies.length;
    const readBefore = s.readClues.size;
    move(s, to);
    const gotSupply = s.level.supplies.length < suppliesBefore;

    this.animating = true;
    const pos = { ...from };
    this.tweens.add({
      targets: pos, x: dest.x, y: dest.y, duration: 100, ease: 'Sine.easeOut',
      onUpdate: () => this.drawPlayer(pos.x, pos.y),
      onComplete: () => {
        this.animating = false;
        floatText(this, dest.x, dest.y - cs * 0.5, `-${cost}`, cssRgba(this.pal.paper, 0.75));
        if (gotSupply) {
          floatText(this, dest.x, dest.y - cs, `+${getDifficulty(s.round).supplyRestore}`, cssHex(this.pal.supply));
          this.audio.play('pickup');
        }
        if (s.readClues.size > readBefore) {
          const clue = s.level.clues.find((c) => key(c.position) === key(to));
          if (clue) {
            this.playReveal(clue);
            this.audio.play('reveal');
          }
          if (this.tutStep === 0) {
            this.tutStep = 1;
            this.showTut('tut.read');
            this.time.delayedCall(3000, () => this.checkTutStep1to2(s));
          } else if (this.tutStep === 1) {
            this.checkTutStep1to2(s);
          }
        }
        // 引導 step2→3：進逼目標範圍（cheb<=2）先於實際 QTE 觸發距離（cheb<=1）示警，
        // 涵蓋玩家跳步略過 step1/2 的情境（任何 0..2 步驟命中都直接進 step3）
        if (this.tutStep >= 0 && this.tutStep <= 2 && cheb(s.player, s.level.targetPos) <= 2) {
          this.tutStep = 3;
          this.showTut('tut.qte');
        }
        this.redraw();
        // 途中微事件：教學期間不觸發（rollMicroEvent 內部已排除每日模式與各項條件）；
        // 本次移動若已力竭（phase 轉為 exhausted），不再擲事件——避免演出蓋在淡出畫面上、
        // 且 bonus-supply 會把新格子寫進即將捨棄的關卡資料
        if (this.tutStep < 0 && s.phase === 'explore') {
          const ev = rollMicroEvent(s, this.registry.get('rng') as Rng);
          if (ev) this.playMicroEvent(ev);
        }
        this.afterMove();
      },
    });
  }

  // 線索揭示：以容器縮放模擬形狀擴散，結束時 redraw 已畫出常駐覆蓋層
  private playReveal(c: Clue) {
    const cs = this.cell;
    const pal = this.pal;
    const center = {
      x: this.ox + c.position.x * cs + cs / 2,
      y: this.oy + c.position.y * cs + cs / 2,
    };
    const g = this.add.graphics();
    if (c.type === 'footprint') {
      const len = cs * 5;
      const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
      const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
      g.fillStyle(pal.gold, 0.35).fillTriangle(
        0, 0, len * Math.cos(a1), len * Math.sin(a1), len * Math.cos(a2), len * Math.sin(a2));
    } else if (c.type === 'disturbance') {
      g.lineStyle(3, pal.gold, 0.8).strokeCircle(0, 0, c.data.radius * cs);
    } else {
      g.lineStyle(3, pal.glow, 0.8).strokeCircle(0, 0, c.data.distance * cs);
    }
    const holder = this.add.container(center.x, center.y, [g]).setScale(0.25).setAlpha(0.9);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => holder.destroy(),
    });
  }

  // 途中微事件演出：全部一次性、不留常駐物件；reduced-motion 時跳過視覺演出但效果（浮字／補給／音效）保留。
  // bonus-supply 的新格子由 rollMicroEvent 直接寫入 s.level.supplies，此處固定在 doMove 的
  // redraw() 之後才呼叫（見教學期間排除註解處），故該分支需補畫一次 redraw 讓格子立即可見。
  private playMicroEvent(ev: MicroEvent): void {
    const s = this.session();
    const cs = this.cell;
    const pal = this.pal;
    const player = {
      x: this.ox + s.player.x * cs + cs / 2,
      y: this.oy + s.player.y * cs + cs / 2,
    };

    if (ev.kind === 'bird-startle') {
      if (motionOK()) {
        this.playEventCone(player, ev.direction, 45, cs * 6, pal.gold, 0.25, 2500);
        this.spawnBurstDots(player, ev.direction, pal.gold);
      }
      this.audio.play('reveal');
      floatText(this, player.x, player.y - cs * 0.5, '!', cssHex(pal.mark));
      return;
    }

    if (ev.kind === 'bonus-supply') {
      const center = {
        x: this.ox + ev.pos.x * cs + cs / 2,
        y: this.oy + ev.pos.y * cs + cs / 2,
      };
      this.redraw(); // 補畫：讓 rollMicroEvent 剛寫入的新補給格立即可見
      floatText(this, center.x, center.y - cs * 0.5, '+', cssHex(pal.supply));
      this.audio.play('pickup');
      return;
    }

    // old-trail：玩家所在格的一次性弱足跡
    if (motionOK()) {
      this.playEventCone(player, ev.direction, 60, cs * 5, pal.gold, 0.2, 5000, true);
    }
    this.audio.play('reveal');
  }

  // 微事件錐形演出：複製 playReveal 的容器縮放淡出技法（scale 0.3→1、alpha→0）；
  // dashedEdge 供 old-trail 加畫足跡感虛線邊
  private playEventCone(
    center: Vec2, direction: number, halfAngle: number, len: number,
    color: number, fillAlpha: number, duration: number, dashedEdge = false,
  ): void {
    const g = this.add.graphics();
    const a1 = ((direction - halfAngle) * Math.PI) / 180;
    const a2 = ((direction + halfAngle) * Math.PI) / 180;
    const p1 = { x: len * Math.cos(a1), y: len * Math.sin(a1) };
    const p2 = { x: len * Math.cos(a2), y: len * Math.sin(a2) };
    g.fillStyle(color, fillAlpha).fillTriangle(0, 0, p1.x, p1.y, p2.x, p2.y);
    if (dashedEdge) {
      dashedLine(g, 0, 0, p1.x, p1.y, color, 0.45);
      dashedLine(g, 0, 0, p2.x, p2.y, color, 0.45);
    }
    const holder = this.add.container(center.x, center.y, [g]).setScale(0.3).setAlpha(0.9);
    this.tweens.add({
      targets: holder, scale: 1, alpha: 0, duration, ease: 'Cubic.easeOut',
      onComplete: () => holder.destroy(),
    });
  }

  // 鳥驚飛：沿方向散開的一次性小點（≤6 顆），explode 後即靜態消散，非常駐 emitter
  private spawnBurstDots(center: Vec2, direction: number, color: number): void {
    ensureDotTexture(this, 'dot-startle', color, 3);
    const emitter = this.add.particles(center.x, center.y, 'dot-startle', {
      lifespan: 700,
      speed: { min: 60, max: 140 },
      angle: { min: direction - 20, max: direction + 20 },
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1, end: 0.3 },
      emitting: false,
    });
    emitter.explode(6);
    this.time.delayedCall(800, () => emitter.destroy());
  }

  private afterMove() {
    const s = this.session();
    if (s.phase === 'qte') {
      if (this.tutStep >= 0) this.finishTutorial(); // 引導收尾：進 QTE 即視為引導完成，寫入兩把旗標
      fadeToScene(this, 'Qte');
    } else if (s.phase === 'exhausted') {
      fadeToScene(this, 'Result'); // 中途力竭不寫旗標：下次 round1 仍會重新引導
    }
  }

  private redraw() {
    const s = this.session();
    const L = s.level;
    const cs = this.cell;
    const pal = this.pal;
    const px = (v: Vec2) => ({ x: this.ox + v.x * cs + cs / 2, y: this.oy + v.y * cs + cs / 2 });

    this.g.clear();

    L.supplies.forEach((sup, i) => {
      const p = px(sup);
      drawSupply(this.g, p.x, p.y, cs, sup.x + sup.y + i, pal);
    });

    for (const c of L.clues) {
      if (s.readClues.has(key(c.position))) this.drawClueOverlay(c, px);
    }
    for (const c of L.clues) {
      const p = px(c.position);
      const r = Math.max(8, cs * 0.34);
      drawClueToken(this.g, p.x, p.y, r, c.type, pal);
      if (s.readClues.has(key(c.position))) this.drawReadCheck(p.x, p.y, r);
    }

    for (const [m] of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      const r = cs * 0.32;
      this.g.lineStyle(3, pal.mark, 0.9);
      this.g.lineBetween(p.x - r, p.y - r, p.x + r, p.y + r);
      this.g.lineBetween(p.x + r, p.y - r, p.x - r, p.y + r);
    }

    // 玩家：光暈＋紙墨白圓點（設計板）
    const pp = px(s.player);
    this.drawPlayer(pp.x, pp.y);

    this.updateHud(s);
  }

  private drawPlayer(x: number, y: number) {
    const cs = this.cell;
    const pal = this.pal;
    this.pg.clear();
    this.pg.fillStyle(pal.gold, 0.1).fillCircle(x, y, cs * 0.62);
    this.pg.fillStyle(pal.gold, 0.16).fillCircle(x, y, cs * 0.44);
    this.pg.lineStyle(1.2, pal.paper, 0.5).strokeCircle(x, y, cs * 0.36);
    this.pg.fillStyle(pal.paper, 1).fillCircle(x, y, cs * 0.26);
  }

  private updateHud(s: SessionState) {
    const i18n = this.i18n();
    const pal = this.pal;
    const w = this.scale.width;
    const budget = getDifficulty(s.round).staminaBudget;

    this.roundText.setText(i18n.t('hud.round', { n: s.round }));
    this.drawWeatherBadge(s);
    this.stamLabel.setText(`${i18n.t('hud.stamina', { n: s.stamina })} / ${budget}`.toUpperCase());
    this.hintText?.setText(i18n.t('hud.hint').split(' · ').join('\n'));
    if (this.markChipG) this.drawMarkChip(this.markChipX, this.markChipY, 60, 30);
    if (this.bellChipG) this.drawBellChip(this.bellChipX, this.bellChipY, 60, 30);

    // 置中體力條在較窄視窗（或持有微光鈴、chip 列多一格時）會撞上右側 chip 列
    // （chip 列左緣隨寬度＋是否持有鈴鐺變動，見 chipRowLeft）。固定寬度斷點（舊：w>=700）
    // 沒考慮鈴鐺 chip 把 chipRowLeft 再往左推 68px，導致 w∈[700,~826) 持有鈴鐺時
    // 置中版面的體力條右緣會蓋到 chip 列。改用幾何判斷：僅當置中版面（bx=w/2-105，
    // 固定寬 210）的右緣加上 8px 安全間距仍在 chipRowLeft 之內，才採置中版面；
    // 否則一律退回左靠齊版面（bx=50，寬度依 chipRowLeft 動態夾限，保證 ≥8px 間距）。
    const centered = this.scale.width / 2 + 105 <= this.chipRowLeft - 8;
    const barLeft = !centered;
    const bx = barLeft ? 50 : w / 2 - 105;
    const bw = barLeft ? Math.max(90, Math.min(210, this.chipRowLeft - 8 - bx)) : 210;
    const bh = barLeft ? 10 : 12;
    const by = barLeft ? 46 : 27;
    this.stamLabel.setPosition(barLeft ? bx + bw / 2 : w / 2, barLeft ? 30 : 8);
    this.hudG.clear();
    this.hudG.fillStyle(0x0d1310, 1).fillRoundedRect(bx, by, bw, bh, BRUSH_RADIUS);
    this.hudG.lineStyle(1, pal.paper, 0.18).strokeRoundedRect(bx, by, bw, bh, BRUSH_RADIUS);
    const ratio = Math.max(0, Math.min(1, s.stamina / budget));
    const low = ratio > 0 && ratio < 0.25;
    if (ratio > 0) {
      this.hudG.fillStyle(low ? pal.mark : pal.gold, 1)
        .fillRoundedRect(bx + 1, by + 1, Math.max(6, (bw - 2) * ratio), bh - 2, { tl: 7, tr: 2, br: 6, bl: 3 });
    }
    if (low && !this.lowTween) {
      this.lowTween = this.tweens.add({
        targets: this.hudG, alpha: { from: 1, to: 0.55 },
        duration: 700, yoyo: true, repeat: -1,
      });
    } else if (!low && this.lowTween) {
      this.lowTween.stop();
      this.lowTween = undefined;
      this.hudG.setAlpha(1);
    }
  }

  // 天氣徽章：緊接 roundText 之後——round 文字隨局數／語系換寬，每次 updateHud 都要
  // 重新以 roundText.x + roundText.width 定位，不能寫死座標
  private drawWeatherBadge(s: SessionState) {
    const pal = this.pal;
    const weather = s.level.weather;
    const bx = this.roundText.x + this.roundText.width + 12;
    const cy = this.roundText.y + this.roundText.height / 2;
    this.weatherG.clear();
    this.drawWeatherGlyph(this.weatherG, bx + 6, cy, weather, pal);
    if (this.weatherText) {
      this.weatherText.setText(this.i18n().t(WEATHER_KEY[weather])).setPosition(bx + 16, cy);
    }
  }

  // 天氣小圖形（≤14px，paperDim 線條）：晴＝圓圈、霧＝兩短橫、風＝三斜線、雨＝兩斜點
  private drawWeatherGlyph(
    g: Phaser.GameObjects.Graphics, cx: number, cy: number, weather: Weather, pal: Palette,
  ) {
    g.lineStyle(1.3, pal.paperDim, 0.9);
    switch (weather) {
      case 'clear':
        g.strokeCircle(cx, cy, 4);
        break;
      case 'mist':
        g.lineBetween(cx - 4, cy - 2, cx + 4, cy - 2);
        g.lineBetween(cx - 4, cy + 2, cx + 4, cy + 2);
        break;
      case 'wind':
        g.lineBetween(cx - 6, cy - 5, cx + 4, cy - 3);
        g.lineBetween(cx - 6, cy - 1, cx + 4, cy + 1);
        g.lineBetween(cx - 6, cy + 3, cx + 4, cy + 5);
        break;
      case 'drizzle':
        g.lineBetween(cx - 4, cy - 4, cx - 2, cy + 2);
        g.lineBetween(cx + 2, cy - 4, cx + 4, cy + 2);
        break;
    }
  }

  // 已判讀線索 token 金色小勾（右上角，兩段線，座標依 token 半徑 r 縮放）
  private drawReadCheck(x: number, y: number, r: number) {
    this.g.lineStyle(1.6, this.pal.gold, 1);
    this.g.lineBetween(x + r * 0.5, y - r * 0.9, x + r * 0.8, y - r * 0.6);
    this.g.lineBetween(x + r * 0.8, y - r * 0.6, x + r * 1.3, y - r * 1.2);
  }

  // 已判讀線索覆蓋層（設計板）：足跡=金色錐形（淡填色＋點描邊線）、
  // 擾動=金色虛線圓域、氣味=發光色虛線距離環
  private drawClueOverlay(c: Clue, px: (v: Vec2) => { x: number; y: number }) {
    const cs = this.cell;
    const pal = this.pal;
    const center = px(c.position);
    if (c.type === 'footprint') {
      const len = cs * 5;
      const a1 = ((c.data.direction - c.data.angleSpread) * Math.PI) / 180;
      const a2 = ((c.data.direction + c.data.angleSpread) * Math.PI) / 180;
      const p1 = { x: center.x + len * Math.cos(a1), y: center.y + len * Math.sin(a1) };
      const p2 = { x: center.x + len * Math.cos(a2), y: center.y + len * Math.sin(a2) };
      this.g.fillStyle(pal.gold, 0.1).fillTriangle(center.x, center.y, p1.x, p1.y, p2.x, p2.y);
      dashedLine(this.g, center.x, center.y, p1.x, p1.y, pal.gold, 0.55);
      dashedLine(this.g, center.x, center.y, p2.x, p2.y, pal.gold, 0.55);
    } else if (c.type === 'disturbance') {
      this.g.fillStyle(pal.gold, 0.05).fillCircle(center.x, center.y, c.data.radius * cs);
      dashedCircle(this.g, center.x, center.y, c.data.radius * cs, pal.gold, 0.45, 2, 6, 9);
    } else if (this.tools.has('windstone')) {
      // 風向石：完整距離環收窄為 240° 偏心弧，弧心指向 biasDirection（來源方向提示）
      dashedArc(this.g, center.x, center.y, c.data.distance * cs, c.data.biasDirection, 240, pal.glow, 0.5, 2, 3, 8);
    } else {
      dashedCircle(this.g, center.x, center.y, c.data.distance * cs, pal.glow, 0.5, 2, 3, 8);
    }
  }
}

// 天氣字串鍵映射：同 CampScene describeCommission 的 QUALITY_KEY 手法，
// 避免模板字面型別（`weather.${Weather}`）無法收斂為 MsgKey 聯集
const WEATHER_KEY: Record<Weather, MsgKey> = {
  clear: 'weather.clear', mist: 'weather.mist', wind: 'weather.wind', drizzle: 'weather.drizzle',
};
