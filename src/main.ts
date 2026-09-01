import Phaser from 'phaser';
import { mulberry32 } from './core/rng';
import { newSession } from './core/session';
import { createCodex } from './core/codex';
import { createI18n, detectLocale } from './core/i18n';
import { createStreak } from './core/daily';
import { createRunState } from './core/runstate';
import { createAudio } from './core/audio';
import { createTools } from './core/tools';
import { BootScene } from './scenes/BootScene';
import { CampScene } from './scenes/CampScene';
import { MapScene } from './scenes/MapScene';
import { QteScene } from './scenes/QteScene';
import { ResultScene } from './scenes/ResultScene';
import { CodexScene } from './scenes/CodexScene';
import { HelpScene } from './scenes/HelpScene';

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function launch(): void {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#131a17',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, CampScene, MapScene, QteScene, ResultScene, CodexScene, HelpScene],
    callbacks: {
      preBoot: (game) => {
        const rng = mulberry32(Date.now() >>> 0);
        const storage = safeStorage();
        game.registry.set('rng', rng);
        game.registry.set('storage', storage);
        game.registry.set('codex', createCodex(storage));
        game.registry.set('i18n', createI18n(detectLocale(navigator.language), storage));
        game.registry.set('session', newSession(1, rng));
        const runState = createRunState(storage);
        game.registry.set('runState', runState);
        game.registry.set('runRound', runState.round());
        game.registry.set('streak', createStreak(storage));
        game.registry.set('tools', createTools(storage));
        // Safari 舊版無 window.AudioContext，退回 webkitAudioContext 前綴；
        // 皆缺席時 factory 內 throw，createAudio 會靜默降級為無聲
        game.registry.set('audio', createAudio(storage, () => new (
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )()));
      },
    },
  });
}

// 等 Marcellus/Karla 就緒再啟動（避免 Canvas 文字先以後備字體渲染）；
// 逾時或字體 API 不可用時直接啟動，後備字體照常運作。
let launched = false;
const launchOnce = () => {
  if (!launched) {
    launched = true;
    launch();
  }
};
try {
  Promise.all([
    document.fonts.load('20px Marcellus'),
    document.fonts.load('16px Karla'),
  ]).then(launchOnce, launchOnce);
} catch {
  launchOnce();
}
setTimeout(launchOnce, 1500);
