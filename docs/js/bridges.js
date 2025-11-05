const BRIDGES_URL = './data/bridges.min.json';

const loadingIndicator = document.getElementById('bridge-loading');
const dashboardWrapper = document.getElementById('bridge-dashboard');
const overviewSection = document.getElementById('bridge-overview');
const totalCountEl = document.getElementById('total-bridge-count');
const totalLengthEl = document.getElementById('total-bridge-length');
const roadTypeChartContainer = document.getElementById('bridge-roadtype-chart');
const structureChartContainer = document.getElementById('bridge-structure-chart');
const specialDonutCanvas = document.getElementById('bridge-special-donut');
const specialLegendList = document.getElementById('bridge-special-legend');
const specialBarSvg = document.getElementById('bridge-special-barline');
const specialSpanList = document.getElementById('bridge-special-span-list');
const ageChartGrid = document.getElementById('bridge-age-chart-grid');
const ageLegendList = document.getElementById('bridge-age-legend');

const countFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const lengthFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });

const AGE_BUCKETS = [
  { key: '\u0031\u0030\ub144 \ubbf8\ub9cc', label: "10\ub144 \ubbf8\ub9cc (\u201915~)", color: '#1d4ed8' },
  { key: '\u0031\u0030~\u0032\u0030\ub144 \ubbf8\ub9cc', label: "10~20\ub144 \ubbf8\ub9cc (\u201905~\u201914)", color: '#0ea5e9' },
  { key: '\u0032\u0030~\u0033\u0030\ub144 \ubbf8\ub9cc', label: "20~30\ub144 \ubbf8\ub9cc (\u201995~\u201904)", color: '#22c55e' },
  { key: '\u0033\u0030~\u0035\u0030\ub144 \ubbf8\ub9cc', label: "30~50\ub144 \ubbf8\ub9cc (\u201975~\u201994)", color: '#f97316' },
  { key: '\u0035\u0030\ub144 \uc774\uc0c1', label: "50\ub144 \uc774\uc0c1 (\u201974 \uc774\uc804)", color: '#facc15' },
];

const AGE_ROAD_TYPES = [
  '\uc804\uccb4',
  '\uace0\uc18d\uad6d\ub3c4',
  '\uc77c\ubc18\uad6d\ub3c4',
  '\uc9c0\ubc29\ub3c4',
  '\uad6d\uac00\uc9c0\uc6d0\uc9c0\ubc29\ub3c4',
  '\ud2b9\ubcc4,\uad11\uc5ed\uc2dc\ub3c4',
  '\uc2dc\ub3c4',
  '\uad70\ub3c4',
  '\uad6c\ub3c4',
];

const SPECIAL_STRUCTURE_DEFINITIONS = [
  { key: '\uc0ac\uc7a5\uad50', label: '\uc0ac\uc7a5\uad50', color: '#2563eb' },
  { key: '\ud604\uc218\uad50', label: '\ud604\uc218\uad50', color: '#22c55e' },
  { key: '\uc544\uce58\uad50', label: '\uc544\uce58\uad50', color: '#f97316' },
  { key: '\uc5d1\uc2a4\ud2b8\ub77c\ub3c4\uc988\ub4dc\uad50', label: '\uc5d1\uc2a4\ud2b8\ub77c\ub3c4\uc988\ub4dc\uad50', color: '#a855f7' },
];

const SPECIAL_SUPERSTRUCTURES = new Set(SPECIAL_STRUCTURE_DEFINITIONS.map(item => item.key));

const ETC_SUPERSTRUCTURES = new Set([
  '\uac15I\uac70\ub354\uad50',
  '\ud2b8\ub7ec\uc2a4\uad50',
  'PSC\uc911\uacf5\uc2ac\ub798\ube0c\uad50',
  'RC\uc911\uacf5\uc2ac\ub798\ube0c\uad50',
  'RC\ubc15\uc2a4\uac70\ub354\uad50',
]);

document.addEventListener('DOMContentLoaded', () => {
  loadBridgeData();
});

async function loadBridgeData() {
  try {
    const response = await fetch(BRIDGES_URL);
    if (!response.ok) throw new Error('\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');

    const bridges = await response.json();
    const summary = summarizeBridges(bridges);
    renderBridgeOverview(summary);
    renderAgeBreakdown(summary.ageGroups);
  } catch (error) {
    showError(error.message || '\uc54c \uc218 \uc5c6\ub294 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.');
    console.error(error);
  }
}

function summarizeBridges(bridges) {
  let totalLength = 0;
  const aggregates = new Map();
  const structureTotals = new Map();
  const specialTotals = new Map();
  const ageTotals = Object.fromEntries(
    AGE_ROAD_TYPES.map(type => [type, initAgeBucket()]),
  );

  for (const item of bridges) {
    const roadType = (item['\ub3c4\ub85c\uc885\ub958'] ?? '\uae30\ud0c0').toString().trim() || '\uae30\ud0c0';
    const lengthMeters = toNumber(item['\ucd1d\uae38\uc774'] ?? item['\ucd1d\uc5f0\uc7a5'] ?? item['\uc5f0\uc7a5(m)']);

    totalLength += lengthMeters;

    const record = aggregates.get(roadType) || { count: 0, length: 0 };
    record.count += 1;
    record.length += lengthMeters;
    aggregates.set(roadType, record);

    const structureLabel = mapSuperstructure(item['\uc0c1\ubd80\uad6c\uc870']);
    structureTotals.set(structureLabel, (structureTotals.get(structureLabel) || 0) + 1);

    const rawStructure = (item['\uc0c1\ubd80\uad6c\uc870'] ?? '').toString().trim();
    if (SPECIAL_SUPERSTRUCTURES.has(rawStructure)) {
      const entry = specialTotals.get(rawStructure) || {
        count: 0,
        totalLength: 0,
        maxSpan: 0,
        maxSpanBridge: null,
      };

      entry.count += 1;
      entry.totalLength += lengthMeters;

      const spanMeters = toNumber(item['\ucd5c\ub300\uacbd\uac04\uc7a5']);
      if (spanMeters > entry.maxSpan) {
        entry.maxSpan = spanMeters;
        entry.maxSpanBridge = {
          facility: (item['\uc2dc\uc124\uba85'] ?? '').toString().trim() || '\ubbf8\uc0c1',
          structure: rawStructure,
          span: spanMeters,
        };
      }

      specialTotals.set(rawStructure, entry);
    }

    const bucket = mapYearToBucket(item['\uc900\uacf5\ub144\ub3c4']);
    if (bucket) {
      ageTotals['\uc804\uccb4'][bucket] += 1;
      if (ageTotals[roadType]) {
        ageTotals[roadType][bucket] += 1;
      }
    }
  }

  const byRoadType = Array.from(aggregates.entries())
    .map(([label, stats]) => ({
      label,
      count: stats.count,
      lengthKm: stats.length / 1000,
    }))
    .sort((a, b) => b.count - a.count);

  const byStructure = Array.from(structureTotals.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const specialStructures = SPECIAL_STRUCTURE_DEFINITIONS.map(definition => {
    const entry = specialTotals.get(definition.key) || {
      count: 0,
      totalLength: 0,
      maxSpan: 0,
      maxSpanBridge: null,
    };

    return {
      key: definition.key,
      label: definition.label,
      color: definition.color,
      count: entry.count,
      totalLengthKm: entry.totalLength / 1000,
      maxSpan: entry.maxSpan,
      maxSpanBridge: entry.maxSpanBridge,
    };
  });

  return {
    totalCount: bridges.length,
    totalLengthKm: totalLength / 1000,
    byRoadType,
    structureCounts: byStructure,
    specialStructures,
    ageGroups: ageTotals,
  };
}

function renderBridgeOverview(summary) {
  loadingIndicator?.remove();

  totalCountEl.textContent = `${countFormatter.format(summary.totalCount)}\uac1c\uc18c`;
  totalLengthEl.textContent = `${lengthFormatter.format(summary.totalLengthKm)}km`;

  renderRoadTypeBars(summary.byRoadType);
  renderStructureChart(summary.structureCounts);
  renderSpecialStructures(summary.specialStructures);
  if (overviewSection) overviewSection.hidden = false;
  if (dashboardWrapper) dashboardWrapper.hidden = false;
}

function renderRoadTypeBars(items) {
  if (!roadTypeChartContainer) return;
  roadTypeChartContainer.innerHTML = '';

  if (!items.length) {
    roadTypeChartContainer.innerHTML = '<p class="error">\ub3c4\ub85c \uc885\ub958 \ub370\uc774\ud130\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.</p>';
    return;
  }

  const maxCount = Math.max(...items.map(item => item.count));
  const maxLength = Math.max(...items.map(item => item.lengthKm));

  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.setAttribute('role', 'listitem');

    const label = document.createElement('div');
    label.className = 'chart-row__label';
    label.textContent = item.label;

    const bars = document.createElement('div');
    bars.className = 'chart-row__bars';

    bars.appendChild(createBarElement({
      className: 'chart-bar count',
      value: item.count,
      max: maxCount,
      text: `${countFormatter.format(item.count)}\uac1c\uc18c`,
    }));

    bars.appendChild(createBarElement({
      className: 'chart-bar length',
      value: item.lengthKm,
      max: maxLength,
      text: `${lengthFormatter.format(item.lengthKm)}km`,
    }));

    row.append(label, bars);
    fragment.append(row);
  });

  roadTypeChartContainer.append(fragment);
}

function createBarElement({ className, value, max, text }) {
  const bar = document.createElement('div');
  bar.className = className;

  const widthPercent = max > 0 ? Math.max((value / max) * 100, 8) : 8;
  bar.style.width = `${Math.min(widthPercent, 100)}%`;

  const span = document.createElement('span');
  span.textContent = text;
  bar.appendChild(span);

  return bar;
}

function renderStructureChart(items) {
  if (!structureChartContainer) return;
  structureChartContainer.innerHTML = '';

  if (!items.length) {
    structureChartContainer.innerHTML = '<p class="error">\uc0c1\ubd80\uad6c\uc870 \ub370\uc774\ud130\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.</p>';
    return;
  }

  const MAX_BAR_HEIGHT = 220;
  const maxCount = Math.max(...items.map(item => item.count));
  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const column = document.createElement('div');
    column.className = 'structure-column';
    column.setAttribute('role', 'listitem');
    column.setAttribute('aria-label', `${item.label} ${countFormatter.format(item.count)}\uac1c\uc18c`);

    const count = document.createElement('div');
    count.className = 'structure-count';
    count.textContent = `${countFormatter.format(item.count)}\uac1c\uc18c`;

    const bar = document.createElement('div');
    bar.className = 'structure-bar';
    const height = maxCount > 0 ? Math.max((item.count / maxCount) * MAX_BAR_HEIGHT, 8) : 8;
    bar.style.height = `${height}px`;
    bar.title = `${item.label} ${countFormatter.format(item.count)}\uac1c\uc18c`;

    const label = document.createElement('div');
    label.className = 'structure-label';
    label.textContent = item.label;

    column.append(count, bar, label);
    fragment.appendChild(column);
  });

  structureChartContainer.appendChild(fragment);
}

function renderSpecialStructures(items) {
  if (!specialDonutCanvas || !specialLegendList || !specialBarSvg || !specialSpanList) return;

  const hasData = items.some(item => item.count > 0);

  if (!hasData) {
    const ctx = specialDonutCanvas.getContext('2d');
    ctx.clearRect(0, 0, specialDonutCanvas.width, specialDonutCanvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\ub370\uc774\ud130 \uc5c6\uc74c', specialDonutCanvas.width / 2, specialDonutCanvas.height / 2);

    specialLegendList.innerHTML = '';
    specialBarSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="14">데이터 없음</text>';
    specialBarSvg.setAttribute('viewBox', '0 0 260 240');
    specialSpanList.innerHTML = `
      <tr>
        <td colspan="3">\ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</td>
      </tr>
    `;
    return;
  }

  drawSpecialDonut(specialDonutCanvas, items);
  renderSpecialLegend(items);
  renderSpecialBarLine(items);
  renderSpecialSpanList(items);
}

function drawSpecialDonut(canvas, items) {
  const ctx = canvas.getContext('2d');
  const size = Math.min(canvas.width, canvas.height);
  const radius = size / 2;
  const innerRadius = radius * 0.58;
  const total = items.reduce((sum, item) => sum + item.count, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    ctx.fillStyle = '#cbd5f5';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let startAngle = -Math.PI / 2;

  items.forEach(item => {
    const sliceAngle = (item.count / total) * Math.PI * 2;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 6, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(radius, radius, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(countFormatter.format(total), radius, radius - 4);
  ctx.font = '12px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('\ucd1d \uac1c\uc18c', radius, radius + 16);
}

function renderSpecialLegend(items) {
  specialLegendList.innerHTML = '';
  const dataset = items.some(item => item.count > 0) ? items.filter(item => item.count > 0) : items;

  dataset.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="special-legend-swatch" style="background:${item.color}"></span>
      <span>${item.label} (${countFormatter.format(item.count)}\uac1c\uc18c)</span>
    `;
    specialLegendList.appendChild(li);
  });
}

function renderSpecialBarLine(items) {
  specialBarSvg.innerHTML = '';

  const height = 260;
  const barWidth = 48;
  const gap = 36;
  const topPadding = 26;
  const bottomPadding = 48;
  const usableHeight = height - topPadding - bottomPadding;
  const width = gap + items.length * (barWidth + gap);

  const maxLength = Math.max(...items.map(item => item.totalLengthKm));
  const maxSpan = Math.max(...items.map(item => item.maxSpan));

  const defs = `
    <defs>
      <linearGradient id="special-bar-gradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f6bd6" />
        <stop offset="100%" stop-color="#60a5fa" />
      </linearGradient>
      <linearGradient id="special-line-gradient" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#f97316" />
        <stop offset="100%" stop-color="#facc15" />
      </linearGradient>
    </defs>
  `;

  const bars = [];
  const labels = [];
  const axisLabels = [];
  const points = [];
  const dots = [];
  const spanLabels = [];

  items.forEach((item, index) => {
    const x = gap + index * (barWidth + gap);
    const lengthRatio = maxLength > 0 ? item.totalLengthKm / maxLength : 0;
    const barHeight = Math.max(lengthRatio * usableHeight, 6);
    const barY = height - bottomPadding - barHeight;
    bars.push(`<rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="12" fill="url(#special-bar-gradient)" />`);
    labels.push(`<text class="special-bar-value" x="${x + barWidth / 2}" y="${barY - 8}" text-anchor="middle">${lengthFormatter.format(item.totalLengthKm)}km</text>`);

    const pointX = x + barWidth / 2;
    const spanRatio = maxSpan > 0 ? item.maxSpan / maxSpan : 0;
    const pointY = height - bottomPadding - spanRatio * usableHeight;
    points.push(`${pointX},${pointY}`);
    dots.push(`<circle cx="${pointX}" cy="${pointY}" r="5" fill="#f97316" stroke="#facc15" stroke-width="2" />`);
    spanLabels.push(`<text class="special-line-value" x="${pointX}" y="${pointY - 10}" text-anchor="middle">${countFormatter.format(item.maxSpan)}m</text>`);

    axisLabels.push(`<text class="special-axis-label" x="${pointX}" y="${height - bottomPadding + 24}" text-anchor="middle">${item.label}</text>`);
  });

  const polyline = points.length
    ? `<polyline fill="none" stroke="url(#special-line-gradient)" stroke-width="3" points="${points.join(' ')}" stroke-linecap="round" />`
    : '';

  specialBarSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  specialBarSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  specialBarSvg.innerHTML = [
    defs,
    ...bars,
    polyline,
    ...dots,
    ...labels,
    ...spanLabels,
    ...axisLabels,
  ].join('');
}

function renderSpecialSpanList(items) {
  specialSpanList.innerHTML = '';

  items.forEach(item => {
    const spanInfo = item.maxSpanBridge;
    const row = document.createElement('tr');
    if (spanInfo) {
      row.innerHTML = `
        <td>${spanInfo.facility}</td>
        <td>${item.label}</td>
        <td>${countFormatter.format(spanInfo.span)}m</td>
      `;
    } else {
      row.innerHTML = `
        <td>\ub370\uc774\ud130 \uc5c6\uc74c</td>
        <td>${item.label}</td>
        <td>-</td>
      `;
    }
    specialSpanList.appendChild(row);
  });
}

function renderAgeBreakdown(ageGroups) {
  if (!ageChartGrid) return;

  ageChartGrid.innerHTML = '';

  AGE_ROAD_TYPES.forEach(type => {
    const buckets = ageGroups[type];
    const total = Object.values(buckets).reduce((sum, value) => sum + value, 0);

    const card = document.createElement('article');
    card.className = 'doughnut-card';
    card.setAttribute('role', 'figure');
    card.setAttribute('aria-labelledby', `age-${type}`);

    const title = document.createElement('h3');
    title.id = `age-${type}`;
    title.textContent = type;

    const wrapper = document.createElement('div');
    wrapper.className = 'doughnut-wrapper';

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);

    const overlay = document.createElement('div');
    overlay.className = 'doughnut-text';
    overlay.textContent = total ? `${countFormatter.format(total)}\uac1c\uc18c` : '\uc790\ub8cc \uc5c6\uc74c';

    wrapper.appendChild(overlay);
    drawDonut(canvas, buckets, total);

    card.append(title, wrapper);
    ageChartGrid.appendChild(card);
  });

  renderAgeLegend(ageGroups['\uc804\uccb4']);
}

function drawDonut(canvas, buckets, total) {
  const size = 224;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const radius = size / 2;
  const innerRadius = radius * 0.6;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  const values = AGE_BUCKETS.map(bucket => buckets[bucket.key] || 0);
  const sum = total || values.reduce((acc, cur) => acc + cur, 0);
  const segments = [];

  let startAngle = -Math.PI / 2;

  if (sum === 0) {
    ctx.fillStyle = '#cbd5f5';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    AGE_BUCKETS.forEach((bucket, index) => {
      const value = values[index];
      const sliceAngle = (value / sum) * Math.PI * 2;
      ctx.fillStyle = bucket.color;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius - 6, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      segments.push({
        key: bucket.key,
        label: bucket.label,
        color: bucket.color,
        value,
        percent: sum ? (value / sum) * 100 : 0,
        startAngle,
        endAngle: startAngle + sliceAngle,
        midAngle: startAngle + sliceAngle / 2,
      });
      startAngle += sliceAngle;
    });
  }

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(radius, radius, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const outerRadius = radius - 6;
  const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.6;

  segments.forEach(segment => {
    if (!segment.value) return;
    const percentText = percentFormatter.format(segment.percent);
    const angle = segment.midAngle;
    const x = radius + Math.cos(angle) * labelRadius;
    const y = radius + Math.sin(angle) * labelRadius;

    let fontSize = 11;
    if (segment.percent < 1) fontSize = 9;
    if (segment.percent < 0.2) fontSize = 8;

    ctx.fillStyle = '#0f172a';
    ctx.font = `${fontSize}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percentText}%`, x, y);
  });

}

function mapSuperstructure(value) {
  if (value === undefined || value === null) return '\ubbf8\uc0c1';
  const normalized = value.toString().trim();
  if (!normalized || normalized.toLowerCase() === 'none') return '\ubbf8\uc0c1';
  if (SPECIAL_SUPERSTRUCTURES.has(normalized)) return '\ud2b9\uc218\uad50\ub7c9';
  if (ETC_SUPERSTRUCTURES.has(normalized)) return '\uae30\ud0c0';
  return normalized;
}

function initAgeBucket() {
  return AGE_BUCKETS.reduce((acc, bucket) => {
    acc[bucket.key] = 0;
    return acc;
  }, {});
}

function mapYearToBucket(yearString) {
  if (yearString === undefined || yearString === null) return null;
  const digits = String(yearString).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const year = Number.parseInt(digits, 10);
  if (!Number.isFinite(year)) return null;

  if (year >= 2015) return '\u0031\u0030\ub144 \ubbf8\ub9cc';
  if (year >= 2005) return '\u0031\u0030~\u0032\u0030\ub144 \ubbf8\ub9cc';
  if (year >= 1995) return '\u0032\u0030~\u0033\u0030\ub144 \ubbf8\ub9cc';
  if (year >= 1975) return '\u0033\u0030~\u0035\u0030\ub144 \ubbf8\ub9cc';
  return '\u0035\u0030\ub144 \uc774\uc0c1';
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  const normalized = value.toString().replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function showError(message) {
  if (loadingIndicator) {
    loadingIndicator.classList.remove('loading');
    loadingIndicator.classList.add('error');
    loadingIndicator.textContent = message;
  }
}

function renderAgeLegend(referenceBuckets) {
  if (!ageLegendList) return;

  ageLegendList.innerHTML = '';
  const total = Object.values(referenceBuckets).reduce((sum, value) => sum + value, 0);

  AGE_BUCKETS.forEach(bucket => {
    const item = document.createElement('li');
    item.innerHTML = `
      <span class="age-bucket-swatch" style="background:${bucket.color}"></span>
      <span class="age-bucket-label">${bucket.label}</span>
    `;
    ageLegendList.appendChild(item);
  });
}
