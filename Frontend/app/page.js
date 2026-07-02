'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { getCondition } from '../lib/conditions';
import { getProfile } from '../lib/profile';
import MedicalReportImport from './components/MedicalReportImport';

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

function buildLinePath(scores, width = 700, height = 240) {
  if (!scores.length) return 'M0,180 L700,90';
  if (scores.length === 1) {
    const y = (height - (clamp(scores[0], 0, 100) / 100) * (height - 30)).toFixed(1);
    return `M0,${y} L700,${y}`;
  }

  const step = width / (scores.length - 1);
  return scores
    .map((score, index) => {
      const x = (index * step).toFixed(1);
      const y = (height - (clamp(score, 0, 100) / 100) * (height - 30)).toFixed(1);
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function buildAreaPath(linePath) {
  return `${linePath} L700,240 L0,240 Z`;
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
    setProfile(getProfile());
    const stored = localStorage.getItem('vocalis_latest_analysis');
    if (stored) {
      try {
        setAnalysisData(JSON.parse(stored));
      } catch (e) { console.error(e); }
    }
  }, []);

  async function handleReportImportSuccess() {
    try {
      const statusResponse = await fetch(`${API_URL}/forecast/parkinsons/status`);
      if (statusResponse.ok) {
        setForecastStatus(await statusResponse.json());
      }

      const historyResponse = await fetch(`${API_URL}/api/history?limit=60`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistoryItems(Array.isArray(historyData.items) ? historyData.items : []);
      }
    } catch {
      // Non-fatal — import already saved locally
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

      const historyResponse = await fetch(`${API_URL}/api/history?limit=60&source=audio`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistoryItems(Array.isArray(historyData.items) ? historyData.items : []);
      }
    } catch {
      setForecastStatus(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch(`${API_URL}/api/history?limit=60`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setHistoryItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (active) {
          setHistoryItems([]);
        }
      }
    }

    loadHistory();
    return () => {
      active = false;
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
  const trendLimit = trendRange === 'week' ? 7 : 30;
  const trendItems = historyItems.slice(0, trendLimit).reverse();
  const trendScores = trendItems.map((item) => Number(item.health_score?.score || 0));
  const linePath = buildLinePath(trendScores);
  const areaPath = buildAreaPath(linePath);
  const latestScore = latestHistory ? Number(latestHistory.health_score?.score || 0) : null;
  const overallScore = latestScore ?? (analysisData ? Number(analysisData.health_score || 92) : 92);
  const trendInfo = analysisData?.trends || null;
  const trendLabel = trendInfo?.trend || (trendScores.length >= 2 && trendScores[trendScores.length - 1] >= trendScores[0] ? 'improving' : 'stable');
  const vsBaseline = trendInfo?.vs_baseline;
  const weeklyPct = trendInfo?.weekly_change_pct;
  const lstmSessionsAvailable = forecastStatus?.sessions_available ?? historyItems.filter(
    (item) => item.biomarkers?.raw_features?.lstm_row?.motor_UPDRS != null,
  ).length;
  const lstmSessionsRequired = forecastStatus?.sessions_required ?? 10;
  const lstmForecastReady = forecastStatus?.ready ?? lstmSessionsAvailable >= lstmSessionsRequired;
  const currentMotorUpdrs = forecastResult?.current_motor_updrs ?? forecastStatus?.current_motor_updrs ?? analysisData?.motor_updrs ?? null;

  const latestBiomarkerRows = historyItems.slice(0, 20).map((item) => item.biomarkers || {});
  const breathValues = latestBiomarkerRows
    .map((row) => Number(row.breathlessness_score))
    .filter((value) => Number.isFinite(value));
  const speechValues = latestBiomarkerRows
    .map((row) => Number(row.speech_rate))
    .filter((value) => Number.isFinite(value));
  const tremorValues = latestBiomarkerRows
    .map((row) => Number(row.jitter ?? row.tremor_score))
    .filter((value) => Number.isFinite(value));

  const breathAvg = average(breathValues);
  const speechAvg = average(speechValues);
  const tremorAvg = average(tremorValues);
  const breathStability = clamp(Math.round(100 - breathAvg * 100), 0, 100);
  const speechConsistencyLabel = speechAvg >= 2.8 ? 'High' : speechAvg >= 1.8 ? 'Moderate' : 'Low';
  const tremorLabel = tremorAvg <= 0.2 ? 'Low' : tremorAvg <= 0.5 ? 'Moderate' : 'High';

  function metricDisplay(card) {
    const rows = latestBiomarkerRows;
    const values = rows
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

  const dashboardMetrics = (condition?.metricCards || []).map(metricDisplay);

  const trendDateLabels = useMemo(() => {
    if (!trendItems.length) return ['Start', 'Mid', 'Today'];
    const first = formatHistoryTimestamp(trendItems[0].timestamp).split(',')[0];
    const mid = formatHistoryTimestamp(trendItems[Math.floor((trendItems.length - 1) / 2)].timestamp).split(',')[0];
    const last = formatHistoryTimestamp(trendItems[trendItems.length - 1].timestamp).split(',')[0];
    return [first, mid, last];
  }, [trendItems]);

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
                    <span className="text-[10px] font-bold tracking-wider uppercase">AI Confidence: High</span>
                 </div>
                 <div className="flex flex-wrap items-center gap-2">
                   <span className="px-3 py-1 bg-secondary-fixed/30 text-secondary-container rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> {analysisData ? analysisData.status : 'Stable'}
                </span>
                   <div className="flex items-center gap-1 border border-primary/20 bg-primary/5 px-2.5 py-1 rounded-full text-[10px] font-bold text-primary uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span> Verified
                   </div>
                 </div>
              </div>
              
              <div className="relative w-48 h-48 flex items-center justify-center group cursor-pointer transition-transform duration-500 hover:scale-[1.02]">
                <div className="absolute inset-0 rounded-full bg-primary/5 -m-6 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <svg className="w-full h-full -rotate-90 relative z-10">
                  <circle className="text-surface-container-low" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="8"></circle>
                  {mounted && <circle cx="96" cy="96" fill="transparent" r="88" stroke="url(#gradient)" strokeLinecap="round" strokeWidth="12" className="anim-ring"></circle>}
                  <defs>
                    <linearGradient id="gradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#0056bb"></stop>
                      <stop offset="100%" stopColor="#006c47"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                  <span className="text-6xl font-extrabold font-headline text-primary leading-none tracking-tighter">
                    {Math.round(overallScore)}
                  </span>
                  <span className="text-slate-400 font-bold opacity-80 mt-1 uppercase text-xs tracking-widest">/ 100</span>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col items-center gap-1">
                 <span className={`flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-full ${
                   trendLabel === 'improving' ? 'text-secondary bg-secondary/10' :
                   trendLabel === 'declining' ? 'text-error bg-error-container' :
                   'text-slate-600 bg-slate-100'
                 }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {trendLabel === 'improving' ? 'trending_up' : trendLabel === 'declining' ? 'trending_down' : 'trending_flat'}
                    </span>
                    {trendLabel === 'improving' ? 'Improving this week' : trendLabel === 'declining' ? 'Declining this week' : 'Stable this week'}
                 </span>
                 <p className="mt-4 text-on-surface-variant font-medium text-sm leading-relaxed max-w-[250px]">
                   {trendInfo?.baseline_ready && vsBaseline != null ? (
                     <>Your vocal stability is <span className={`font-bold ${vsBaseline >= 0 ? 'text-secondary' : 'text-error'}`}>{Math.abs(vsBaseline).toFixed(0)}% {vsBaseline >= 0 ? 'higher' : 'lower'}</span> than your clinical baseline.</>
                   ) : trendInfo?.weekly_ready && weeklyPct != null ? (
                     <>Weekly change: <span className="font-bold text-primary">{weeklyPct >= 0 ? '+' : ''}{weeklyPct.toFixed(1)}%</span></>
                   ) : (
                     <>Record at least 3 sessions to unlock baseline trends.</>
                   )}
                 </p>
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
                      (older imported days first, then your newest recordings — e.g. 30-day import + 5 recordings uses the last 5 import days + all 5 recordings).
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

            <div className="lg:col-span-8 bg-surface-container-lowest border border-gray-100 rounded-[18px] p-6 lg:p-8 flex flex-col hover-lift shadow-sm relative">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 z-10 w-full">
                <div className="flex-1">
                  <h3 className="text-on-surface font-extrabold text-xl font-headline flex items-center gap-2">
                     Voice Stability Trends
                     <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  </h3>
                  <p className="text-slate-500 font-medium text-sm mt-1">Historical data from the last {trendRange === 'week' ? 7 : 30} sessions</p>
                  <div className="mt-4 flex items-center p-3 rounded-xl bg-blue-50/70 border border-blue-100/50 w-fit">
                    <p className="text-xs font-semibold text-blue-800 leading-tight">
                      {trendLabel === 'improving'
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
                <div className="absolute inset-0 flex items-end justify-between px-2 opacity-50 transition-opacity hover:opacity-80">
                  {(trendScores.length ? trendScores.slice(-9) : [60, 65, 55, 75, 85, 80, 90, 85, 95]).map((score, index, arr) => {
                    const percent = clamp(score, 10, 100);
                    const isLatest = index === arr.length - 1;
                    return (
                      <div
                        key={`${score}-${index}`}
                        className={`w-[4%] rounded-t-lg transition-all ${isLatest ? 'bg-primary shadow-[0_0_15px_rgba(0,86,187,0.3)]' : 'bg-primary/20 hover:bg-primary/40'}`}
                        style={{ height: `${percent}%` }}
                      ></div>
                    );
                  })}
                </div>
                
                <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0056bb" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#0056bb" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {mounted && (
                    <>
                      <path className="w-full h-full anim-fill" d={areaPath} fill="url(#line-fill)" stroke="none"></path>
                      <path className="w-full h-full anim-draw" d={linePath} fill="none" stroke="#0056bb" strokeLinecap="round" strokeWidth="4"></path>
                    </>
                  )}
                  {/* Latest Data Point Group */}
                    <g className="group/tooltip cursor-pointer transform translate-x-[700px] translate-y-[90px]">
                    <circle cx="0" cy="0" fill="#0056bb" r="14" className="opacity-20 animate-ping"></circle>
                    <circle cx="0" cy="0" fill="#0056bb" r="6" className="group-hover/tooltip:r-8 transition-all duration-300 shadow-xl"></circle>
                    <circle cx="0" cy="0" fill="white" r="3"></circle>
                    
                    {/* SVG Tooltip */}
                    <g className="opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-300 pointer-events-none">
                       <rect x="-45" y="-55" width="90" height="42" rx="8" fill="#1e293b" opacity="0.95" />
                       <polygon points="-5,-13 5,-13 0,-8" fill="#1e293b" opacity="0.95"/>
                       <text x="0" y="-35" fill="white" fontSize="13" fontWeight="bold" fontFamily="Inter" textAnchor="middle">{Math.round(overallScore)} / 100</text>
                       <text x="0" y="-20" fill="#94a3b8" fontSize="10" fontFamily="Inter" fontWeight="500" textAnchor="middle">Latest Data</text>
                    </g>
                  </g>
                </svg>
              </div>
              <div className="flex justify-between mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
                <span>{trendDateLabels[0]}</span>
                <span>{trendDateLabels[1]}</span>
                <span className="text-primary">{trendDateLabels[2]}</span>
              </div>
            </div>

            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {dashboardMetrics.map((metric, index) => (
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
                    <h4 className="text-3xl font-extrabold font-headline text-slate-900 tracking-tight">{metric.value}</h4>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-12">
              <div className="bg-surface-container-lowest rounded-[18px] border border-gray-200 p-8 shadow-sm">
                <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                  <h3 className="font-headline font-extrabold text-xl text-slate-900">Assessment History</h3>
                  <button className="text-primary font-bold text-sm hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">View Clinical Report</button>
                </div>
                <div className="space-y-4">
                  {historyItems.length === 0 ? (
                    <div className="bg-white border border-gray-100 p-5 rounded-2xl text-slate-500">
                      No saved assessments yet. Record a sample to populate this section.
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
