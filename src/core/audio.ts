// 程序合成音效：零素材檔。所有失敗（無 AudioContext、被瀏覽器擋）一律靜默。
export type SfxName = 'click' | 'reveal' | 'pickup' | 'hit' | 'miss' | 'caught' | 'escaped';

export interface AudioBus {
  enabled(): boolean;
  toggle(): boolean;
  play(name: SfxName): void;
  ambient(on: boolean): void;
  // 標記已取得使用者手勢（點擊/觸控），解除瀏覽器 autoplay 政策的靜音鎖；
  // 冪等——重複呼叫安全。解鎖前 play()/ambient(true) 一律不建立 AudioContext。
  unlock(): void;
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
  let windSrc: AudioBufferSourceNode | null = null;
  let windLp: BiquadFilterNode | null = null;
  // Chrome/Safari 等瀏覽器的 autoplay 政策：AudioContext 建立時預設 suspended，
  // 需一次使用者手勢（點擊/觸控/按鍵）才能 resume()。unlock() 前一律不建立 context、
  // 不啟動環境音；unlock() 後若有暫存的環境音請求（pendingAmbient）立即補放。
  let gestureSeen = false;
  let pendingAmbient = false;

  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, on ? '1' : '0'); } catch { /* 靜默 */ }
  };

  // 部分瀏覽器會在背景分頁/閒置後自動把既有 context 轉回 suspended；
  // 每次要出聲前都嘗試 resume 一次（reject 靜默吞掉，不影響其餘邏輯）。
  const resumeIfSuspended = (c: AudioContext) => {
    if (c.state === 'suspended') {
      try { c.resume().catch(() => { /* 靜默 */ }); } catch { /* 靜默 */ }
    }
  };

  const getCtx = (): AudioContext | null => {
    if (ctx) return ctx;
    if (ctxFailed || !ctxFactory) return null;
    try {
      ctx = ctxFactory();
      resumeIfSuspended(ctx);
      return ctx;
    } catch {
      ctxFailed = true; // 記憶失敗，不重試轟炸
      return null;
    }
  };

  const startAmbient = () => {
    if (!on || windGain) return;
    const c = getCtx();
    if (!c) return;
    resumeIfSuspended(c);
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
      const gain = c.createGain();
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.setTargetAtTime(0.05, c.currentTime, 0.8);
      src.connect(lp).connect(gain).connect(c.destination);
      src.start();
      windGain = gain;
      windSrc = src;
      windLp = lp;
    } catch {
      windGain = null;
      windSrc = null;
      windLp = null;
    }
  };

  // 停止環境音：淡出增益後才真正 stop() BufferSource 並在 onended 中斷開三個節點的
  // 連線，避免每次場景循環（Camp↔Map）都留下一條仍在跑的音訊子圖（buffer + CPU 洩漏）。
  const stopAmbient = () => {
    pendingAmbient = false;
    if (!windGain || !ctx) return;
    const c = ctx;
    const gain = windGain;
    const src = windSrc;
    const lp = windLp;
    try { gain.gain.setTargetAtTime(0, c.currentTime, 0.3); } catch { /* 靜默 */ }
    if (src) {
      try {
        src.stop(c.currentTime + 1);
        src.onended = () => {
          try { src.disconnect(); } catch { /* 靜默 */ }
          try { lp?.disconnect(); } catch { /* 靜默 */ }
          try { gain.disconnect(); } catch { /* 靜默 */ }
        };
      } catch { /* 靜默：stop 失敗時仍清空參照，避免重複嘗試關閉 */ }
    }
    windGain = null;
    windSrc = null;
    windLp = null;
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
      // 解鎖前不建立/使用 AudioContext：所有音效皆由使用者手勢觸發（點擊/QTE 按鍵），
      // 此處僅作防禦性保險，避免任何未來呼叫路徑繞過手勢就嘗試出聲。
      if (!gestureSeen || !on) return;
      const c = getCtx();
      if (!c) return;
      resumeIfSuspended(c);
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
      if (!gestureSeen) { pendingAmbient = true; return; } // 手勢前只暫存請求，不建立 context
      startAmbient();
    },
    unlock() {
      if (gestureSeen) return; // 冪等：重複呼叫（多個 chip/場景 hook）安全
      gestureSeen = true;
      if (pendingAmbient) {
        pendingAmbient = false;
        startAmbient();
      }
    },
  };
}
