'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function mapHistoryToChart(items) {
  return [...items].reverse().map((item, index) => {
    const biomarkers = item.biomarkers || {};
    const signals = biomarkers.raw_features?.signals || {};

    return {
      sample: `S${index + 1}`,
      pitch_mean: Number(biomarkers.pitch_mean ?? signals.pitch_mean ?? 0),
      pitch_std: Number(biomarkers.pitch_variation ?? signals.pitch_std ?? 0),
      jitter: Number(biomarkers.jitter ?? signals.jitter ?? 0),
      shimmer: Number(biomarkers.shimmer ?? signals.shimmer ?? 0),
      hnr: Number(biomarkers.hnr ?? signals.hnr ?? 0),
      speech_rate: Number(biomarkers.speech_rate ?? signals.speech_rate ?? 0),
      pause_count: Number(biomarkers.pause_count ?? signals.pause_count ?? 0),
      avg_pause: Number(biomarkers.pause_duration_avg ?? signals.avg_pause_len ?? 0),
      health_score: Number(item.health_score?.score ?? biomarkers.health_score ?? 0),
      status: item.health_score?.category || 'unknown',
    };
  });
}

export default function InsightsPage() {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch(`${API_URL}/api/history?limit=50&source=audio`);
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

    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const rows = mapHistoryToChart(historyItems);
    return rows.map((row, index, arr) => {
      const start = Math.max(0, index - 2);
      const movingWindow = arr.slice(start, index + 1).map((item) => item.health_score);
      return {
        ...row,
        health_score_avg3: Number(avg(movingWindow).toFixed(2)),
      };
    });
  }, [historyItems]);

  const biomarkerAverages = useMemo(() => {
    return [
      { metric: 'Pitch Mean', avg: Number(avg(chartData.map((d) => d.pitch_mean)).toFixed(2)) },
      { metric: 'Pitch Std', avg: Number(avg(chartData.map((d) => d.pitch_std)).toFixed(2)) },
      { metric: 'Jitter', avg: Number(avg(chartData.map((d) => d.jitter)).toFixed(5)) },
      { metric: 'Shimmer', avg: Number(avg(chartData.map((d) => d.shimmer)).toFixed(5)) },
      { metric: 'HNR', avg: Number(avg(chartData.map((d) => d.hnr)).toFixed(2)) },
      { metric: 'Speech', avg: Number(avg(chartData.map((d) => d.speech_rate)).toFixed(2)) },
      { metric: 'Pause Cnt', avg: Number(avg(chartData.map((d) => d.pause_count)).toFixed(2)) },
      { metric: 'Avg Pause', avg: Number(avg(chartData.map((d) => d.avg_pause)).toFixed(3)) },
    ];
  }, [chartData]);

  const statusPieData = useMemo(() => {
    let low = 0;
    let medium = 0;
    let high = 0;

    chartData.forEach((row) => {
      if (row.health_score >= 75) low += 1;
      else if (row.health_score >= 60) medium += 1;
      else high += 1;
    });

    return [
      { name: 'Low Risk', value: low, color: '#10b981' },
      { name: 'Medium Risk', value: medium, color: '#f59e0b' },
      { name: 'High Risk', value: high, color: '#ef4444' },
    ];
  }, [chartData]);

  const summary = useMemo(() => {
    return {
      samples: chartData.length,
      avgScore: Number(avg(chartData.map((d) => d.health_score)).toFixed(1)),
      avgJitter: Number(avg(chartData.map((d) => d.jitter)).toFixed(5)),
      avgShimmer: Number(avg(chartData.map((d) => d.shimmer)).toFixed(5)),
    };
  }, [chartData]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <header>
          <p className="text-slate-600">Biomarker trends from your saved voice assessments.</p>
        </header>

        {!loading && chartData.length === 0 ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
            <p className="font-medium">No voice assessments yet.</p>
            <p className="text-sm mt-2">Record a sample first, then return here for trend charts.</p>
            <Link href="/record" className="inline-block mt-4 text-blue-700 font-bold hover:underline">
              Go to Record
            </Link>
          </section>
        ) : null}

        {chartData.length > 0 ? (
        <>
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Samples</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{summary.samples}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Avg Health Score</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{summary.avgScore}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Avg Jitter</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{summary.avgJitter}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Avg Shimmer</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{summary.avgShimmer}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Health Score Trend (Raw vs Avg-3)</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sample" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[30, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="health_score" stroke="#2563eb" strokeWidth={3} dot={false} name="Health Score" />
                  <Line type="monotone" dataKey="health_score_avg3" stroke="#16a34a" strokeWidth={3} dot={false} name="Avg-3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Risk Distribution</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Pitch Profile</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sample" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pitch_mean" stroke="#0ea5e9" strokeWidth={3} dot={false} name="Pitch Mean" />
                  <Line type="monotone" dataKey="pitch_std" stroke="#f97316" strokeWidth={3} dot={false} name="Pitch Std" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Jitter and Shimmer</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sample" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="jitter" stroke="#ef4444" fill="#fecaca" name="Jitter" />
                  <Area type="monotone" dataKey="shimmer" stroke="#a855f7" fill="#e9d5ff" name="Shimmer" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Speech and Pause Dynamics</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sample" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="speech_rate" fill="#22c55e" name="Speech Rate" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="pause_count" fill="#f59e0b" name="Pause Count" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="avg_pause" fill="#64748b" name="Avg Pause" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">HNR vs Health Score</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="hnr" name="HNR" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis type="number" dataKey="health_score" name="Health Score" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={chartData} fill="#2563eb" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-12 bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Biomarker Averages</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={biomarkerAverages} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#0ea5e9" name="Average Value" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
        </>
        ) : null}
    </div>
  );
}
