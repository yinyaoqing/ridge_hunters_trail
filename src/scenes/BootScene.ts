import Phaser from 'phaser';
import { CREATURES } from '../data/creatures';
import { TERRAIN_TYPES } from '../core/types';
import { silhouetteDataUri } from '../data/silhouettes';
import { cssHex } from './paint';

const INK = '#0f1613';

// 將剪影 SVG 轉為貼圖（data URI，無外部素材檔）。
// addBase64 為非同步：全部載妥或逾時 1.2 秒後進入地圖（場景端有 fallback）。
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // 選配美術管線：嘗試載入生物 sprite 與地形紋理（見 docs/ASSETS.md）。
  // 兩者皆為選配：缺檔時 FILE_LOAD_ERROR 靜默吞下（僅 debug log），
  // create() 的剪影後備與 MapScene 的純色塊後備完全不受影響——
  // preload 先於 create 執行是 Phaser 場景生命週期的既定順序，故不需額外同步機制。
  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      // 僅吞「選配」素材的缺檔（sprite 與地形紋理）——其餘必要資源不得沿用此靜默路徑
      if (!file.key.startsWith('spr-') && !file.key.startsWith('terr-')) return;
      console.debug(`[assets] optional asset missing, using built-in fallback: ${file.key}`);
    });
    for (const c of CREATURES) {
      // 相對路徑（無前導斜線）：搭配 vite.config.ts 的 base: './'，
      // 讓 index.html 與 public/ 素材在任何部署子路徑（itch.io、CrazyGames iframe 等）下
      // 都以「相對於目前頁面」解析，與瀏覽器對相對 URL 的預設行為一致。
      this.load.image(`spr-${c.id}`, `assets/creatures/${c.id}.png`);
    }
    for (const t of TERRAIN_TYPES) {
      this.load.image(`terr-${t}`, `assets/terrain/${t}.png`);
    }
  }

  create() {
    let loaded = 0;
    let started = false;
    const begin = () => {
      if (!started) {
        started = true;
        this.scene.start(this.devTargetScene() ?? 'Camp');
      }
    };
    this.textures.on(Phaser.Textures.Events.ADD, () => {
      loaded++;
      if (loaded >= CREATURES.length) begin();
    });
    for (const c of CREATURES) {
      this.textures.addBase64(`sil-${c.id}`, silhouetteDataUri(c.id, INK, cssHex(c.color)));
    }
    this.time.delayedCall(1200, begin);
  }

  // 僅開發模式：#scene=Qte|Result|Codex(&phase=caught|escaped|exhausted) 直達場景，供視覺調試
  private devTargetScene(): string | null {
    if (!import.meta.env.DEV) return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const target = params.get('scene');
    if (!target || !['Camp', 'Map', 'Qte', 'Result', 'Codex'].includes(target)) return null;
    if (target === 'Result') {
      const phase = params.get('phase');
      const s = this.registry.get('session');
      s.phase = phase === 'escaped' || phase === 'exhausted' ? phase : 'caught';
    }
    return target;
  }
}
