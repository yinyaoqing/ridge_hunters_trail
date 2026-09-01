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
