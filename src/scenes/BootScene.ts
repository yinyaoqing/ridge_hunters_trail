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
        this.scene.start('Map');
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
}
