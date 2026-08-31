import Phaser from 'phaser';
import { mulberry32 } from './core/rng';
import { newSession } from './core/session';
import { createCodex } from './core/codex';
import { createI18n, detectLocale } from './core/i18n';
import { MapScene } from './scenes/MapScene';
import { QteScene } from './scenes/QteScene';
import { ResultScene } from './scenes/ResultScene';
import { CodexScene } from './scenes/CodexScene';

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 720,
  height: 780,
  backgroundColor: '#141814',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MapScene, QteScene, ResultScene, CodexScene],
  callbacks: {
    preBoot: (game) => {
      const rng = mulberry32(Date.now() >>> 0);
      const storage = safeStorage();
      game.registry.set('rng', rng);
      game.registry.set('codex', createCodex(storage));
      game.registry.set('i18n', createI18n(detectLocale(navigator.language), storage));
      game.registry.set('session', newSession(1, rng));
    },
  },
});
