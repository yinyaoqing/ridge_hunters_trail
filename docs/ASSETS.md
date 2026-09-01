# 美術素材指南（Art Asset Guide）

本文件說明如何為 Ridge Hunter's Trail 加入正式美術素材。目前遊戲**完全不依賴外部素材檔**
即可運作——所有生物皆以程式產生的向量剪影（`src/data/silhouettes.ts`）與純色幾何圖形呈現。
本文件描述的是**選配（optional）**的美術升級管線：放入符合規格的檔案即自動生效，
不放則維持既有剪影/幾何後備，行為完全不受影響。

## 1. 生物 Sprite

| 項目 | 規格 |
|---|---|
| 尺寸 | 128×128 px |
| 格式 | PNG，透明背景 |
| 檔案大小上限 | 每檔 ≤ 64 KB |
| 路徑與命名 | `public/assets/creatures/<id>.png` |
| 生物 id 清單 | `mistfawn`、`emberquill`、`thicketloom`、`dewhopper`、`veilmoth`、`lanternshrew`、`ridgecrest`、`plumetail`（對照 `src/data/creatures.ts`） |

> **顯示尺寸（已處理）**：剪影母檔原生 208×176（實際墨形寬約 144px），sprite 為 128×128
> （實際造型寬約 112px），同一 `setScale` 會讓 sprite 明顯偏小。`paint.ts` 的
> `creatureScale(texKey, silhouetteScale)` 依實際貼圖回傳倍率——sprite 乘上
> `SPRITE_SCALE_RATIO`（1.3），剪影沿用原值——三處消費端（QTE 1.35／結算 1.05／圖鑑 0.3）
> 皆已改用此函式，故 sprite 與剪影在畫面上等大。新素材若改變造型佔比，調整該常數即可。

### 運作方式

- `BootScene.preload()` 對每個生物 id 嘗試載入 `spr-<id>`（`assets/creatures/<id>.png`）。
  檔案不存在時 Phaser 觸發 `FILE_LOAD_ERROR`，該事件被靜默吞下（僅 `console.debug`），
  不影響任何後續流程。
- `paint.ts` 的 `creatureTexKey(scene, id)` 回傳可用的貼圖 key：
  若 `spr-<id>` 已成功載入則優先使用，否則回退 `sil-<id>`（剪影，恆常存在）。
- `QteScene`（轉盤中央淡影）、`ResultScene`（結算肖像）、`CodexScene`（圖鑑列表）
  三處消費端皆已改用 `creatureTexKey`，剪影/純色幾何 fallback 分支維持不變。
- 因此：**放入符合命名的 PNG 檔即可局部或全部升級單一生物的視覺**，不需要改動任何程式碼、
  不需要全部生物同時到齊，且移除檔案後會在下次載入時自動恢復剪影顯示。

### 內建素材與重新產生

本倉庫已附一套原創生物 sprite（`public/assets/creatures/*.png`，8 隻，合計約 39 KB）。
造型為程式化向量原稿，母檔與產生器如下：

| 檔案 | 用途 |
|---|---|
| `scripts/creature-art.mjs` | 8 隻生物的向量原稿（可編輯的美術母檔），含造型註解與設計意圖 |
| `scripts/build-sprites.mjs` | 光柵化腳本：輸出 `art/creatures/*.svg` 與 `public/assets/creatures/*.png`，並檢查 ≤64 KB 預算 |
| `art/creatures/*.svg` | 產生出的 SVG 母檔（供外部向量軟體再加工） |

重新產生（光柵器 `@resvg/resvg-js` 僅為建置期工具，刻意不寫入 `package.json` 相依，
以維持執行期零額外相依）：

```bash
npm i --no-save @resvg/resvg-js
node scripts/build-sprites.mjs
npm r --no-save @resvg/resvg-js
```

要替換為其他來源（例如 AI 生成後手工簡化）的素材時，直接覆蓋 `public/assets/creatures/<id>.png`
即可，無須理會上述腳本；腳本僅是內建這套向量素材的可重現產生路徑。

### 路徑寫法（相對路徑，無前導斜線）

`vite.config.ts` 設定 `base: './'`，代表建置產物以「相對於部署位置」的方式引用資源，
以支援 itch.io、CrazyGames iframe 等非網站根目錄的部署環境。`public/` 目錄下的檔案會被
原樣複製到 `dist/` 對應路徑，因此程式中載入素材必須使用**相對路徑**
（`assets/creatures/<id>.png`，無前導 `/`），讓瀏覽器依「目前頁面 URL」解析，
與 `dist/index.html` 旁的 `dist/assets/...` 實際落點一致。若改用前導斜線的絕對路徑
（如 `/assets/creatures/x.png`），瀏覽器會改為相對於網域根目錄解析，
一旦部署在子路徑（例如 itch.io 的 `https://x.itch.io/game/` 或平台 iframe 沙盒）下就會 404。

## 2. 地形貼圖（預留章節，本階段未接線）

| 項目 | 規格 |
|---|---|
| 尺寸 | 64×64 px，可平鋪（seamless tile） |
| 格式 | PNG |
| 檔案大小上限 | 每檔 ≤ 32 KB |
| 路徑與命名 | `public/assets/terrain/<type>.png`（`type`：`mist` / `rock` / `thicket` / `meadow`，對照 `src/core/types.ts` 的 `TerrainType`） |

目前地圖地形完全以程式繪製的色塊呈現（`MapScene`），尚未有對應的載入/後備邏輯。
本節僅預留規格與命名慣例，供未來任務接線時沿用；在該任務完成前，即使放入符合命名的
檔案也不會被讀取或顯示。

## 3. 內容審查清單（正式入庫前，人工簽核）

依設計規格 §2「世界觀原創性」與內容分級要求，任何生物/地形/圖標素材（含 AI 生成草稿）
在合併進 `main` 前必須完成以下人工目視檢查，逐項打勾：

- [ ] 造型不會令人聯想到任何**真實存在的特定動物物種**（可保留「鹿」「鳥」等泛用生物剪影，
      但不得複製特定物種的可辨識特徵，如特定品種的角型、羽色圖鑑等）。
- [ ] 不含任何**真實民族/族群圖騰、紋樣或符號**（不得取材自任何真實紋樣資料庫）。
- [ ] 不含任何**宗教圖騰或宗教相關意象**。
- [ ] 不含任何真實地名、真實族群名稱或可辨識的現實文化元素。
- [ ] 整體呈現符合 **PEGI 3–7**：無威嚇、無驚悚、無血腥/死亡意象，闔家皆宜。
- [ ] 色彩不與線索金光 `0xd8c874`（`CLUE_GOLD`）過於相近，避免玩家誤讀為線索標記。
- [ ] 已由至少一位人類簽核（非僅 AI 自我審查），簽核者與日期記錄於 PR 描述或 commit message。

未完成上述簽核的素材檔**不得**放入 `public/assets/`（含暫存/測試用途）。

## 4. 體積預算表

| 項目 | 預算 | 說明 |
|---|---|---|
| 初始下載總量（現階段目標平台：CrazyGames Basic Launch） | ≤ 50 MB | 含所有素材、程式碼、字型 |
| 檔案總數（CrazyGames） | < 1,500 個 | 生物 8 個 + 地形 4 個（預留）遠低於此上限 |
| 單一生物 sprite | ≤ 64 KB | 見第 1 節 |
| 單一地形貼圖 | ≤ 32 KB | 見第 2 節 |
| 未來擴張平台：Poki | 初始下載 ≤ 8 MB | 門檻最嚴格，僅在後期優化階段適用，非本階段目標 |

零素材時遊戲本體（程式碼＋字型）遠低於上述所有門檻；加入美術素材時應持續以
`npm run build` 後檢查 `dist/` 體積作為把關手段。
