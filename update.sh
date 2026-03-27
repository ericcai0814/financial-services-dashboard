#!/usr/bin/env bash
# 更新投資儀表板資料（從 yfinance 拉取最新報價）→ 自動推送到 GitHub Pages
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p logs

echo "══════════════════════════════════════"
echo "更新開始：$(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════"

source .venv/bin/activate
python scripts/fetch_data.py

# 自動 commit + push 到 GitHub Pages
if git diff --quiet data/ 2>/dev/null; then
  echo "資料無變動，跳過推送"
else
  git add data/
  git commit -m "data: 更新報價 $(date '+%Y-%m-%d %H:%M')"
  git push origin master
  echo "✓ 已推送到 GitHub Pages"
fi

echo "更新完成：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""
