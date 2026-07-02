/** Visual styles + human labels for voice analysis diagnostic results. */

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

export function formatSexLabel(sex) {
  if (sex === 0 || sex === '0') return 'Female';
  if (sex === 1 || sex === '1') return 'Male';
  return 'Not set';
}

/**
 * Diagnostic Status from ML `prediction` field:
 * - NO      → severity ≤ 45  (low voice-disease signal)
 * - MONITOR → severity 45–70 (borderline — watch closely)
 * - YES     → severity > 70  (elevated signal — clinical follow-up)
 */
export function explainDiagnosticStatus(status) {
  const key = normalizeStatus(status);
  if (key === 'YES') {
    return 'Voice biomarkers suggest elevated concern. Consider discussing results with your care team.';
  }
  if (key === 'MONITOR') {
    return 'Some markers are in a borderline range. Keep recording regularly and watch for changes.';
  }
  if (key === 'NO') {
    return 'Voice biomarkers are within the model’s lower-concern range for this session.';
  }
  if (key.includes('COUGH')) {
    return 'Cough-like acoustic patterns were detected in this recording.';
  }
  return 'Summary label from the voice analysis model for this session.';
}

export function getDiagnosticStatusPresentation(status, severity = null) {
  const key = normalizeStatus(status);
  const sev = Number(severity);

  if (key === 'YES' || key.includes('COUGH')) {
    return {
      title: key.includes('COUGH') ? 'Cough detected' : 'Elevated concern',
      subtitle: key,
      cardClass: 'bg-gradient-to-br from-red-50 to-red-100/70 border-red-200',
      textClass: 'text-red-800',
      badgeClass: 'bg-red-600 text-white',
      icon: 'warning',
    };
  }

  if (key === 'MONITOR') {
    return {
      title: 'Monitor closely',
      subtitle: 'MONITOR',
      cardClass: 'bg-gradient-to-br from-amber-50 to-orange-100/70 border-amber-200',
      textClass: 'text-amber-900',
      badgeClass: 'bg-amber-500 text-white',
      icon: 'visibility',
    };
  }

  if (key === 'NO') {
    return {
      title: 'Within normal range',
      subtitle: 'NO',
      cardClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100/70 border-emerald-200',
      textClass: 'text-emerald-800',
      badgeClass: 'bg-emerald-600 text-white',
      icon: 'check_circle',
    };
  }

  if (Number.isFinite(sev)) {
    if (sev > 70) {
      return {
        title: status || 'High severity',
        subtitle: `Severity ${Math.round(sev)}`,
        cardClass: 'bg-gradient-to-br from-red-50 to-red-100/70 border-red-200',
        textClass: 'text-red-800',
        badgeClass: 'bg-red-600 text-white',
        icon: 'warning',
      };
    }
    if (sev > 45) {
      return {
        title: status || 'Moderate severity',
        subtitle: `Severity ${Math.round(sev)}`,
        cardClass: 'bg-gradient-to-br from-amber-50 to-orange-100/70 border-amber-200',
        textClass: 'text-amber-900',
        badgeClass: 'bg-amber-500 text-white',
        icon: 'visibility',
      };
    }
  }

  return {
    title: status || 'Unknown',
    subtitle: '',
    cardClass: 'bg-gradient-to-br from-slate-50 to-slate-100/70 border-slate-200',
    textClass: 'text-slate-700',
    badgeClass: 'bg-slate-500 text-white',
    icon: 'info',
  };
}

export function getHealthScorePresentation(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return {
      cardClass: 'bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200',
      textClass: 'text-slate-600',
      label: 'N/A',
    };
  }
  if (value >= 80) {
    return {
      cardClass: 'bg-gradient-to-br from-emerald-50 to-teal-100/50 border-emerald-200',
      textClass: 'text-emerald-700',
      label: 'Strong',
    };
  }
  if (value >= 60) {
    return {
      cardClass: 'bg-gradient-to-br from-blue-50 to-sky-100/50 border-blue-200',
      textClass: 'text-blue-700',
      label: 'Good',
    };
  }
  if (value >= 40) {
    return {
      cardClass: 'bg-gradient-to-br from-amber-50 to-yellow-100/50 border-amber-200',
      textClass: 'text-amber-800',
      label: 'Fair',
    };
  }
  return {
    cardClass: 'bg-gradient-to-br from-red-50 to-rose-100/50 border-red-200',
    textClass: 'text-red-700',
    label: 'Low',
  };
}

export function getSeverityPresentation(severity, stage) {
  const value = Number(severity);
  const stageText = String(stage || '').toLowerCase();

  if (stageText === 'severe' || (Number.isFinite(value) && value >= 65)) {
    return {
      cardClass: 'bg-gradient-to-br from-red-50 to-rose-100/60 border-red-200',
      textClass: 'text-red-800',
      stageClass: 'text-red-700',
      label: 'Severe',
    };
  }
  if (stageText === 'moderate' || (Number.isFinite(value) && value >= 35)) {
    return {
      cardClass: 'bg-gradient-to-br from-amber-50 to-orange-100/60 border-amber-200',
      textClass: 'text-amber-900',
      stageClass: 'text-amber-800',
      label: 'Moderate',
    };
  }
  return {
    cardClass: 'bg-gradient-to-br from-violet-50 to-purple-100/50 border-violet-200',
    textClass: 'text-violet-800',
    stageClass: 'text-violet-700',
    label: 'Mild',
  };
}
