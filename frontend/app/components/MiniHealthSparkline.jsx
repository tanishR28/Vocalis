'use client';

import Link from 'next/link';
import { Line, LineChart } from 'recharts';
import { ChartContainer } from '../../components/ui/chart';
import { CHART_COLORS, chartMargins } from '../../lib/chartTheme';

const chartConfig = {
  health_score: { label: 'Score', color: CHART_COLORS.primary },
};

export default function MiniHealthSparkline({ data }) {
  if (!data?.length) return null;

  return (
    <div className="mt-4 w-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last 7 sessions</p>
        <Link href="/insights" className="text-[10px] font-bold text-primary hover:underline">
          View Insights
        </Link>
      </div>
      <ChartContainer config={chartConfig} className="h-14 w-full">
        <LineChart data={data} margin={chartMargins.compact}>
          <Line
            type="monotone"
            dataKey="health_score"
            stroke="var(--color-health_score)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
