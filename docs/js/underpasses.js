const UNDERPASSES_URL = './data/underpasses.min.json';

const loadingIndicator = document.getElementById('underpass-loading');
const dashboardWrapper = document.getElementById('underpass-dashboard');
const overviewSection = document.getElementById('underpass-overview');
const totalCountEl = document.getElementById('total-underpass-count');
const totalLengthEl = document.getElementById('total-underpass-length');
const roadTypeChartContainer = document.getElementById('underpass-roadtype-chart');
const ageChartGrid = document.getElementById('underpass-age-chart-grid');
const ageLegendList = document.getElementById('underpass-age-legend');

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

const ROAD_TYPE_WHITELIST = AGE_ROAD_TYPES.filter(type => type !== '\uc804\uccb4');

document.addEventListener('DOMContentLoaded', () => {
  loadUnderpassData();
});

async function loadUnderpassData() {
  try {
    const response = await fetch(UNDERPASSES_URL);
    if (!response.ok) throw new Error('\ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');

    const underpasses = await response.json();
    const summary = summarizeUnderpasses(underpasses);
    renderUnderpassOverview(summary);
    renderAgeBreakdown(summary.ageGroups);
  } catch (error) {
    showError(error.message || '\uc54c \uc218 \uc5c6\ub294 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.');
    console.error(error);
  }
}

function summarizeUnderpasses(underpasses) {
  let totalLength = 0;
  const aggregates = new Map();
  const ageTotals = Object.fromEntries(
    AGE_ROAD_TYPES.map(type => [type, initAgeBucket()]),
  );

  let includedCount = 0;

  for (const item of underpasses) {
    const rawRoadType = (item['\ub3c4\ub85c\uc885\ub958'] ?? '').toString().trim();
    if (!rawRoadType || rawRoadType === 'None') continue;
    if (!ROAD_TYPE_WHITELIST.includes(rawRoadType)) continue;

    const rawLength = item['총길이'] ?? item['총연장'] ?? item['연장(m)'] ?? item['연장(km)'];
    let lengthMeters = toNumber(rawLength);
    if (
      item['연장(km)'] !== undefined &&
      item['연장(m)'] === undefined &&
      item['총길이'] === undefined &&
      item['총연장'] === undefined
    ) {
      lengthMeters *= 1000;
    }

    totalLength += lengthMeters;
    includedCount += 1;

    const record = aggregates.get(rawRoadType) || { count: 0, length: 0 };
    record.count += 1;
    record.length += lengthMeters;
    aggregates.set(rawRoadType, record);

    const bucket = mapYearToBucket(item['준공년도']);
    if (bucket) {
      ageTotals['\uc804\uccb4'][bucket] += 1;
      if (ageTotals[rawRoadType]) {
        ageTotals[rawRoadType][bucket] += 1;
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

  return {
    totalCount: includedCount,
    totalLengthKm: totalLength / 1000,
    byRoadType,
    ageGroups: ageTotals,
  };
}

function renderUnderpassOverview(summary) {
  loadingIndicator?.remove();

  totalCountEl.textContent = `${countFormatter.format(summary.totalCount)}\uac1c\uc18c`;
  totalLengthEl.textContent = `${lengthFormatter.format(summary.totalLengthKm)}km`;

  renderRoadTypeBars(summary.byRoadType);
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
    label.innerHTML = `<strong>${item.label}</strong>`;

    const bars = document.createElement('div');
    bars.className = 'bars';

    bars.appendChild(makeBar('count', item.count, maxCount, `${countFormatter.format(item.count)}\uac1c\uc18c`));
    bars.appendChild(makeBar('length', item.lengthKm, maxLength, `${lengthFormatter.format(item.lengthKm)}km`));

    row.append(label, bars);
    fragment.appendChild(row);
  });

  roadTypeChartContainer.appendChild(fragment);
}

function makeBar(type, value, maxValue, text) {
  const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const bar = document.createElement('div');
  bar.className = `bar-track ${type}`;
  bar.style.width = `${Math.min(widthPercent, 100)}%`;

  const span = document.createElement('span');
  span.textContent = text;
  bar.appendChild(span);

  return bar;
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

  AGE_BUCKETS.forEach(bucket => {
    const item = document.createElement('li');
    item.innerHTML = `
      <span class="age-bucket-swatch" style="background:${bucket.color}"></span>
      <span class="age-bucket-label">${bucket.label}</span>
    `;
    ageLegendList.appendChild(item);
  });
}

