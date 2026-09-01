import Phaser from 'phaser';
import { canMove, move, toggleMark, useBell, TERRAIN_COST, type SessionState } from '../core/session';
import { getDifficulty } from '../core/difficulty';
import { getPalette, type Palette } from '../core/palette';
import { key } from '../core/clues';
import type { Vec2 } from '../core/geometry';
import type { Clue, TerrainType } from '../core/types';
import type { I18n } from '../core/i18n';
import type { AudioBus } from '../core/audio';
import type { Rng } from '../core/rng';
import type { ToolStore } from '../core/tools';
import type { RunState } from '../core/runstate';
import {
  cssHex, cssRgba, dashedCircle, dashedArc, dashedLine, drawClueToken, drawSupply,
  BRUSH_RADIUS, FONTS, displayFont,
} from './paint';
import {
  restartOnResize, fadeIn, fadeToScene, floatText,
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
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.clearHover(); this.redraw(); });
    this.redraw();
    restartOnResize(this);
    fadeIn(this);
    this.maybeShowFirstRunHelp();
    this.audio.ambient(true); // 探索環境風聲（靜音時 ambient 內部自行忽略）
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
    const jd = Phaser.Input.Keyboard.JustDown;
    let to: Vec2 | null = null;
    if (jd(this.cursors.left)) to = { x: s.player.x - 1, y: s.player.y };
    else if (jd(this.cursors.right)) to = { x: s.player.x + 1, y: s.player.y };
    else if (jd(this.cursors.up)) to = { x: s.player.x, y: s.player.y - 1 };
    else if (jd(this.cursors.down)) to = { x: s.player.x, y: s.player.y + 1 };
    if (to) this.doMove(to);
  }

  private session(): SessionState {
    return this.registry.get('session');
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
    const emitter = this.add.particles(0, 0, 'dot-mist', {
      quantity: 1,
      frequency: 900,
      lifespan: 4000,
      alpha: { start: 0.08, end: 0 },
      scale: { start: 1.4, end: 2.2 },
      speedY: { min: -6, max: -2 },
      maxAliveParticles: PARTICLE_CAPS.mist,
      emitZone: {
        type: 'random',
        source: {
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
    if (!compact) {
      this.add.text(50, 34, "RIDGE HUNTER'S TRAIL", {
        fontFamily: FONTS.body, fontSize: '10px', color: cssHex(pal.paperDim),
      }).setLetterSpacing(2.5);
    }

    // 迷你地形圖例（僅寬螢幕：副標題右側，四色塊＋成本數字；窄螢幕圖例改放 HelpScene）
    if (w >= 900) {
      const legendG = this.add.graphics();
      const legendY = 36;
      const order: TerrainType[] = ['meadow', 'mist', 'thicket', 'rock'];
      const costs = ['1', '1', '2', '2'];
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
        this.audio.toggle();
        // 重新開啟時風聲需立刻恢復，不能等到下次進場；ambient() 內建 windGain 防重入
        if (this.audio.enabled()) this.audio.ambient(true);
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
      toggleMark(s, cellPos);
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
        }
        this.redraw();
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

  private afterMove() {
    const s = this.session();
    if (s.phase === 'qte') fadeToScene(this, 'Qte');
    else if (s.phase === 'exhausted') fadeToScene(this, 'Result');
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

    for (const m of s.marks) {
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
    this.stamLabel.setText(`${i18n.t('hud.stamina', { n: s.stamina })} / ${budget}`.toUpperCase());
    this.hintText?.setText(i18n.t('hud.hint').split(' · ').join('\n'));
    if (this.markChipG) this.drawMarkChip(this.markChipX, this.markChipY, 60, 30);
    if (this.bellChipG) this.drawBellChip(this.bellChipX, this.bellChipY, 60, 30);

    // 置中體力條在較窄視窗會撞上右側加寬後的 chip 列（新增 ♪ chip 後 chip 列左緣
    // 隨寬度線性變動，見 chipRowLeft）。與其疊加新斷點修修補補，改用明確規則：
    // w<700 一律採左靠齊版面（label 於 y30、bar 於 y46，bx=50），bar 寬度依
    // chipRowLeft 動態夾限，保證與 chip 列保持 ≥8px 間距；w≥700 時 chip 列已遠離
    // 中線，改回置中版面（bw 固定 210，見 task-4-report.md 驗算）。
    const barLeft = w < 700;
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
