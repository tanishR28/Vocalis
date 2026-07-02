'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { getCondition } from '../lib/conditions';
import { getProfile, PROFILE_CHANGED } from '../lib/profile';
import { getDiagnosticStatusPresentation } from '../lib/diagnosticStyling';
import {
  buildInsightsTimeline,
  countSessionsBySource,
  dashboardClinicalMetric,
  latestTimelineRow,
} from '../lib/insightsData';
import MedicalReportImport from './components/MedicalReportImport';
import VoiceStabilityTrendChart from './components/VoiceStabilityTrendChart';
import MiniHealthSparkline from './components/MiniHealthSparkline';
import { REPORT_IMPORT_CHANGED } from '../lib/reportImport';

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

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeTrendFromScores(scores) {
  if (!scores || scores.length < 2) return null;
  const delta = scores[scores.length - 1] - scores[0];
  if (delta > 3) return 'improving';
  if (delta < -3) return 'declining';
  return 'stable';
}

function confidenceLabel(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 0.85) return 'High';
  if (value >= 0.7) return 'Medium';
  return 'Low';
}

function getSessionSnapshot(historyItem, analysisData) {
  if (historyItem) {
    const raw = historyItem.biomarkers?.raw_features || {};
    return {
      healthScore: Number(historyItem.health_score?.score),
      status: raw.prediction || raw.status || null,
      severity: raw.severity ?? null,
      confidence: Number(historyItem.biomarkers?.confidence),
      motorUpdrs: raw.motor_updrs ?? raw.lstm_row?.motor_UPDRS ?? null,
      source: historyItem.source,
    };
  }
  if (analysisData) {
    return {
      healthScore: Number(analysisData.health_score),
      status: analysisData.status,
      severity: analysisData.severity,
      confidence: Number(analysisData.confidence),
      motorUpdrs: analysisData.motor_updrs,
      source: 'live-analysis',
    };
  }
  return null;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [trendRange, setTrendRange] = useState('month');
  const [profile, setProfile] = useState(null);
  const [forecastStatus, setForecastStatus] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');

  const condition = profile ? getCondition(profile.conditionId) : null;

  useEffect(() => {
    setMounted(true);
    function hydrateProfile() {
      setProfile(getProfile());
    }
    hydrateProfile();
    const stored = localStorage.getItem('vocalis_latest_analysis');
    if (stored) {
      try {
        setAnalysisData(JSON.parse(stored));
      } catch (e) { console.error(e); }
    }
    window.addEventListener(PROFILE_CHANGED, hydrateProfile);
    return () => window.removeEventListener(PROFILE_CHANGED, hydrateProfile);
  }, []);

  async function loadDashboardHistory() {
    try {
      const response = await fetch(`${API_URL}/api/history?limit=60`);
      if (!response.ok) return [];
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setHistoryItems(items);
      return items;
    } catch {
      setHistoryItems([]);
      return [];
    }
  }

  async function handleReportImportSuccess() {
    try {
      const statusResponse = await fetch(`${API_URL}/forecast/parkinsons/status`);
      if (statusResponse.ok) {
        setForecastStatus(await statusResponse.json());
      }
      await loadDashboardHistory();
    } catch {
      await loadDashboardHistory();
    }
  }

  async function handleReportImportRemoved() {
    setForecastResult(null);
    setForecastError('');
    try {
      const statusResponse = await fetch(`${API_URL}/forecast/parkinsons/status`);
      if (statusResponse.ok) {
        setForecastStatus(await statusResponse.json());
      }

      const response = await fetch(`${API_URL}/api/history?limit=60&source=audio`);
      if (response.ok) {
        const historyData = await response.json();
        setHistoryItems(Array.isArray(historyData.items) ? historyData.items : []);
      } else {
        await loadDashboardHistory();
      }
    } catch {
      setForecastStatus(null);
      await loadDashboardHistory();
    }
  }

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!active) return;
      await loadDashboardHistory();
    }

    loadHistory();

    function onImportChanged() {
      if (active) loadHistory();
    }
    window.addEventListener(REPORT_IMPORT_CHANGED, onImportChanged);

    return () => {
      active = false;
      window.removeEventListener(REPORT_IMPORT_CHANGED, onImportChanged);
    };
  }, []);

  useEffect(() => {
    if (!mounted || profile?.conditionId !== 'parkinsons') return;

    let active = true;

    async function loadForecastStatus() {
      try {
        const response = await fetch(`${API_URL}/forecast/parkinsons/status`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) setForecastStatus(data);
      } catch {
        if (active) setForecastStatus(null);
      }
    }

    loadForecastStatus();
    return () => {
      active = false;
    };
  }, [mounted, profile?.conditionId, historyItems.length]);

  async function handleForecastProgression() {
    setIsForecastLoading(true);
    setForecastError('');
    try {
      const response = await fetch(`${API_URL}/forecast/parkinsons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Forecast request failed');
      }
      if (!data.ready) {
        setForecastStatus(data);
        setForecastError(data.message || 'Not enough sessions for forecasting yet.');
        return;
      }
      setForecastResult(data);
      setForecastStatus(data);
    } catch (error) {
      setForecastError(error?.message || 'Failed to run progression forecast.');
    } finally {
      setIsForecastLoading(false);
    }
  }

  const latestHistory = historyItems[0] || null;
  const sessionSnapshot = getSessionSnapshot(latestHistory, analysisData);
  const hasAssessmentData = Boolean(
    sessionSnapshot && Number.isFinite(sessionSnapshot.healthScore),
  );
  const trendLimit = trendRange === 'week' ? 7 : 30;
  const trendItems = historyItems.slice(0, trendLimit);
  const trendScores = [...trendItems]
    .reverse()
    .map((item) => Number(item.health_score?.score))
    .filter((value) => Number.isFinite(value));
  const overallScore = hasAssessmentData ? sessionSnapshot.healthScore : null;
  const trendInfo = analysisData?.trends || null;
  const computedTrend = computeTrendFromScores(trendScores);
  const trendLabel = trendInfo?.trend || computedTrend;
  const vsBaseline = trendInfo?.vs_baseline ?? (
    trendScores.length >= 3
      ? trendScores[trendScores.length - 1] - trendScores[0]
      : null
  );
  const weeklyPct = trendInfo?.weekly_change_pct;
  const lstmSessionsAvailable = forecastStatus?.sessions_available ?? historyItems.filter(
    (item) => item.biomarkers?.raw_features?.lstm_row?.motor_UPDRS != null,
  ).length;
  const lstmSessionsRequired = forecastStatus?.sessions_required ?? 10;
  const lstmForecastReady = forecastStatus?.ready ?? lstmSessionsAvailable >= lstmSessionsRequired;
  const currentMotorUpdrs = forecastResult?.current_motor_updrs
    ?? forecastStatus?.current_motor_updrs
    ?? sessionSnapshot?.motorUpdrs
    ?? null;
  const diagnosticStatusStyle = useMemo(
    () => getDiagnosticStatusPresentation(sessionSnapshot?.status, sessionSnapshot?.severity),
    [sessionSnapshot?.status, sessionSnapshot?.severity],
  );
  const confidenceText = confidenceLabel(sessionSnapshot?.confidence);
  const ringCircumference = 552.9;
  const ringOffset = hasAssessmentData
    ? ringCircumference - (clamp(overallScore, 0, 100) / 100) * ringCircumference
    : ringCircumference;
  const minSessionsForTrends = 3;
  const hasTrendData = trendScores.length >= minSessionsForTrends;
  const sessionCounts = countSessionsBySource(historyItems);
  const dashboardTimeline = useMemo(
    () => buildInsightsTimeline(historyItems, trendRange === 'week' ? '7d' : '30d'),
    [historyItems, trendRange],
  );
  const latestTimeline = latestTimelineRow(dashboardTimeline);
  const sparklineData = useMemo(
    () => buildInsightsTimeline(historyItems, '7d').slice(-7),
    [historyItems],
  );

  const latestBiomarkerRows = historyItems.slice(0, 20).map((item) => item.biomarkers || {});

  function metricDisplay(card) {
    const values = latestBiomarkerRows
      .map((row) => {
        let val = Number(row[card.field]);
        if (!Number.isFinite(val) && card.fallback) val = Number(row[card.fallback]);
        if (!Number.isFinite(val)) return null;
        if (card.combine) {
          const extra = Number(row[card.combine]);
          if (Number.isFinite(extra)) val = (val + extra) / 2;
        }
        return val;
      })
      .filter((v) => v !== null);
    if (!values.length) {
      return { label: card.label, value: '—', icon: card.icon, empty: true };
    }
    const mean = average(values);
    if (card.id === 'breath') {
      return { label: card.label, value: `${clamp(Math.round(100 - mean * 100), 0, 100)}%`, icon: card.icon };
    }
    if (card.id === 'speech') {
      const label = mean >= 2.8 ? 'High' : mean >= 1.8 ? 'Moderate' : 'Low';
      return { label: card.label, value: label, icon: card.icon };
    }
    if (card.id === 'tremor' || card.id === 'jitter' || card.id === 'pause') {
      const label = mean <= 0.2 ? 'Low' : mean <= 0.5 ? 'Moderate' : 'High';
      return { label: card.label, value: label, icon: card.icon };
    }
    if (card.id === 'pitch') {
      return { label: card.label, value: mean.toFixed(2), icon: card.icon };
    }
    return { label: card.label, value: mean.toFixed(2), icon: card.icon };
  }

  const clinicalCards = condition?.dashboardClinicalCards || condition?.metricCards || [];
  const dashboardMetrics = clinicalCards.map((card) =>
    condition?.dashboardClinicalCards
      ? dashboardClinicalMetric(card, latestTimeline)
      : metricDisplay(card),
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fillIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinRing {
          from { stroke-dashoffset: 552.9; }
          to { stroke-dashoffset: 44; }
        }
        .anim-draw {
          stroke-dasharray: 1000;
          animation: drawLine 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .anim-fill {
          animation: fillIn 1s ease-out 0.5s both;
        }
        .anim-ring {
          stroke-dasharray: 552.9;
          stroke-dashoffset: 552.9;
          animation: spinRing 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .hover-lift {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          border-color: #e5e7eb;
        }
      `}} />
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-headline">
                Good Morning, {profile?.patientName || 'there'}
              </h2>
              <p className="text-on-surface-variant text-[17px] font-medium opacity-90">
                {condition
                  ? `${condition.label} monitoring — ${condition.dashboardSubtitle}`
                  : 'Your vocal health profile is updated based on your last assessments.'}
              </p>
              {sessionCounts.total > 0 ? (
                <p className="text-sm font-medium text-slate-500">
                  Based on {sessionCounts.total} session{sessionCounts.total === 1 ? '' : 's'}
                  {sessionCounts.imported > 0 || sessionCounts.recorded > 0
                    ? ` (${sessionCounts.imported} imported + ${sessionCounts.recorded} recorded)`
                    : ''}
                </p>
              ) : null}
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-2">
              <Link href="/record">
                <button className="flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-blue-600 text-white px-8 py-5 rounded-[18px] shadow-lg shadow-primary/30 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(0,86,187,0.35)] hover:scale-[1.02] transition-all duration-300 ease-out group border border-blue-500/50">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <span className="material-symbols-outlined text-white animate-[pulse_2s_ease-in-out_infinite]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                  </div>
                  <span className="text-lg font-bold tracking-wide">Record Today's Voice</span>
                </button>
              </Link>
              <span className="text-[13px] font-semibold tracking-wide text-slate-400 mr-2">
                {condition ? `${condition.recordingSeconds}-sec daily check` : '15-sec daily check'}
              </span>
            </div>
          </section>

          <MedicalReportImport
            variant="dashboard"
            onImportSuccess={handleReportImportSuccess}
            onImportRemoved={handleReportImportRemoved}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 bg-surface-container-lowest border border-gray-100 rounded-[18px] p-6 lg:p-8 flex flex-col items-center text-center relative overflow-hidden hover-lift shadow-sm">
              <div className="flex flex-wrap justify-between items-start w-full gap-3 mb-6">
                 <div className="flex items-center gap-1.5 opacity-80 text-gray-500 pt-1">
                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      {confidenceText ? `AI Confidence: ${confidenceText}` : 'Awaiting assessment'}
                    </span>
                 </div>
                 <div className="flex flex-wrap items-center gap-2">
                   {hasAssessmentData ? (
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm backdrop-blur-sm border ${diagnosticStatusStyle.badgeClass}`}>
                       <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{diagnosticStatusStyle.icon}</span>
                       {diagnosticStatusStyle.subtitle || sessionSnapshot?.status || '—'}
                     </span>
                   ) : (
                     <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                       No status yet
                     </span>
                   )}
                   {hasAssessmentData ? (
                     <div className="flex items-center gap-1 border border-primary/20 bg-primary/5 px-2.5 py-1 rounded-full text-[10px] font-bold text-primary uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span> Verified
                     </div>
                   ) : null}
                 </div>
              </div>
              
              <div className="relative w-48 h-48 flex items-center justify-center group transition-transform duration-500">
                <div className="absolute inset-0 rounded-full bg-primary/5 -m-6 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <svg className="w-full h-full -rotate-90 relative z-10">
                  <circle className="text-surface-container-low" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="8"></circle>
                  {mounted && hasAssessmentData ? (
                    <circle
                      cx="96"
                      cy="96"
                      fill="transparent"
                      r="88"
                      stroke="url(#gradient)"
                      strokeLinecap="round"
                      strokeWidth="12"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="transition-all duration-1000 ease-out"
                    />
                  ) : null}
                  <defs>
                    <linearGradient id="gradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#0056bb"></stop>
                      <stop offset="100%" stopColor="#006c47"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                  <span className={`text-6xl font-extrabold font-headline leading-none tracking-tighter ${hasAssessmentData ? 'text-primary' : 'text-slate-300'}`}>
                    {hasAssessmentData ? Math.round(overallScore) : '—'}
                  </span>
                  <span className="text-slate-400 font-bold opacity-80 mt-1 uppercase text-xs tracking-widest">/ 100</span>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col items-center gap-1">
                 {hasTrendData && trendLabel ? (
                 <span className={`flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-full ${
                   trendLabel === 'improving' ? 'text-secondary bg-secondary/10' :
                   trendLabel === 'declining' ? 'text-error bg-error-container' :
                   'text-slate-600 bg-slate-100'
                 }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {trendLabel === 'improving' ? 'trending_up' : trendLabel === 'declining' ? 'trending_down' : 'trending_flat'}
                    </span>
                    {trendLabel === 'improving' ? `Improving over last ${trendScores.length} sessions` : trendLabel === 'declining' ? `Declining over last ${trendScores.length} sessions` : `Stable over last ${trendScores.length} sessions`}
                 </span>
                 ) : (
                   <span className="flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-full text-slate-500 bg-slate-50">
                     <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                     Trend needs more data
                   </span>
                 )}
                 <p className="mt-4 text-on-surface-variant font-medium text-sm leading-relaxed max-w-[280px]">
                   {(trendInfo?.baseline_ready && trendInfo?.vs_baseline != null) ? (
                     <>Your vocal stability is <span className={`font-bold ${trendInfo.vs_baseline >= 0 ? 'text-secondary' : 'text-error'}`}>{Math.abs(trendInfo.vs_baseline).toFixed(0)}% {trendInfo.vs_baseline >= 0 ? 'higher' : 'lower'}</span> than your clinical baseline.</>
                   ) : hasTrendData && vsBaseline != null ? (
                     <>Score change in this range: <span className={`font-bold ${vsBaseline >= 0 ? 'text-secondary' : 'text-error'}`}>{vsBaseline >= 0 ? '+' : ''}{vsBaseline.toFixed(0)}</span> points ({trendScores[0].toFixed(0)} → {trendScores[trendScores.length - 1].toFixed(0)}).</>
                   ) : trendInfo?.weekly_ready && weeklyPct != null ? (
                     <>Weekly change: <span className="font-bold text-primary">{weeklyPct >= 0 ? '+' : ''}{weeklyPct.toFixed(1)}%</span></>
                   ) : trendScores.length > 0 ? (
                     <>Add {Math.max(0, minSessionsForTrends - trendScores.length)} more session{trendScores.length === minSessionsForTrends - 1 ? '' : 's'} to unlock trend comparison.</>
                   ) : (
                     <>Record daily or import a medical report to populate your health score.</>
                   )}
                 </p>
              </div>
              {sparklineData.length >= 2 ? (
                <MiniHealthSparkline data={sparklineData} />
              ) : null}
            </div>

            <div className="lg:col-span-8 bg-surface-container-lowest border border-gray-100 rounded-[18px] p-6 lg:p-8 flex flex-col hover-lift shadow-sm relative">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 z-10 w-full">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-on-surface font-extrabold text-xl font-headline flex items-center gap-2">
                       Voice Stability Trends
                       <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    </h3>
                    <Link
                      href="/insights"
                      className="text-xs font-bold text-primary hover:text-blue-700 hover:underline uppercase tracking-wider"
                    >
                      View full Insights
                    </Link>
                  </div>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    Composite health score (0–100) per session — hover any point for that day&apos;s value
                  </p>
                  <div className="mt-4 flex items-center p-3 rounded-xl bg-blue-50/70 border border-blue-100/50 w-fit">
                    <p className="text-xs font-semibold text-blue-800 leading-tight">
                      {!trendScores.length
                        ? 'No history yet — record or import data to see your voice stability trend.'
                        : trendLabel === 'improving'
                        ? 'Your voice stability trend is improving in the selected range.'
                        : trendLabel === 'declining'
                        ? 'Your voice stability trend is declining — consider reviewing with your care team.'
                        : 'Your voice stability trend is stable in the selected range.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 bg-slate-50 p-1 rounded-xl border border-gray-100 shrink-0">
                  <button
                    onClick={() => setTrendRange('month')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${trendRange === 'month' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setTrendRange('week')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${trendRange === 'week' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    Week
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-[260px] relative z-0 mt-4 sm:mt-0">
                {trendItems.length > 0 ? (
                  <VoiceStabilityTrendChart items={trendItems} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">show_chart</span>
                    <p className="text-sm font-semibold text-slate-500">No trend data yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">Import a report or record your voice to see stability over time.</p>
                  </div>
                )}
              </div>
            </div>

            {profile?.conditionId === 'parkinsons' && (
              <div className="lg:col-span-12 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-[18px] p-6 lg:p-8 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <h3 className="font-headline font-extrabold text-xl text-violet-900 flex items-center gap-2">
                      <span className="material-symbols-outlined">neurology</span>
                      Motor UPDRS Progression Forecast
                    </h3>
                    <p className="text-sm text-violet-800/80 mt-2 max-w-xl">
                      Predicts tomorrow&apos;s motor UPDRS from your last {lstmSessionsRequired} days of history
                      (older imported days first, then your newest recordings).
                    </p>
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mt-3">
                      {lstmSessionsAvailable}/{lstmSessionsRequired} days of history available
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleForecastProgression}
                    disabled={!lstmForecastReady || isForecastLoading}
                    className="shrink-0 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm uppercase tracking-wider hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isForecastLoading ? 'Forecasting…' : 'Forecast Progression'}
                  </button>
                </div>

                {!lstmForecastReady && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                      At least {lstmSessionsRequired} days of prior data needed
                    </p>
                    <p className="mt-2 text-amber-900/90">
                      {forecastStatus?.message || (
                        <>
                          We need {lstmSessionsRequired - lstmSessionsAvailable} more day{lstmSessionsRequired - lstmSessionsAvailable === 1 ? '' : 's'} of voice biomarker history to forecast your next motor UPDRS score.
                          {' '}Record daily or{' '}
                          <Link href="/history" className="font-bold text-amber-950 underline underline-offset-2">import a report in History</Link>
                          {' '}(CSV with 10+ days works).
                        </>
                      )}
                    </p>
                  </div>
                )}

                {forecastError && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {forecastError}
                  </div>
                )}

                {(forecastResult?.ready || (forecastResult?.predicted_motor_updrs != null)) && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-violet-200 bg-white p-5 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current motor UPDRS</p>
                      <p className="text-3xl font-black text-violet-800 mt-2">{Number(currentMotorUpdrs).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-white p-5 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Predicted tomorrow&apos;s motor UPDRS</p>
                      <p className="text-3xl font-black text-purple-700 mt-2">{Number(forecastResult.predicted_motor_updrs).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-white p-5 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difference</p>
                      <p className={`text-3xl font-black mt-2 ${forecastResult.delta > 0 ? 'text-red-600' : forecastResult.delta < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {forecastResult.delta > 0 ? '+' : ''}{Number(forecastResult.delta).toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-white p-5 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trend</p>
                      <p className={`text-2xl font-black mt-2 flex items-center justify-center gap-1 ${
                        forecastResult.trend === 'Worsening' ? 'text-red-600' :
                        forecastResult.trend === 'Improving' ? 'text-emerald-600' : 'text-slate-700'
                      }`}>
                        {forecastResult.trend}
                        <span className="material-symbols-outlined text-[22px]">
                          {forecastResult.trend === 'Worsening' ? 'trending_up' : forecastResult.trend === 'Improving' ? 'trending_down' : 'trending_flat'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {dashboardMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="bg-surface-container-lowest p-6 rounded-[18px] hover-lift shadow-sm border border-gray-200 flex flex-col gap-4 relative overflow-hidden group"
                >
                  <div className="flex flex-wrap justify-between items-start relative z-10 gap-3">
                    <div className="w-12 h-12 rounded-[14px] bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                      <span className="material-symbols-outlined font-light">{metric.icon}</span>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-500 text-sm font-semibold mb-1">{metric.label}</p>
                    <h4 className={`text-3xl font-extrabold font-headline tracking-tight ${metric.empty ? 'text-slate-300' : 'text-slate-900'}`}>{metric.value}</h4>
                    {metric.hint && !metric.empty ? (
                      <p className="text-xs text-slate-400 mt-1">{metric.hint}</p>
                    ) : null}
                    {metric.empty ? (
                      <p className="text-xs text-slate-400 mt-1">Needs recorded or imported sessions</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-12">
              <div className="bg-surface-container-lowest rounded-[18px] border border-gray-200 p-8 shadow-sm">
                <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                  <h3 className="font-headline font-extrabold text-xl text-slate-900">Assessment History</h3>
                  <Link href="/history" className="text-primary font-bold text-sm hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">View full history</Link>
                </div>
                <div className="space-y-4">
                  {historyItems.length === 0 ? (
                    <div className="bg-white border border-gray-100 p-5 rounded-2xl text-slate-500">
                      No saved assessments yet. Record a voice sample or import a medical report to populate this section.
                    </div>
                  ) : (
                    historyItems.slice(0, 4).map((item) => {
                      const score = Number(item.health_score?.score || 0);
                      const tone = historyTone(score);
                      return (
                        <div key={item.id} className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center justify-between group hover:shadow-md hover:border-gray-200 transition-all cursor-pointer hover:-translate-y-[1px]">
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${tone.badge}`}>
                              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{tone.icon}</span>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-[15px] group-hover:text-primary transition-colors">{item.title || 'Voice Assessment'}</div>
                              <div className="text-sm font-medium text-slate-400 mt-0.5">{formatHistoryTimestamp(item.timestamp)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                              <div className="text-[15px] font-bold text-slate-900">{score.toFixed(0)}<span className="text-slate-400 text-xs text-normal">/100</span></div>
                              <div className="text-[10px] text-secondary font-black uppercase tracking-widest mt-0.5">{item.health_score?.category || tone.label}</div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                               <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors text-xl">chevron_right</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center w-full pt-8 pb-4">
             <div className="flex items-center gap-2 opacity-50">
               <span className="material-symbols-outlined text-[14px]">lock</span>
               <span className="text-xs font-semibold tracking-wide uppercase">AI-assisted analysis • Non-invasive monitoring</span>
             </div>
          </div>
        </div>
    </>
  );
}
