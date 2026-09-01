import Phaser from 'phaser';
import { FONTS } from './paint';

// resize 後 debounce 重啟場景：所有狀態都在 registry，重啟即重排
export function restartOnResize(scene: Phaser.Scene): void {
  let timer: Phaser.Time.TimerEvent | null = null;
  const handler = () => {
    timer?.remove();
    timer = scene.time.delayedCall(150, () => scene.scene.restart());
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

export function fadeIn(scene: Phaser.Scene, ms = 240): void {
  scene.cameras.main.fadeIn(ms, 0, 0, 0);
}

export function fadeToScene(scene: Phaser.Scene, key: string, ms = 200): void {
  if (scene.cameras.main.fadeEffect.isRunning) return; // 防止雙擊等連續觸發重複 fade/重複 scene.start
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
    scene.scene.start(key));
}

// 一次性浮字（體力扣減/補給回復/筆記掉落）
export function floatText(
  scene: Phaser.Scene, x: number, y: number, msg: string, cssColor: string,
): void {
  const t = scene.add.text(x, y, msg, {
    fontFamily: FONTS.body, fontSize: '13px', color: cssColor, fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({
    targets: t, y: y - 22, alpha: 0, duration: 600, ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

// 氛圍粒子存活上限（低密度，避免搶戲或拖慢低階裝置）
export const PARTICLE_CAPS = { mist: 20, spore: 30, ember: 8 } as const;

// 減少動態偏好：match → 不生成任何粒子；API 缺席（舊瀏覽器/測試環境）一律視為 OK
export function motionOK(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

// 產生單色圓點材質供粒子重複使用；同 key 已存在即跳過（場景 restart 不重建）
export function ensureDotTexture(scene: Phaser.Scene, key: string, color: number, radius: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(color, 1).fillCircle(radius, radius, radius);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

// 低階裝置防護：建立 3 秒後若 fps 掉到 40 以下就停止並隱藏該 emitter
export function guardLowFps(scene: Phaser.Scene, emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
  scene.time.delayedCall(3000, () => {
    if (scene.game.loop.actualFps < 40) {
      emitter.stop();
      emitter.setVisible(false);
    }
  });
}

// 新手引導：脈動高亮圈（虛線感改用純描邊圓，避免 fx.ts 反向依賴 paint.ts）——
// scale 1→1.25 yoyo 三次（duration*2*3 ≈ 1.8s）後自毀，非常駐效果
export function pulseHighlight(
  scene: Phaser.Scene, x: number, y: number, r: number, color: number,
): Phaser.GameObjects.Container {
  const g = scene.make.graphics({}, false);
  g.lineStyle(2, color, 0.9).strokeCircle(0, 0, r);
  const holder = scene.add.container(x, y, [g]);
  scene.tweens.add({
    targets: holder, scale: 1.25, duration: 300, yoyo: true, repeat: 2,
    onComplete: () => holder.destroy(),
  });
  return holder;
}

// 僅 WebGL 才疊加光暈後製（Canvas renderer 無此能力，靜默跳過不影響既有畫法）
export function addGlowIfWebGL(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject & { postFX?: Phaser.GameObjects.Components.FX },
  color: number,
): void {
  try {
    if (scene.game.renderer.type === Phaser.WEBGL) obj.postFX?.addGlow(color, 4, 0);
  } catch { /* 舊環境靜默 */ }
}
