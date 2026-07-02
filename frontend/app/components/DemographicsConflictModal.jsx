'use client';

import { formatSexLabel } from '../../lib/diagnosticStyling';

export default function DemographicsConflictModal({
  open,
  preview,
  onUseProfile,
  onUseReport,
  onCancel,
}) {
  if (!open || !preview) return null;

  const profileAge = preview.profile_age;
  const profileSex = preview.profile_sex;
  const reportAge = preview.report_age;
  const reportSex = preview.report_sex;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6"
        role="dialog"
        aria-labelledby="demographics-conflict-title"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-3xl shrink-0">person_alert</span>
          <div>
            <h3 id="demographics-conflict-title" className="text-lg font-extrabold text-slate-900">
              Age & gender mismatch
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Your saved settings differ from this report. Choose which values to use for this import
              (LSTM history, forecasting, and export). Choosing report values also updates Settings.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Your settings</p>
            <p className="text-sm font-semibold text-slate-800 mt-2">
              Age {profileAge ?? '—'}, {formatSexLabel(profileSex)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Report file</p>
            <p className="text-sm font-semibold text-slate-800 mt-2">
              Age {reportAge ?? '—'}, {formatSexLabel(reportSex)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onUseProfile}
            className="w-full rounded-xl bg-primary text-white py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Use my settings (recommended)
          </button>
          <button
            type="button"
            onClick={onUseReport}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Use report values
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
