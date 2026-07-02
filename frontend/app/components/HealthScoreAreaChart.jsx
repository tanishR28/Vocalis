'use client';

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';
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
import { formatFullDate } from '../../lib/insightsData';

const chartConfig = {
  health_score: { label: 'Health Score', color: CHART_COLORS.primary },
  health_score_avg3: { label: '3-session avg', color: CHART_COLORS.success },
};

function HealthTooltipContent({ active, payload, showMovingAverage }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-slate-500">{formatFullDate(row.date)}</p>
      <p className="text-xl font-bold text-primary leading-none">
        {Math.round(row.health_score)}
        <span className="text-sm font-medium text-slate-400">/100</span>
      </p>
      {row.category ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">{row.category}</p>
      ) : null}
      {row.title ? (
        <p className="text-slate-500 truncate max-w-[200px]" title={row.title}>{row.title}</p>
      ) : null}
      <p className="text-[10px] text-slate-400">Source: {row.source || 'Recorded'}</p>
      {showMovingAverage && row.health_score_avg3 != null ? (
        <p className="text-slate-600">
          3-session avg: <span className="font-mono font-semibold">{row.health_score_avg3}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function HealthScoreAreaChart({
  data,
  height = 320,
  showMovingAverage = false,
  className = '',
}) {
  if (!data?.length) return null;

  const fillId = makeGradientId('health-score');

  return (
    <ChartContainer
      config={chartConfig}
      className={`w-full ${className}`}
      style={{ height }}
    >
      <AreaChart data={data} margin={chartMargins.default}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-health_score)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-health_score)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} domain={[0, 100]} tickCount={5} />
        <ChartTooltip
          cursor={tooltipCursor}
          content={<HealthTooltipContent showMovingAverage={showMovingAverage} />}
        />
        <Area
          type="monotone"
          dataKey="health_score"
          name="health_score"
          stroke="var(--color-health_score)"
          strokeWidth={2.5}
          fill={`url(#${fillId})`}
          dot={{ r: 3, fill: 'var(--color-health_score)', strokeWidth: 2, stroke: '#ffffff' }}
          activeDot={{ r: 6, fill: 'var(--color-health_score)', strokeWidth: 2, stroke: '#ffffff' }}
        />
        {showMovingAverage ? (
          <Line
            type="monotone"
            dataKey="health_score_avg3"
            name="health_score_avg3"
            stroke="var(--color-health_score_avg3)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="6 4"
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  );
}
