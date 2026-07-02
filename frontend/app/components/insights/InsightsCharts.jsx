'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../../../components/ui/chart';
import {
  formatInsightValue,
  insightLevel,
} from '../../../lib/clinicalInsights';
import {
  CHART_COLORS,
  chartMargins,
  dateTooltipLabel,
  gridProps,
  makeGradientId,
  tooltipCursor,
  xAxisDateProps,
  yAxisDefaultProps,
} from '../../../lib/chartTheme';
import { formatFullDate } from '../../../lib/insightsData';

const CLINICAL_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.sky,
  CHART_COLORS.orange,
  CHART_COLORS.green,
  CHART_COLORS.purple,
];

export function ClinicalTrendChart({ data, metricId, name, color = CHART_COLORS.primary }) {
  if (!data?.length) return null;

  const fillId = makeGradientId(`clinical-${metricId}`);
  const config = { [metricId]: { label: name, color } };

  return (
    <ChartContainer config={config} className="h-[140px] w-full">
      <AreaChart data={data} margin={chartMargins.compact}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={`var(--color-${metricId})`} stopOpacity={0.3} />
            <stop offset="95%" stopColor={`var(--color-${metricId})`} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} tick={{ fill: '#94a3b8', fontSize: 9 }} minTickGap={24} />
        <YAxis domain={[0, 100]} hide />
        <ChartTooltip
          cursor={tooltipCursor}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            const insight = row[`${metricId}_raw`];
            return (
              <div className="grid min-w-36 gap-1 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl">
                <p className="font-medium text-slate-500">{formatFullDate(row.date)}</p>
                <p className="text-lg font-bold text-primary">{Math.round(payload[0].value)}</p>
                {insight ? (
                  <p className="text-slate-600">
                    {insightLevel(metricId, insight)} · {formatInsightValue(metricId, insight)}
                  </p>
                ) : null}
                {row.insight_source ? (
                  <p className="text-[10px] text-slate-400">Source: {row.insight_source}</p>
                ) : null}
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey={metricId}
          name={metricId}
          stroke={`var(--color-${metricId})`}
          fill={`url(#${fillId})`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function ClinicalRadarChart({ data }) {
  const config = { value: { label: 'Score', color: CHART_COLORS.primary } };

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#64748b' }} />
        <Radar
          name="value"
          dataKey="value"
          stroke="var(--color-value)"
          fill="var(--color-value)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="grid gap-1 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl">
                <p className="font-semibold text-slate-900">{d.metric}</p>
                <p className="text-lg font-bold text-primary">{Math.round(d.value)}</p>
                <p className="text-slate-500 max-w-[180px]">{d.description}</p>
              </div>
            );
          }}
        />
      </RadarChart>
    </ChartContainer>
  );
}

const jitterShimmerConfig = {
  jitter: { label: 'Jitter', color: CHART_COLORS.red },
  shimmer: { label: 'Shimmer', color: CHART_COLORS.purple },
};

export function JitterShimmerChart({ data }) {
  return (
    <ChartContainer config={jitterShimmerConfig} className="h-[280px] w-full">
      <AreaChart data={data} margin={chartMargins.default}>
        <defs>
          <linearGradient id={makeGradientId('jitter')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-jitter)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-jitter)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={makeGradientId('shimmer')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-shimmer)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-shimmer)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} />
        <ChartTooltip
          cursor={tooltipCursor}
          content={<ChartTooltipContent labelFormatter={dateTooltipLabel} indicator="dot" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="jitter"
          name="jitter"
          stroke="var(--color-jitter)"
          fill={`url(#${makeGradientId('jitter')})`}
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="shimmer"
          name="shimmer"
          stroke="var(--color-shimmer)"
          fill={`url(#${makeGradientId('shimmer')})`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const pitchConfig = {
  pitch_mean: { label: 'Pitch mean', color: CHART_COLORS.sky },
  pitch_std: { label: 'Pitch std', color: CHART_COLORS.orange },
};

export function PitchProfileChart({ data }) {
  return (
    <ChartContainer config={pitchConfig} className="h-[280px] w-full">
      <LineChart data={data} margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} />
        <ChartTooltip
          cursor={tooltipCursor}
          content={<ChartTooltipContent labelFormatter={dateTooltipLabel} indicator="dot" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="pitch_mean"
          name="pitch_mean"
          stroke="var(--color-pitch_mean)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="pitch_std"
          name="pitch_std"
          stroke="var(--color-pitch_std)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

const speechConfig = {
  speech_rate: { label: 'Speech rate', color: CHART_COLORS.green },
  pause_count: { label: 'Pause count', color: CHART_COLORS.amber },
  avg_pause: { label: 'Avg pause', color: CHART_COLORS.slate },
};

export function SpeechPauseChart({ data }) {
  return (
    <ChartContainer config={speechConfig} className="h-[280px] w-full">
      <BarChart data={data} margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} />
        <ChartTooltip
          cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
          content={<ChartTooltipContent labelFormatter={dateTooltipLabel} indicator="dot" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="speech_rate" name="speech_rate" fill="var(--color-speech_rate)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pause_count" name="pause_count" fill="var(--color-pause_count)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="avg_pause" name="avg_pause" fill="var(--color-avg_pause)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const scatterConfig = {
  health_score: { label: 'Health score', color: CHART_COLORS.primary },
};

export function HnrScatterChart({ data }) {
  return (
    <ChartContainer config={scatterConfig} className="h-[280px] w-full">
      <ScatterChart margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis type="number" dataKey="hnr" name="HNR" {...yAxisDefaultProps} />
        <YAxis type="number" dataKey="health_score" name="Health" domain={[0, 100]} {...yAxisDefaultProps} />
        <ChartTooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            return (
              <div className="grid gap-1 rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl">
                <p className="font-medium text-slate-500">HNR {row.hnr?.toFixed(2)}</p>
                <p className="font-bold text-primary">Health {Math.round(row.health_score)}</p>
              </div>
            );
          }}
        />
        <Scatter data={data} fill="var(--color-health_score)" />
      </ScatterChart>
    </ChartContainer>
  );
}

const motorConfig = {
  motor_updrs: { label: 'Motor UPDRS', color: CHART_COLORS.violet },
};

export function MotorUpdrsChart({ data }) {
  return (
    <ChartContainer config={motorConfig} className="h-[260px] w-full">
      <LineChart data={data} margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisDefaultProps} />
        <ChartTooltip
          cursor={tooltipCursor}
          content={<ChartTooltipContent labelFormatter={dateTooltipLabel} indicator="dot" />}
        />
        <Line
          type="monotone"
          dataKey="motor_updrs"
          name="motor_updrs"
          stroke="var(--color-motor_updrs)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: 'var(--color-motor_updrs)' }}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function DiagnosticPieChart({ data }) {
  const config = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.color }]),
  );

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-xl">
                <p className="font-semibold">{d.name}</p>
                <p className="font-bold text-primary">{d.value} sessions</p>
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    </ChartContainer>
  );
}

const severityConfig = {
  count: { label: 'Sessions', color: CHART_COLORS.primary },
};

export function SeverityBarChart({ data }) {
  return (
    <ChartContainer config={severityConfig} className="h-[260px] w-full">
      <BarChart data={data} margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
        <YAxis allowDecimals={false} {...yAxisDefaultProps} />
        <ChartTooltip content={<ChartTooltipContent hideLabel indicator="dot" />} />
        <Bar dataKey="count" name="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const averagesConfig = {
  avg: { label: 'Average', color: CHART_COLORS.sky },
};

export function ClinicalAveragesChart({ data }) {
  return (
    <ChartContainer config={averagesConfig} className="h-[280px] w-full">
      <BarChart data={data} margin={chartMargins.default}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="metric" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis {...yAxisDefaultProps} />
        <ChartTooltip content={<ChartTooltipContent hideLabel indicator="dot" />} />
        <Bar dataKey="avg" name="avg" fill="var(--color-avg)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export { CLINICAL_COLORS };
