import Phaser from 'phaser';
import { FONTS } from './paint';

// resize 後 debounce 重啟場景：所有狀態都在 registry，重啟即重排。
// beforeRestart（選用）在實際呼叫 scene.restart() 之前執行一次——場景若需要分辨
// 「這次重啟是不是同一次造訪」（例如 coach 首見提示不該因為 resize 而被跳過或錯位，
// 見 CampScene/ResultScene/CodexScene），就在這個回呼裡把自己的旗標欄位設成 true，
// 該欄位再由場景的 init() 讀取並立刻歸零。刻意不透過 scene.restart(data) 傳資料——
// Phaser 的 Systems#start 只在 data 為 truthy 時才覆寫 settings.data，之後任何一次
// 不帶 data 的 scene.start(key)（本專案所有一般轉場都是如此）都會讓 init() 繼續讀到
// 上一次留下的舊 data，欄位因此永久卡住，見開發紀錄裡的重啟旗標永久外洩問題。
// 場景自身持有並讀寫的實例欄位不受這個問題影響：每個真正的新造訪都是
// 新一輪「未經回呼設 true」的 init()，欄位自然是預設值。
export function restartOnResize(scene: Phaser.Scene, beforeRestart?: () => void): void {
  let timer: Phaser.Time.TimerEvent | null = null;
  const handler = () => {
    timer?.remove();
    timer = scene.time.delayedCall(150, () => {
      beforeRestart?.();
      scene.scene.restart();
    });
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

// 低階裝置防護：每秒取樣一次 fps，連續 3 秒都低於 40 才停止並隱藏該 emitter
// （單次 3 秒後取樣一次容易被瞬間掉幀誤判；改為連續採樣更能反映「持續」低幀率）
export function guardLowFps(scene: Phaser.Scene, emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
  let consecutiveLow = 0;
  const timer = scene.time.addEvent({
    delay: 1000,
    repeat: -1,
    callback: () => {
      if (scene.game.loop.actualFps < 40) {
        consecutiveLow++;
        if (consecutiveLow >= 3) {
          emitter.stop();
          emitter.setVisible(false);
          timer.remove();
        }
      } else {
        consecutiveLow = 0;
      }
    },
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
