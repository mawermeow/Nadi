# Nadi System Design Slides

以 [reveal.js](https://revealjs.com/) 製作的設計決策簡報，內容涵蓋：

- Functional Requirements
- Non-Functional Requirements
- API Design
- High-Level Design
- Deep Dive

## 本機預覽

在專案根目錄執行：

```bash
pnpm dlx serve docs/slides
```

然後開啟 [http://localhost:3000](http://localhost:3000)。

或使用任何靜態檔案伺服器，直接開啟 `docs/slides/index.html` 也可以。

## 操作方式

- `→` / `←`：上一頁 / 下一頁
- `Esc`：總覽模式
- `S`：Speaker notes（若之後有加入）
- 網址 `#/2` 可直接跳到指定 slide

## 部署到 GitHub Pages

此 repo 已包含 GitHub Actions workflow：`.github/workflows/deploy-slides.yml`

啟用步驟：

1. 到 GitHub repo → **Settings** → **Pages**
2. **Build and deployment** 選 **GitHub Actions**
3. Push 到 `main` 後，workflow 會部署整個 `docs/`（`docs/index.html` 會導向 `docs/slides/`）
4. 完成後可從 `https://mawermeow.github.io/Nadi/` 開啟

這樣可以同時承載 slides 與其他文件頁面。
