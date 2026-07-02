import {
  CLINICAL_INSIGHT_CATALOG,
  formatInsightValue,
  getClinicalInsightsFromBiomarkers,
  insightLevel,
} from './clinicalInsights';

export const TIME_RANGES = {
  '7d': { label: '7 days', days: 7, limit: 7 },
  '30d': { label: '30 days', days: 30, limit: 30 },
  '90d': { label: '90 days', days: 90, limit: 90 },
  all: { label: 'All', days: null, limit: 200 },
};

const IMPORT_SOURCE = 'imported-medical-record';

export function isImportedSession(item) {
  const source = item?.source || item?.biomarkers?.raw_features?.source || '';
  return source === IMPORT_SOURCE || String(source).includes('import');
}

export function sessionSourceLabel(item) {
  return isImportedSession(item) ? 'Imported' : 'Recorded';
}

export function countSessionsBySource(items) {
  const list = items || [];
  let imported = 0;
  let recorded = 0;
  for (const item of list) {
    if (isImportedSession(item)) imported += 1;
    else recorded += 1;
  }
  return { total: list.length, imported, recorded };
}

function normalizeClinicalScore(insight) {
  if (!insight) return null;
  const score = Number(insight.score ?? insight.raw_value);
  if (!Number.isFinite(score)) return null;
  return score <= 1 ? score * 100 : score;
}

function parseTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value) {
  const date = parseTimestamp(value);
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAILY_AVG_NUMERIC_KEYS = [
  'health_score',
  'severity',
  'motor_updrs',
  'pitch_mean',
  'pitch_std',
  'jitter',
  'shimmer',
  'hnr',
  'speech_rate',
  'pause_count',
  'avg_pause',
  ...CLINICAL_INSIGHT_CATALOG.map((def) => def.id),
];

function averageNumbers(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

/** Multiple recordings on the same calendar day → one averaged point for charts. */
export function aggregateTimelineByDay(rows) {
  if (!rows?.length) return [];

  const byDay = new Map();
  for (const row of rows) {
    const key = dayKey(row.date);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  }

  const aggregated = [];
  for (const [key, sessions] of byDay) {
    if (sessions.length === 1) {
      aggregated.push({
        ...sessions[0],
        session_count: 1,
        session_ids: [sessions[0].id],
        is_daily_average: false,
      });
      continue;
    }

    const latest = sessions[sessions.length - 1];
    const averaged = { ...latest };
    for (const field of DAILY_AVG_NUMERIC_KEYS) {
      const mean = averageNumbers(sessions.map((s) => Number(s[field])));
      if (mean !== null) averaged[field] = Number(mean.toFixed(2));
    }
    averaged.session_count = sessions.length;
    averaged.session_ids = sessions.map((s) => s.id);
    averaged.is_daily_average = true;
    averaged.title = `${sessions.length} sessions (daily avg)`;
    const [year, month, day] = key.split('-').map(Number);
    averaged.date = new Date(year, month - 1, day, 12, 0, 0).toISOString();
    averaged.dateLabel = formatAxisDate(averaged.date);
    aggregated.push(averaged);
  }

  aggregated.sort((a, b) => {
    const da = parseTimestamp(a.date)?.getTime() ?? 0;
    const db = parseTimestamp(b.date)?.getTime() ?? 0;
    return da - db;
  });

  return aggregated.map((row, index, arr) => {
    const start = Math.max(0, index - 2);
    const window = arr.slice(start, index + 1).map((r) => Number(r.health_score ?? 0));
    return {
      ...row,
      health_score_avg3: window.length
        ? Number((window.reduce((s, v) => s + v, 0) / window.length).toFixed(1))
        : row.health_score,
    };
  });
}

export function buildInsightsTimeline(historyItems, rangeKey = '30d', { aggregateByDay = true } = {}) {
  const range = TIME_RANGES[rangeKey] || TIME_RANGES['30d'];
  const now = Date.now();
  const cutoff = range.days ? now - range.days * 86400000 : null;

  const sorted = [...(historyItems || [])]
    .filter((item) => item?.timestamp)
    .sort((a, b) => {
      const da = parseTimestamp(a.timestamp)?.getTime() ?? 0;
      const db = parseTimestamp(b.timestamp)?.getTime() ?? 0;
      return da - db;
    });

  const filtered = sorted.filter((item) => {
    if (!cutoff) return true;
    const ts = parseTimestamp(item.timestamp)?.getTime();
    return ts != null && ts >= cutoff;
  });

  const limited = range.limit ? filtered.slice(-range.limit) : filtered;

  const sessionRows = limited.map((item, index, arr) => {
    const biomarkers = item.biomarkers || {};
    const raw = biomarkers.raw_features || {};
    const signals = raw.signals || {};
    const clinical = getClinicalInsightsFromBiomarkers(biomarkers) || {};
    const healthScore = Number(item.health_score?.score ?? biomarkers.health_score ?? 0);
    const severity = Number(raw.severity ?? 0);
    const motorUpdrs = Number(raw.motor_updrs ?? raw.lstm_row?.motor_UPDRS ?? NaN);

    const row = {
      id: item.id || `row-${index}`,
      date: item.timestamp,
      dateLabel: formatAxisDate(item.timestamp),
      title: item.title || 'Session',
      source: sessionSourceLabel(item),
      sourceRaw: item.source || raw.source || 'audio-analysis',
      category: item.health_score?.category || biomarkers.health_category || '',
      health_score: healthScore,
      severity: Number.isFinite(severity) ? severity : null,
      prediction: raw.prediction || raw.status || null,
      motor_updrs: Number.isFinite(motorUpdrs) ? motorUpdrs : null,
      insight_source: clinical.insight_source || raw.model_source || null,
      pitch_mean: Number(biomarkers.pitch_mean ?? signals.pitch_mean ?? 0),
      pitch_std: Number(biomarkers.pitch_variation ?? signals.pitch_std ?? 0),
      jitter: Number(biomarkers.jitter ?? signals.jitter ?? 0),
      shimmer: Number(biomarkers.shimmer ?? signals.shimmer ?? 0),
      hnr: Number(biomarkers.hnr ?? signals.hnr ?? 0),
      speech_rate: Number(biomarkers.speech_rate ?? signals.speech_rate ?? 0),
      pause_count: Number(biomarkers.pause_count ?? signals.pause_count ?? 0),
      avg_pause: Number(biomarkers.pause_duration_avg ?? signals.avg_pause_len ?? 0),
    };

    for (const def of CLINICAL_INSIGHT_CATALOG) {
      const insight = clinical[def.id];
      row[def.id] = normalizeClinicalScore(insight);
      row[`${def.id}_raw`] = insight || null;
    }

    const start = Math.max(0, index - 2);
    const window = arr.slice(start, index + 1).map((r) => Number(r.health_score?.score ?? 0));
    row.health_score_avg3 = window.length
      ? Number((window.reduce((s, v) => s + v, 0) / window.length).toFixed(1))
      : healthScore;

    row.session_count = 1;
    row.is_daily_average = false;

    return row;
  });

  return aggregateByDay ? aggregateTimelineByDay(sessionRows) : sessionRows;
}

export function formatAxisDate(value) {
  const date = parseTimestamp(value);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(value) {
  const date = parseTimestamp(value);
  if (!date) return String(value || '');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function averageField(rows, key) {
  const values = (rows || []).map((r) => Number(r[key])).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function buildRadarData(latestRow) {
  if (!latestRow) return [];
  return CLINICAL_INSIGHT_CATALOG.map((def) => ({
    metric: def.name,
    id: def.id,
    value: Number(latestRow[def.id] ?? 0),
    fullMark: 100,
    description: def.description,
    level: latestRow[`${def.id}_raw`],
  })).filter((d) => Number.isFinite(d.value));
}

export function buildDiagnosticPieData(rows) {
  const counts = { NO: 0, MONITOR: 0, YES: 0, Other: 0 };
  for (const row of rows || []) {
    const key = String(row.prediction || '').toUpperCase();
    if (key === 'NO') counts.NO += 1;
    else if (key === 'MONITOR') counts.MONITOR += 1;
    else if (key === 'YES') counts.YES += 1;
    else if (key) counts.Other += 1;
  }
  return [
    { name: 'NO', value: counts.NO, color: '#10b981' },
    { name: 'MONITOR', value: counts.MONITOR, color: '#f59e0b' },
    { name: 'YES', value: counts.YES, color: '#ef4444' },
    { name: 'Other', value: counts.Other, color: '#94a3b8' },
  ].filter((d) => d.value > 0);
}

export function buildSeverityBuckets(rows) {
  const buckets = [
    { name: 'Mild (0–45)', min: 0, max: 45, count: 0 },
    { name: 'Monitor (45–70)', min: 45, max: 70, count: 0 },
    { name: 'Elevated (70+)', min: 70, max: 101, count: 0 },
  ];
  for (const row of rows || []) {
    const sev = Number(row.severity);
    if (!Number.isFinite(sev)) continue;
    if (sev <= 45) buckets[0].count += 1;
    else if (sev <= 70) buckets[1].count += 1;
    else buckets[2].count += 1;
  }
  return buckets;
}

export function buildClinicalAverageBars(rows) {
  return CLINICAL_INSIGHT_CATALOG.map((def) => ({
    metric: def.name,
    id: def.id,
    avg: Number(averageField(rows, def.id).toFixed(1)),
  }));
}

export function hasAcousticData(rows) {
  return (rows || []).some(
    (r) => r.jitter > 0 || r.shimmer > 0 || r.hnr > 0 || r.insight_source === 'acoustic_analysis' || r.insight_source === 'updrs_xgboost',
  );
}

export function latestTimelineRow(rows) {
  if (!rows?.length) return null;
  return rows[rows.length - 1];
}

export function dashboardClinicalMetric(card, latestRow) {
  const insight = latestRow?.[`${card.id}_raw`];
  const score = latestRow?.[card.id];
  if (insight && Number.isFinite(score)) {
    return {
      label: card.label,
      value: insightLevel(card.id, insight),
      hint: formatInsightValue(card.id, insight),
      icon: card.icon,
      empty: false,
    };
  }
  return { label: card.label, value: '—', hint: 'No data', icon: card.icon, empty: true };
}
