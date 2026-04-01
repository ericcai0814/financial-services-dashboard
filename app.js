/**
 * app.js — 投資儀表板前端渲染邏輯
 *
 * 職責：
 * 1. 載入 data/*.json
 * 2. 渲染摘要卡片、資產配置 Donut、持倉表格
 * 3. 點擊 ETF 列展開 X 光面板（產業/地區 Donut + 成分股表格）
 */

// ─── 常數 ──────────────────────────────────────
const COLORS = {
  UP: '#EF4444',     // 漲 — 紅（台股慣例）
  DOWN: '#22C55E',   // 跌 — 綠（台股慣例）
  NEUTRAL: '#6B7494',
  LINK: '#34D399',
};

// S30 Aurora Borealis palette
const CHART_PALETTE = [
  '#34D399', '#A78BFA', '#60A5FA', '#F472B6',
  '#FBBF24', '#2DD4BF', '#818CF8', '#FB923C',
  '#4ADE80', '#E879F9', '#38BDF8', '#F87171',
];

// ─── DOM 工具 ──────────────────────────────────
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') node.className = val;
    else if (key === 'textContent') node.textContent = val;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), val);
    else node.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

// ─── 格式化工具 ────────────────────────────────
function formatCurrency(value) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatPnl(value) {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(value / 1_000).toFixed(0)}K`;
  return `${sign}$${value.toLocaleString()}`;
}

function formatReturn(pct) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function pnlClass(value) {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'neutral';
}

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

// ─── 數字動畫 ──────────────────────────────────
function animateValue(element, target, formatter, duration = 800) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = start + (target - start) * eased;
    element.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── 資料載入 ──────────────────────────────────
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) return null;
  return res.json();
}

async function loadData() {
  const [portfolio, xray, overlap, history, exposure, watchlist] = await Promise.all([
    fetchJson('data/portfolio.json'),
    fetchJson('data/etf_xray.json'),
    fetchJson('data/overlap.json'),
    fetchJson('data/history.json'),
    fetchJson('data/exposure.json'),
    fetchJson('data/watchlist_live.json'),
  ]);
  return { portfolio, xray, overlap, history, exposure, watchlist };
}

// ─── 摘要卡片 ──────────────────────────────────
function renderSummary(summary) {
  const valueEl = document.getElementById('total-value');
  animateValue(valueEl, summary.total_value, formatCurrency);

  const pnlEl = document.getElementById('total-pnl');
  pnlEl.className = `summary-value ${pnlClass(summary.total_pnl)}`;
  animateValue(pnlEl, summary.total_pnl, formatPnl);

  const retEl = document.getElementById('total-return');
  retEl.className = `summary-value ${pnlClass(summary.total_return)}`;
  animateValue(retEl, summary.total_return, formatReturn);
}

// ─── 資產配置 Donut ────────────────────────────
function renderAllocationChart(holdings) {
  const ctx = document.getElementById('allocation-chart').getContext('2d');
  const labels = holdings.map(h => `${h.ticker} ${h.name}`);
  const data = holdings.map(h => h.market_value);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_PALETTE.slice(0, holdings.length),
        borderWidth: 0,
        hoverBorderWidth: 2,
        hoverBorderColor: '#E2E8F0',
      }],
    },
    options: {
      cutout: '65%',
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#6B7494',
            padding: 12,
            font: { family: 'Syne', size: 12 },
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─── 持倉表格 ──────────────────────────────────
let expandedTicker = null;
let xrayData = null;
const chartInstances = {};

function renderHoldings(holdings) {
  const tbody = document.getElementById('holdings-body');
  tbody.replaceChildren();

  for (const h of holdings) {
    const isEtf = h.type === 'etf';
    const indicator = el('span', {
      className: `expand-indicator ${isEtf ? '' : 'invisible'}`,
      textContent: isEtf ? '▶' : '',
    });

    const badgeChildren = isEtf
      ? [h.name, el('span', { className: 'etf-badge', textContent: 'ETF' })]
      : [h.name];

    const tr = el('tr', {}, [
      el('td', { className: 'px-2' }, [indicator, ` ${h.ticker}`]),
      el('td', { className: 'px-2' }, badgeChildren),
      el('td', { className: 'text-right px-2', textContent: h.shares.toLocaleString() }),
      el('td', { className: 'text-right px-2', textContent: `$${h.current_price.toFixed(2)}` }),
      el('td', { className: 'text-right px-2', textContent: formatCurrency(h.market_value) }),
      el('td', { className: `text-right px-2 ${pnlClass(h.pnl)}`, textContent: formatPnl(h.pnl) }),
      el('td', { className: `text-right px-2 ${pnlClass(h.return_pct)}`, textContent: formatReturn(h.return_pct) }),
    ]);

    if (isEtf) {
      tr.addEventListener('click', () => toggleXray(h.ticker, tr));
      tr.style.cursor = 'pointer';
    }

    tbody.appendChild(tr);
  }
}

// ─── ETF X 光展開/收合 ────────────────────────
function toggleXray(ticker, rowEl) {
  const container = document.getElementById('xray-container');

  // 收合已展開的
  if (expandedTicker === ticker) {
    container.classList.add('hidden');
    container.replaceChildren();
    expandedTicker = null;
    rowEl.classList.remove('expanded');
    rowEl.querySelector('.expand-indicator').classList.remove('open');
    destroyXrayCharts();
    return;
  }

  // 清除之前的展開狀態
  const prevExpanded = document.querySelector('#holdings-body tr.expanded');
  if (prevExpanded) {
    prevExpanded.classList.remove('expanded');
    prevExpanded.querySelector('.expand-indicator').classList.remove('open');
  }
  destroyXrayCharts();

  const etf = xrayData[ticker];
  if (!etf) return;

  expandedTicker = ticker;
  rowEl.classList.add('expanded');
  rowEl.querySelector('.expand-indicator').classList.add('open');

  container.classList.remove('hidden');
  container.replaceChildren(buildXrayPanel(ticker, etf));

  renderXrayCharts(ticker, etf);

  // 平滑滾動到 X 光面板
  setTimeout(() => {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function buildXrayPanel(ticker, etf) {
  // 成分股表格 rows
  const tbodyRows = etf.top_holdings.map(h => {
    const linkCell = el('td', { className: 'text-center' });
    if (etf.coverage_links[h.ticker]) {
      linkCell.appendChild(el('a', {
        href: etf.coverage_links[h.ticker].url,
        target: '_blank',
        className: 'coverage-link',
        title: '查看供應鏈報告',
        textContent: '↗',
      }));
    }

    return el('tr', {}, [
      el('td', { textContent: h.name }),
      el('td', { className: 'text-slate-400', textContent: h.ticker }),
      el('td', { className: 'text-right', textContent: `${h.weight.toFixed(2)}%` }),
      el('td', { className: 'text-right', textContent: h.pe != null ? h.pe.toFixed(1) : '—' }),
      el('td', { className: 'text-right', textContent: h.pb != null ? h.pb.toFixed(1) : '—' }),
      linkCell,
    ]);
  });

  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: '名稱' }),
      el('th', { textContent: '代號' }),
      el('th', { className: 'text-right', textContent: '權重' }),
      el('th', { className: 'text-right', textContent: 'P/E' }),
      el('th', { className: 'text-right', textContent: 'P/B' }),
      el('th', { className: 'text-center', textContent: '供應鏈' }),
    ]),
  ]);
  const tbody = el('tbody', {}, tbodyRows);

  const sectorCanvas = el('canvas', { id: `xray-sector-${ticker}` });
  const regionCanvas = el('canvas', { id: `xray-region-${ticker}` });

  return el('div', { className: 'xray-panel' }, [
    el('h3', { textContent: `${ticker} ${etf.name} — ${etf.total_holdings} 檔成分股` }),
    el('div', { className: 'xray-charts' }, [
      el('div', { className: 'xray-chart-wrapper' }, [
        el('h4', { textContent: '產業配置' }),
        sectorCanvas,
      ]),
      el('div', { className: 'xray-chart-wrapper' }, [
        el('h4', { textContent: '地區配置' }),
        regionCanvas,
      ]),
    ]),
    el('div', { className: 'overflow-x-auto' }, [
      el('table', { className: 'xray-table' }, [thead, tbody]),
    ]),
  ]);
}

function renderXrayCharts(ticker, etf) {
  const sectorCtx = document.getElementById(`xray-sector-${ticker}`);
  const regionCtx = document.getElementById(`xray-region-${ticker}`);

  if (sectorCtx) {
    chartInstances.sector = new Chart(sectorCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: etf.sector_allocation.map(s => s.sector),
        datasets: [{
          data: etf.sector_allocation.map(s => s.weight),
          backgroundColor: CHART_PALETTE.slice(0, etf.sector_allocation.length),
          borderWidth: 0,
        }],
      },
      options: donutOptions(),
    });
  }

  if (regionCtx) {
    chartInstances.region = new Chart(regionCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: etf.region_allocation.map(r => r.region),
        datasets: [{
          data: etf.region_allocation.map(r => r.weight),
          backgroundColor: CHART_PALETTE.slice(0, etf.region_allocation.length),
          borderWidth: 0,
        }],
      },
      options: donutOptions(),
    });
  }
}

function donutOptions() {
  return {
    cutout: '60%',
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6B7494',
          padding: 8,
          font: { family: 'Syne', size: 11 },
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(1)}%`,
        },
      },
    },
  };
}

function destroyXrayCharts() {
  if (chartInstances.sector) {
    chartInstances.sector.destroy();
    chartInstances.sector = null;
  }
  if (chartInstances.region) {
    chartInstances.region.destroy();
    chartInstances.region = null;
  }
}

// ─── 趨勢線圖（含大盤比較切換）─────────────────
let historyData = null;
let trendMode = 'absolute'; // 'absolute' | 'indexed'

function renderTrendChart(history) {
  if (!history) return;
  historyData = history;
  buildTrendChart();

  document.getElementById('btn-absolute').addEventListener('click', () => {
    trendMode = 'absolute';
    document.getElementById('btn-absolute').classList.add('active');
    document.getElementById('btn-indexed').classList.remove('active');
    buildTrendChart();
  });
  document.getElementById('btn-indexed').addEventListener('click', () => {
    trendMode = 'indexed';
    document.getElementById('btn-indexed').classList.add('active');
    document.getElementById('btn-absolute').classList.remove('active');
    buildTrendChart();
  });
}

function buildTrendChart() {
  if (chartInstances.trend) {
    chartInstances.trend.destroy();
    chartInstances.trend = null;
  }
  const ctx = document.getElementById('trend-chart').getContext('2d');
  const h = historyData;

  if (trendMode === 'indexed' && h.benchmark && h.benchmark.length > 0) {
    // vs 大盤模式（base-100 歸一化）
    chartInstances.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: h.dates,
        datasets: [
          {
            label: '我的持倉',
            data: h.portfolio_indexed,
            borderColor: '#34D399',
            tension: 0.3, pointRadius: 0, pointHitRadius: 10, borderWidth: 2,
          },
          {
            label: '加權指數',
            data: h.benchmark,
            borderColor: '#A78BFA',
            tension: 0.3, pointRadius: 0, pointHitRadius: 10, borderWidth: 2,
          },
          {
            label: '基準線 (100)',
            data: new Array(h.dates.length).fill(100),
            borderColor: '#6B7494', borderDash: [6, 4],
            pointRadius: 0, borderWidth: 1,
          },
        ],
      },
      options: trendOptions((v) => v.toFixed(1)),
    });
  } else {
    // 市值模式
    chartInstances.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: h.dates,
        datasets: [
          {
            label: '總市值',
            data: h.total_value,
            borderColor: '#34D399',
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            fill: true, tension: 0.3, pointRadius: 0, pointHitRadius: 10, borderWidth: 2,
          },
          {
            label: '成本線',
            data: new Array(h.dates.length).fill(h.cost_basis),
            borderColor: '#6B7494', borderDash: [6, 4],
            pointRadius: 0, borderWidth: 1.5, fill: false,
          },
        ],
      },
      options: trendOptions((v) => formatCurrency(v)),
    });
  }
}

function trendOptions(yFormatter) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        ticks: { color: '#6B7494', font: { family: 'Syne', size: 10 }, maxTicksLimit: 8 },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        ticks: { color: '#6B7494', font: { family: 'Syne', size: 10 }, callback: yFormatter },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
    },
    plugins: {
      legend: {
        labels: { color: '#B8C0D0', font: { family: 'Syne', size: 11 }, usePointStyle: true },
      },
    },
  };
}

// ─── ETF 重疊分析 ──────────────────────────────
function renderOverlap(overlap) {
  if (!overlap) return;
  const section = document.getElementById('overlap-section');
  section.classList.remove('hidden');

  // 重疊矩陣
  const matrixContainer = document.getElementById('overlap-matrix');
  const mThead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: 'ETF A' }),
      el('th', { textContent: 'ETF B' }),
      el('th', { className: 'text-right', textContent: '重疊' }),
      el('th', { className: 'text-right', textContent: 'A 中佔比' }),
      el('th', { className: 'text-right', textContent: 'B 中佔比' }),
    ]),
  ]);
  const mRows = overlap.matrix.map(m => {
    const countClass = m.overlap_count >= 5 ? 'overlap-count high' : 'overlap-count';
    return el('tr', {}, [
      el('td', { textContent: `${m.etf_a} ${m.name_a}` }),
      el('td', { textContent: `${m.etf_b} ${m.name_b}` }),
      el('td', { className: 'text-right' }, [
        el('span', { className: countClass, textContent: `${m.overlap_count} 檔` }),
      ]),
      el('td', { className: 'text-right', textContent: `${m.overlap_weight_a}%` }),
      el('td', { className: 'text-right', textContent: `${m.overlap_weight_b}%` }),
    ]);
  });
  matrixContainer.replaceChildren(
    el('table', { className: 'overlap-table' }, [mThead, el('tbody', {}, mRows)])
  );

  // 重疊個股列表
  const stocksContainer = document.getElementById('overlap-stocks');
  const sThead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: '個股' }),
      el('th', { className: 'text-right', textContent: '出現次數' }),
      el('th', { textContent: '各 ETF 權重' }),
    ]),
  ]);
  const sRows = overlap.overlapping_stocks.map(s => {
    const etfWeights = Object.entries(s.etfs)
      .map(([etf, w]) => `${etf}: ${w}%`)
      .join('  ');
    return el('tr', {}, [
      el('td', { textContent: `${s.name} (${s.ticker})` }),
      el('td', { className: 'text-right', textContent: `${Object.keys(s.etfs).length} 檔` }),
      el('td', { className: 'text-slate-400', textContent: etfWeights }),
    ]);
  });
  stocksContainer.replaceChildren(
    el('table', { className: 'overlap-table' }, [sThead, el('tbody', {}, sRows)])
  );
}

// ─── 實質曝險穿透 ──────────────────────────────
function renderExposure(exposure) {
  if (!exposure) return;
  const section = document.getElementById('exposure-section');
  section.classList.remove('hidden');
  const container = document.getElementById('exposure-content');

  const top = exposure.exposures.slice(0, 15);
  const maxAmount = top[0]?.amount || 1;

  const rows = top.map(e => {
    const barWidth = Math.round(e.amount / maxAmount * 100);
    const barColor = e.pct >= 10 ? '#F87171' : e.pct >= 5 ? '#A78BFA' : '#34D399';
    const sourceText = e.sources
      .map(s => s.etf === e.sources[0]?.etf && e.sources.length === 1 && s.weight === 100
        ? '直接持有'
        : `${s.etf_name} ${s.weight}%`)
      .join(' + ');

    const barFill = el('div', { className: 'exposure-bar-fill' });
    barFill.style.width = `${barWidth}%`;
    barFill.style.backgroundColor = barColor;

    return el('div', { className: 'flex items-center gap-3 py-2 border-b border-slate-800' }, [
      el('div', { className: 'w-24 sm:w-32 text-sm font-medium truncate', textContent: e.name }),
      el('div', { className: 'flex-1 min-w-0' }, [
        el('div', { className: 'flex justify-between text-xs mb-1' }, [
          el('span', { className: 'text-slate-400', textContent: sourceText }),
          el('span', { className: 'font-medium', textContent: `${formatCurrency(e.amount)} (${e.pct}%)` }),
        ]),
        el('div', { className: 'exposure-bar-bg' }, [barFill]),
      ]),
    ]);
  });

  container.replaceChildren(...rows);
}

// ─── 觀察清單 ──────────────────────────────────
function renderWatchlist(watchlist) {
  if (!watchlist || !watchlist.items || watchlist.items.length === 0) return;
  const section = document.getElementById('watchlist-section');
  section.classList.remove('hidden');
  const container = document.getElementById('watchlist-content');

  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { textContent: '代號' }),
      el('th', { textContent: '名稱' }),
      el('th', { className: 'text-right', textContent: '現價' }),
      el('th', { className: 'text-right', textContent: '目標價' }),
      el('th', { className: 'text-right', textContent: '距離' }),
      el('th', { textContent: '備註' }),
    ]),
  ]);

  const rows = watchlist.items.map(w => {
    const price = w.current_price;
    const target = w.target_price;
    let distText = '—';
    let badgeClass = 'target-badge';
    if (price != null && target != null) {
      const dist = ((price - target) / target * 100).toFixed(1);
      const above = price >= target;
      distText = `${above ? '+' : ''}${dist}%`;
      badgeClass += above ? ' above' : ' below';
    }

    return el('tr', {}, [
      el('td', { textContent: w.ticker }),
      el('td', { textContent: w.name }),
      el('td', { className: 'text-right', textContent: price != null ? `$${price.toFixed(2)}` : '—' }),
      el('td', { className: 'text-right', textContent: `$${target}` }),
      el('td', { className: 'text-right' }, [
        el('span', { className: badgeClass, textContent: distText }),
      ]),
      el('td', { className: 'text-slate-500 text-xs', textContent: w.note || '' }),
    ]);
  });

  container.replaceChildren(
    el('table', { className: 'overlap-table' }, [thead, el('tbody', {}, rows)])
  );
}

// ─── 時間戳 ────────────────────────────────────
function renderTimestamp(updatedAt) {
  const elNode = document.getElementById('updated-at');
  if (!updatedAt) {
    elNode.textContent = '資料未載入';
    return;
  }
  const d = new Date(updatedAt);
  const absolute = `${d.toLocaleDateString('zh-TW')} ${d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  const relative = relativeTime(updatedAt);
  elNode.textContent = `${relative}更新 (${absolute})`;
  elNode.title = absolute;
}

// ─── 初始化 ────────────────────────────────────
async function init() {
  try {
    const { portfolio, xray, overlap, history, exposure, watchlist } = await loadData();
    xrayData = xray;

    renderTimestamp(portfolio.updated_at);
    renderSummary(portfolio.summary);
    renderTrendChart(history);
    renderAllocationChart(portfolio.holdings);
    renderHoldings(portfolio.holdings);
    renderOverlap(overlap);
    renderExposure(exposure);
    renderWatchlist(watchlist);
  } catch (err) {
    console.error('載入資料失敗:', err);
    document.getElementById('updated-at').textContent = '⚠ 資料載入失敗';
    const tbody = document.getElementById('holdings-body');
    tbody.replaceChildren(
      el('tr', {}, [
        el('td', {
          colspan: '7',
          className: 'text-center py-8 text-red-400',
          textContent: '無法載入資料，請先執行 python scripts/fetch_data.py',
        }),
      ])
    );
  }
}

init();
