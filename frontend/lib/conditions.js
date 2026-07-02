/** Supported monitoring conditions — one per patient profile. */

export const CONDITION_IDS = ['parkinsons', 'depression', 'asthma'];

export const CONDITIONS = {
  parkinsons: {
    id: 'parkinsons',
    label: "Parkinson's",
    apiValue: "Parkinson's",
    icon: 'neurology',
    accent: 'from-violet-600 to-purple-500',
    summary: 'Monitor tremor, jitter, shimmer, and speech steadiness over time.',
    recordingSeconds: 15,
    sustainSeconds: 5,
    dashboardSubtitle: 'Motor speech and tremor biomarkers from your daily voice diary.',
    metricCards: [
      { id: 'tremor', label: 'Voice Tremor', icon: 'graphic_eq', field: 'tremor_score', fallback: 'jitter', invert: true },
      { id: 'jitter', label: 'Jitter & Shimmer', icon: 'vibration', field: 'jitter', combine: 'shimmer', invert: true },
      { id: 'speech', label: 'Speech Steadiness', icon: 'record_voice_over', field: 'speech_rate', invert: false },
    ],
    dashboardClinicalCards: [
      { id: 'voice_tremor', label: 'Voice Tremors', icon: 'graphic_eq' },
      { id: 'breathlessness', label: 'Breathlessness', icon: 'air' },
      { id: 'pitch_variation', label: 'Pitch Variation', icon: 'tune' },
      { id: 'speech_rate', label: 'Speech Rate', icon: 'speed' },
      { id: 'pause_patterns', label: 'Pause Patterns', icon: 'pause' },
    ],
    resultBars: [
      { label: 'Signature Detected', key: 'signature_detected', max: 1 },
      { label: 'Tremor', key: 'tremor_score', max: 1 },
      { label: 'Pause Patterns', key: 'pause_score', max: 1 },
      { label: 'Speech Rate', key: 'speech_rate', max: 1 },
      { label: 'Pitch Variation', key: 'pitch_variation', max: 1 },
    ],
  },
  depression: {
    id: 'depression',
    label: 'Depression',
    apiValue: 'Depression',
    icon: 'psychology',
    accent: 'from-sky-600 to-blue-500',
    summary: 'Track speech rate, pauses, pitch monotony, and vocal energy daily.',
    recordingSeconds: 15,
    sustainSeconds: 0,
    dashboardSubtitle: 'Psychomotor speech markers linked to mood and energy changes.',
    metricCards: [
      { id: 'speech', label: 'Speech Rate', icon: 'speed', field: 'speech_rate', invert: false },
      { id: 'pause', label: 'Pause Patterns', icon: 'pause', field: 'pause_score', invert: true },
      { id: 'pitch', label: 'Pitch Variation', icon: 'graphic_eq', field: 'pitch_variation', invert: false },
    ],
    resultBars: [
      { label: 'Signature Detected', key: 'signature_detected', max: 1 },
      { label: 'Speech Rate', key: 'speech_rate', max: 1 },
      { label: 'Pause Patterns', key: 'pause_score', max: 1 },
      { label: 'Pitch Variation', key: 'pitch_variation', max: 1 },
      { label: 'Vocal Energy', key: 'breath_score', max: 1 },
    ],
  },
  asthma: {
    id: 'asthma',
    label: 'Asthma',
    apiValue: 'Asthma',
    icon: 'pulmonology',
    accent: 'from-emerald-600 to-teal-500',
    summary: 'Watch breathlessness, wheeze signatures, pauses, and speech effort.',
    recordingSeconds: 20,
    sustainSeconds: 5,
    dashboardSubtitle: 'Respiratory voice markers from your daily breathing check-in.',
    metricCards: [
      { id: 'breath', label: 'Breath Stability', icon: 'air', field: 'breathlessness_score', invert: false },
      { id: 'pause', label: 'Pause Patterns', icon: 'pause', field: 'pause_score', invert: true },
      { id: 'speech', label: 'Speech Rate', icon: 'speed', field: 'speech_rate', invert: false },
    ],
    resultBars: [
      { label: 'Wheeze', key: 'wheeze_detected', max: 1 },
      { label: 'Cough', key: 'cough_detected', max: 1 },
      { label: 'Breathlessness', key: 'breathlessness_score', max: 100 },
      { label: 'Pause Patterns', key: 'pause_score', max: 1 },
      { label: 'Speech Rate', key: 'speech_rate', max: 1 },
    ],
  },
};

export function getCondition(id) {
  return CONDITIONS[id] || null;
}

export function getConditionList() {
  return CONDITION_IDS.map((id) => CONDITIONS[id]);
}

export function apiValueFromId(id) {
  return CONDITIONS[id]?.apiValue || null;
}

/** Map stored `profiles.condition` value back to app condition id. */
export function conditionIdFromApiValue(apiValue) {
  if (!apiValue) return null;
  const normalized = String(apiValue).trim().toLowerCase();
  for (const id of CONDITION_IDS) {
    const c = CONDITIONS[id];
    if (c.apiValue.toLowerCase() === normalized || id === normalized) {
      return id;
    }
  }
  return null;
}
