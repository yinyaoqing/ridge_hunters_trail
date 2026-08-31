import Phaser from 'phaser';
import { CREATURES } from '../data/creatures';
import { silhouetteDataUri } from '../data/silhouettes';
import { cssHex } from './paint';

const INK = '#0f1613';

// 將剪影 SVG 轉為貼圖（data URI，無外部素材檔）。
// addBase64 為非同步：全部載妥或逾時 1.2 秒後進入地圖（場景端有 fallback）。
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    let loaded = 0;
    let started = false;
    const begin = () => {
      if (!started) {
        started = true;
        this.scene.start(this.devTargetScene() ?? 'Map');
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
    if (!target || !['Map', 'Qte', 'Result', 'Codex'].includes(target)) return null;
    if (target === 'Result') {
      const phase = params.get('phase');
      const s = this.registry.get('session');
      s.phase = phase === 'escaped' || phase === 'exhausted' ? phase : 'caught';
    }
    return target;
  }
}
