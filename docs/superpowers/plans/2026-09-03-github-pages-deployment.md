# GitHub Pages 部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每一次推上 `main` 的變更，在測試與型別檢查通過後自動發布到 `https://yinyaoqing.github.io/ridge_hunters_trail/`。

**Architecture:** 單一 `.github/workflows/ci.yml`，兩個 job。`check` 在任何分支的 push 上跑 `npm ci` → `npm test` → `npm run build`，並把 `dist/` 上傳為 Pages artifact；`deploy` 以 `needs: check` 掛在後面、只在 `main` 上執行，直接發布那包已通過檢查的位元組，不重新建置。

**Tech Stack:** GitHub Actions（`actions/checkout@v4`、`actions/setup-node@v4`、`actions/upload-pages-artifact@v3`、`actions/deploy-pages@v4`）、Node 22、Vite 6、Vitest 3。

## Global Constraints

- 上游規格：`docs/superpowers/specs/2026-09-03-github-pages-deployment-design.md`。與規格衝突時以規格為準；若發現規格有錯，**停下來回報**，不要自行改設計。
- **`gh` CLI 在本機不存在，也沒有 GitHub token。** 所有 GitHub 網頁端操作（啟用 Pages、改預設分支、開 PR、合併 PR、看 Actions 結果）都必須由 owner 手動執行；本計畫中標記 **[OWNER]** 的步驟不要嘗試自動化，也不要試圖安裝 `gh` 來繞過。
- **不得改動 `vite.config.ts`。** `base: './'` 產出的相對路徑正是 Pages 子路徑所需（規格 §1）。
- **不得把 `dist/` 加入版控。** 它已在 `.gitignore`，artifact 走 Actions 通道。
- **不得為了讓 CI 變綠而修改或刪除既有測試。** 若淨室預演失敗，停下來回報。
- `tests/_scratch_*.test.ts` 維持**不追蹤**——那是調參數用的探針，不進 CI。
- 註解一律繁體中文，寫「**為什麼**」。YAML 註解同此規則。
- 指令一律**在前景**執行，一次一個。**不要開背景等待——你不會被喚回。**
- 每個 Task 結束時 commit，訊息結尾加：
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| 檔案 | 職責 |
|---|---|
| `.github/workflows/ci.yml`（新增） | 唯一的工作流程檔。`check` job 把關、`deploy` job 發布 |
| `README.md`（修改） | 加上線上遊玩連結與部署說明，讓新讀者知道線上版從哪來 |

沒有原始碼變更。`src/` 在本計畫中**唯讀**；`tests/` 僅在 Task 2 收尾 owner 既有的未提交改動時可能觸及。

## 三個 Task 的順序為什麼是這樣

有兩個順序陷阱，排錯了會在最後一步才爆：

1. **PR 的 base 分支會預設成 repo 的預設分支**，而 `origin/HEAD` 現在指著 `feat/phase1-retention-ui`。所以「改預設分支」必須在開 PR **之前**。
2. **合併進 `main` 就會立刻觸發首次部署**，若 Pages 尚未啟用，`deploy` job 會失敗。所以「啟用 Pages」必須在合併 **之前**。

因此：Task 1 建立並在自己分支上驗證工作流程 → Task 2 收尾工作區並把 GitHub 端的前置設定全部做完 → Task 3 才走 PR 合併並驗收。

---

## Task 1: 淨室預演並建立 ci.yml

這個 Task 的「失敗的測試」是**淨室預演**：從版控裡的檔案（而非工作目錄）複製一份乾淨的 checkout，跑一次 CI 將要跑的完整指令序列。CI 看不到未追蹤的檔案，也沒有現成的 `node_modules`——這一步就是在本機重現那個環境。先確認它會過，再把它寫成工作流程。

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `package.json` 的 `test`（`vitest run`）與 `build`（`tsc --noEmit && vite build`）script；`package-lock.json`（`npm ci` 需要）
- Produces: 名為 `github-pages` 的 Pages artifact（Task 3 的 `deploy` job 與驗收都依賴它存在）

**本 Task 全程使用的淨室路徑**，以下以 `<CI_DIR>` 代稱：

```
C:/Users/yinya/AppData/Local/Temp/claude/c--Users-yinya-git-ridge-hunter-s-trai/07f71447-ac88-4084-ae87-614e81ff5613/scratchpad/ci-dryrun
```

- [ ] **Step 1: 淨室預演——複製一份只含版控檔案的 checkout**

`git clone` 只會帶走已提交的內容，正是 CI 看到的那一份：

```bash
git clone --depth 1 --branch feat/phase6a-living-quarry "file://c:/Users/yinya/git/ridge_hunter-s_trai" "<CI_DIR>"
```

Expected: `Cloning into ...` 後成功結束，exit 0。

- [ ] **Step 2: 確認淨室裡看不到 scratch 測試**

```bash
ls "<CI_DIR>/tests" | grep -c "test.ts"
```

Expected: `35`。若不是 35，表示有測試檔沒被提交（或 scratch 檔被誤提交），**停下來回報**。

- [ ] **Step 3: 在淨室裡安裝相依**

```bash
cd "<CI_DIR>" && npm ci
```

Expected: `added NNN packages`，exit 0。

- [ ] **Step 4: 在淨室裡跑測試**

```bash
cd "<CI_DIR>" && npm test
```

Expected: `Test Files  35 passed (35)`，`Tests  NNN passed (NNN)`，exit 0。

**把這裡輸出的測試總數記下來**——它是 CI 的基準，Task 1 Step 12 與 Task 3 驗收都要比對。

**若失敗，停下來回報。** 不要修測試、不要跳過——淨室紅燈代表版控裡的東西真的壞了，那比部署更優先。

- [ ] **Step 5: 在淨室裡建置**

```bash
cd "<CI_DIR>" && npm run build
```

Expected: `vite vX.X.X building for production...` → `✓ built in Xs`，exit 0。`tsc --noEmit` 若有型別錯誤會在 `vite` 之前就中止。

- [ ] **Step 6: 確認建置產出是相對路徑**

Pages 把站點掛在 `/ridge_hunters_trail/` 子路徑下。build 產出若是絕對路徑 `/assets/...`，頁面會是白的而 build 照樣成功——這是本計畫最容易漏掉的失敗模式。

```bash
grep -o 'src="[^"]*"' "<CI_DIR>/dist/index.html"
```

Expected: `src="./assets/index-XXXXXXXX.js"`——**必須以 `./` 開頭**。若是 `/assets/...`，停下來回報（表示 `vite.config.ts` 的 `base` 被改動過）。

- [ ] **Step 7: 建立 `.github/workflows/ci.yml`**

在專案根目錄建立 `.github/workflows/` 目錄與以下檔案：

```yaml
# 把關與發布。check 在任何分支上跑，deploy 只在 main 上跑並直接發布 check
# 產出的那包 artifact——不重新建置，好讓「線上跑的東西通過了檢查」是事實而非推論。
name: CI

# 只掛 push，不掛 pull_request：兩個都掛的話，同一個 repo 內開的 PR 會跑兩次
# 一模一樣的檢查。檢查狀態是掛在 commit 上，所以分支推上去跑的那次，PR 頁面
# 照樣看得到結果。
on:
  push:
    branches: ['**']

# 預設收到最小權限；需要寫入的能力只加在 deploy job 上。
permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'   # 對齊開發機的 v22.22.0
          cache: npm

      # npm ci 而非 npm install：嚴格照 package-lock.json 安裝，
      # 讓 CI 裝到的相依與本機淨室預演時完全一致。
      - run: npm ci

      - run: npm test

      # build script 本身就是 tsc --noEmit && vite build，
      # 型別檢查已含在內，不需要另外再跑一次 tsc。
      - run: npm run build

      # 非 main 分支也會上傳。成本是幾秒鐘，換來 deploy job 完全不必碰原始碼。
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: check
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    permissions:
      pages: write
      id-token: write

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    # 掛在 job 上而非 workflow 層級：要排隊的只有「寫入同一個 Pages 站點」，
    # 若掛在 workflow 層級，所有分支的 check 也會被塞進同一個佇列互等。
    # cancel-in-progress 為 false——部署做到一半被取消，Pages 可能停在不確定狀態。
    concurrency:
      group: pages
      cancel-in-progress: false

    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 8: 驗證 YAML 語法**

語法錯誤在 GitHub 上只會顯示成一則含糊的錯誤，本機先擋下來比較快。本機已有 PyYAML 6.0.3：

```bash
python -c "import yaml,io; d=yaml.safe_load(io.open('.github/workflows/ci.yml',encoding='utf-8')); print('jobs:', list(d['jobs'].keys())); print('deploy needs:', d['jobs']['deploy']['needs']); print('deploy if:', d['jobs']['deploy']['if'])"
```

Expected:
```
jobs: ['check', 'deploy']
deploy needs: check
deploy if: github.ref == 'refs/heads/main'
```

注意：PyYAML 會把裸寫的 `on:` 解析成布林 `True` 鍵，這是 YAML 1.1 的既知行為，**不是錯誤**，GitHub Actions 自己的解析器不受影響。不要為此改動 `ci.yml`。

- [ ] **Step 9: 更新 README**

在 `README.md` 的 `## Develop` 區塊之後、`## Design docs` 之前插入：

```markdown
## Play

<https://yinyaoqing.github.io/ridge_hunters_trail/>

Every push to `main` runs the tests and the type check, then publishes the
build that passed them. See `.github/workflows/ci.yml`.
```

- [ ] **Step 10: Commit**

```bash
git add .github/workflows/ci.yml README.md
```

提交訊息（以 `git commit -F` 從檔案傳入，避免多行訊息在 shell 裡被拆散）：

```
ci: run the tests on every push and publish main to Pages

The tests have never run anywhere but this laptop, and the only build that
exists is the one in my dist/. One workflow closes both gaps: check runs on
every branch, and deploy publishes the artifact check produced rather than
rebuilding it, so what ships is the bytes that passed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

- [ ] **Step 11: 推上分支，讓工作流程在自己身上跑一次**

```bash
git push origin feat/phase6a-living-quarry
```

Expected: 推送成功。這一步的用意是讓 `ci.yml` 在**自己的分支上先自我驗證**——紅燈該出現在這裡，而不是在已經合進 `main`、正往線上推的時候。

- [ ] **Step 12: [OWNER] 在 GitHub 上確認 `check` job 綠燈**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail/actions`。

Expected:
- 出現一筆 `CI` 執行紀錄，`check` job 綠燈
- `npm test` 步驟輸出 `Test Files  35 passed (35)`，測試總數與 Step 4 記下的一致
- `deploy` job 顯示為 skipped（因為現在不在 `main` 上）——**這正是預期行為，不是失敗**

若 `check` 紅燈：看是哪一步失敗。若 `npm ci` 或 `npm test` 在 Linux 上與本機淨室結果不同，那是真正的跨平台問題，**停下來回報**，不要靠改工作流程繞過去。

---

## Task 2: 工作區收尾與 GitHub 端前置設定

合併之前要清空兩件債：工作區裡沒收尾的 Phase 6a 調參改動，以及 GitHub 上兩個必須人工點的設定。兩件都做完，Task 3 的合併才會一次成功。

**Files:**
- Modify: 工作區中所有未提交的變更（實際清單以執行當下的 `git status --short` 為準）

**Interfaces:**
- Consumes: Task 1 已提交且 `check` 綠燈的 `.github/workflows/ci.yml`
- Produces: 乾淨的工作區、`origin/HEAD` 指向 `main`、Pages 已啟用且 `github-pages` environment 已存在（Task 3 的 `deploy` job 依賴這個 environment）

- [ ] **Step 1: 盤點工作區**

```bash
git status --short
```

撰寫本計畫時的狀態是：`src/core/quirks.ts`、`tests/solvability.test.ts`、`tests/terrain.test.ts` 三個已修改檔案，加上未追蹤的 `tests/_scratch_behavior.test.ts`。**執行當下實際清單可能不同**——以指令輸出為準，不要照抄這裡的檔名。

- [ ] **Step 2: [OWNER] 逐檔決定去留**

這一步必須由 owner 裁定，**不要代為決定**：那些是 Phase 6a 的調參改動，只有 owner 知道哪個數值是最後採用的。逐檔顯示 diff 並詢問「提交還是丟棄」：

```bash
git diff <每一個已修改的檔案>
```

`tests/_scratch_*.test.ts` **一律維持不追蹤**，不需要詢問，也不要 `git add`。

- [ ] **Step 3: 提交 owner 決定保留的改動**

```bash
git add <owner 指定的檔案>
```

提交訊息依實際改動內容撰寫，說明**為什麼**調這個數值，結尾加：

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

若 owner 決定全部丟棄，改用 `git restore <檔案>`，並跳過本步驟。

- [ ] **Step 4: 收尾後重跑測試**

工作區剛動過，基準要重新確立：

```bash
npx vitest run
```

Expected: 全過，exit 0。

- [ ] **Step 5: 收尾後重跑型別檢查**

```bash
npx tsc --noEmit
```

Expected: 無輸出，exit 0。

- [ ] **Step 6: 確認工作區已乾淨**

```bash
git status --short
```

Expected: 只剩 `?? tests/_scratch_*.test.ts` 之類的未追蹤探針，**沒有任何 `M` 開頭的行**。若還有已修改未提交的檔案，回到 Step 2。

- [ ] **Step 7: 推上收尾的 commit**

```bash
git push origin feat/phase6a-living-quarry
```

若 Step 3 沒有產生任何 commit，這一步會顯示 `Everything up-to-date`，屬正常。

- [ ] **Step 8: [OWNER] 把遠端預設分支改成 main**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail/settings`
→ **Default branch** → 由 `feat/phase1-retention-ui` 改為 `main` → 確認。

**這一步必須在開 PR 之前完成。** GitHub 開 PR 時 base 分支會預設成 repo 的預設分支；現在那個指標指著 8/31 的文件分支，不先修的話 PR 會默默地開錯目標。

- [ ] **Step 9: 確認預設分支已生效**

```bash
git remote set-head origin --auto
```

```bash
git symbolic-ref refs/remotes/origin/HEAD
```

Expected: `refs/remotes/origin/main`。若仍是舊分支，回到 Step 8 確認設定有存到。

- [ ] **Step 10: [OWNER] 啟用 Pages**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail/settings/pages`
→ **Build and deployment** → **Source** 選 **GitHub Actions**。

Expected: 頁面改顯示「GitHub Actions」而非「Deploy from a branch」。這一步同時會建立 `deploy` job 需要的 `github-pages` environment。

**這一步必須在合併之前完成。** 合併進 `main` 會立刻觸發首次部署，Pages 沒啟用的話 `deploy` job 會直接失敗。**workflow 無權自行啟用 Pages**，只能人工點。

---

## Task 3: 走 PR 合併並完成首次部署驗收

規格 §2 裁定首次上線走 PR 而非本地快轉：第一次跑這套流程要在真實環境驗證，紅燈該出現在 PR 上，而不是在已經合進 `main`、正往線上推的時候。

**Files:**
- 無檔案變更。本 Task 是 GitHub 網頁端操作與驗收。

**Interfaces:**
- Consumes: Task 1 的 `ci.yml`、Task 2 產出的乾淨工作區與 GitHub 端設定
- Produces: 線上可玩的 `https://yinyaoqing.github.io/ridge_hunters_trail/`

- [ ] **Step 1: [OWNER] 開 PR**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail/compare/main...feat/phase6a-living-quarry`
→ **Create pull request**。

確認 base 是 `main`、compare 是 `feat/phase6a-living-quarry`。PR 描述結尾加：

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 2: [OWNER] 確認 PR 上的檢查綠燈**

在 PR 頁面下方的檢查區塊。

Expected:
- `check` 綠燈
- `deploy` skipped（此刻仍不在 `main` 上）——**正常**

紅燈就**停下來回報**，不要合併。

- [ ] **Step 3: [OWNER] 合併 PR**

在 PR 頁面按 **Merge pull request** → **Confirm merge**。

合併的那一刻就會觸發 `main` 上的首次部署。

- [ ] **Step 4: [OWNER] 確認兩個 job 都綠燈**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail/actions`。

Expected:
- `check` 綠燈，`Test Files  35 passed (35)`，測試總數與 Task 1 Step 4 記下的一致
- `deploy` 綠燈（這次不再是 skipped）
- `deploy` job 摘要頁顯示 `page_url` 為 `https://yinyaoqing.github.io/ridge_hunters_trail/`

若 `deploy` 失敗且錯誤提到 environment 或 permission，多半是 Task 2 Step 10 沒生效——回頭確認 Source 真的存成了「GitHub Actions」。

- [ ] **Step 5: [OWNER] 開啟網址實際玩一局**

**這是唯一真正算數的驗收。** base path 錯掉的話，build 會成功、`deploy` 會綠燈、頁面照樣是白的——前四步全綠不代表遊戲能玩。

開啟 `https://yinyaoqing.github.io/ridge_hunters_trail/`，逐項確認：

1. 畫面載入，不是白畫面（白畫面 → 按 F12 看 Console，多半是資源 404）
2. 首次進入會彈出玩法說明（`src/scenes/MapScene.ts` 的 localStorage 首啟邏輯）
3. 能開始一局，地圖與線索畫得出來
4. 生物 sprite 與地形貼圖有顯示——這驗證 `public/assets/**.png` 確實進了 artifact

任一項不過，**停下來回報並附上 Console 錯誤訊息**。

**不算失敗的一件事**：首次載入時字型可能先以 fallback 字體顯示、隨後跳成
Marcellus／Karla。`index.html` 從 `fonts.googleapis.com` 載字型，本機開發時多半
已快取所以看不到這個跳動。這是規格 §8 已知並接受的風險，**不要為此改動任何東西**
——自託管字型明確不在本計畫範圍。

- [ ] **Step 6: 把本機 main 同步到合併後的狀態**

PR 是在 GitHub 上合併的，本機 `main` 還停在合併前：

```bash
git switch main
```

```bash
git pull origin main
```

Expected: 快轉到含有合併結果的 commit。

- [ ] **Step 7: 確認建置產物沒被推進版控**

```bash
git ls-files | grep dist
```

Expected: **無輸出**。grep 找不到會以 exit 1 結束，這裡的 exit 1 是正確結果。

- [ ] **Step 8: [OWNER] 把線上網址掛到 repo 首頁**

開啟 `https://github.com/yinyaoqing/ridge_hunters_trail`，右上角 **About** 齒輪 → 勾選 **Use your GitHub Pages website**。

純門面，但這是「別人怎麼玩得到」這個問題的最後一哩。

- [ ] **Step 9: 清掉淨室**

```bash
rm -rf "<CI_DIR>"
```

裡面有一份完整的 `node_modules`，留著只是佔空間。

---

## 回滾

若某次推上 `main` 之後線上版壞了：

```bash
git revert <壞掉的 commit>
```

```bash
git push origin main
```

revert 會觸發一次新的部署，把線上換回上一個可用狀態。

**不要用 `git push --force` 回滾。** Pages 部署的是 artifact 而非分支內容，強推歷史不會讓線上版跟著回去，只會弄亂歷史而線上依然是壞的。

## 明確不在本計畫範圍

規格 §7 已列，此處重申以免執行時順手多做：分享預覽 meta（`og:*`）、自訂網域、PR 預覽部署、itch.io 自動發行、自託管字型。**任何一項都不要順手加進來。**
