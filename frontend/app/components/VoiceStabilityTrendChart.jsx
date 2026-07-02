'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
} from '../../components/ui/chart';
import {
  CHART_COLORS,
  chartMargins,
  gridProps,
  makeGradientId,
  tooltipCursor,
  xAxisDateProps,
  yAxisDefaultProps,
} from '../../lib/chartTheme';
import { formatFullDate, buildInsightsTimeline } from '../../lib/insightsData';

const chartConfig = {
  score: { label: 'Stability', color: CHART_COLORS.primary },
};

function StabilityTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-slate-500">{formatFullDate(row.date)}</p>
      <p className="text-xl font-bold text-primary leading-none">
        {Math.round(row.score)}
        <span className="text-sm font-medium text-slate-400">/100</span>
      </p>
      <p className="text-slate-600">Voice stability score</p>
      {row.category ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">{row.category}</p>
      ) : null}
      {row.title ? (
        <p className="text-slate-400 truncate max-w-[200px]" title={row.title}>{row.title}</p>
      ) : null}
    </div>
  );
}

export function buildVoiceStabilityChartData(historyItems) {
  return buildInsightsTimeline(historyItems || [], '90d')
    .map((row) => ({
      date: row.date,
      score: Number(row.health_score ?? 0),
      category: row.category || '',
      title: row.title || '',
    }))
    .filter((row) => Number.isFinite(row.score) && row.date);
}

export default function VoiceStabilityTrendChart({ items }) {
  const chartData = buildVoiceStabilityChartData(items);
  if (!chartData.length) return null;

  const fillId = makeGradientId('voice-stability');

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <AreaChart data={chartData} margin={chartMargins.default}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-score)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-score)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} domain={[0, 100]} tickCount={5} />
        <ChartTooltip cursor={tooltipCursor} content={<StabilityTooltipContent />} />
        <Area
          type="monotone"
          dataKey="score"
          name="score"
          stroke="var(--color-score)"
          strokeWidth={2.5}
          fill={`url(#${fillId})`}
          dot={{ r: 3, fill: 'var(--color-score)', strokeWidth: 2, stroke: '#ffffff' }}
          activeDot={{ r: 6, fill: 'var(--color-score)', strokeWidth: 2, stroke: '#ffffff' }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
