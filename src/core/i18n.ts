import type { Locale } from './types';

export type MsgKey =
  | 'hud.round' | 'hud.stamina' | 'hud.step' | 'hud.hint' | 'hud.mark'
  | 'qte.title' | 'qte.instruction' | 'qte.progress'
  | 'result.recorded'
  | 'result.escaped.title' | 'result.escaped.body'
  | 'result.exhausted.title' | 'result.exhausted.body'
  | 'result.quality' | 'result.notes' | 'result.research' | 'result.copied'
  | 'btn.retry' | 'btn.guide' | 'btn.back' | 'btn.start'
  | 'btn.camp' | 'btn.copy'
  | 'help.title' | 'help.goal'
  | 'help.footprint' | 'help.disturbance' | 'help.scent'
  | 'help.decoy' | 'help.stamina' | 'help.qte' | 'help.weather'
  | 'weather.clear' | 'weather.mist' | 'weather.wind' | 'weather.drizzle'
  | 'camp.continue' | 'camp.daily' | 'camp.dailyDone' | 'camp.streak'
  | 'quality.bronze' | 'quality.silver' | 'quality.gold'
  | 'codex.title' | 'codex.count' | 'codex.unknown' | 'codex.notRecorded'
  | 'codex.research' | 'codex.rumored' | 'codex.quirk'
  | 'share.stats'
  | 'iris.prefix'
  | 'tool.windstone.name' | 'tool.windstone.desc'
  | 'tool.glowbell.name' | 'tool.glowbell.desc'
  | 'result.toolUnlocked' | 'hud.bell'
  | 'comm.title' | 'comm.record' | 'comm.stamina' | 'comm.quality' | 'comm.done' | 'comm.reward'
  | 'tut.move' | 'tut.read' | 'tut.cross' | 'tut.qte'
  | 'hud.layer' | 'hud.muted'
  | 'mark.exclude' | 'mark.suspect' | 'mark.wager'
  | 'reveal.title' | 'reveal.wasHere' | 'reveal.yourCall' | 'reveal.exact' | 'reveal.offBy'
  | 'reveal.noCall' | 'reveal.decoy' | 'reveal.infoAt' | 'reveal.dailyHidden'
  | 'btn.continue'
  | 'help.marks' | 'help.layer' | 'help.reveal'
  | 'hud.survey' | 'hud.surveyCost' | 'hud.pathCost'
  | 'help.vision' | 'help.survey' | 'help.route'
  | 'score.gain' | 'score.pot' | 'score.lost' | 'btn.bank' | 'btn.push' | 'camp.best' | 'camp.carry'
  | 'demo.title' | 'demo.progress' | 'demo.fromResult'
  | 'demo.ch1' | 'demo.ch2' | 'demo.ch3' | 'demo.ch4'
  | 'demo.s1' | 'demo.s2' | 'demo.s3' | 'demo.s4' | 'demo.s5' | 'demo.s6' | 'demo.s7'
  | 'demo.s8' | 'demo.s9' | 'demo.s10' | 'demo.s11' | 'demo.s12' | 'demo.s13' | 'demo.s14'
  | 'demo.hint.exclude' | 'demo.hint.mute' | 'demo.hint.wager'
  | 'btn.demo' | 'btn.next' | 'btn.prev'
  | 'demo2.title' | 'demo2.ch1' | 'demo2.ch2' | 'demo2.ch3'
  | 'demo2.s1' | 'demo2.s2' | 'demo2.s3' | 'demo2.s4' | 'demo2.s5'
  | 'demo2.s6' | 'demo2.s7' | 'demo2.s8'
  | 'demo2.hint.wager' | 'demo2.hint.mute' | 'btn.demo2'
  | 'age.fresh' | 'age.night' | 'age.older' | 'age.all'
  | 'reveal.route'
  | 'coach.event.startle' | 'coach.event.supply' | 'coach.event.oldtrail'
  | 'coach.supply' | 'coach.age' | 'coach.bankpush' | 'coach.iris'
  | 'coach.route' | 'coach.quality' | 'coach.infoAt'
  | 'rule.lowland' | 'rule.highland' | 'rule.cover' | 'rule.straight' | 'rule.doubling'
  | 'help.sec.track' | 'help.sec.deduce' | 'help.sec.ground' | 'help.sec.longRun'
  | 'help.quarry' | 'help.habit' | 'help.age' | 'help.score' | 'help.iris'
  | 'help.events' | 'help.supply' | 'help.mute' | 'help.infoAt' | 'help.quirk'
  | 'help.progress' | 'help.tools' | 'help.codex' | 'help.commission' | 'help.daily'
  | 'help.wx.clear' | 'help.wx.mist' | 'help.wx.wind' | 'help.wx.drizzle'
  | 'coach.tool.windstone' | 'coach.tool.glowbell'
  | 'coach.codex' | 'coach.commission' | 'coach.daily';

export const STRINGS: Record<Locale, Record<MsgKey, string>> = {
  en: {
    'hud.round': 'Round {n}',
    'hud.stamina': 'Stamina {n}',
    'hud.step': 'Step {n}',
    'hud.hint': 'Move: click/arrow keys · Look: space · Mark: Shift+click',
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
    'help.stamina': 'Every step costs stamina — meadow and fog 1, thicket 2, scree 4. Cliffs cannot be crossed. Mistleaf and dewfruit restore it.',
    'help.qte': 'Up close, tap or press SPACE when the needle sweeps the glowing arc.',
    'help.weather': 'Weather shifts how clues read: mist blurs, wind scatters scent, drizzle sharpens tracks.',
    'weather.clear': 'Clear',
    'weather.mist': 'Misty',
    'weather.wind': 'Windy',
    'weather.drizzle': 'Drizzle',
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
    'iris.prefix': 'Iridescent ',
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
    // F3（owner 核准改字）：獵物現在會沿路線走，「牠就在這指向的範圍裡」只在讀到的
    // 剛好是最新齡線索時為真（實測僅 37.5%）。改成過去式——線索永遠精確錨定在
    // 「牠留下痕跡當下」所在的節點，這句話因此不論齡別都恆真，不再暗示「現在」。
    'tut.read': 'A clue! It shows where the creature was, not where it is now.',
    // 同理改過去式：同齡交集在幾何上保證含該齡節點（checkTutStep1to2 只餵同齡真線索），
    // 但那是「牠當時」所在，不是「牠現在」所在——舊句「真相藏在交集之處」用現在式
    // 暗示交集等於現在的位置，只有 38.1% 為真。
    'tut.cross': "Two clues of the same freshness agree — that's where the creature was at that moment.",
    'tut.qte': 'You are close. Get ready to tap in rhythm!',
    'score.gain': '+{n} pts',
    'score.pot': 'Unbanked {n}',
    'score.lost': 'The unbanked haul faded into the mist... banked points are safe.',
    'btn.bank': '[ Rest & Bank ]',
    'btn.push': '[ Push On x{m} ]',
    'camp.best': 'Best run {n}',
    'camp.carry': 'Banked {b} · Unbanked {p}',
    'hud.layer': 'Layer',
    'hud.muted': 'Muted',
    'mark.exclude': 'Ruled out',
    'mark.suspect': 'Maybe',
    'mark.wager': 'My call',
    'reveal.title': 'The Reveal',
    'reveal.wasHere': 'It was here',
    'reveal.yourCall': 'Your call',
    'reveal.exact': 'You called it exactly.',
    'reveal.offBy': 'You were {n} cells off.',
    'reveal.noCall': 'You made no call this hunt — mark a cell gold next time.',
    'reveal.decoy': 'This false trail led you astray.',
    'reveal.infoAt': 'You had the sharpest reading available by step {n}, and walked to step {m}.',
    'reveal.dailyHidden': "Today's trail keeps its secret — everyone is hunting the same map.",
    'btn.continue': '[ Continue ]',
    'help.marks': 'Mark a cell again and again to cycle it: ruled out, maybe, my call. Your call sets your record quality.',
    'help.layer': 'Layer shades each cell by how many read clues of one freshness agree — the chip beside it picks which. Mark a clue you already read to mute it.',
    'help.reveal': 'Every hunt ends by revealing where it really was and how close your call landed.',
    'hud.survey': 'Look',
    'hud.surveyCost': '-{n} to look around',
    'hud.pathCost': '{n}',
    'help.vision': 'You only see the ground near you. High ground sees further; thickets close in.',
    'help.survey': 'Look costs stamina and sweeps the ground around you, uncovering clues you have not walked past.',
    'help.route': 'Click a distant cell to preview the route and its cost, then click again to walk it. Walking stops the moment you read something new.',
    'help.sec.track': 'READING THE TRAIL',
    'help.sec.deduce': 'WORKING IT OUT',
    'help.sec.ground': 'GROUND & STAMINA',
    'help.sec.longRun': 'THE LONG RUN',
    'demo.title': 'Deduction Walkthrough',
    'demo.progress': '{n} / {total}',
    'demo.fromResult': 'Not sure how to read the clues? Walk through a hunt step by step.',
    'demo.ch1': 'One clue only rules places out',
    'demo.ch2': 'The overlap is the answer',
    'demo.ch3': 'The odd one out is lying',
    'demo.ch4': 'Look around, then call it',
    'demo.s1': '{n} cells. It hides in one of them. A clue never names the cell — it only rules others out.',
    'demo.s2': 'Read the footprint: it heads northeast. It is somewhere inside this cone — {n} cells.',
    'demo.s3': 'So the {n} cells outside the cone are impossible. Pick one and rule it out.',
    'demo.s4': 'A second clue: scent. It sits on the ring, {n} cells out from here.',
    'demo.s5': 'Layer them. The more clues a cell agrees with, the brighter it burns — and only {n} cells agree with both. This is what the Layer button does.',
    'demo.s6': 'A third clue, another footprint. But this one points northwest.',
    'demo.s7': 'Now no cell on the map satisfies all three. They cannot all be true, so one of them is lying.',
    'demo.s8': 'Count the agreements: {n} cells match two clues, none match three. Two corroborate each other; the leftover agrees with nobody.',
    'demo.s9': 'Mute the one that lies. Click its marker.',
    'demo.s10': 'Still {n} cells — too many. And the far ground is dark to you. Walk toward the overlap.',
    'demo.s11': 'Look around. The mist pulls back and a fourth clue surfaces — looking is not only how you find clues, it is how you open up ground to plan through.',
    'demo.s12': 'Now the three honest clues agree on one cell, and one cell only.',
    'demo.s13': 'That is the one. Call it.',
    'demo.s14': 'It was here. Read, layer, discard, look, call — every hunt is these five things.',
    'demo.hint.exclude': 'That cell is still inside the cone, so it is still possible. Pick one outside it.',
    'demo.hint.mute': 'That clue corroborates another one. Look again — which clue agrees with nobody?',
    'demo.hint.wager': 'That cell does not satisfy all three clues. Only one cell does.',
    'btn.demo': '[ Walkthrough ]',
    'btn.next': '[ Next ]',
    'btn.prev': '[ Back ]',
    'demo2.title': 'The Walking Quarry',
    'demo2.ch1': 'It did not stay put',
    'demo2.ch2': 'One age at a time',
    'demo2.ch3': 'Lead it',
    'demo2.s1': 'Six clues, all honest. Layer them all and {n} cells agree with everything — none.',
    'demo2.s2': 'Nothing is lying. The clues disagree because it was walking: each one marks where it passed.',
    'demo2.s3': 'Every clue carries a freshness. These six are three pairs — older, night, morning.',
    'demo2.s4': 'Set the freshness chip to the newest age. Only two clues left.',
    'demo2.s5': 'Those two agree on one cell. That is where it was this morning.',
    'demo2.s6': 'Do the same for the other two ages and you get three cells — where it was, in order.',
    'demo2.s7': 'Three cells in a line, evenly spaced. It is still walking. Call the next one.',
    'demo2.s8': 'There it was. Clues say where it has been; freshness says when; together they say where it is going.',
    'demo2.hint.wager': 'That is where it was, not where it is heading. Step one more along the line.',
    'demo2.hint.mute': 'Nothing here is lying — all six clues are honest. They disagree because they belong to different moments.',
    'btn.demo2': '[ Walkthrough: Moving Quarry ]',
    'age.fresh': 'Morning',
    'age.night': 'Night',
    'age.older': 'Older',
    'age.all': 'All',
    'reveal.route': 'It was moving. The trail below is where it walked, oldest to newest.',
    'rule.lowland': 'Follows the valley floor',
    'rule.highland': 'Keeps to the ridgeline',
    'rule.cover': 'Hugs the thickets',
    'rule.straight': 'Travels in a straight line',
    'rule.doubling': 'Doubles back on itself',
    'coach.event.startle': 'Birds burst from cover — they flew away from where it is.',
    'coach.event.supply': 'You found extra forage at your feet. Stamina restored.',
    'coach.event.oldtrail': 'An old print underfoot. The bearing is rough — take it as a hint, not evidence.',
    'coach.supply': 'Mistleaf and dewfruit restore stamina. Plan your route through them.',
    'coach.age': 'These two clues are different ages. Only same-age clues can be crossed — use the freshness chip to pick one age at a time.',
    'coach.bankpush': 'Bank to keep the haul and rest. Push on to multiply it — but lose it all if the next trail goes cold.',
    'coach.iris': 'An iridescent one. Rare, and worth double.',
    'coach.route': 'It was walking the whole time. Clues sit where it passed, not where it went — read the freshest and lead it.',
    'coach.quality': 'Your call lands the record: dead on is gold, within two cells is silver, further is bronze.',
    'coach.infoAt': 'That step is when your clues first pinned one cell. Everything after it was walking, not deducing.',
    'help.quarry': 'It does not sit still. It walks a foraging route, so a clue marks where it passed — not where it went.',
    'help.habit': 'Each species walks its own way: the valley floor, the ridgeline, the thickets, a straight line, or doubling back. The reveal names it.',
    'help.age': 'Clues carry a freshness: morning, night, older. Only same-age clues can be crossed — the chip beside Layer picks which age you are reading.',
    'help.score': 'A record banks points. Rest to keep them, or push on to multiply the next haul — a failed hunt scatters everything unbanked.',
    'help.iris': 'Iridescent variants are rare and score double. You only know once you have recorded one.',
    'help.events': 'The mountain moves around you. Startled birds fly away from it, forage turns up underfoot, and old prints give a rough bearing.',
    'help.supply': 'Mistleaf and dewfruit restore stamina where they grow. Route through them on a long crossing.',
    'help.mute': 'Marking a cell you already read mutes that clue — it drops out of Layer. Use it on a trail you believe is lying.',
    'help.infoAt': 'The reveal names the step your clues first pinned one cell. Walking past it costs stamina and buys nothing.',
    'help.quirk': 'Species differ in how they read: some scatter their scent, some leave a tighter print. The field guide records each habit.',
    'help.progress': 'Ground widens as you go — 15 cells, then 20, then 25 — and from round 4 some trails lie.',
    'help.tools': 'Records unlock tools. The windstone leans scent rings toward the source; the glowbell rings out one false trail per hunt.',
    'help.codex': 'Every record adds field notes. Notes raise a research level, and traces you have found but not recorded show as rumors.',
    'help.commission': 'Three commissions post each day — a species, a stamina margin, a record quality. Each one pays field notes.',
    'help.daily': "Today's Trail is the same map for everyone. Finishing it builds a streak; every seventh day earns a rest token that covers a missed day.",
    'help.wx.clear': 'Clear — clues read exactly as they are.',
    'help.wx.mist': 'Mist — scent spreads and footprint cones widen. Everything reads looser.',
    'help.wx.wind': 'Wind — scent scatters furthest of all, but disturbances tighten to a smaller circle.',
    'help.wx.drizzle': 'Drizzle — prints press sharp and narrow, while scent smears a little.',
    'coach.tool.windstone': 'You are carrying the windstone. Scent rings now lean toward the source — the thick side of the arc is the near side.',
    'coach.tool.glowbell': 'You are carrying the glowbell. Tap its chip once a hunt to ring out one false trail.',
    'coach.codex': 'Each record adds field notes, and notes raise a research level. Traces you have found but not recorded show as rumors.',
    'coach.commission': 'Three commissions post each day. Meet one on any hunt and it pays field notes.',
    'coach.daily': "Today's Trail is the same map for everyone. Finish it to build a streak — every seventh day earns a rest token that covers a missed day.",
  },
  'zh-TW': {
    'hud.round': '第 {n} 局',
    'hud.stamina': '體力 {n}',
    'hud.step': '步數 {n}',
    'hud.hint': '移動：點擊/方向鍵 · 眺望：空白鍵 · 標記：Shift+點擊',
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
    'help.stamina': '每一步都消耗體力：草地／霧谷 1，密叢 2，岩坡 4，崖壁過不去。霧葉與露珠果可以回復。',
    'help.qte': '逼近目標後，趁指針掃過發光弧區時點擊或按空白鍵。',
    'help.weather': '天氣影響判讀：霧日朦朧、風日氣味散逸、細雨足跡清晰。',
    'weather.clear': '晴',
    'weather.mist': '霧日',
    'weather.wind': '風日',
    'weather.drizzle': '細雨',
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
    'iris.prefix': '異彩·',
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
    // 與英文版同一次改字（見 en 區塊註解）：線索永遠錨定在牠留下痕跡當下所在的節點，
    // 改成過去式後不論齡別都恆真，不再暗示「現在」。
    'tut.read': '線索！這是牠留下痕跡當下的位置，不是牠現在的位置。',
    // 同齡交集保證含該齡節點，但那是牠「當時」所在，不是「現在」所在——改過去式。
    'tut.cross': '兩條齡別相同的線索重疊——那是牠當時所在的位置。',
    'tut.qte': '很近了，準備節奏點擊！',
    'score.gain': '得分 +{n}',
    'score.pot': '待入袋 {n}',
    'score.lost': '這趟未入袋的收穫散進霧裡了……已入袋的安然無恙。',
    'btn.bank': '［安全歇腳］',
    'btn.push': '［乘勝續追 ×{m}］',
    'camp.best': '最佳連追 {n}',
    'camp.carry': '入袋 {b}｜待入袋 {p}',
    'hud.layer': '圖層',
    'hud.muted': '已靜音',
    'mark.exclude': '排除',
    'mark.suspect': '存疑',
    'mark.wager': '押注',
    'reveal.title': '揭曉',
    'reveal.wasHere': '牠在這裡',
    'reveal.yourCall': '你的押注',
    'reveal.exact': '你押得正中。',
    'reveal.offBy': '你差了 {n} 格。',
    'reveal.noCall': '這一局你沒有下押注——下次記得把一格標成金色。',
    'reveal.decoy': '這條假蹤跡把你帶偏了。',
    'reveal.infoAt': '你在第 {n} 步就取得了本局最精確的資訊，最後走到第 {m} 步。',
    'reveal.dailyHidden': '今日行蹤不揭曉——全球同題，答案得自己找。',
    'btn.continue': '［繼續］',
    'help.marks': '反覆標記同一格可循環：排除、存疑、押注。押注格決定你的記錄品質。',
    'help.layer': '「圖層」依符合選定齡別的已判讀線索數上色，chip 選哪一齡；標記已判讀線索可靜音。',
    'help.reveal': '每一局結束都會揭曉牠實際在哪，以及你的押注差了幾格。',
    'hud.survey': '眺望',
    'hud.surveyCost': '眺望 -{n}',
    'hud.pathCost': '{n}',
    'help.vision': '你只看得見身邊的地面。高處望得遠，密叢裡看不遠。',
    'help.survey': '「眺望」消耗體力，掃過身邊一圈地面，找出你還沒走過的線索。',
    'help.route': '點遠處的格子會先預覽路線與總花費，再點一次才會走。一讀到新東西就會立刻停下。',
    'help.sec.track': '判讀蹤跡',
    'help.sec.deduce': '推理工具',
    'help.sec.ground': '地形與體力',
    'help.sec.longRun': '收分與長線',
    'demo.title': '推理示範',
    'demo.progress': '{n} / {total}',
    'demo.fromResult': '不確定線索該怎麼讀？跟著走一遍完整的推理。',
    'demo.ch1': '一條線索只會排除',
    'demo.ch2': '交集才是答案',
    'demo.ch3': '落單的那條在說謊',
    'demo.ch4': '眺望，然後押注',
    'demo.s1': '{n} 格，牠躲在其中一格。線索從來不會直接指出是哪一格——它只負責把不可能的地方劃掉。',
    'demo.s2': '判讀足跡：牠往東北去了。牠在這片錐形裡的某一格——{n} 格。',
    'demo.s3': '所以錐形外的 {n} 格全都不可能。挑一格，把它標成排除。',
    'demo.s4': '第二條線索是氣味。牠就在離這裡 {n} 格遠的環帶上。',
    'demo.s5': '疊起來看。符合越多線索的格子越亮，而兩條都符合的只剩 {n} 格——這就是「圖層」鈕在做的事。',
    'demo.s6': '第三條線索，又是足跡。但這一枚朝西北。',
    'demo.s7': '現在整張圖沒有任何一格同時滿足三條。它們不可能都是真的，所以其中一條在說謊。',
    'demo.s8': '數符合數：{n} 格符合兩條，沒有一格符合三條。兩條互相印證，剩下那條和誰都對不上。',
    'demo.s9': '把說謊的那條靜音。點它的記號。',
    'demo.s10': '還有 {n} 格，太多了。而更遠的地方你根本看不見。往交集區走過去。',
    'demo.s11': '眺望。霧退開，第四條線索浮了出來——眺望不只是找線索，也是把你能規劃的地面打開。',
    'demo.s12': '三條誠實的線索交會的地方，只剩一格。',
    'demo.s13': '就是這一格。押下去。',
    'demo.s14': '牠就在這裡。讀、疊、剔、望、押——每一局都是這五件事。',
    'demo.hint.exclude': '這格還在錐形裡，仍然有可能。挑錐形外的一格。',
    'demo.hint.mute': '這條和另一條互相吻合。再看一次——哪一條和誰都對不上？',
    'demo.hint.wager': '這格沒有滿足全部三條線索。只有一格滿足。',
    'btn.demo': '［看示範］',
    'btn.next': '［下一步］',
    'btn.prev': '［上一步］',
    'demo2.title': '會走的獵物',
    'demo2.ch1': '牠沒有待在原地',
    'demo2.ch2': '一次只看一齡',
    'demo2.ch3': '往前帶',
    'demo2.s1': '六條線索，全是真的。全部疊起來，符合每一條的格子有 {n} 個——一個也沒有。',
    'demo2.s2': '沒有人在說謊。線索彼此矛盾，是因為牠一路在走：每一條標的都是牠「經過」的地方。',
    'demo2.s3': '每條線索都帶有新鮮度。這六條是三組——更早、夜間、晨間。',
    'demo2.s4': '把新鮮度 chip 切到最新的一齡。只剩兩條了。',
    'demo2.s5': '這兩條交在同一格。那是牠今天早上所在的位置。',
    'demo2.s6': '另外兩齡照做，你會得到三個格子——牠依序待過的地方。',
    'demo2.s7': '三格成一直線、間距相等。牠還在走。押下一格。',
    'demo2.s8': '牠在這裡。線索說牠去過哪，新鮮度說那是什麼時候，合起來才知道牠要去哪。',
    'demo2.hint.wager': '那是牠待過的地方，不是牠要去的地方。沿著這條線再往前一格。',
    'demo2.hint.mute': '這裡沒有人在說謊——六條線索都是真的。它們彼此矛盾，是因為分屬不同的時刻。',
    'btn.demo2': '［示範：會走的獵物］',
    'age.fresh': '今晨',
    'age.night': '昨夜',
    'age.older': '更早',
    'age.all': '全部',
    'reveal.route': '牠一直在移動。下面這條就是牠走過的路，由舊到新。',
    'rule.lowland': '沿溪谷低處走',
    'rule.highland': '沿稜線高處走',
    'rule.cover': '貼著密叢走',
    'rule.straight': '一路直行',
    'rule.doubling': '走出去再折返',
    'coach.event.startle': '一群鳥被驚起——牠們飛離的方向，就是牠所在的大致方位。',
    'coach.event.supply': '你在腳邊發現了額外的補給，體力已經補回。',
    'coach.event.oldtrail': '腳下有一道舊足跡，方向很粗略——當作參考，別當作證據。',
    'coach.supply': '霧葉與露珠果可以回復體力。規劃路線時把它們算進去。',
    'coach.age': '這兩條線索的齡別不同。只有同齡的線索能求交集——用新鮮度 chip 一次只看一齡。',
    'coach.bankpush': '歇腳＝把收穫入袋收工。續追＝倍率疊高再走一局，但下一趟落空就全部散掉。',
    'coach.iris': '異彩變種。少見，而且值兩倍。',
    'coach.route': '牠一路都在走。線索留在牠經過的地方，不是牠去的地方——讀最新的那一齡，然後往前帶。',
    'coach.quality': '押注決定記錄品質：正中是金，相距兩格內是銀，再遠是銅。',
    'coach.infoAt': '那一步是你的線索第一次鎖定單一格。在那之後你都在走路，不是在推理。',
    'help.quarry': '牠不會待在原地。牠沿覓食路線走，所以線索標的是牠「經過」的地方，不是牠去的地方。',
    'help.habit': '每個物種走法不同：谷底、稜線、密叢、直線、或者折返。揭曉時會告訴你牠是哪一種。',
    'help.age': '線索帶有新鮮度：晨間、夜間、更早。只有同齡的線索能求交集——「圖層」旁的 chip 決定你在讀哪一齡。',
    'help.score': '記錄會累積分數。歇腳把它入袋收工，續追則把下一趟的倍率疊高——但落空一次，未入袋的全部散掉。',
    'help.iris': '異彩變種少見，分數兩倍。要記錄到才會知道遇上了。',
    'help.events': '山會在你身邊動。驚起的鳥會朝反方向飛離牠、腳邊會冒出補給、舊足跡會給你一個粗略方位。',
    'help.supply': '霧葉與露珠果長在原地、回復體力。長距離橫越時把路線繞過去。',
    'help.mute': '標記一格你已判讀過的線索＝把那條線索靜音，它會退出「圖層」。用在你認為在說謊的那條蹤跡上。',
    'help.infoAt': '揭曉會告訴你「第幾步就足以鎖定」。走過那一步之後的每一步都在花體力，換不到資訊。',
    'help.quirk': '物種的判讀難度各不相同：有的氣味散得開，有的足跡收得緊。圖鑑會記下每一種的習性。',
    'help.progress': '地圖會愈走愈大——15 格、20 格、25 格——而且從第 4 局起，有些蹤跡會說謊。',
    'help.tools': '記錄會解鎖道具。風向石讓氣味環朝源頭偏心；輝鈴每局可以敲掉一條假蹤跡。',
    'help.codex': '每筆記錄都會累積田野筆記。筆記推高研究度，而找到痕跡卻尚未記錄的物種會顯示為傳聞。',
    'help.commission': '每天張貼三則委託——指定物種、體力餘裕、記錄品質。每完成一則都付田野筆記。',
    'help.daily': '「今日行蹤」全世界同一張圖。完成會累積連勝；每滿七天贈一枚歇腳符，可以補一天沒跑的空缺。',
    'help.wx.clear': '晴——線索如實呈現，不增不減。',
    'help.wx.mist': '霧——氣味擴散、足跡錐形變寬。整體都讀得比較鬆。',
    'help.wx.wind': '風——氣味散得最開，但擾動的圓域反而收得更小。',
    'help.wx.drizzle': '細雨——足跡壓得又深又窄，氣味則稍微糊掉。',
    'coach.tool.windstone': '你帶著風向石。氣味環現在會朝源頭偏心——弧線較厚的那一側就是靠近的那一側。',
    'coach.tool.glowbell': '你帶著輝鈴。每局點它的 chip 一次，可以敲掉一條假蹤跡。',
    'coach.codex': '每筆記錄都會累積田野筆記，筆記推高研究度。找到痕跡卻尚未記錄的物種會顯示為傳聞。',
    'coach.commission': '每天張貼三則委託。任何一局達成都會付田野筆記。',
    'coach.daily': '「今日行蹤」全世界同一張圖。完成會累積連勝——每滿七天贈一枚歇腳符，可以補一天沒跑的空缺。',
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
