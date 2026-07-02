'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatBioValue, formatImportedAt } from '../../lib/reportDisplay';
import { useMedicalReportImport } from '../../lib/useMedicalReportImport';
import { getProfile, hasParkinsonDemographics } from '../../lib/profile';
import { downloadParkinsonHistoryExport } from '../../lib/exportHistory';
import DemographicsConflictModal from './DemographicsConflictModal';
import {
  dismissDashboardImport,
  isDashboardImportDismissed,
  REPORT_IMPORT_CHANGED,
} from '../../lib/reportImport';

export function HistoryExportPanel() {
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState('');

  async function handleExport(format) {
    const profile = getProfile();
    if (!hasParkinsonDemographics(profile)) {
      setExportError('Add your age and sex in Settings before exporting (used instead of report values).');
      return;
    }
    setExportError('');
    setExporting(format);
    try {
      await downloadParkinsonHistoryExport({
        format,
        age: profile.age,
        sex: profile.sex,
        subjectId: 1,
      });
    } catch (error) {
      setExportError(error?.message || 'Export failed.');
    } finally {
      setExporting('');
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 font-headline">Export 30-day history</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Downloads your latest 30 biomarker days in the same CSV/PDF format as imports
            (merges remaining imported days with your recordings — e.g. 24 from report + 6 recorded).
            Uses your profile age and sex, not values from an old report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={Boolean(exporting)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting === 'csv' ? 'Exporting…' : 'Download CSV'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={Boolean(exporting)}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Download PDF'}
          </button>
        </div>
      </div>
      {exportError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</div>
      ) : null}
    </section>
  );
}

function ReportUploadForm({
  reportFileInputRef,
  selectedReportFileName,
  isReportUploading,
  hasUploadedReport,
  showReportUploadForm,
  reportError,
  onChooseFile,
  onUpload,
  onCancel,
  onDismiss,
  showDismiss = false,
}) {
  return (
    <>
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <input
          ref={reportFileInputRef}
          type="file"
          accept="image/*,.pdf,.csv"
          onChange={onChooseFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => reportFileInputRef.current?.click()}
          className={`rounded-xl border px-5 py-2.5 font-bold transition-colors max-w-full flex-1 sm:flex-none ${selectedReportFileName ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {selectedReportFileName ? (
            <span className="block truncate">Selected: {selectedReportFileName}</span>
          ) : (
            'Choose PDF/CSV/Image'
          )}
        </button>
        <button
          type="button"
          onClick={onUpload}
          disabled={isReportUploading}
          className="rounded-xl px-5 py-2.5 bg-primary text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isReportUploading ? 'Importing…' : 'Import report'}
        </button>
        {hasUploadedReport && showReportUploadForm ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
        {showDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-50"
          >
            Not now
          </button>
        ) : null}
      </div>

      {showReportUploadForm && !hasUploadedReport && selectedReportFileName ? (
        <p className="mt-2 text-xs text-slate-500">Selected file: {selectedReportFileName}</p>
      ) : null}

      {reportError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reportError}</div>
      ) : null}
    </>
  );
}

function ReportBiomarkerTable({ structuredReport }) {
  if (!structuredReport?.rows?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-bold">Day</th>
              {structuredReport.hasParkinsonBiomarkers ? (
                <>
                  <th className="px-4 py-3 font-bold">Motor UPDRS</th>
                  <th className="px-4 py-3 font-bold">Jitter (%)</th>
                  <th className="px-4 py-3 font-bold">Shimmer</th>
                  <th className="px-4 py-3 font-bold">HNR</th>
                  <th className="px-4 py-3 font-bold">RPDE</th>
                  <th className="px-4 py-3 font-bold">PPE</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 font-bold">Breath Score</th>
                  <th className="px-4 py-3 font-bold">Pause Score</th>
                  <th className="px-4 py-3 font-bold">Speech Rate</th>
                  <th className="px-4 py-3 font-bold">Health Score</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {structuredReport.rows.map((row) => (
              <tr key={`report-row-${row.day}`} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-2 font-semibold text-slate-700">Day {row.day}</td>
                {structuredReport.hasParkinsonBiomarkers ? (
                  <>
                    <td className="px-4 py-2 font-bold text-violet-800">{formatBioValue(row.motorUpdrs, 2)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{formatBioValue(row.jitter, 5)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{formatBioValue(row.shimmer, 5)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{formatBioValue(row.hnr, 2)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{formatBioValue(row.rpde, 4)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{formatBioValue(row.ppe, 4)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-slate-700">{Number.isFinite(row.breathScore) ? row.breathScore : 'N/A'}</td>
                    <td className="px-4 py-2 text-slate-700">{Number.isFinite(row.pauseScore) ? row.pauseScore : 'N/A'}</td>
                    <td className="px-4 py-2 text-slate-700">{Number.isFinite(row.speechRate) ? row.speechRate : 'N/A'}</td>
                    <td className="px-4 py-2 font-bold text-slate-800">{Number.isFinite(row.healthScore) ? row.healthScore : 'N/A'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardCompactCard({ uploadedReportFileName, reportImportResult }) {
  return (
    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/60 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className="material-symbols-outlined text-emerald-600 text-2xl shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-emerald-900">Medical report uploaded</p>
          <p className="text-xs text-emerald-800/90 truncate mt-0.5">
            {uploadedReportFileName}
            {' · '}
            {reportImportResult.imported_rows ?? 0} days
            {reportImportResult.lstm_rows_parsed ? ` · ${reportImportResult.lstm_rows_parsed} LSTM sessions` : ''}
          </p>
        </div>
      </div>
      <Link
        href="/history"
        className="inline-flex items-center justify-center gap-1 shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
      >
        View in History
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
  );
}

function HistoryReportDetail({
  reportImportResult,
  structuredReport,
  uploadedReportFileName,
  showReportUploadForm,
  onChangeReport,
  onRemoveReport,
  reportFileInputRef,
  selectedReportFileName,
  isReportUploading,
  hasUploadedReport,
  reportError,
  onChooseFile,
  onUpload,
  onCancel,
}) {
  const [tableExpanded, setTableExpanded] = useState(false);

  if (showReportUploadForm) {
    return (
      <section className="bg-white border border-slate-200 rounded-[18px] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 font-headline">Replace medical report</h3>
            <p className="text-sm text-slate-500 mt-1">Upload a new PDF, CSV, or image to replace the current import.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            Cancel
          </button>
        </div>
        <ReportUploadForm
          reportFileInputRef={reportFileInputRef}
          selectedReportFileName={selectedReportFileName}
          isReportUploading={isReportUploading}
          hasUploadedReport={hasUploadedReport}
          showReportUploadForm={showReportUploadForm}
          reportError={reportError}
          onChooseFile={onChooseFile}
          onUpload={onUpload}
          onCancel={onCancel}
        />
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-[18px] p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div>
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Imported report</p>
          <h3 className="text-xl font-extrabold text-slate-900 font-headline mt-1">{uploadedReportFileName}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {reportImportResult.imported_rows ?? 0} days imported
            {reportImportResult.lstm_rows_parsed ? ` · ${reportImportResult.lstm_rows_parsed} LSTM sessions` : ''}
            {formatImportedAt(reportImportResult.importedAt) ? ` · ${formatImportedAt(reportImportResult.importedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onChangeReport}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Change report
          </button>
          <button
            type="button"
            onClick={onRemoveReport}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="material-symbols-outlined text-emerald-600 text-3xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Report on file</p>
            <p className="text-base font-extrabold text-slate-900 truncate mt-0.5">{uploadedReportFileName}</p>
            {reportImportResult.persistence_warning && !reportImportResult.db_persisted ? (
              <p className="text-xs text-amber-800 mt-1">Stored locally (cloud DB offline) — forecast still works.</p>
            ) : (
              <p className="text-xs text-emerald-700 mt-1">Saved in this browser — included in LSTM forecast history.</p>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 self-start sm:self-center px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider shrink-0">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Active
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Patient</p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">{structuredReport?.patientName || 'Not found'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Condition</p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">{structuredReport?.disease || 'Not found'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">LSTM Sessions</p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">
              {reportImportResult.lstm_rows_parsed ?? 0}
              {reportImportResult.persistence_warning && !reportImportResult.db_persisted ? (
                <span className="block text-xs font-normal text-amber-700 mt-1">Saved locally (DB offline)</span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Rows Imported</p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">{reportImportResult.imported_rows ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
              {structuredReport?.hasParkinsonBiomarkers ? 'Latest Motor UPDRS' : 'Final Score'}
            </p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">
              {structuredReport?.hasParkinsonBiomarkers
                ? (structuredReport.lastMotor != null ? formatBioValue(structuredReport.lastMotor, 2) : 'N/A')
                : (structuredReport?.finalScore ?? 'N/A')}
              {structuredReport?.hasParkinsonBiomarkers && structuredReport.motorDelta != null ? (
                <span className={`ml-1 text-xs font-bold ${structuredReport.motorDelta > 0 ? 'text-red-600' : structuredReport.motorDelta < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  ({structuredReport.motorDelta > 0 ? '+' : ''}{formatBioValue(structuredReport.motorDelta, 2)} vs day 1)
                </span>
              ) : structuredReport?.finalStatus ? (
                <span className="ml-1 text-xs text-slate-500">({structuredReport.finalStatus})</span>
              ) : null}
            </p>
          </div>
        </div>

        {reportImportResult.summary ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
            <span className="font-bold text-blue-800 mr-1">Summary:</span>
            {reportImportResult.summary}
          </div>
        ) : null}

        {structuredReport?.rows?.length ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setTableExpanded((open) => !open)}
              className="w-full flex items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-100/80 transition-colors"
            >
              <span className="text-sm font-bold text-slate-700">
                {structuredReport.hasParkinsonBiomarkers
                  ? `Parkinson voice biomarkers from report (${structuredReport.rows.length} days)`
                  : `Patient health history from report (${structuredReport.rows.length} days)`}
              </span>
              <span className="material-symbols-outlined text-slate-500 shrink-0">
                {tableExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {tableExpanded ? (
              <div className="p-0">
                <ReportBiomarkerTable structuredReport={structuredReport} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function MedicalReportImport({ variant = 'dashboard', onImportSuccess, onImportRemoved }) {
  const [dashboardDismissed, setDashboardDismissed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  useEffect(() => {
    if (variant === 'dashboard') {
      setDashboardDismissed(isDashboardImportDismissed());
    }
  }, [variant]);

  useEffect(() => {
    function onImportChanged() {
      if (variant === 'dashboard') {
        setDashboardDismissed(isDashboardImportDismissed());
      }
    }
    window.addEventListener(REPORT_IMPORT_CHANGED, onImportChanged);
    return () => window.removeEventListener(REPORT_IMPORT_CHANGED, onImportChanged);
  }, [variant]);
  const {
    selectedReportFileName,
    uploadedReportFileName,
    isReportUploading,
    reportImportResult,
    reportError,
    showReportUploadForm,
    reportFileInputRef,
    structuredReport,
    hasUploadedReport,
    handleReportUpload,
    handleChangeReport,
    handleRemoveReport,
    setSelectedReportFile,
    setSelectedReportFileName,
    setReportError,
    setShowReportUploadForm,
    showDemographicsModal,
    demographicsPreview,
    confirmDemographicsFromProfile,
    confirmDemographicsFromReport,
    cancelDemographicsModal,
  } = useMedicalReportImport({ onImportSuccess, onImportRemoved });

  const demographicsModal = (
    <DemographicsConflictModal
      open={showDemographicsModal}
      preview={demographicsPreview}
      onUseProfile={confirmDemographicsFromProfile}
      onUseReport={confirmDemographicsFromReport}
      onCancel={cancelDemographicsModal}
    />
  );

  const onChooseFile = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedReportFile(file);
    setSelectedReportFileName(file?.name || '');
    setReportError('');
  };

  const onCancel = () => setShowReportUploadForm(false);

  function handleDashboardDismiss() {
    dismissDashboardImport();
    setDashboardDismissed(true);
  }

  if (variant === 'dashboard' && !hasUploadedReport && dashboardDismissed) {
    return null;
  }

  if (variant === 'dashboard' && hasUploadedReport && !showReportUploadForm) {
    return (
      <>
        {demographicsModal}
        <section className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900 font-headline">Medical records</h3>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            Imported
          </span>
        </div>
        <DashboardCompactCard
          uploadedReportFileName={uploadedReportFileName}
          reportImportResult={reportImportResult}
        />
      </section>
      </>
    );
  }

  if (variant === 'history' && hasUploadedReport) {
    return (
      <>
        {demographicsModal}
        <HistoryReportDetail
        reportImportResult={reportImportResult}
        structuredReport={structuredReport}
        uploadedReportFileName={uploadedReportFileName}
        showReportUploadForm={showReportUploadForm}
        onChangeReport={handleChangeReport}
        onRemoveReport={handleRemoveReport}
        reportFileInputRef={reportFileInputRef}
        selectedReportFileName={selectedReportFileName}
        isReportUploading={isReportUploading}
        hasUploadedReport={hasUploadedReport}
        reportError={reportError}
        onChooseFile={onChooseFile}
        onUpload={handleReportUpload}
        onCancel={onCancel}
      />
      </>
    );
  }

  if (variant === 'history' && !hasUploadedReport && historyCollapsed) {
    return (
      <>
        {demographicsModal}
        <section className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Import a previous medical report (PDF/CSV) for Parkinson progression forecasting.
          </p>
          <button
            type="button"
            onClick={() => setHistoryCollapsed(false)}
            className="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Import report
          </button>
        </div>
      </section>
      </>
    );
  }

  return (
    <>
      {demographicsModal}
      <section className={`bg-white border border-slate-200 rounded-[18px] p-6 shadow-sm ${variant === 'history' ? '' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 font-headline">Import Previous Medical Records</h3>
          <p className="text-sm text-slate-500 mt-1">
            Upload JPG, PNG, PDF, or Parkinson history CSV (minimum 10 days for forecasting; more is fine).
            Extracted rows are saved and included in LSTM history.
          </p>
        </div>
        {variant === 'history' && !hasUploadedReport ? (
          <button
            type="button"
            onClick={() => setHistoryCollapsed(true)}
            className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Not now
          </button>
        ) : null}
      </div>

      <ReportUploadForm
        reportFileInputRef={reportFileInputRef}
        selectedReportFileName={selectedReportFileName}
        isReportUploading={isReportUploading}
        hasUploadedReport={hasUploadedReport}
        showReportUploadForm={showReportUploadForm}
        reportError={reportError}
        onChooseFile={onChooseFile}
        onUpload={handleReportUpload}
        onCancel={onCancel}
        onDismiss={variant === 'dashboard' ? handleDashboardDismiss : () => setHistoryCollapsed(true)}
        showDismiss={variant === 'dashboard' && !hasUploadedReport}
      />
    </section>
    </>
  );
}
