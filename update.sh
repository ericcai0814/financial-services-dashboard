#!/usr/bin/env bash
# 更新投資儀表板資料（從 yfinance 拉取最新報價）
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p logs

echo "══════════════════════════════════════"
echo "更新開始：$(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════"

source .venv/bin/activate
python scripts/fetch_data.py

echo "更新完成：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""
