"""
fetch_data.py — 從 yfinance 拉取持倉即時價格，輸出 portfolio.json 與 etf_xray.json。

Usage:
    source .venv/bin/activate
    python scripts/fetch_data.py
"""

import json
import os
import sys
from datetime import datetime

import yfinance as yf

# ─── 路徑設定 ───────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(DASHBOARD_DIR, "data")
MY_TW_COVERAGE = os.path.join(os.path.dirname(DASHBOARD_DIR), "My-TW-Coverage")

# ─── 持倉定義（從 holdings.json 讀取）─────────────────────
HOLDINGS_FILE = os.path.join(DATA_DIR, "holdings.json")


def load_holdings():
    """從 data/holdings.json 讀取持倉設定。"""
    with open(HOLDINGS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    holdings = []
    for h in data["holdings"]:
        ticker = h["ticker"]
        yf_ticker = f"{ticker}.TW" if not ticker.endswith(".TW") else ticker
        holdings.append({
            "ticker": ticker,
            "yf_ticker": yf_ticker,
            "name": h["name"],
            "shares": h["shares"],
            "unit": "股",
            "avg_cost": h["avg_cost"],
            "type": h.get("type", "stock"),
        })
    return holdings

# ─── ETF 成分股定義（硬編碼已知成分股）───────────────────
ETF_COMPONENTS = {
    "006208": {
        "name": "富邦台50",
        "total_holdings": 50,
        "top_holdings": [
            {"name": "台積電", "ticker": "2330.TW", "weight": 48.52},
            {"name": "鴻海", "ticker": "2317.TW", "weight": 5.42},
            {"name": "聯發科", "ticker": "2454.TW", "weight": 4.81},
            {"name": "台達電", "ticker": "2308.TW", "weight": 2.58},
            {"name": "廣達", "ticker": "2382.TW", "weight": 2.55},
            {"name": "富邦金", "ticker": "2881.TW", "weight": 2.15},
            {"name": "國泰金", "ticker": "2882.TW", "weight": 1.98},
            {"name": "中華電", "ticker": "2412.TW", "weight": 1.85},
            {"name": "日月光投控", "ticker": "3711.TW", "weight": 1.72},
            {"name": "聯電", "ticker": "2303.TW", "weight": 1.55},
        ],
        "sector_allocation": [
            {"sector": "半導體", "weight": 62.3},
            {"sector": "金融", "weight": 12.1},
            {"sector": "電子零組件", "weight": 8.5},
            {"sector": "通訊網路", "weight": 5.2},
            {"sector": "電腦及週邊", "weight": 4.8},
            {"sector": "其他", "weight": 7.1},
        ],
        "region_allocation": [
            {"region": "台灣", "weight": 100.0},
        ],
    },
    "00878": {
        "name": "國泰永續高股息",
        "total_holdings": 30,
        "top_holdings": [
            {"name": "華碩", "ticker": "2357.TW", "weight": 5.89},
            {"name": "大聯大", "ticker": "3702.TW", "weight": 5.21},
            {"name": "聯強", "ticker": "2347.TW", "weight": 4.85},
            {"name": "廣達", "ticker": "2382.TW", "weight": 4.72},
            {"name": "仁寶", "ticker": "2324.TW", "weight": 4.55},
            {"name": "緯創", "ticker": "3231.TW", "weight": 4.38},
            {"name": "英業達", "ticker": "2356.TW", "weight": 4.12},
            {"name": "技嘉", "ticker": "2376.TW", "weight": 3.95},
            {"name": "微星", "ticker": "2377.TW", "weight": 3.78},
            {"name": "光寶", "ticker": "2301.TW", "weight": 3.62},
        ],
        "sector_allocation": [
            {"sector": "電腦及週邊", "weight": 35.2},
            {"sector": "半導體", "weight": 22.8},
            {"sector": "電子零組件", "weight": 18.5},
            {"sector": "通訊網路", "weight": 8.3},
            {"sector": "金融", "weight": 7.8},
            {"sector": "其他", "weight": 7.4},
        ],
        "region_allocation": [
            {"region": "台灣", "weight": 100.0},
        ],
    },
    "00881": {
        "name": "國泰台灣科技龍頭",
        "total_holdings": 15,
        "top_holdings": [
            {"name": "台積電", "ticker": "2330.TW", "weight": 30.25},
            {"name": "聯發科", "ticker": "2454.TW", "weight": 10.82},
            {"name": "鴻海", "ticker": "2317.TW", "weight": 8.15},
            {"name": "台達電", "ticker": "2308.TW", "weight": 6.33},
            {"name": "日月光投控", "ticker": "3711.TW", "weight": 5.72},
            {"name": "聯電", "ticker": "2303.TW", "weight": 5.18},
            {"name": "廣達", "ticker": "2382.TW", "weight": 4.95},
            {"name": "瑞昱", "ticker": "2379.TW", "weight": 4.68},
            {"name": "聯詠", "ticker": "3034.TW", "weight": 4.22},
            {"name": "矽力-KY", "ticker": "6415.TW", "weight": 3.85},
        ],
        "sector_allocation": [
            {"sector": "半導體", "weight": 72.5},
            {"sector": "電子零組件", "weight": 12.3},
            {"sector": "電腦及週邊", "weight": 8.8},
            {"sector": "通訊網路", "weight": 6.4},
        ],
        "region_allocation": [
            {"region": "台灣", "weight": 100.0},
        ],
    },
    "00910": {
        "name": "第一金太空衛星",
        "total_holdings": 30,
        "top_holdings": [
            {"name": "Planet Labs", "ticker": "PL", "weight": 8.24},
            {"name": "Rocket Lab", "ticker": "RKLB", "weight": 7.55},
            {"name": "L3Harris Technologies", "ticker": "LHX", "weight": 6.12},
            {"name": "Northrop Grumman", "ticker": "NOC", "weight": 5.88},
            {"name": "Iridium Communications", "ticker": "IRDM", "weight": 5.45},
            {"name": "Trimble", "ticker": "TRMB", "weight": 4.92},
            {"name": "Garmin", "ticker": "GRMN", "weight": 4.78},
            {"name": "SES S.A.", "ticker": "SES", "weight": 4.35},
            {"name": "Viasat", "ticker": "VSAT", "weight": 4.12},
            {"name": "BlackSky Technology", "ticker": "BKSY", "weight": 3.88},
        ],
        "sector_allocation": [
            {"sector": "航太與國防", "weight": 48.22},
            {"sector": "通訊服務", "weight": 22.15},
            {"sector": "資訊科技", "weight": 18.33},
            {"sector": "工業", "weight": 11.30},
        ],
        "region_allocation": [
            {"region": "美國", "weight": 60.82},
            {"region": "歐洲", "weight": 18.45},
            {"region": "亞太", "weight": 12.33},
            {"region": "其他", "weight": 8.40},
        ],
    },
}

# ─── 供應鏈連結（My-TW-Coverage 報告對應）───────────────
COVERAGE_LINKS = {
    "2330.TW": {"name": "台積電", "path": "Semiconductors/2330_台積電.md"},
    "2317.TW": {"name": "鴻海", "path": "Electronic Components/2317_鴻海.md"},
    "2454.TW": {"name": "聯發科", "path": "Semiconductors/2454_聯發科.md"},
    "2308.TW": {"name": "台達電", "path": "Electronic Components/2308_台達電.md"},
    "2382.TW": {"name": "廣達", "path": "Computer Hardware/2382_廣達.md"},
    "2303.TW": {"name": "聯電", "path": "Semiconductors/2303_聯電.md"},
    "3711.TW": {"name": "日月光投控", "path": "Semiconductors/3711_日月光投控.md"},
    "2357.TW": {"name": "華碩", "path": "Computer Hardware/2357_華碩.md"},
    "2324.TW": {"name": "仁寶", "path": "Computer Hardware/2324_仁寶.md"},
    "3231.TW": {"name": "緯創", "path": "Computer Hardware/3231_緯創.md"},
    "2356.TW": {"name": "英業達", "path": "Computer Hardware/2356_英業達.md"},
    "2379.TW": {"name": "瑞昱", "path": "Semiconductors/2379_瑞昱.md"},
    "3034.TW": {"name": "聯詠", "path": "Semiconductors/3034_聯詠.md"},
}

GITHUB_BASE = "https://github.com/ericcai-tw/My-TW-Coverage/blob/main/Pilot_Reports"


def fetch_current_prices(holdings):
    """批次拉取所有持倉的即時價格。"""
    tickers_str = " ".join(h["yf_ticker"] for h in holdings)
    print(f"正在從 yfinance 拉取報價: {tickers_str}")

    data = yf.download(tickers_str, period="1d", group_by="ticker", progress=False)

    prices = {}
    for h in holdings:
        t = h["yf_ticker"]
        try:
            if len(holdings) == 1:
                close = data["Close"].iloc[-1]
            else:
                close = data[(t, "Close")].iloc[-1]
            val = float(close)
            if val != val:  # NaN check
                raise ValueError("NaN price")
            prices[t] = round(val, 2)
        except (KeyError, IndexError, ValueError):
            prices[t] = None

    # 個別重試失敗的 ticker
    failed = [h for h in holdings if prices.get(h["yf_ticker"]) is None]
    for h in failed:
        t = h["yf_ticker"]
        print(f"  ⚠ {t} 批次失敗，個別重試...")
        try:
            single = yf.Ticker(t)
            hist = single.history(period="5d")
            if not hist.empty:
                prices[t] = round(float(hist["Close"].iloc[-1]), 2)
        except Exception as e:
            print(f"  ✗ {t} 重試失敗: {e}")

    return prices


def build_portfolio(holdings, prices):
    """計算損益並建構 portfolio.json 資料結構。"""
    result_holdings = []
    total_value = 0
    total_cost = 0

    for h in holdings:
        price = prices.get(h["yf_ticker"])
        if price is None:
            print(f"  ⚠ {h['ticker']} 無價格，跳過計算")
            price = h["avg_cost"]  # fallback to cost

        market_value = round(price * h["shares"], 2)
        cost_basis = round(h["avg_cost"] * h["shares"], 2)
        pnl = round(market_value - cost_basis, 2)
        return_pct = round((pnl / cost_basis) * 100, 2) if cost_basis > 0 else 0

        total_value += market_value
        total_cost += cost_basis

        result_holdings.append({
            "ticker": h["ticker"],
            "name": h["name"],
            "shares": h["shares"],
            "unit": h["unit"],
            "avg_cost": h["avg_cost"],
            "current_price": price,
            "market_value": round(market_value),
            "pnl": round(pnl),
            "return_pct": return_pct,
            "type": h["type"],
        })

    total_pnl = round(total_value - total_cost)
    total_return = round((total_pnl / total_cost) * 100, 1) if total_cost > 0 else 0

    return {
        "updated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "summary": {
            "total_value": round(total_value),
            "total_pnl": total_pnl,
            "total_return": total_return,
        },
        "holdings": result_holdings,
    }


def build_etf_xray(etf_components):
    """建構 etf_xray.json，加入供應鏈連結。"""
    xray = {}
    for ticker, data in etf_components.items():
        coverage_links = {}
        for holding in data["top_holdings"]:
            ht = holding["ticker"]
            if ht in COVERAGE_LINKS:
                info = COVERAGE_LINKS[ht]
                coverage_links[ht] = {
                    "name": info["name"],
                    "url": f"{GITHUB_BASE}/{info['path']}",
                }

        # 嘗試拉取成分股的 P/E, P/B
        enriched_holdings = []
        for holding in data["top_holdings"]:
            enriched = {**holding}
            enriched.setdefault("pe", None)
            enriched.setdefault("pb", None)
            enriched_holdings.append(enriched)

        xray[ticker] = {
            "name": data["name"],
            "total_holdings": data["total_holdings"],
            "top_holdings": enriched_holdings,
            "sector_allocation": data["sector_allocation"],
            "region_allocation": data["region_allocation"],
            "coverage_links": coverage_links,
        }

    return xray


def enrich_xray_valuations(xray):
    """批次拉取 ETF 成分股的 P/E 和 P/B 估值。"""
    all_tickers = set()
    for etf_data in xray.values():
        for h in etf_data["top_holdings"]:
            all_tickers.add(h["ticker"])

    print(f"正在拉取 {len(all_tickers)} 檔成分股估值...")

    valuations = {}
    for t in all_tickers:
        try:
            info = yf.Ticker(t).info
            valuations[t] = {
                "pe": round(info["trailingPE"], 2) if info.get("trailingPE") else None,
                "pb": round(info["priceToBook"], 2) if info.get("priceToBook") else None,
            }
        except Exception:
            valuations[t] = {"pe": None, "pb": None}

    for etf_data in xray.values():
        for h in etf_data["top_holdings"]:
            v = valuations.get(h["ticker"], {})
            h["pe"] = v.get("pe")
            h["pb"] = v.get("pb")


def build_overlap(etf_components):
    """分析跨 ETF 的重疊持股。"""
    # 建立 ticker → {etf: weight} 映射
    ticker_to_etfs = {}
    for etf_ticker, data in etf_components.items():
        for h in data["top_holdings"]:
            entry = ticker_to_etfs.setdefault(h["ticker"], {"name": h["name"], "etfs": {}})
            entry["etfs"][etf_ticker] = h["weight"]

    # 找出出現在 ≥2 檔 ETF 的個股
    overlapping = [
        {"name": v["name"], "ticker": t, "etfs": v["etfs"]}
        for t, v in ticker_to_etfs.items()
        if len(v["etfs"]) >= 2
    ]
    overlapping.sort(key=lambda x: len(x["etfs"]), reverse=True)

    # 建構 ETF 兩兩交叉矩陣
    etf_list = list(etf_components.keys())
    matrix = []
    for i, a in enumerate(etf_list):
        tickers_a = {h["ticker"] for h in etf_components[a]["top_holdings"]}
        for b in etf_list[i + 1:]:
            tickers_b = {h["ticker"] for h in etf_components[b]["top_holdings"]}
            common = tickers_a & tickers_b
            if not common:
                continue
            weight_a = sum(
                h["weight"] for h in etf_components[a]["top_holdings"]
                if h["ticker"] in common
            )
            weight_b = sum(
                h["weight"] for h in etf_components[b]["top_holdings"]
                if h["ticker"] in common
            )
            matrix.append({
                "etf_a": a, "name_a": etf_components[a]["name"],
                "etf_b": b, "name_b": etf_components[b]["name"],
                "overlap_count": len(common),
                "overlap_weight_a": round(weight_a, 2),
                "overlap_weight_b": round(weight_b, 2),
            })

    return {"matrix": matrix, "overlapping_stocks": overlapping}


def build_history(holdings):
    """拉取 90 天歷史收盤價，計算每日持倉市值。"""
    tickers_str = " ".join(h["yf_ticker"] for h in holdings)
    print(f"正在拉取 90 天歷史資料: {tickers_str}")

    data = yf.download(tickers_str, period="3mo", group_by="ticker", progress=False)
    if data.empty:
        print("  ⚠ 無歷史資料")
        return None

    dates = [d.strftime("%Y-%m-%d") for d in data.index]
    per_holding = {}
    total_value = [0.0] * len(dates)
    cost_basis = 0

    for h in holdings:
        t = h["yf_ticker"]
        cost_basis += h["avg_cost"] * h["shares"]
        try:
            if len(holdings) == 1:
                closes = data["Close"]
            else:
                closes = data[(t, "Close")]
            daily_values = []
            last_valid = h["avg_cost"]
            for val in closes:
                fv = float(val)
                if fv != fv:  # NaN
                    fv = last_valid
                else:
                    last_valid = fv
                mv = round(fv * h["shares"])
                daily_values.append(mv)
            per_holding[h["ticker"]] = daily_values
            total_value = [tv + dv for tv, dv in zip(total_value, daily_values)]
        except (KeyError, IndexError):
            print(f"  ⚠ {t} 無歷史資料，跳過")

    total_value = [round(v) for v in total_value]

    return {
        "dates": dates,
        "total_value": total_value,
        "cost_basis": round(cost_basis),
        "per_holding": per_holding,
    }


def write_json(data, filename):
    """寫入 JSON 檔案到 DATA_DIR。"""
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    # Step 0: 載入持倉設定
    holdings = load_holdings()
    print(f"載入 {len(holdings)} 檔持倉")

    # Step 1: 拉取持倉價格
    prices = fetch_current_prices(holdings)
    for h in holdings:
        p = prices.get(h["yf_ticker"], "N/A")
        print(f"  {h['ticker']} {h['name']}: ${p}")

    # Step 2: 建構 portfolio.json
    portfolio = build_portfolio(holdings, prices)
    path = write_json(portfolio, "portfolio.json")
    print(f"\n✓ portfolio.json → {path}")
    print(f"  總市值: ${portfolio['summary']['total_value']:,}")
    print(f"  總損益: ${portfolio['summary']['total_pnl']:,}")
    print(f"  總報酬率: {portfolio['summary']['total_return']}%")

    # Step 3: 建構 etf_xray.json
    xray = build_etf_xray(ETF_COMPONENTS)
    enrich_xray_valuations(xray)
    path = write_json(xray, "etf_xray.json")
    print(f"\n✓ etf_xray.json → {path}")

    # Step 4: 建構 overlap.json
    overlap = build_overlap(ETF_COMPONENTS)
    path = write_json(overlap, "overlap.json")
    print(f"\n✓ overlap.json → {path}")
    print(f"  重疊個股: {len(overlap['overlapping_stocks'])} 檔")
    print(f"  ETF 交叉對: {len(overlap['matrix'])} 組")

    # Step 5: 建構 history.json
    history = build_history(holdings)
    if history:
        path = write_json(history, "history.json")
        print(f"\n✓ history.json → {path}")
        print(f"  天數: {len(history['dates'])}")
    else:
        print("\n⚠ history.json 跳過（無歷史資料）")

    print("\n🎉 資料更新完成！")


if __name__ == "__main__":
    main()
