import { formatAxisDate, formatFullDate } from './insightsData';

/** Primary brand blue used across dashboard and insights. */
export const CHART_PRIMARY = '#0056bb';

export const CHART_COLORS = {
  primary: CHART_PRIMARY,
  success: '#16a34a',
  sky: '#0ea5e9',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  violet: '#7c3aed',
  green: '#22c55e',
  amber: '#f59e0b',
  slate: '#64748b',
};

export const chartMargins = {
  default: { top: 8, right: 12, left: 0, bottom: 0 },
  compact: { top: 4, right: 8, left: 0, bottom: 0 },
};

export const xAxisDateProps = {
  dataKey: 'date',
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 32,
  tick: { fill: '#94a3b8', fontSize: 11 },
  tickFormatter: formatAxisDate,
};

export const yAxisDefaultProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: '#94a3b8', fontSize: 11 },
  width: 40,
};

export const gridProps = {
  vertical: false,
  strokeDasharray: '4 4',
  stroke: '#e2e8f0',
};

export const tooltipCursor = {
  stroke: CHART_PRIMARY,
  strokeWidth: 1,
  strokeDasharray: '4 4',
};

export function dateTooltipLabel(value) {
  return formatFullDate(value);
}

export function makeGradientId(key) {
  return `fill-${key}`;
}
