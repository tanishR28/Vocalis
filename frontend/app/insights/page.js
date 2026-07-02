'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import HealthScoreAreaChart from '../components/HealthScoreAreaChart';
import {
  CLINICAL_COLORS,
  ClinicalAveragesChart,
  ClinicalRadarChart,
  ClinicalTrendChart,
  DiagnosticPieChart,
  HnrScatterChart,
  JitterShimmerChart,
  MotorUpdrsChart,
  PitchProfileChart,
  SeverityBarChart,
  SpeechPauseChart,
} from '../components/insights/InsightsCharts';
import {
  CLINICAL_INSIGHT_CATALOG,
  formatInsightValue,
  insightLevel,
} from '../../lib/clinicalInsights';
import { getDiagnosticStatusPresentation } from '../../lib/diagnosticStyling';
import {
  TIME_RANGES,
  averageField,
  buildClinicalAverageBars,
  buildDiagnosticPieData,
  buildInsightsTimeline,
  buildRadarData,
  buildSeverityBuckets,
  hasAcousticData,
  latestTimelineRow,
} from '../../lib/insightsData';
import { apiFetch, withUserIdParams } from '../../lib/api';
import { useAuthScopeId } from '../../lib/useAuthScope';

const MIN_TREND_SESSIONS = 3;

function EmptySection({ title, message, actionHref, actionLabel }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="text-sm text-slate-500 mt-2">{message}</p>
      {actionHref ? (
        <Link href={actionHref} className="inline-block mt-3 text-sm font-bold text-primary hover:underline">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default function InsightsPage() {
  const { userId, authReady } = useAuthScopeId();
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState('30d');
  const trendRefs = useRef({});

  useEffect(() => {
    if (!authReady) return;

    let active = true;

    async function loadHistory() {
      try {
        const response = await apiFetch(`/api/history?${withUserIdParams({ limit: 200 }).toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setHistoryItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (active) setHistoryItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    loadHistory();
    return () => {
      active = false;
    };
  }, [authReady, userId]);

  const timeline = useMemo(
    () => buildInsightsTimeline(historyItems, rangeKey),
    [historyItems, rangeKey],
  );

  const latestRow = latestTimelineRow(timeline);
  const radarData = useMemo(() => buildRadarData(latestRow), [latestRow]);
  const diagnosticPie = useMemo(() => buildDiagnosticPieData(timeline), [timeline]);
  const severityBuckets = useMemo(() => buildSeverityBuckets(timeline), [timeline]);
  const clinicalAverages = useMemo(() => buildClinicalAverageBars(timeline), [timeline]);
  const acousticAvailable = hasAcousticData(timeline);
  const hasTrendSessions = timeline.length >= MIN_TREND_SESSIONS;
  const motorTimeline = timeline.filter((r) => r.motor_updrs != null);

  const diagnosticStyle = getDiagnosticStatusPresentation(
    latestRow?.prediction,
    latestRow?.severity,
  );

  const avgHealth = Number(averageField(timeline, 'health_score').toFixed(1));
  const latestMotorUpdrs = latestRow?.motor_updrs;

  const averagesChartData = useMemo(
    () => [
      ...clinicalAverages,
      { metric: 'HNR', id: 'hnr', avg: Number(averageField(timeline, 'hnr').toFixed(2)) },
    ],
    [clinicalAverages, timeline],
  );

  function scrollToMetric(metricId) {
    trendRefs.current[metricId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 font-headline">Insights</h1>
        <p className="text-slate-600 max-w-3xl">
          Deep analytics from voice assessments and imports. Clinical biomarkers are stored for
          reference — LSTM and XGBoost use separate Oxford voice features only.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {Object.entries(TIME_RANGES).map(([key, range]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRangeKey(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              rangeKey === key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading session history…</div>
      ) : null}

      {!loading && timeline.length === 0 ? (
        <EmptySection
          title="No voice assessments yet"
          message="Record a sample or import a medical report to unlock trend charts."
          actionHref="/record"
          actionLabel="Go to Record"
        />
      ) : null}

      {timeline.length > 0 ? (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total sessions</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{timeline.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Avg health score</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{avgHealth}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Latest diagnostic</p>
              <p className={`text-2xl font-extrabold mt-1 ${diagnosticStyle.textClass || 'text-slate-900'}`}>
                {latestRow?.prediction || '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Latest motor UPDRS</p>
              <p className="text-3xl font-extrabold text-violet-800 mt-1">
                {latestMotorUpdrs != null ? Number(latestMotorUpdrs).toFixed(1) : '—'}
              </p>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Health stability over time</h3>
            <p className="text-sm text-slate-500 mb-4">
              Composite health score (0–100) with 3-session moving average
            </p>
            {!hasTrendSessions ? (
              <EmptySection
                title="Need 3+ sessions for trends"
                message={`You have ${timeline.length} session${timeline.length === 1 ? '' : 's'} in this range. Add more to see the trend line.`}
              />
            ) : (
              <HealthScoreAreaChart data={timeline} showMovingAverage height={320} />
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Clinical voice biomarkers</h3>
              <p className="text-sm text-slate-500">
                Acoustic analysis (librosa) — not used as LSTM/XGBoost model inputs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {CLINICAL_INSIGHT_CATALOG.map((def) => {
                const insight = latestRow?.[`${def.id}_raw`];
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => scrollToMetric(def.id)}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left hover:border-primary/30 hover:bg-blue-50/40 transition-colors"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{def.number}</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{def.name}</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                      {insight ? formatInsightValue(def.id, insight) : '—'}
                    </p>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      {insight ? insightLevel(def.id, insight) : 'No data'} · latest
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-4 bg-slate-50/50 rounded-xl border border-slate-100 p-5">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Latest snapshot (radar)</h4>
                {radarData.length < 3 ? (
                  <EmptySection
                    title="Insufficient clinical data"
                    message="Record a voice sample to populate the 5 clinical biomarkers."
                    actionHref="/record"
                    actionLabel="Record voice"
                  />
                ) : (
                  <ClinicalRadarChart data={radarData} />
                )}
              </div>

              <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CLINICAL_INSIGHT_CATALOG.map((def, index) => (
                  <div
                    key={def.id}
                    ref={(el) => { trendRefs.current[def.id] = el; }}
                    className="rounded-xl border border-slate-100 p-4"
                  >
                    <p className="text-xs font-bold text-slate-700 mb-2">{def.name}</p>
                    {!hasTrendSessions ? (
                      <p className="text-xs text-slate-400 py-8 text-center">Need 3+ sessions</p>
                    ) : (
                      <ClinicalTrendChart
                        data={timeline}
                        metricId={def.id}
                        name={def.name}
                        color={CLINICAL_COLORS[index % CLINICAL_COLORS.length]}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Acoustic detail</h3>
              <p className="text-sm text-slate-500">Raw signal features for clinicians and power users.</p>
            </div>
            {!acousticAvailable ? (
              <EmptySection
                title="No acoustic biomarkers yet"
                message="Record at least one voice sample to populate jitter, shimmer, pitch, and pause metrics."
                actionHref="/record"
                actionLabel="Record voice"
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">Jitter &amp; Shimmer</h4>
                  <JitterShimmerChart data={timeline} />
                </div>
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">Pitch profile</h4>
                  <PitchProfileChart data={timeline} />
                </div>
                <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">Speech &amp; pause dynamics</h4>
                  <SpeechPauseChart data={timeline} />
                </div>
                <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-900 mb-4">HNR vs health score</h4>
                  <HnrScatterChart data={timeline} />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Model outputs (XGBoost / LSTM)</h3>
              <p className="text-sm text-slate-500">
                Separate from clinical acoustic scores — derived from Oxford voice features.
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Motor UPDRS trend</h4>
                {motorTimeline.length === 0 ? (
                  <EmptySection
                    title="No motor UPDRS data"
                    message="Import a Parkinson's report or record sessions with UPDRS estimates."
                  />
                ) : (
                  <MotorUpdrsChart data={motorTimeline} />
                )}
              </div>
              <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Diagnostic status mix</h4>
                {diagnosticPie.length === 0 ? (
                  <EmptySection title="No predictions yet" message="Sessions need ML diagnostic labels." />
                ) : (
                  <DiagnosticPieChart data={diagnosticPie} />
                )}
              </div>
              <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Severity distribution</h4>
                {severityBuckets.every((b) => b.count === 0) ? (
                  <EmptySection title="No severity data" message="Import or record sessions with severity scores." />
                ) : (
                  <SeverityBarChart data={severityBuckets} />
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Clinical averages + HNR</h3>
            <p className="text-sm text-slate-500 mb-4">Mean scores across the selected time range.</p>
            {!hasTrendSessions ? (
              <EmptySection title="Need 3+ sessions" message="Expand your time range or add more sessions." />
            ) : (
              <ClinicalAveragesChart data={averagesChartData} />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
