# Ridge Hunter's Trail — GitHub Pages 部署 v1.0

> 這是第一份與遊戲玩法無關的設計文件。前面每一階都在讓遊戲更好玩，
> 這一階要回答的是另一個問題：**做好的東西，別人怎麼玩得到。**
> 目前答案是「玩不到」——repo 沒有任何 CI，唯一的產物是本機 `dist/`
> 與一包手動打的 itch zip，而遠端預設分支還指著三天前的文件分支。

---

## 1. 現況體檢

動手前先量過，因為「測試必須通過才能部署」這道關卡如果一開始就是紅的，
它就只是路障而不是防線。

| 項目 | 實測結果 |
|---|---|
| `npx tsc --noEmit` | exit 0，零錯誤 |
| `npx vitest run` | 37 檔 / 445 測試全過，8.02 秒 |
| 已追蹤測試檔 | 35 支（另 2 支 `tests/_scratch_*.test.ts` 未追蹤，CI 看不到） |
| build 產物路徑 | `dist/index.html` 引用 `./assets/index-*.js`，已是相對路徑 |
| 素材 | `public/assets/**.png` 已進版控，CI 不需執行 `scripts/build-assets.mjs` |
| 存檔相容性 | 鍵值已是 `rht.*.v1/v2` 分模組版號，codex 有 v1→v2 遷移 |
| `main` 與 `HEAD` | 落後 0、領先 12，`main` 是直接祖先，可快轉 |
| 遠端預設分支 | `feat/phase1-retention-ui`（停在 8/31 的 docs commit）← 錯的 |

三個關鍵結論：

- **關卡從第一天就是綠的**，不需要先修測試。
- **`vite.config.ts` 不用動**。`base: './'` 產出的相對路徑在
  `/ridge_hunters_trail/` 這種子路徑下本來就正確；改成絕對路徑反而會綁死網域。
- **CI 環境不需要 `@resvg/resvg-js`**。素材產生器刻意不列為相依
  （見 `scripts/build-assets.mjs` 開頭註解），PNG 直接讀版控裡的。

---

## 2. 決策紀錄

| 分歧 | 裁定 | 落選項與理由 |
|---|---|---|
| 部署目標 | **GitHub Pages** | itch.io 沒有自己的網址，分享卡貼出去沒有可點的連結；Cloudflare/Vercel 多一個平台帳號要管，靜態遊戲用不到它們的邊緣運算 |
| 發布機制 | **官方 `upload-pages-artifact` + `deploy-pages`** | `peaceiris/actions-gh-pages` 要多一支永遠在變動的 `gh-pages` 分支，等於把已 gitignore 的 `dist/` 半推回版控，還多信任一個第三方 action；手動推則沒有任何品質關卡，與「測試要過」直接矛盾 |
| 觸發時機 | **推上 `main` 自動部署** | 手動按鈕與 tag 觸發都把「線上是哪個 commit」交還給人的記憶；自動觸發讓「線上版 = main」成為系統事實 |
| 品質關卡 | **測試與型別任一失敗即不部署** | 已有 445 個測試卻從不自動跑，等於白寫；線索演算法壞掉是玩家才會發現的那種錯 |
| workflow 檔數 | **單一 `ci.yml`，兩個 job** | 拆兩個檔會有兩份重複的檢查定義，且部署方若重新建置一次，上線的就不是被檢查過的那包位元組 |
| 首次上線路徑 | **走 PR，不走本地快轉** | 第一次跑這套流程要在真實 Linux 環境驗證一遍；紅燈該出現在 PR 上，而不是在已經合進 `main`、正往線上推的時候 |
| 本次範圍 | **只做 CI + Pages** | og meta、自訂網域、PR 預覽各自是獨立的一件事，先讓遊戲能被玩到 |

---

## 3. 架構

```
push（任何分支）
        │
        ▼
   job: check ─────────────────────────────────────
   ubuntu-latest · permissions: contents:read
   actions/checkout@v4
   actions/setup-node@v4  (node-version: 22, cache: npm)   ← 對齊本機 v22.22.0
   npm ci
   npm test                    ← 35 個已追蹤測試檔
   npm run build               ← tsc --noEmit && vite build
   actions/upload-pages-artifact@v3  (path: dist/)
        │
        │ needs: check
        │ if: github.ref == 'refs/heads/main'
        ▼
   job: deploy ────────────────────────────────────
   environment: github-pages
   permissions: pages:write, id-token:write
   actions/deploy-pages@v4
        │
        ▼
   https://yinyaoqing.github.io/ridge_hunters_trail/
```

五個設計要點：

**artifact 只產生一次。** `deploy` job 不重新建置，直接發布 `check` 通過的那包
位元組。這讓「線上跑的東西通過了檢查」從一個推論變成一個事實——同一個 commit
重建兩次理論上該一致，但那是理論。

**型別檢查不另外寫一步。** `npm run build` 本身就是 `tsc --noEmit && vite build`，
再加一步 `tsc` 只是跑第二遍。

**只掛 `push`，不掛 `pull_request`。** 兩個觸發都掛上去的話，同一個 repo 內開的
PR 會跑兩次完全一樣的檢查。GitHub 的檢查狀態是掛在 commit 上而不是掛在 PR 上，
所以分支推上去跑的那次，PR 頁面照樣看得到綠燈或紅燈。這個 repo 沒有外部 fork
要接，`push` 一個觸發就夠。

**非 `main` 分支也產生 artifact 但不部署。** 成本是幾秒鐘上傳，換來 `deploy` job
完全不必碰原始碼。

**權限逐 job 收斂。** `check` 只有 `contents: read`；寫入 Pages 的能力只掛在
`deploy` 上。預設的 workflow 權限不放寬。

### 3.1 為什麼 `concurrency` 是必要的

兩次連續推上 `main` 會產生兩條部署，後推的先完成時，線上會停在較舊的版本。
`deploy` job 需要：

```yaml
concurrency:
  group: pages
  cancel-in-progress: false
```

兩個細節：

**掛在 `deploy` job 上，不掛在 workflow 層級。** 掛 workflow 層級的話，所有分支的
`check` 也會被塞進同一個佇列互相等待——feature 分支跑個測試要排隊等別的分支，
沒有道理。要排隊的只有「往同一個 Pages 站點寫入」這件事。

**`cancel-in-progress: false` 而非 `true`。** 部署進行到一半被取消，Pages 可能停在
不確定狀態。排隊等它做完比較安全，反正一次部署只要幾十秒。

---

## 4. 上線前的分支整併

三件事卡在 `main` 與線上版之間，順序不能顛倒：

1. **workflow 進 PR。** 把 `ci.yml` 當成第一個 PR 的內容，它會在自己的 PR 上
   先自我驗證一次。若 Node 版本、`npm ci`、或某個測試在 Linux 上與 Windows
   行為不同，紅燈出現在這裡。
2. **工作區收尾。** `src/core/quirks.ts` 有一行未提交的修改，合併前要決定提交
   或丟棄。兩支 `tests/_scratch_*.test.ts` 維持不追蹤——它們是調參數用的探針
   （會印統計數字、跑 1000 seed 掃描），不屬於 CI。
3. **Phase 6a 的 12 個 commit 合進 `main`。** 無分歧，快轉即可。

之後才是改預設分支、開 Pages 開關、第一次自動部署。

---

## 5. 只有 owner 能做的手動步驟

Actions 無權自行啟用 Pages，也無權改預設分支。這三步必須在 GitHub 網頁上點：

| 位置 | 動作 | 為什麼非人不可 |
|---|---|---|
| Settings → Pages → Source | 選 **GitHub Actions** | 這是 Pages 的啟用開關，workflow 無權自行開啟 |
| Settings → General → Default branch | 改成 **main** | 修正 `origin/HEAD` 指向 8/31 文件分支的問題 |
| Actions 頁面（首次） | 若出現授權提示則批准 | 新 repo 首次執行 workflow 偶爾需要 |

第二項與部署無關也該修：任何人 clone 這個 repo，現在拿到的是三天前的文件分支
而不是遊戲。選了「推 `main` 就部署」之後，它從衛生問題升級為前提條件。

---

## 6. 驗收條件

逐項實際驗證，不接受「應該可以」：

1. PR 上 `check` job 綠燈，35 個測試檔在 Linux 上通過。
2. 合入 `main` 後 `deploy` job 綠燈，Actions 摘要頁顯示 Pages 網址。
3. **開啟該網址，遊戲能載入、能開始一局。** 這是唯一真正算數的一項——
   base path 錯掉的話 build 照樣成功、`deploy` 照樣綠燈、頁面照樣是白的。
4. `git ls-files | grep dist` 為空，確認建置產物沒被推進版控。

---

## 7. 明確排除的範圍

以下各自是獨立的一件事，本階段不做，列出來是為了讓「沒做」是個決定而非疏漏：

- **分享預覽 meta**（`og:title` / `og:image`）。遊戲有每日挑戰分享卡
  （`src/core/share.ts`），但貼出去的連結目前沒有預覽圖。
- **自訂網域**（CNAME + DNS）。
- **PR 預覽部署。** GitHub Pages 一個 repo 只有一個站點，要做得另闢機制。
- **itch.io 自動發行。** `npm run package` 仍可手動打包；butler CLI 自動上傳
  需要 API key 與 secrets 設定。
- **自託管字型。** 見下節。

---

## 8. 已知風險

**Google Fonts 執行期相依。** `index.html` 從 `fonts.googleapis.com` 載
Marcellus 與 Karla。本機開發多半已快取，線上首次載入會有一次連外請求，字型未到
之前使用 fallback 字體。不影響部署成敗，但會讓首次載入的視覺有一次跳動；
若在意，自託管字型是之後可獨立處理的一件事。

**localStorage 跨版本。** 存檔鍵已分模組版號、codex 已有遷移範例，改版不會清掉
玩家進度。但這是既有約定，不是這次建立的——之後任何改變存檔結構的階段，
仍須自行升版號並寫遷移。
