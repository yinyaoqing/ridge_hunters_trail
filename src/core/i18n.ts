import type { Locale } from './types';

export type MsgKey =
  | 'hud.round' | 'hud.stamina' | 'hud.hint' | 'hud.mark'
  | 'qte.title' | 'qte.instruction' | 'qte.progress'
  | 'result.recorded'
  | 'result.escaped.title' | 'result.escaped.body'
  | 'result.exhausted.title' | 'result.exhausted.body'
  | 'result.quality' | 'result.notes' | 'result.research' | 'result.copied'
  | 'btn.next' | 'btn.retry' | 'btn.guide' | 'btn.back' | 'btn.start'
  | 'btn.camp' | 'btn.copy'
  | 'help.title' | 'help.goal'
  | 'help.footprint' | 'help.disturbance' | 'help.scent'
  | 'help.decoy' | 'help.stamina' | 'help.mark' | 'help.qte' | 'help.terrain'
  | 'camp.continue' | 'camp.daily' | 'camp.dailyDone' | 'camp.streak'
  | 'quality.bronze' | 'quality.silver' | 'quality.gold'
  | 'codex.title' | 'codex.count' | 'codex.unknown' | 'codex.notRecorded'
  | 'codex.research' | 'codex.rumored' | 'codex.quirk'
  | 'share.stats'
  | 'tool.windstone.name' | 'tool.windstone.desc'
  | 'tool.glowbell.name' | 'tool.glowbell.desc'
  | 'result.toolUnlocked' | 'hud.bell'
  | 'comm.title' | 'comm.record' | 'comm.stamina' | 'comm.quality' | 'comm.done' | 'comm.reward'
  | 'tut.move' | 'tut.read' | 'tut.cross' | 'tut.qte';

export const STRINGS: Record<Locale, Record<MsgKey, string>> = {
  en: {
    'hud.round': 'Round {n}',
    'hud.stamina': 'Stamina {n}',
    'hud.hint': 'Move: click/arrow keys · Mark: Shift+click',
    'hud.mark': 'Mark',
    'qte.title': 'Close Encounter',
    'qte.instruction': 'Tap or press SPACE when the needle crosses the glowing arc',
    'qte.progress': 'Hits {hits}/{needed}   Attempts {attempt}/{rounds}',
    'result.recorded': '{name} recorded!',
    'result.escaped.title': 'It slipped away into the mist...',
    'result.escaped.body': 'The trail went cold. Every clue is lost — start the tracking again.',
    'result.exhausted.title': 'You ran out of stamina.',
    'result.exhausted.body': 'Rest up. The mountain keeps its secrets for now.',
    'result.quality': 'Record quality',
    'result.notes': 'Field notes +{n}',
    'result.research': 'Research {cur} / {next}',
    'result.copied': 'Copied!',
    'btn.next': '[ Next Hunt ]',
    'btn.retry': '[ Track Again ]',
    'btn.guide': '[ Field Guide ]',
    'btn.back': '[ Back to Trail ]',
    'btn.start': '[ Begin the Hunt ]',
    'btn.camp': '[ Back to Camp ]',
    'btn.copy': '[ Copy Result ]',
    'help.title': 'How to Play',
    'help.goal': 'Read the clues a creature leaves behind, deduce where it hides, and get close enough to record it in your field guide. No harm done — if you fail, it simply slips away.',
    'help.footprint': 'Footprint — points roughly toward the creature, within the shown cone.',
    'help.disturbance': 'Disturbance — the creature is somewhere inside this circle.',
    'help.scent': 'Scent — the creature sits at this distance, along the ring.',
    'help.decoy': 'Some trails lie. From round 4, decoy clues appear — cross-check before you commit.',
    'help.stamina': 'Every step costs stamina; thickets and rock cost more. Mistleaf and dewfruit restore it.',
    'help.mark': 'Shift+click marks a cell for your notes. Step onto a clue to read it.',
    'help.qte': 'Up close, tap or press SPACE when the needle sweeps the glowing arc.',
    'help.terrain': 'Terrain costs stamina: meadow/mist 1 · thicket/rock 2.',
    'camp.continue': 'Hit the Trail · Round {n}',
    'camp.daily': "Today's Trail",
    'camp.dailyDone': 'Done today',
    'camp.streak': 'Streak {n}',
    'quality.bronze': 'Bronze Record',
    'quality.silver': 'Silver Record',
    'quality.gold': 'Gold Record',
    'codex.title': 'Field Guide',
    'codex.count': '{found} / {total} recorded',
    'codex.unknown': '???',
    'codex.notRecorded': 'Not yet recorded',
    'codex.research': 'Research',
    'codex.rumored': 'Traces found in the field...',
    'codex.quirk': 'Field instinct',
    'share.stats': 'Steps {steps} · Stamina {stam} · Streak {streak}',
    'tool.windstone.name': 'Windstone',
    'tool.windstone.desc': 'Scent rings now lean toward the source.',
    'tool.glowbell.name': 'Glowbell',
    'tool.glowbell.desc': 'Once per hunt, rings out one false trail.',
    'result.toolUnlocked': 'New tool: {name}',
    'hud.bell': 'Bell',
    'comm.title': 'Notice Board',
    'comm.record': 'Record {name}',
    'comm.stamina': 'Finish a hunt with {n}+ stamina',
    'comm.quality': 'Earn a {q} record or better',
    'comm.done': 'Done',
    'comm.reward': '+{n} field notes',
    'tut.move': 'See that marker? Walk over and read it.',
    'tut.read': 'A clue! The creature is somewhere it points to.',
    'tut.cross': 'Two clues overlap — the truth hides where both agree.',
    'tut.qte': 'You are close. Get ready to tap in rhythm!',
  },
  'zh-TW': {
    'hud.round': '第 {n} 局',
    'hud.stamina': '體力 {n}',
    'hud.hint': '移動：點擊/方向鍵 · 標記：Shift+點擊',
    'hud.mark': '標記',
    'qte.title': '近距離判讀',
    'qte.instruction': '指針掃過發光弧區時點擊或按空白鍵',
    'qte.progress': '命中 {hits}/{needed}   嘗試 {attempt}/{rounds}',
    'result.recorded': '已記錄 {name}！',
    'result.escaped.title': '牠溜進霧裡了……',
    'result.escaped.body': '蹤跡已冷，線索全數消散——重新開始追蹤吧。',
    'result.exhausted.title': '體力耗盡了。',
    'result.exhausted.body': '休息一下，山林暫時守住了牠的祕密。',
    'result.quality': '記錄品質',
    'result.notes': '觀察筆記 +{n}',
    'result.research': '研究度 {cur} / {next}',
    'result.copied': '已複製！',
    'btn.next': '［下一場狩獵］',
    'btn.retry': '［重新追蹤］',
    'btn.guide': '［生態圖鑑］',
    'btn.back': '［返回山徑］',
    'btn.start': '［開始追蹤］',
    'btn.camp': '［返回營地］',
    'btn.copy': '［複製成績］',
    'help.title': '玩法說明',
    'help.goal': '判讀生物留下的線索，推理出牠的藏身處，悄悄接近並記入圖鑑。全程無傷害——失敗時牠只是悄悄溜走。',
    'help.footprint': '足跡——大致指向生物所在，方向落在顯示的錐形範圍內。',
    'help.disturbance': '擾動——生物就在這個圓域範圍之中。',
    'help.scent': '氣味——生物位於這個距離的環帶上。',
    'help.decoy': '有些蹤跡會說謊。第 4 局起會出現干擾線索，下判斷前先交叉比對。',
    'help.stamina': '每一步都消耗體力；密叢與岩坡消耗更多。霧葉與露珠果可以回復體力。',
    'help.mark': 'Shift+點擊可在格子上做標記筆記；踩上線索即可判讀。',
    'help.qte': '逼近目標後，趁指針掃過發光弧區時點擊或按空白鍵。',
    'help.terrain': '地形消耗體力：草地／霧地 1 ・密叢／岩坡 2。',
    'camp.continue': '上山追蹤｜第 {n} 局',
    'camp.daily': '今日行蹤',
    'camp.dailyDone': '今日已完成',
    'camp.streak': '連勝 {n}',
    'quality.bronze': '銅級記錄',
    'quality.silver': '銀級記錄',
    'quality.gold': '金級記錄',
    'codex.title': '生態圖鑑',
    'codex.count': '已記錄 {found} / {total} 種',
    'codex.unknown': '？？？',
    'codex.notRecorded': '尚未記錄',
    'codex.research': '研究度',
    'codex.rumored': '山野間已見蹤跡……',
    'codex.quirk': '判讀心得',
    'share.stats': '步數 {steps}｜剩餘體力 {stam}｜連勝 {streak}',
    'tool.windstone.name': '風向石',
    'tool.windstone.desc': '氣味環將偏向來源方向。',
    'tool.glowbell.name': '微光鈴',
    'tool.glowbell.desc': '每局一次，辨明一條假蹤跡。',
    'result.toolUnlocked': '獲得道具：{name}',
    'hud.bell': '鈴',
    'comm.title': '委託板',
    'comm.record': '記錄{name}',
    'comm.stamina': '以 ≥{n} 體力完成一局',
    'comm.quality': '取得{q}以上記錄',
    'comm.done': '已完成',
    'comm.reward': '觀察筆記 +{n}',
    'tut.move': '看到那個記號了嗎？走過去判讀。',
    'tut.read': '線索！牠就在這指向的範圍裡。',
    'tut.cross': '兩條線索重疊——真相藏在交集之處。',
    'tut.qte': '很近了，準備節奏點擊！',
  },
};

const STORAGE_KEY = 'rht.locale.v1';

export interface I18n {
  locale(): Locale;
  setLocale(l: Locale): void;
  t(key: MsgKey, vars?: Record<string, string | number>): string;
}

export function detectLocale(lang: string | undefined | null): Locale {
  return (lang ?? '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

export function createI18n(initial: Locale, storage?: Pick<Storage, 'getItem' | 'setItem'>): I18n {
  let current: Locale = initial;
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh-TW') current = saved;
    } catch {
      // storage 不可用時沿用 initial
    }
  }
  return {
    locale: () => current,
    setLocale(l: Locale) {
      current = l;
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, l);
      } catch {
        // 靜默退回記憶體
      }
    },
    t(key, vars) {
      let s = STRINGS[current][key];
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
  };
}
