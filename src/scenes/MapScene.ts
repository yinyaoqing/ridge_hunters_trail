import Phaser from 'phaser';
import { canMove, move, toggleMark, type SessionState } from '../core/session';
import { key } from '../core/clues';
import type { Vec2 } from '../core/geometry';
import type { Clue, TerrainType } from '../core/types';
import type { I18n } from '../core/i18n';

const TERRAIN_COLOR: Record<TerrainType, number> = {
  meadow: 0x4a6741, mist: 0x5c6b73, thicket: 0x3d5233, rock: 0x6b5f52,
};
const HUD_HEIGHT = 56;

export class MapScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private hud!: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private cell = 0;
  private ox = 0;
  private oy = HUD_HEIGHT;

  constructor() {
    super('Map');
  }

  create() {
    const s = this.session();
    this.cell = Math.floor((this.scale.height - HUD_HEIGHT - 8) / s.level.mapSize);
    this.ox = Math.floor((this.scale.width - this.cell * s.level.mapSize) / 2);
    this.g = this.add.graphics();
    this.hud = this.add.text(12, 14, '', { fontSize: '17px', color: '#e8e3d5' });
    const i18n: I18n = this.registry.get('i18n');
    this.add
      .text(this.scale.width - 12, 14, 'EN / 中', { fontSize: '16px', color: '#f2d98d' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        i18n.setLocale(i18n.locale() === 'en' ? 'zh-TW' : 'en');
        this.redraw();
      });
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.redraw();
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
    if (to && canMove(s, to)) {
      move(s, to);
      this.redraw();
      this.afterMove();
    }
  }

  private session(): SessionState {
    return this.registry.get('session');
  }

  private toGrid(px: number, py: number): Vec2 | null {
    const x = Math.floor((px - this.ox) / this.cell);
    const y = Math.floor((py - this.oy) / this.cell);
    const size = this.session().level.mapSize;
    return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
  }

  private onPointer(p: Phaser.Input.Pointer) {
    const s = this.session();
    if (s.phase !== 'explore') return;
    const cellPos = this.toGrid(p.x, p.y);
    if (!cellPos) return;
    if ((p.event as MouseEvent).shiftKey) {
      toggleMark(s, cellPos);
      this.redraw();
      return;
    }
    if (canMove(s, cellPos)) {
      move(s, cellPos);
      this.redraw();
      this.afterMove();
    }
  }

  private afterMove() {
    const s = this.session();
    if (s.phase === 'qte') this.scene.start('Qte');
    else if (s.phase === 'exhausted') this.scene.start('Result');
  }

  private redraw() {
    const s = this.session();
    const L = s.level;
    const cs = this.cell;
    const px = (v: Vec2) => ({ x: this.ox + v.x * cs, y: this.oy + v.y * cs });

    this.g.clear();
    this.labels.forEach((t) => t.destroy());
    this.labels = [];

    for (let y = 0; y < L.mapSize; y++) {
      for (let x = 0; x < L.mapSize; x++) {
        const p = px({ x, y });
        this.g.fillStyle(TERRAIN_COLOR[L.terrain[y][x]], 1).fillRect(p.x, p.y, cs - 1, cs - 1);
      }
    }

    for (const sup of L.supplies) {
      const p = px(sup);
      this.g.fillStyle(0xa8d08d, 1).fillCircle(p.x + cs / 2, p.y + cs / 2, cs * 0.22);
    }

    for (const c of L.clues) {
      if (s.readClues.has(key(c.position))) this.drawClueOverlay(c, px);
    }
    for (const c of L.clues) {
      const p = px(c.position);
      const t = this.add
        .text(p.x + cs / 2, p.y + cs / 2, c.type[0].toUpperCase(), {
          fontSize: `${Math.max(11, Math.floor(cs * 0.55))}px`,
          color: '#f2d98d',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.push(t);
    }

    for (const m of s.marks) {
      const [mx, my] = m.split(',').map(Number);
      const p = px({ x: mx, y: my });
      this.g.lineStyle(2, 0xd9764a, 1);
      this.g.lineBetween(p.x + 4, p.y + 4, p.x + cs - 4, p.y + cs - 4);
      this.g.lineBetween(p.x + cs - 4, p.y + 4, p.x + 4, p.y + cs - 4);
    }

    const pp = px(s.player);
    this.g.fillStyle(0xe8e3d5, 1).fillCircle(pp.x + cs / 2, pp.y + cs / 2, cs * 0.3);

    const i18n: I18n = this.registry.get('i18n');
    this.hud.setText(
      `${i18n.t('hud.round', { n: s.round })}   ${i18n.t('hud.stamina', { n: s.stamina })}   ${i18n.t('hud.hint')}`,
    );
  }

  // 已判讀線索的資訊覆蓋層：足跡=錐形線、擾動=實心圓域邊線、氣味=距離環
  private drawClueOverlay(c: Clue, px: (v: Vec2) => { x: number; y: number }) {
    const cs = this.cell;
    const center = px(c.position);
    const cx = center.x + cs / 2;
    const cy = center.y + cs / 2;
    this.g.lineStyle(2, 0xf2d98d, 0.6);
    if (c.type === 'footprint') {
      const len = cs * 5;
      for (const off of [-c.data.angleSpread, 0, c.data.angleSpread]) {
        const rad = ((c.data.direction + off) * Math.PI) / 180;
        this.g.lineBetween(cx, cy, cx + len * Math.cos(rad), cy + len * Math.sin(rad));
      }
    } else if (c.type === 'disturbance') {
      this.g.strokeCircle(cx, cy, c.data.radius * cs);
    } else {
      this.g.strokeCircle(cx, cy, c.data.distance * cs);
    }
  }
}
