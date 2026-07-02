/** Clinical voice biomarkers stored for insights/reference (not LSTM/XGBoost model inputs). */

export const CLINICAL_INSIGHT_CATALOG = [
  {
    id: 'voice_tremor',
    number: '01',
    name: 'Voice Tremors',
    description: 'Detection of micro-oscillations in frequency/amplitude.',
  },
  {
    id: 'breathlessness',
    number: '02',
    name: 'Breathlessness',
    description: 'Analysis of intake gasps and phrase length.',
  },
  {
    id: 'pitch_variation',
    number: '03',
    name: 'Pitch Variation',
    description: 'Monitoring monotonic speech or erratic fluctuations.',
  },
  {
    id: 'speech_rate',
    number: '04',
    name: 'Speech Rate',
    description: 'Tracking cognitive load and neurological responses.',
  },
  {
    id: 'pause_patterns',
    number: '05',
    name: 'Pause Patterns',
    description: 'Identifying abnormal gaps in verbal articulation.',
  },
];

export function getClinicalInsightsFromBiomarkers(biomarkers) {
  return biomarkers?.raw_features?.clinical_insights || null;
}

export function formatInsightValue(insightId, insight) {
  if (!insight || insight.score == null) return '—';
  const score = Number(insight.score);
  if (!Number.isFinite(score)) return '—';

  if (insightId === 'pitch_variation') {
    return score < 1 ? score.toFixed(3) : score.toFixed(1);
  }
  if (insightId === 'pause_patterns') {
    const count = insight.pause_count;
    if (Number.isFinite(count)) return `${Math.round(score)} (${count} pauses)`;
  }
  if (score <= 1) return `${(score * 100).toFixed(0)}%`;
  return `${Math.round(score)}`;
}

export function insightLevel(insightId, insight) {
  const raw = Number(insight?.raw_value ?? insight?.score ?? 0);
  if (!Number.isFinite(raw)) return '—';

  const value = raw <= 1 ? raw : raw / 100;
  if (insightId === 'speech_rate') {
    if (value >= 0.55) return 'High';
    if (value >= 0.35) return 'Moderate';
    return 'Low';
  }
  if (value <= 0.25) return 'Low';
  if (value <= 0.5) return 'Moderate';
  return 'High';
}

export function averageClinicalInsights(historyItems) {
  const rows = (historyItems || [])
    .map((item) => getClinicalInsightsFromBiomarkers(item.biomarkers))
    .filter(Boolean);

  if (!rows.length) return null;

  const result = {};
  for (const def of CLINICAL_INSIGHT_CATALOG) {
    const values = rows
      .map((row) => row[def.id])
      .filter((entry) => entry && Number.isFinite(Number(entry.score ?? entry.raw_value)));
    if (!values.length) {
      result[def.id] = null;
      continue;
    }
    const avgScore =
      values.reduce((sum, entry) => sum + Number(entry.score ?? entry.raw_value ?? 0), 0) / values.length;
    const avgRaw =
      values.reduce((sum, entry) => sum + Number(entry.raw_value ?? entry.score ?? 0), 0) / values.length;
    result[def.id] = {
      score: avgScore,
      raw_value: avgRaw,
      samples: values.length,
    };
  }
  return result;
}
