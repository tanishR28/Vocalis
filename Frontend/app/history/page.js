'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import MedicalReportImport, { HistoryExportPanel } from '../components/MedicalReportImport';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatHistoryTimestamp(timestamp) {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function historyTone(score) {
  if (score >= 80) return { label: 'Stable', badge: 'bg-secondary/10 text-secondary', icon: 'check_circle' };
  if (score >= 60) return { label: 'Watch', badge: 'bg-blue-50 text-blue-700', icon: 'priority_high' };
  if (score >= 40) return { label: 'Monitor', badge: 'bg-orange-50 text-orange-600', icon: 'report' };
  return { label: 'Review', badge: 'bg-error-container text-error', icon: 'warning' };
}

function formatValue(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return num.toFixed(digits);
}

function HistoryPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const selectedRecordId = searchParams.get('recording');

  async function reloadAudioHistory() {
    try {
      const response = await fetch(`${API_URL}/api/history?limit=50&source=audio`);
      if (!response.ok) return;
      const data = await response.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    }
  }

  async function handleReportImportRemoved() {
    await reloadAudioHistory();
  }

  useEffect(() => {
    reloadAudioHistory();
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const matchedItem = items.find((item) => item.id === selectedRecordId);
    if (matchedItem) {
      setSelectedItem(matchedItem);
    }
  }, [items, selectedRecordId]);

  function closeModal() {
    setSelectedItem(null);
    router.push(pathname);
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <p className="text-on-surface-variant font-label">Real saved audio analyses from Supabase</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <span className="material-symbols-outlined text-slate-400">history</span>
            <span className="text-sm font-semibold">{items.length} saved records</span>
          </div>
        </header>

        <MedicalReportImport variant="history" onImportRemoved={handleReportImportRemoved} />

        <HistoryExportPanel />

        <section className="w-full bg-white rounded-xxl shadow-sm border border-slate-100 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-on-surface">Saved sessions</h3>
              <p className="text-sm text-on-surface-variant mt-1">Tap a session to inspect real saved audio biomarker data.</p>
            </div>
          </div>

          <div className="space-y-4">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-slate-500">
                  No saved history yet. Record a sample and the analysis will appear here after the backend saves it.
                </div>
              ) : (
                items.map((item) => {
                  const score = Number(item.health_score?.score || 0);
                  const tone = historyTone(score);
                  const isSelected = selectedItem?.id === item.id;
                  const recordHref = `${pathname}?recording=${encodeURIComponent(item.id)}`;
                  return (
                    <Link
                      key={item.id}
                      href={recordHref}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left group flex items-center justify-between gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'border-primary bg-blue-50/60 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tone.badge}`}>
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{tone.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">{item.title || 'Voice Assessment'}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-widest">{tone.label}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{formatHistoryTimestamp(item.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-slate-900">{score.toFixed(0)}<span className="text-xs text-slate-400">/100</span></div>
                        <div className="text-[10px] uppercase tracking-widest text-secondary font-bold">{item.health_score?.category || 'Unknown'}</div>
                      </div>
                    </Link>
                  );
                })
              )}
          </div>
        </section>

        {selectedItem ? (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={closeModal}>
            <div className="w-full max-w-2xl max-h-[50vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col my-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-slate-100">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{selectedItem.title || 'Voice Assessment'}</h4>
                  <p className="text-sm text-slate-500 mt-1">{formatHistoryTimestamp(selectedItem.timestamp)}</p>
                </div>
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Close
                </button>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3">
                <p className="text-xs uppercase tracking-widest text-secondary font-extrabold mb-1">
                  {(selectedItem.health_score?.category || 'Unknown').toUpperCase()}
                </p>
                <p className="text-sm text-slate-500">Health score</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900">{Number(selectedItem.health_score?.score || 0).toFixed(0)}</span>
                  <span className="text-sm text-slate-400 font-bold">/100</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Breathlessness</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.breathlessness_score)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Speech rate</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.speech_rate)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Pitch variation</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.pitch_variation)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Jitter / Tremor</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.jitter)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Pause count</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.pause_count, 0)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">HNR</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatValue(selectedItem.biomarkers?.hnr)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Audio Session Metadata</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">Recording ID:</span> {selectedItem.recording?.id || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-700">Duration:</span> {formatValue(selectedItem.recording?.duration)} sec</p>
                  <p><span className="font-semibold text-slate-700">Status:</span> {selectedItem.recording?.status || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-700">Analyzed at:</span> {formatHistoryTimestamp(selectedItem.biomarkers?.analyzed_at || selectedItem.timestamp)}</p>
                </div>
              </div>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading history…</div>}>
      <HistoryPageContent />
    </Suspense>
  );
}