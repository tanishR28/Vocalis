const REPORT_IMPORT_KEY = 'vocalis_report_import';
const LEGACY_REPORT_IMPORT_KEY = 'vocalis_report_import';
const DASHBOARD_IMPORT_DISMISS_KEY = 'vocalis_report_import_dashboard_dismissed';
export const REPORT_IMPORT_CHANGED = 'vocalis_report_import_changed';
export const AUTH_USER_CHANGED = 'vocalis_auth_user_changed';

function scopedImportKey(userId) {
  return userId ? `${REPORT_IMPORT_KEY}:${userId}` : LEGACY_REPORT_IMPORT_KEY;
}

function scopedDismissKey(userId) {
  return userId ? `${DASHBOARD_IMPORT_DISMISS_KEY}:${userId}` : DASHBOARD_IMPORT_DISMISS_KEY;
}

function notifyReportImportChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REPORT_IMPORT_CHANGED));
  }
}

/** Trim API payload before localStorage (drop huge extracted_text). */
function toStoredPayload(data, userId = null) {
  if (!data) return null;
  return {
    userId: userId || null,
    filename: data.filename || null,
    importedAt: new Date().toISOString(),
    imported_rows: data.imported_rows ?? 0,
    lstm_rows_parsed: data.lstm_rows_parsed ?? 0,
    db_persisted: data.db_persisted,
    persistence_warning: data.persistence_warning || null,
    summary: data.summary || null,
    report: data.report || null,
    detected_conditions: data.detected_conditions || [],
    source_type: data.source_type || null,
  };
}

function parseStored(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.filename && !parsed?.imported_rows) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isDashboardImportDismissed(userId = null) {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(scopedDismissKey(userId)) === '1';
}

export function dismissDashboardImport(userId = null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(scopedDismissKey(userId), '1');
  notifyReportImportChange();
}

export function clearDashboardImportDismiss(userId = null) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(scopedDismissKey(userId));
}

export function getStoredReportImport(userId = null) {
  if (typeof window === 'undefined') return null;

  if (userId) {
    return parseStored(localStorage.getItem(scopedImportKey(userId)));
  }

  return parseStored(localStorage.getItem(LEGACY_REPORT_IMPORT_KEY));
}

export function saveReportImport(apiResponse, userId = null) {
  if (typeof window === 'undefined') return null;
  const payload = toStoredPayload(apiResponse, userId);
  if (!payload) return null;

  if (userId) {
    localStorage.setItem(scopedImportKey(userId), JSON.stringify(payload));
    localStorage.removeItem(LEGACY_REPORT_IMPORT_KEY);
    localStorage.removeItem(DASHBOARD_IMPORT_DISMISS_KEY);
  } else {
    localStorage.setItem(LEGACY_REPORT_IMPORT_KEY, JSON.stringify(payload));
  }

  clearDashboardImportDismiss(userId);
  notifyReportImportChange();
  return payload;
}

export function clearReportImport(userId = null) {
  if (typeof window === 'undefined') return false;

  let changed = false;
  if (userId) {
    if (localStorage.getItem(scopedImportKey(userId))) changed = true;
    if (localStorage.getItem(scopedDismissKey(userId))) changed = true;
    localStorage.removeItem(scopedImportKey(userId));
    localStorage.removeItem(scopedDismissKey(userId));
  } else {
    if (localStorage.getItem(LEGACY_REPORT_IMPORT_KEY)) changed = true;
    if (localStorage.getItem(DASHBOARD_IMPORT_DISMISS_KEY)) changed = true;
    localStorage.removeItem(LEGACY_REPORT_IMPORT_KEY);
    localStorage.removeItem(DASHBOARD_IMPORT_DISMISS_KEY);
  }

  if (changed) notifyReportImportChange();
  return changed;
}

/** Drop anonymous/legacy import cache when a real user signs in. */
export function clearLegacyReportImport() {
  if (typeof window === 'undefined') return false;

  let changed = false;
  if (localStorage.getItem(LEGACY_REPORT_IMPORT_KEY)) changed = true;
  if (localStorage.getItem(DASHBOARD_IMPORT_DISMISS_KEY)) changed = true;
  localStorage.removeItem(LEGACY_REPORT_IMPORT_KEY);
  localStorage.removeItem(DASHBOARD_IMPORT_DISMISS_KEY);

  if (changed) notifyReportImportChange();
  return changed;
}

export function onAuthUserChanged(userId) {
  if (typeof window === 'undefined') return;

  const previousUserId = sessionStorage.getItem('vocalis_last_auth_user_id') || '';
  const nextUserId = userId || '';

  if (previousUserId && previousUserId !== nextUserId) {
    localStorage.removeItem('vocalis_latest_analysis');
    localStorage.removeItem('vocalis_just_updated');
  }

  if (nextUserId) {
    clearLegacyReportImport();
  }

  sessionStorage.setItem('vocalis_last_auth_user_id', nextUserId);
  window.dispatchEvent(new Event(AUTH_USER_CHANGED));
}

/** Rehydrate shape expected by dashboard (matches API response subset). */
export function toReportImportResult(stored) {
  if (!stored) return null;
  return {
    filename: stored.filename,
    imported_rows: stored.imported_rows,
    lstm_rows_parsed: stored.lstm_rows_parsed,
    db_persisted: stored.db_persisted,
    persistence_warning: stored.persistence_warning,
    summary: stored.summary,
    report: stored.report,
    detected_conditions: stored.detected_conditions,
    source_type: stored.source_type,
    importedAt: stored.importedAt,
  };
}
