// 生物剪影向量素材：取自美術方向板（docs/design/ArtDirection.dc.html）。
// 全部為原創虛構造型；INK = 剪影墨色、ACCENT = 單點發光細節（依配色循環）。
// 以 data URI 交給 Phaser 當貼圖，零外部素材檔。

const SHAPES: Record<string, string> = {
  mistfawn: `
    <g fill="INK">
      <path d="M-32 -4 Q-34 -14 -22 -16 Q-2 -20 12 -14 Q14 -24 20 -28 L22 -38 L25 -29 L32 -34 L30 -26 Q36 -24 34 -18 L26 -14 Q30 -6 22 -2 Q4 4 -14 2 Q-28 4 -32 -4 Z"/>
      <rect x="-30" y="0" width="4.5" height="26" rx="2"/><rect x="-20" y="1" width="4.5" height="25" rx="2"/>
      <rect x="8" y="0" width="4.5" height="26" rx="2"/><rect x="17" y="-2" width="4.5" height="28" rx="2"/>
    </g>
    <circle cx="24" cy="-24" r="1.8" fill="ACCENT"/>
    <circle cx="-36" cy="-10" r="4" fill="ACCENT" opacity="0.3"/>
    <circle cx="-42" cy="-14" r="2.5" fill="ACCENT" opacity="0.2"/>`,
  emberquill: `
    <g fill="INK">
      <path d="M-26 8 Q-30 -10 -12 -16 L-14 -24 L-6 -18 L-6 -26 L0 -18 L4 -26 L8 -17 L14 -22 L14 -13 Q26 -8 26 4 Q26 12 14 12 L-16 12 Q-24 12 -26 8 Z"/>
      <path d="M26 4 Q34 3 34 8 Q31 12 24 10 Z"/>
      <rect x="-18" y="12" width="4" height="10" rx="2"/><rect x="12" y="12" width="4" height="10" rx="2"/>
    </g>
    <circle cx="20" cy="0" r="1.8" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.6"><circle cx="-13" cy="-25" r="1.4"/><circle cx="-5" cy="-27" r="1.4"/><circle cx="5" cy="-27" r="1.4"/><circle cx="14" cy="-23" r="1.4"/></g>`,
  thicketloom: `
    <g fill="INK">
      <path d="M-8 -6 Q-8 -20 4 -20 Q16 -20 16 -8 Q16 6 0 10 L-24 30 Q-8 8 -10 0 Q-10 -4 -8 -6 Z"/>
      <path d="M16 -14 L26 -11 L16 -8 Z"/>
    </g>
    <path d="M-2 10 Q-2 20 6 24 Q12 26 14 20" stroke="INK" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="9" cy="-13" r="1.8" fill="ACCENT"/>`,
  dewhopper: `
    <g fill="INK">
      <path d="M-20 10 Q-30 2 -22 -8 Q-16 -16 -4 -14 Q0 -22 6 -22 L4 -14 L12 -20 L8 -12 Q18 -8 16 2 Q14 12 0 12 L-16 12 Z"/>
      <circle cx="-12" cy="2" r="10"/>
    </g>
    <circle cx="6" cy="-10" r="1.8" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.35"><circle cx="22" cy="8" r="2"/><circle cx="27" cy="3" r="1.3"/></g>`,
  veilmoth: `
    <g fill="INK">
      <path d="M0 -4 Q-26 -26 -34 -8 Q-36 6 -14 6 Q-24 22 -8 18 Q-2 16 0 8 Z"/>
      <path d="M0 -4 Q26 -26 34 -8 Q36 6 14 6 Q24 22 8 18 Q2 16 0 8 Z"/>
      <ellipse cx="0" cy="2" rx="3.2" ry="11"/>
    </g>
    <path d="M-2 -12 Q-6 -20 -12 -22 M2 -12 Q6 -20 12 -22" stroke="INK" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="-16" cy="-6" r="2.6" fill="ACCENT" opacity="0.8"/>
    <circle cx="16" cy="-6" r="2.6" fill="ACCENT" opacity="0.8"/>`,
  lanternshrew: `
    <g fill="INK">
      <path d="M-18 6 Q-22 -10 -4 -12 Q10 -14 16 -4 L27 -7 L18 3 Q16 10 0 10 L-14 10 Z"/>
      <rect x="-12" y="10" width="4" height="8" rx="2"/><rect x="6" y="10" width="4" height="8" rx="2"/>
    </g>
    <path d="M-18 4 Q-30 6 -32 -4 Q-33 -10 -28 -12" stroke="INK" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="14" cy="-4" r="1.8" fill="ACCENT"/>
    <circle cx="4" cy="1" r="4" fill="ACCENT" opacity="0.55"/>
    <circle cx="4" cy="1" r="7" fill="ACCENT" opacity="0.18"/>`,
  ridgecrest: `
    <g fill="INK">
      <path d="M-30 6 Q-40 4 -36 -2 L-20 0 Q-18 -8 -8 -8 L-6 -14 L-2 -9 L2 -15 L5 -9 L10 -13 L11 -7 Q20 -6 22 0 Q24 6 14 8 L-24 8 Z"/>
      <rect x="-20" y="8" width="4" height="8" rx="2"/><rect x="10" y="8" width="4" height="8" rx="2"/>
    </g>
    <circle cx="16" cy="-2" r="1.8" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.5"><circle cx="-6" cy="-13" r="1.2"/><circle cx="2" cy="-14" r="1.2"/><circle cx="10" cy="-12" r="1.2"/></g>`,
  plumetail: `
    <g fill="INK">
      <path d="M-2 -8 Q0 -18 8 -18 L8 -26 L14 -18 L20 -26 L20 -17 Q28 -14 26 -6 Q24 0 14 2 L14 12 L10 12 L10 2 L-2 2 Z"/>
      <path d="M-2 2 Q-30 6 -32 -16 Q-18 -16 -10 -6 Q-14 -14 -4 -10 Z"/>
    </g>
    <circle cx="18" cy="-12" r="1.8" fill="ACCENT"/>
    <g fill="ACCENT" opacity="0.35"><circle cx="-26" cy="-2" r="1.6"/><circle cx="-33" cy="-8" r="1.2"/></g>`,
};

export function silhouetteSvg(id: string, ink: string, accent: string): string {
  const shape = SHAPES[id];
  if (!shape) throw new Error(`unknown creature silhouette: ${id}`);
  const body = shape.replaceAll('INK', ink).replaceAll('ACCENT', accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-52 -48 104 88" width="208" height="176">${body}</svg>`;
}

export function silhouetteDataUri(id: string, ink: string, accent: string): string {
  const svg = silhouetteSvg(id, ink, accent);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
