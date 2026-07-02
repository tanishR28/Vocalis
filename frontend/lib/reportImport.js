const REPORT_IMPORT_KEY = 'vocalis_report_import';
const DASHBOARD_IMPORT_DISMISS_KEY = 'vocalis_report_import_dashboard_dismissed';
export const REPORT_IMPORT_CHANGED = 'vocalis_report_import_changed';

function notifyReportImportChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REPORT_IMPORT_CHANGED));
  }
}

/** Trim API payload before localStorage (drop huge extracted_text). */
function toStoredPayload(data) {
  if (!data) return null;
  return {
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

export function isDashboardImportDismissed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DASHBOARD_IMPORT_DISMISS_KEY) === '1';
}

export function dismissDashboardImport() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DASHBOARD_IMPORT_DISMISS_KEY, '1');
  notifyReportImportChange();
}

export function clearDashboardImportDismiss() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DASHBOARD_IMPORT_DISMISS_KEY);
}

export function getStoredReportImport() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REPORT_IMPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.filename && !parsed?.imported_rows) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveReportImport(apiResponse) {
  if (typeof window === 'undefined') return null;
  const payload = toStoredPayload(apiResponse);
  if (!payload) return null;
  localStorage.setItem(REPORT_IMPORT_KEY, JSON.stringify(payload));
  clearDashboardImportDismiss();
  notifyReportImportChange();
  return payload;
}

export function clearReportImport() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REPORT_IMPORT_KEY);
  notifyReportImportChange();
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
