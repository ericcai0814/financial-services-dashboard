# 儀表板功能擴充：自動化 + ETF 重疊分析 + 趨勢線圖

## Context

儀表板 MVP 已完成（摘要卡片、資產配置 Donut、持倉表格、ETF X 光展開）。現在擴充三個功能：
1. **自動化**：cron 定時更新資料
2. **ETF 重疊分析**：找出跨 ETF 的重複持股和實質曝險
3. **趨勢線圖**：90 天持倉市值走勢

## Feature 1: 自動化（cron 定時更新）

### 修改檔案
- `dashboard/update.sh`（已存在）— 加入 log 輸出
- 新增 crontab entry

### 實作
- crontab：每個交易日 14:05（台股 13:30 收盤後）執行 `update.sh`
- `update.sh` 加入 log 紀錄到 `dashboard/logs/update.log`
- cron 指令：`5 14 * * 1-5 /Users/ericcai/financial-services/dashboard/update.sh >> /Users/ericcai/financial-services/dashboard/logs/update.log 2>&1`

## Feature 2: ETF 重疊分析

### 修改檔案
- `scripts/fetch_data.py` — 新增 `build_overlap()` 函式
- `data/overlap.json` — 新輸出
- `index.html` — 新增重疊分析區塊
- `app.js` — 載入 overlap.json 並渲染重疊矩陣 + 重疊個股表
- `style.css` — 重疊矩陣樣式

### 資料格式 `overlap.json`
```json
{
  "matrix": [
    { "etf_a": "006208", "etf_b": "00881", "overlap_count": 7, "overlap_weight_a": 19.66, "overlap_weight_b": 75.15 }
  ],
  "overlapping_stocks": [
    { "name": "台積電", "ticker": "2330.TW", "etfs": { "006208": 48.52, "00881": 30.25 } },
    { "name": "廣達", "ticker": "2382.TW", "etfs": { "006208": 2.55, "00878": 4.72, "00881": 4.95 } }
  ]
}
```

### 前端渲染
- 重疊矩陣表：N×N ETF 交叉表，顯示重疊檔數
- 重疊個股列表：出現在 ≥2 檔 ETF 的個股，依重疊 ETF 數排序
- 放在資產配置 Donut 和持倉表之間或之後

## Feature 3: 趨勢線圖（90 天市值走勢）

### 修改檔案
- `scripts/fetch_data.py` — 新增 `build_history()` 函式
- `data/history.json` — 新輸出
- `index.html` — 新增趨勢圖容器
- `app.js` — Chart.js Line chart 渲染

### Python 邏輯
- `yf.download(tickers, period="3mo")` 批次拉取 90 天日線
- 每日計算各持倉市值 = 收盤價 × 庫存 → 加總 = 每日總市值
- 同時算每日成本線（水平線 = 總成本）作為參考

### 資料格式 `history.json`
```json
{
  "dates": ["2025-12-27", "2025-12-30", "..."],
  "total_value": [1350000, 1355000, "..."],
  "cost_basis": 1037325,
  "per_holding": {
    "006208": [1050000, 1053000, "..."],
    "00878": [180000, 179500, "..."]
  }
}
```

### 前端渲染
- Line Chart：總市值走勢（主線）+ 成本線（虛線）
- Tooltip 顯示日期 + 市值 + 損益
- 放在摘要卡片下方、資產配置上方

## 實作順序

1. **Python 端**：在 `fetch_data.py` 的 `main()` 中依序加入 `build_overlap()` 和 `build_history()`
2. **前端**：`index.html` 加容器 → `app.js` 加渲染邏輯 → `style.css` 加樣式
3. **自動化**：更新 `update.sh` + 設定 crontab

## 驗證

1. `./update.sh` → 確認 4 個 JSON 正確輸出（portfolio / etf_xray / overlap / history）
2. Playwright 截圖：
   - 趨勢線圖渲染（含成本虛線）
   - 重疊分析矩陣 + 個股列表
3. `crontab -l` 確認 cron entry 已設定
