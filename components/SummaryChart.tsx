
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ExpertOpinion } from '../types';

interface IterationData {
  iteration: string;
  score: number;
}

interface SummaryChartProps {
  data: ExpertOpinion[];
}

const SummaryChart: React.FC<SummaryChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center text-slate-400 py-8">Awaiting feasibility scores for chart...</div>;
    }

    // Transform the data to show iterations with scores
    const chartData: IterationData[] = data.map((opinion, index) => ({
        iteration: `Iteration ${index + 1}`,
        score: opinion.feasibilityScore
    }));

  return (
    <div id="summary-chart-container" className="h-64 w-full bg-slate-800/50 p-2 rounded-md">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis dataKey="iteration" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }}
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [`${value}/100`, 'Feasibility Score']}
          />
          <Legend wrapperStyle={{ color: '#e2e8f0' }} />
          <Bar dataKey="score" name="Feasibility Score" fill="#0ea5e9" barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SummaryChart;