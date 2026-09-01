// 程序合成音效：零素材檔。所有失敗（無 AudioContext、被瀏覽器擋）一律靜默。
export type SfxName = 'click' | 'reveal' | 'pickup' | 'hit' | 'miss' | 'caught' | 'escaped';

export interface AudioBus {
  enabled(): boolean;
  toggle(): boolean;
  play(name: SfxName): void;
  ambient(on: boolean): void;
}

const KEY = 'rht.audio.v1';

// 各音色配方：type/頻率序列/時值。集中一處便於調音。
const RECIPES: Record<SfxName, { type: OscillatorType; freqs: number[]; dur: number; gain: number }> = {
  click:   { type: 'sine',     freqs: [800],            dur: 0.05, gain: 0.12 },
  reveal:  { type: 'sine',     freqs: [520, 880],       dur: 0.22, gain: 0.15 },
  pickup:  { type: 'sine',     freqs: [660, 990],       dur: 0.16, gain: 0.15 },
  hit:     { type: 'triangle', freqs: [880],            dur: 0.09, gain: 0.18 },
  miss:    { type: 'square',   freqs: [180],            dur: 0.12, gain: 0.10 },
  caught:  { type: 'sine',     freqs: [523, 659, 784],  dur: 0.34, gain: 0.16 },
  escaped: { type: 'sine',     freqs: [440, 220],       dur: 0.40, gain: 0.12 },
};

export function createAudio(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
  ctxFactory?: () => AudioContext,
): AudioBus {
  let on = true;
  if (storage) {
    try {
      const saved = storage.getItem(KEY);
      if (saved === '0' || saved === '1') on = saved === '1';
    } catch { /* 沿用預設 */ }
  }
  let ctx: AudioContext | null = null;
  let ctxFailed = false;
  let windGain: GainNode | null = null;

  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, on ? '1' : '0'); } catch { /* 靜默 */ }
  };

  const getCtx = (): AudioContext | null => {
    if (ctx) return ctx;
    if (ctxFailed || !ctxFactory) return null;
    try {
      ctx = ctxFactory();
      return ctx;
    } catch {
      ctxFailed = true; // 記憶失敗，不重試轟炸
      return null;
    }
  };

  const stopAmbient = () => {
    if (windGain && ctx) {
      try { windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); } catch { /* 靜默 */ }
      windGain = null;
    }
  };

  return {
    enabled: () => on,
    toggle() {
      on = !on;
      if (!on) stopAmbient();
      persist();
      return on;
    },
    play(name) {
      if (!on) return;
      const c = getCtx();
      if (!c) return;
      try {
        const r = RECIPES[name];
        const t0 = c.currentTime;
        const g = c.createGain();
        g.gain.setValueAtTime(r.gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + r.dur);
        g.connect(c.destination);
        const step = r.dur / r.freqs.length;
        r.freqs.forEach((f, i) => {
          const o = c.createOscillator();
          o.type = r.type;
          o.frequency.setValueAtTime(f, t0 + i * step);
          o.connect(g);
          o.start(t0 + i * step);
          o.stop(t0 + r.dur + 0.02);
        });
      } catch { /* 靜默 */ }
    },
    ambient(onOff) {
      if (!onOff) { stopAmbient(); return; }
      if (!on || windGain) return;
      const c = getCtx();
      if (!c) return;
      try {
        // 風聲：2 秒白噪音 buffer 循環 + lowpass + 微弱增益
        // Math.random 僅用於噪音波形——非遊戲邏輯隨機性，不受種子 RNG 約束
        const len = c.sampleRate * 2;
        const buf = c.createBuffer(1, len, c.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // 平滑化噪音（風感）
          data[i] = last * 6;
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 400;
        windGain = c.createGain();
        windGain.gain.setValueAtTime(0, c.currentTime);
        windGain.gain.setTargetAtTime(0.05, c.currentTime, 0.8);
        src.connect(lp).connect(windGain).connect(c.destination);
        src.start();
      } catch { windGain = null; }
    },
  };
}
