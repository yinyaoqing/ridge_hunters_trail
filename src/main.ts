import Phaser from 'phaser';
import { mulberry32 } from './core/rng';
import { newSession } from './core/session';
import { createCodex } from './core/codex';
import { createI18n, detectLocale } from './core/i18n';
import { MapScene } from './scenes/MapScene';
import { QteScene } from './scenes/QteScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 720,
  height: 780,
  backgroundColor: '#141814',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MapScene, QteScene], // Task 11 依序加入 ResultScene / CodexScene
  callbacks: {
    preBoot: (game) => {
      const rng = mulberry32(Date.now() >>> 0);
      game.registry.set('rng', rng);
      game.registry.set('codex', createCodex(window.localStorage));
      game.registry.set('i18n', createI18n(detectLocale(navigator.language), window.localStorage));
      game.registry.set('session', newSession(1, rng));
    },
  },
});
