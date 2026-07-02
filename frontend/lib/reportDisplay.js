export function formatBioValue(value, decimals = 4) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n !== 0 && Math.abs(n) < 0.0001) return n.toExponential(2);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(decimals);
}

export function formatImportedAt(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function normalizeStructuredReport(report) {
  const rows = Array.isArray(report?.rows)
    ? report.rows
        .map((row) => {
          const lstm = row.lstm_row || {};
          const hasLstm = lstm.motor_UPDRS != null;
          return {
            day: Number(row.day),
            breathScore: Number(row.breath_score),
            pauseScore: Number(row.pause_score),
            speechRate: Number(row.speech_rate),
            healthScore: Number(row.health_score),
            hasLstm,
            motorUpdrs: hasLstm ? Number(lstm.motor_UPDRS) : null,
            jitter: hasLstm ? Number(lstm['Jitter(%)']) : null,
            shimmer: hasLstm ? Number(lstm.Shimmer) : null,
            hnr: hasLstm ? Number(lstm.HNR) : null,
            rpde: hasLstm ? Number(lstm.RPDE) : null,
            ppe: hasLstm ? Number(lstm.PPE) : null,
          };
        })
        .filter((row) => Number.isFinite(row.day))
        .sort((a, b) => a.day - b.day)
    : [];

  const hasParkinsonBiomarkers = rows.some((row) => row.hasLstm);
  const firstMotor = rows.find((r) => r.hasLstm)?.motorUpdrs ?? null;
  const lastMotor = [...rows].reverse().find((r) => r.hasLstm)?.motorUpdrs ?? null;
  const firstScore = rows.length ? rows[0].healthScore : null;
  const lastScore = rows.length ? rows[rows.length - 1].healthScore : null;

  return {
    patientName: report?.patient_name || null,
    disease: report?.disease || null,
    rows,
    hasParkinsonBiomarkers,
    firstMotor,
    lastMotor,
    motorDelta: firstMotor != null && lastMotor != null ? lastMotor - firstMotor : null,
    firstScore,
    lastScore,
    scoreDelta: firstScore !== null && lastScore !== null ? lastScore - firstScore : null,
    finalScore: report?.final_health_score ?? null,
    finalStatus: report?.final_health_status || null,
  };
}
