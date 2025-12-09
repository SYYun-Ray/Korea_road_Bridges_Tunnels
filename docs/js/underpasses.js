const UNDERPASSES_URL = './data/underpasses.min.json';

const loadingIndicator = document.getElementById('underpass-loading');
const dashboardWrapper = document.getElementById('underpass-dashboard');
const overviewSection = document.getElementById('underpass-overview');
const totalCountEl = document.getElementById('total-underpass-count');
const totalLengthEl = document.getElementById('total-underpass-length');
const roadTypeChartContainer = document.getElementById('underpass-roadtype-chart');
const ageChartGrid = document.getElementById('underpass-age-chart-grid');
const ageLegendList = document.getElementById('underpass-age-legend');
const bucketCountsContainer = document.getElementById('underpass-bucket-counts');
const bucketLengthsContainer = document.getElementById('underpass-bucket-lengths');
const bucketLegendContainer = document.getElementById('underpass-bucket-legend');

// table controls
const filterSearch = document.getElementById('underpass-filter-search');
const filterRoadType = document.getElementById('underpass-filter-roadtype');
const filterRegion = document.getElementById('underpass-filter-region');
const filterYearMin = document.getElementById('underpass-filter-year-min');
const filterYearMax = document.getElementById('underpass-filter-year-max');
const filterLengthMin = document.getElementById('underpass-filter-length-min');
const filterLengthMax = document.getElementById('underpass-filter-length-max');
const filterWidthMin = document.getElementById('underpass-filter-width-min');
const filterWidthMax = document.getElementById('underpass-filter-width-max');
const filterApplyBtn = document.getElementById('underpass-filter-apply');
const filterResetBtn = document.getElementById('underpass-filter-reset');
const tableSummary = document.getElementById('underpass-table-summary');
const tableBody = document.getElementById('underpass-table-body');
const pagePrevBtn = document.getElementById('underpass-page-prev');
const pageNextBtn = document.getElementById('underpass-page-next');
const pageInfo = document.getElementById('underpass-page-info');

const countFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const lengthFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const widthFormatter = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });

const AGE_BUCKETS = [
  { key: '\u0031\u0030\ub144 \ubbf8\ub9cc', label: '10\uac1c\ub144 \ubbf8\ub9cc (\u201915~)', color: '#1d4ed8' },
  { key: '\u0031\u0030~\u0032\u0030\ub144 \ubbf8\ub9cc', label: '10~20\uac1c\ub144 \ubbf8\ub9cc (\u201905~\u201914)', color: '#0ea5e9' },
  { key: '\u0032\u0030~\u0033\u0030\ub144 \ubbf8\ub9cc', label: '20~30\uac1c\ub144 \ubbf8\ub9cc (\u201995~\u201904)', color: '#22c55e' },
  { key: '\u0033\u0030~\u0035\u0030\ub144 \ubbf8\ub9cc', label: '30~50\uac1c\ub144 \ubbf8\ub9cc (\u201975~\u201994)', color: '#f97316' },
  { key: '\u0035\u0030\ub144 \uc774\uc0c1', label: '50\uac1c\ub144 \uc774\uc0c1 (\u201974 \uc774\uc804)', color: '#facc15' },
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

const BUCKETS = [
  { key: 'under_500', label: '500m \ubbf8\ub9cc', min: 0, max: 500 },
  { key: '500_1000', label: '500~1,000m', min: 500, max: 1000 },
  { key: '1000_3000', label: '1,000~3,000m', min: 1000, max: 3000 },
  { key: '3000_plus', label: '3,000m \uc774\uc0c1', min: 3000, max: Infinity },
];

const ROAD_COLORS = {
  '\uace0\uc18d\uad6d\ub3c4': '#0f6bd6',
  '\uc77c\ubc18\uad6d\ub3c4': '#f97316',
  '\ud2b9\ubcc4,\uad11\uc5ed\uc2dc\ub3c4': '#a855f7',
  '\uc9c0\ubc29\ub3c4': '#22c55e',
  '\uad6d\uac00\uc9c0\uc6d0\uc9c0\ubc29\ub3c4': '#0ea5e9',
  '\uc2dc\ub3c4': '#6366f1',
  '\uad70\ub3c4': '#ec4899',
  '\uad6c\ub3c4': '#14b8a6',
};

const TABLE_PAGE_SIZE = 200;
let underpassDataset = [];
let filteredDataset = [];
let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  loadUnderpassData();
});

async function loadUnderpassData() {
  try {
    const response = await fetch(UNDERPASSES_URL);
    if (!response.ok) throw new Error(`데이터를 불러오지 못했습니다. (HTTP ${response.status})`);

    const underpasses = await response.json();
    const summary = summarizeUnderpasses(underpasses);

    renderUnderpassOverview(summary);
    renderAgeBreakdown(summary.ageGroups);
    renderBucketStacks(summary.bucketSummary);
    prepareTableDataset(underpasses);
  } catch (error) {
    showError(error.message || '알 수 없는 오류가 발생했습니다.');
    renderTableError(error.message || '데이터를 불러오지 못했습니다.');
    console.error(error);
  }
}

function summarizeUnderpasses(underpasses) {
  let totalLength = 0;
  const aggregates = new Map();
  const bucketSummary = initBucketSummary();
  const ageTotals = Object.fromEntries(AGE_ROAD_TYPES.map(type => [type, initAgeBucket()]));
  let includedCount = 0;

  for (const item of underpasses) {
    const rawRoadType = (item['\ub3c4\ub85c\uc885\ub958'] ?? '').toString().trim();
    if (!rawRoadType || rawRoadType === 'None') continue;
    if (!ROAD_TYPE_WHITELIST.includes(rawRoadType)) continue;

    const rawLength = item['\ucd1d\uae38\uc774'] ?? item['\ucd1d\uc5f0\uc7a5'] ?? item['\uc5f0\uc7a5(m)'] ?? item['\uc5f0\uc7a5(km)'];
    let lengthMeters = toNumber(rawLength);
    if (item['\uc5f0\uc7a5(km)'] !== undefined && item['\uc5f0\uc7a5(m)'] === undefined && item['\ucd1d\uae38\uc774'] === undefined && item['\ucd1d\uc5f0\uc7a5'] === undefined) {
      lengthMeters *= 1000;
    }

    totalLength += lengthMeters;
    includedCount += 1;

    const record = aggregates.get(rawRoadType) || { count: 0, length: 0 };
    record.count += 1;
    record.length += lengthMeters;
    aggregates.set(rawRoadType, record);

    assignBucket(bucketSummary, lengthMeters, rawRoadType);

    const bucket = mapYearToBucket(item['\uc900\uacf5\ub144\ub3c4']);
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
    bucketSummary,
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
    roadTypeChartContainer.innerHTML = '<p class="error">도로 종류 데이터를 찾을 수 없습니다.</p>';
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

    bars.appendChild(makeBar('count', item.count, maxCount, `${countFormatter.format(item.count)}개소`));
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
    overlay.textContent = total ? `${countFormatter.format(total)}개소` : '자료 없음';

    wrapper.appendChild(overlay);
    drawDonut(canvas, buckets, total);

    card.append(title, wrapper);
    ageChartGrid.appendChild(card);
  });

  renderAgeLegend(ageGroups['\uc804\uccb4']);
}

function renderBucketStacks(bucketSummary) {
  if (!bucketCountsContainer || !bucketLengthsContainer || !bucketLegendContainer) return;

  renderBucketRows(bucketCountsContainer, bucketSummary, 'count');
  renderBucketRows(bucketLengthsContainer, bucketSummary, 'length');
  renderBucketLegend();
}

function renderBucketRows(container, summary, mode) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const grandTotal = mode === 'count'
    ? BUCKETS.reduce((sum, b) => sum + summary.total[b.key].count, 0)
    : BUCKETS.reduce((sum, b) => sum + summary.total[b.key].length / 1000, 0);
  const denom = grandTotal > 0 ? grandTotal : 1;

  BUCKETS.forEach(bucket => {
    const row = document.createElement('div');
    row.className = 'bucket-row';

    const label = document.createElement('div');
    label.className = 'bucket-label';
    label.textContent = bucket.label;

    const bar = document.createElement('div');
    bar.className = 'bucket-bar';

    const totalValue =
      mode === 'count'
        ? summary.total[bucket.key].count
        : summary.total[bucket.key].length / 1000;

    const segments = summary.byRoad[bucket.key];
    Object.entries(segments).forEach(([road, stats]) => {
      const value = mode === 'count' ? stats.count : stats.lengthKm;
      if (value <= 0) return;
      const widthPercent = (value / denom) * 100;
      const segment = document.createElement('div');
      segment.className = 'bucket-segment';
      segment.style.width = `${widthPercent}%`;
      segment.style.background = ROAD_COLORS[road] || '#94a3b8';
      segment.textContent = mode === 'count' ? countFormatter.format(value) : lengthFormatter.format(value);
      bar.appendChild(segment);
    });

    const total = document.createElement('div');
    total.className = 'bucket-total';
    total.textContent = mode === 'count'
      ? countFormatter.format(totalValue)
      : `${lengthFormatter.format(totalValue)}km`;

    row.append(label, bar, total);
    fragment.appendChild(row);
  });

  container.appendChild(fragment);
}

function renderBucketLegend() {
  if (!bucketLegendContainer) return;
  bucketLegendContainer.innerHTML = '';
  ROAD_TYPE_WHITELIST.forEach(road => {
    const span = document.createElement('span');
    span.innerHTML = `<span class="bucket-swatch" style="background:${ROAD_COLORS[road] || '#94a3b8'}"></span>${road}`;
    bucketLegendContainer.appendChild(span);
  });
}

function prepareTableDataset(underpasses) {
  underpassDataset = underpasses
    .filter(item => {
      const roadType = (item['\ub3c4\ub85c\uc885\ub958'] ?? '').toString().trim();
      return roadType && roadType !== 'None' && ROAD_TYPE_WHITELIST.includes(roadType);
    })
    .map(item => {
      const roadType = (item['\ub3c4\ub85c\uc885\ub958'] ?? '\uae30\ud0c0').toString().trim() || '\uae30\ud0c0';
      const region = (item['\uc2dc\ub3c4'] ?? '').toString().trim() || '-';
      const rawLength = item['\ucd1d\uae38\uc774'] ?? item['\ucd1d\uc5f0\uc7a5'] ?? item['\uc5f0\uc7a5(m)'] ?? item['\uc5f0\uc7a5(km)'];
      let lengthMeters = toNumber(rawLength);
      if (item['\uc5f0\uc7a5(km)'] !== undefined && item['\uc5f0\uc7a5(m)'] === undefined && item['\ucd1d\uae38\uc774'] === undefined && item['\ucd1d\uc5f0\uc7a5'] === undefined) {
        lengthMeters *= 1000;
      }
      const widthMeters = toNumber(item['\ucd1d\ud3ed'] ?? item['\uc720\ud6a8\ud3ed']);
      const yearDigits = String(item['\uc900\uacf5\ub144\ub3c4'] ?? '').replace(/[^0-9]/g, '');
      const year = yearDigits ? Number.parseInt(yearDigits, 10) : null;

      return {
        facility: (item['\uc2dc\uc124\uba85'] ?? '').toString().trim() || '(무제)',
        roadType,
        region,
        lengthKm: lengthMeters / 1000,
        width: widthMeters,
        year,
      };
    });

  populateFilterOptions();
  bindFilterEvents();
  applyFilters();
}

function populateFilterOptions() {
  const addOptions = (select, values, labelAll) => {
    if (!select) return;
    select.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'ALL';
    optAll.textContent = labelAll;
    select.appendChild(optAll);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  };

  const roadTypes = Array.from(new Set(underpassDataset.map(d => d.roadType))).sort();
  const regions = Array.from(new Set(underpassDataset.map(d => d.region))).filter(v => v && v !== '-').sort();

  addOptions(filterRoadType, roadTypes, '전체');
  addOptions(filterRegion, regions, '전체');
}

function bindFilterEvents() {
  filterApplyBtn?.addEventListener('click', () => {
    currentPage = 1;
    applyFilters();
  });

  filterResetBtn?.addEventListener('click', () => {
    if (filterSearch) filterSearch.value = '';
    [filterRoadType, filterRegion].forEach(sel => { if (sel) sel.value = 'ALL'; });
    [filterYearMin, filterYearMax, filterLengthMin, filterLengthMax, filterWidthMin, filterWidthMax].forEach(inp => { if (inp) inp.value = ''; });
    currentPage = 1;
    applyFilters();
  });

  pagePrevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  pageNextBtn?.addEventListener('click', () => {
    const maxPage = Math.ceil(filteredDataset.length / TABLE_PAGE_SIZE) || 1;
    if (currentPage < maxPage) {
      currentPage += 1;
      renderTable();
    }
  });
}

function applyFilters() {
  const search = filterSearch?.value.trim().toLowerCase() || '';
  const roadSel = filterRoadType?.value || 'ALL';
  const regionSel = filterRegion?.value || 'ALL';
  const yearMin = filterYearMin?.value ? Number(filterYearMin.value) : null;
  const yearMax = filterYearMax?.value ? Number(filterYearMax.value) : null;
  const lenMin = filterLengthMin?.value ? Number(filterLengthMin.value) : null;
  const lenMax = filterLengthMax?.value ? Number(filterLengthMax.value) : null;
  const widthMin = filterWidthMin?.value ? Number(filterWidthMin.value) : null;
  const widthMax = filterWidthMax?.value ? Number(filterWidthMax.value) : null;

  filteredDataset = underpassDataset.filter(row => {
    if (search && !row.facility.toLowerCase().includes(search)) return false;
    if (roadSel !== 'ALL' && row.roadType !== roadSel) return false;
    if (regionSel !== 'ALL' && row.region !== regionSel) return false;
    if (yearMin !== null && (row.year === null || row.year < yearMin)) return false;
    if (yearMax !== null && (row.year === null || row.year > yearMax)) return false;
    if (lenMin !== null && row.lengthKm < lenMin) return false;
    if (lenMax !== null && row.lengthKm > lenMax) return false;
    if (widthMin !== null && row.width < widthMin) return false;
    if (widthMax !== null && row.width > widthMax) return false;
    return true;
  });

  renderTableSummary();
  renderTable();
}

function renderTableSummary() {
  if (!tableSummary) return;
  const totalCount = filteredDataset.length;
  const totalLength = filteredDataset.reduce((sum, r) => sum + r.lengthKm, 0);
  tableSummary.textContent = `결과: ${countFormatter.format(totalCount)}개소 · 총연장 ${lengthFormatter.format(totalLength)}km`;
}

function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';
  const maxPage = Math.ceil(filteredDataset.length / TABLE_PAGE_SIZE) || 1;
  if (currentPage > maxPage) currentPage = maxPage;
  const start = (currentPage - 1) * TABLE_PAGE_SIZE;
  const slice = filteredDataset.slice(start, start + TABLE_PAGE_SIZE);

  slice.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.facility}</td>
      <td>${row.roadType}</td>
      <td>${row.region}</td>
      <td>${lengthFormatter.format(row.lengthKm)}</td>
      <td>${row.width ? widthFormatter.format(row.width) : '-'}</td>
      <td>${row.year ?? '-'}</td>
    `;
    tableBody.appendChild(tr);
  });

  if (pageInfo) {
    pageInfo.textContent = `${currentPage} / ${maxPage}`;
  }
}

function renderTableError(message) {
  if (!tableBody || !tableSummary) return;
  tableBody.innerHTML = `
    <tr>
      <td colspan="6">${message}</td>
    </tr>
  `;
  tableSummary.textContent = '데이터가 없어 표를 표시할 수 없습니다.';
  if (pageInfo) pageInfo.textContent = '';
}

function renderAgeLegend() {
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

function initBucketSummary() {
  const byRoad = {};
  BUCKETS.forEach(bucket => {
    byRoad[bucket.key] = {};
    ROAD_TYPE_WHITELIST.forEach(road => {
      byRoad[bucket.key][road] = { count: 0, lengthKm: 0 };
    });
  });

  const total = {};
  BUCKETS.forEach(bucket => {
    total[bucket.key] = { count: 0, length: 0 };
  });

  return { byRoad, total, maxTotals: { count: 0, length: 0 } };
}

function assignBucket(summary, lengthMeters, roadType) {
  const bucket = BUCKETS.find(b => lengthMeters >= b.min && lengthMeters < b.max);
  if (!bucket) return;
  const bucketKey = bucket.key;
  const bucketRoad = summary.byRoad[bucketKey]?.[roadType];
  if (bucketRoad) {
    bucketRoad.count += 1;
    bucketRoad.lengthKm += lengthMeters / 1000;
  }
  summary.total[bucketKey].count += 1;
  summary.total[bucketKey].length += lengthMeters;
  summary.maxTotals.count = Math.max(summary.maxTotals.count, summary.total[bucketKey].count);
  summary.maxTotals.length = Math.max(summary.maxTotals.length, summary.total[bucketKey].length / 1000);
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
