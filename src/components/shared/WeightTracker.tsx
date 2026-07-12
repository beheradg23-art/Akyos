// Weight trend mini-chart + logging card shown on the Timeline tab. Stores
// its own log in localStorage under WEIGHT_LOG_KEY.
import React, { useState, useEffect, useMemo } from 'react';
import { Weight, TrendingUp, Calendar, Trash2, Plus } from 'lucide-react';
import { ConfigContext, getLocalDateString, getDayName } from '../../lib/appConfig';
import { Card, StatPill, RippleButton } from '../ui/Primitives';
import { EditableSectionHeading } from './EditableSectionHeading';

export const WEIGHT_LOG_KEY = 'weight_log_v1';

export function WeightTrendChart({ entries }) {
  const width = 600;
  const height = 200;
  const padding = { top: 16, right: 14, bottom: 24, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const n = entries.length;

  const weights = entries.map((e) => e.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  // Pad the range so the line never touches the top/bottom edge, and give it
  // a floor of 2kg span so a flat week of identical weigh-ins doesn't render
  // as a wall-to-wall jagged line from floating point noise.
  const span = Math.max(rawMax - rawMin, 2);
  const yMin = rawMin - span * 0.25;
  const yMax = rawMax + span * 0.25;

  const xFor = (i) => padding.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (w) => padding.top + innerH - ((w - yMin) / (yMax - yMin)) * innerH;

  const path = entries.map((e, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(e.weight).toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${xFor(n - 1).toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

  const gridLines = [yMin, yMin + (yMax - yMin) / 2, yMax];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((g) => (
        <g key={g}>
          <line x1={padding.left} x2={width - padding.right} y1={yFor(g)} y2={yFor(g)} stroke="#27272a" strokeWidth="1" />
          <text x={padding.left - 6} y={yFor(g) + 3} fontSize="9" fill="#71717a" textAnchor="end">{g.toFixed(1)}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#weightFill)" stroke="none" />
      <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {entries.map((e, i) => (
        <circle key={e.id} cx={xFor(i)} cy={yFor(e.weight)} r="3" fill="#38bdf8">
          <title>{`${e.date}: ${e.weight} kg`}</title>
        </circle>
      ))}
      {entries.map(
        (e, i) =>
          (i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) && (
            <text key={e.id} x={xFor(i)} y={height - 6} fontSize="9" fill="#71717a" textAnchor="middle">
              {e.date.slice(5)}
            </text>
          )
      )}
    </svg>
  );
}

export function WeightTrackerCard() {
  const { profile } = React.useContext(ConfigContext);
  const [entries, setEntries] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(WEIGHT_LOG_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(entries));
    } catch {
      /* storage unavailable — fail silently, nothing to do here */
    }
  }, [entries]);

  const [formDate, setFormDate] = useState(() => getLocalDateString());
  const [formWeight, setFormWeight] = useState('');

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);

  const handleLog = () => {
    const val = Number(formWeight);
    if (!formWeight || Number.isNaN(val) || val <= 0) return;
    setEntries((prev) => {
      // One weigh-in per day — logging again on the same date overwrites
      // rather than stacking duplicate points on the chart.
      const existing = prev.find((e) => e.date === formDate);
      if (existing) {
        return prev.map((e) => (e.date === formDate ? { ...e, weight: val } : e));
      }
      return [...prev, { id: `w_${Date.now()}`, date: formDate, weight: val }];
    });
    setFormWeight('');
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const first = sortedEntries[0];
  const latest = sortedEntries[sortedEntries.length - 1];
  const baseline = first ? first.weight : profile.weight;
  const delta = latest ? +(latest.weight - baseline).toFixed(1) : 0;

  const last30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return sortedEntries.filter((e) => new Date(e.date) >= cutoff);
  }, [sortedEntries]);
  const delta30 = last30.length >= 2 ? +(last30[last30.length - 1].weight - last30[0].weight).toFixed(1) : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <EditableSectionHeading id="tl_weight" defaultTitle="Body Weight Trend" defaultIcon={TrendingUp} subtitle="Weekly weigh-ins — the real check on whether the recomposition plan is working" />
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2 text-[13px] text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Weight (kg)</label>
            <input
              type="number" min={0} step="0.1" value={formWeight}
              onChange={(e) => setFormWeight(e.target.value)}
              placeholder="e.g. 77.4"
              onKeyDown={(e) => e.key === 'Enter' && handleLog()}
              className="w-28 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
            />
          </div>
          <RippleButton
            onClick={handleLog}
            className="cursor-target flex items-center gap-1.5 rounded-lg bg-neutral-100 text-neutral-900 px-3.5 py-2 text-[12.5px] font-semibold hover:bg-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Log
          </RippleButton>
        </div>
      </div>

      {sortedEntries.length === 0 ? (
        <p className="text-[13px] text-neutral-500">
          No weigh-ins logged yet. Add one above every week — the trend line and change-over-time stats build up automatically from here.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2.5">
            <StatPill icon={Weight} label="Latest" value={`${latest.weight} kg`} />
            <StatPill icon={Calendar} label="Since First Log" value={`${delta > 0 ? '+' : ''}${delta} kg`} accent={delta === 0 ? 'neutral' : delta > 0 ? 'violet' : 'blue'} />
            {delta30 !== null && (
              <StatPill icon={TrendingUp} label="Last 30 Days" value={`${delta30 > 0 ? '+' : ''}${delta30} kg`} accent={delta30 === 0 ? 'neutral' : delta30 > 0 ? 'violet' : 'blue'} />
            )}
          </div>

          {sortedEntries.length >= 2 && (
            <div className="mb-4">
              <WeightTrendChart entries={sortedEntries} />
            </div>
          )}

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {[...sortedEntries].reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                <div className="text-[12.5px] text-neutral-300">{getDayName(e.date)}, {e.date}</div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold tabular-nums text-neutral-100">{e.weight} kg</span>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="cursor-target p-1.5 rounded-lg text-neutral-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    title="Delete this entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

