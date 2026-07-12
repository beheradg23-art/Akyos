// Mock Test tab: test log, score-trend chart, and weak-topic priority list.
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ClipboardList, BarChart3, Trash2, Plus, Settings } from 'lucide-react';
import { ConfigContext, getSubjectStyle, getSubjectHex, getLocalDateString, getDayName } from '../../lib/appConfig';
import { Card, RippleButton } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';

export function ScoreTrendChart({ tests, subjects }) {
  const width = 600;
  const height = 220;
  const padding = { top: 10, right: 10, bottom: 24, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const n = tests.length;

  // Every test can have a different max-marks per subject, so the chart plots
  // percentage-of-max (score / max * 100) rather than the raw score. That's
  // the only way an 68/80 and a 74/100 land on the same comparable scale.
  const pctFor = (t, key) => {
    const s = t.scores[key];
    if (!s || !s.max) return 0;
    return (s.score / s.max) * 100;
  };

  const xFor = (i) => padding.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (pct) => padding.top + innerH - (Math.max(0, Math.min(pct, 100)) / 100) * innerH;

  const buildPath = (key) =>
    tests.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(pctFor(t, key)).toFixed(1)}`).join(' ');

  // Old logged tests are always { math, physics, chem }; new ones can have
  // any subject keys, so read the keys straight off the data rather than
  // assuming a fixed 3 — that keeps old data rendering unchanged.
  const scoreKeys = Array.from(new Set(tests.flatMap((t) => Object.keys(t.scores || {}))));
  const series = scoreKeys.map((key) => {
    const found = subjects.find((s) => s.key === key);
    return {
      key,
      color: getSubjectHex(key, subjects),
      label: found?.label || key,
    };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[0, 25, 50, 75, 100].map((gVal) => (
          <g key={gVal}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(gVal)} y2={yFor(gVal)} stroke="#27272a" strokeWidth="1" />
            <text x={padding.left - 6} y={yFor(gVal) + 3} fontSize="9" fill="#71717a" textAnchor="end">{gVal}%</text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.key} d={buildPath(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {series.map((s) =>
          tests.map((t, i) => {
            const raw = t.scores[s.key];
            if (!raw) return null;
            return (
              <circle key={`${s.key}-${i}`} cx={xFor(i)} cy={yFor(pctFor(t, s.key))} r="3" fill={s.color}>
                <title>{`${s.label}: ${raw.score}/${raw.max} (${pctFor(t, s.key).toFixed(1)}%)`}</title>
              </circle>
            );
          })
        )}
        {tests.map(
          (t, i) =>
            (i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) && (
              <text key={i} x={xFor(i)} y={height - 6} fontSize="9" fill="#71717a" textAnchor="middle">
                {t.date.slice(5)}
              </text>
            )
        )}
      </svg>
      <div className="flex items-center gap-4 mt-1 justify-center text-[11px] text-neutral-400">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <p className="text-center text-[10.5px] text-neutral-600 mt-2">Plotted as % of that test's max marks, since full marks vary test to test — hover a point for the raw score.</p>
    </div>
  );
}

export function MockTestTab() {
  const { subjects, syllabus } = React.useContext(ConfigContext);
  // Subjects worth putting a score box in the test-log form are the ones
  // explicitly marked "in Mock Tests" in Settings > Subjects & Syllabus
  // (default true; undefined only for malformed/very old data).
  const scorableSubjects = useMemo(
    () => subjects.filter((s) => s.inMockTest !== false),
    [subjects]
  );

  const [tests, setTests] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mock_test_log');
      const parsed = saved ? JSON.parse(saved) : [];
      // Back-compat: earlier versions stored raw numbers per subject with an
      // implicit fixed 100 max, always under exactly {math,physics,chem}.
      // Normalize old numeric entries into { score, max } shape, but leave
      // the key set itself alone — every render path below iterates
      // Object.keys(test.scores) rather than assuming particular keys, so
      // old {math,physics,chem} tests keep working unchanged.
      return parsed.map((t: any) => {
        const scores: Record<string, { score: number; max: number }> = {};
        Object.entries(t.scores || {}).forEach(([key, val]: [string, any]) => {
          scores[key] = typeof val === 'number' ? { score: val, max: 100 } : val;
        });
        return { ...t, scores };
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mock_test_log', JSON.stringify(tests));
    } catch {
      /* storage unavailable — fail silently, nothing to do here */
    }
  }, [tests]);

  const [formPhase, setFormPhase] = useState(1);
  const [formDate, setFormDate] = useState(() => getLocalDateString());
  const [formLabel, setFormLabel] = useState('');
  // One { score, max } pair per scorable subject key, keyed the same way
  // as the logged-test shape below.
  const [formScores, setFormScores] = useState<Record<string, { score: string; max: string }>>(() =>
    Object.fromEntries(scorableSubjects.map((s) => [s.key, { score: '', max: '100' }]))
  );
  const [formWeakTopics, setFormWeakTopics] = useState<string[]>([]);

  // If the user edits their subject list in Settings while this tab is
  // mounted, keep the form in sync (new subject -> new blank box; removed
  // subject -> its box disappears) without clobbering scores already typed
  // into boxes that still exist.
  useEffect(() => {
    setFormScores((prev) => {
      const next: Record<string, { score: string; max: string }> = {};
      scorableSubjects.forEach((s) => {
        next[s.key] = prev[s.key] || { score: '', max: '100' };
      });
      return next;
    });
  }, [scorableSubjects]);

  const setFormScore = (key: string, field: 'score' | 'max', value: string) => {
    setFormScores((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const activePhaseData = syllabus.find((p) => p.phase === formPhase);

  const toggleWeakTopic = (topic: string) => {
    setFormWeakTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  };

  const resetForm = () => {
    setFormLabel('');
    // Max-marks fields deliberately are NOT reset — most students sit a run of
    // tests from the same series with the same marking scheme, so keeping
    // the last-used max marks pre-filled saves re-typing every single time.
    setFormScores((prev) =>
      Object.fromEntries(Object.entries(prev).map(([key, v]) => [key, { score: '', max: v.max }]))
    );
    setFormWeakTopics([]);
  };

  const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

  const handleAddTest = () => {
    const hasAnyScore = Object.values(formScores).some((v) => v.score);
    if (!hasAnyScore) return;
    const scores: Record<string, { score: number; max: number }> = {};
    Object.entries(formScores).forEach(([key, v]) => {
      const max = Math.max(1, Number(v.max) || 100);
      scores[key] = { score: clamp(Number(v.score) || 0, max), max };
    });
    const entry = {
      id: `mt_${Date.now()}`,
      date: formDate,
      label: formLabel.trim() || 'Untitled Test',
      scores,
      weakTopics: formWeakTopics,
    };
    setTests((prev) => [...prev, entry]);
    resetForm();
  };

  const handleDeleteTest = (id: string) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  const sortedTests = useMemo(() => [...tests].sort((a, b) => a.date.localeCompare(b.date)), [tests]);

  const weakTopicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tests.forEach((t) => {
      (t.weakTopics || []).forEach((topic: string) => {
        counts[topic] = (counts[topic] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tests]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <Card>
        <EditableSectionHeading
          id="mt_log"
          defaultTitle="Log a Mock Test"
          defaultIcon={ClipboardList}
          subtitle="Log each attempt with its actual full marks. Flag whichever topics cost you marks — the priority list below builds itself from this."
        />

        <div className="grid sm:grid-cols-2 gap-3 mb-4 mt-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Test Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[13px] text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Test Name (optional)</label>
            <input
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="e.g. Allen Weekly Test 14"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {scorableSubjects.map((s) => {
            const style = getSubjectStyle(s.key, subjects);
            const v = formScores[s.key] || { score: '', max: '100' };
            return (
              <div key={s.key} className="rounded-xl border border-neutral-800/70 bg-neutral-950/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <label className={`text-[11px] uppercase tracking-wider font-bold block mb-2 sm:mb-1.5 ${style.text}`}>{s.label}</label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="number" inputMode="decimal" min={0} value={v.score}
                    onChange={(e) => setFormScore(s.key, 'score', e.target.value)}
                    placeholder="Score"
                    className="w-full min-w-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3 sm:py-2 text-base sm:text-[13px] font-semibold text-neutral-50 placeholder:font-normal placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <span className="flex items-center text-neutral-600 text-[13px] shrink-0">/</span>
                  <input
                    type="number" inputMode="decimal" min={1} value={v.max}
                    onChange={(e) => setFormScore(s.key, 'max', e.target.value)}
                    title="Full marks for this subject in this test"
                    className="w-20 sm:w-16 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-3 sm:py-2 text-base sm:text-[13px] font-medium text-neutral-300 text-center focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10.5px] text-neutral-600 -mt-3.5 mb-5">Enter the actual full marks for each subject — it doesn't need to be 100, and can differ subject to subject or test to test.</p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">Flag Weak Topics (optional)</label>
            <div className="flex gap-1 flex-wrap">
              {syllabus.map((p) => (
                <button
                  key={p.phase}
                  onClick={() => setFormPhase(p.phase)}
                  className={`cursor-target px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-colors ${
                    formPhase === p.phase ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {p.month}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3.5 max-h-56 overflow-y-auto">
            {scorableSubjects.map((s) => (
              <div key={s.key}>
                <div className={`text-[11px] font-semibold mb-1.5 ${getSubjectStyle(s.key, subjects).text}`}>{s.label}</div>
                <div className="space-y-1.5">
                  {(activePhaseData?.subjects[s.key] || []).map((topic) => (
                    <label key={topic} className="flex items-center gap-1.5 text-[12px] text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formWeakTopics.includes(topic)}
                        onChange={() => toggleWeakTopic(topic)}
                        className="accent-rose-500"
                      />
                      {topic}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <RippleButton
          onClick={handleAddTest}
          className="cursor-target flex items-center gap-1.5 rounded-lg bg-neutral-100 text-neutral-900 px-4 py-2.5 text-[12.5px] font-semibold hover:bg-white transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Log Test
        </RippleButton>
      </Card>

      {sortedTests.length > 0 && (
        <Card>
          <EditableSectionHeading id="mt_trend" defaultTitle="Score Trend" defaultIcon={BarChart3} subtitle={`${sortedTests.length} test${sortedTests.length === 1 ? '' : 's'} logged — shown as % of that test's max marks`} />
          <div className="mt-4">
            <ScoreTrendChart tests={sortedTests} subjects={subjects} />
          </div>
        </Card>
      )}

      {weakTopicCounts.length > 0 && (
        <Card>
          <EditableSectionHeading id="mt_weak" defaultTitle="Weak Topic Priority" defaultIcon={AlertTriangle} subtitle="Ranked by how often each topic has been flagged across your logged tests" />
          <div className="space-y-2 mt-4">
            {weakTopicCounts.map(([topic, count], idx) => (
              <div key={topic} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[11px] font-mono w-5 text-center ${idx < 3 ? 'text-rose-400' : 'text-neutral-600'}`}>#{idx + 1}</span>
                  <span className="text-[13px] text-neutral-200">{topic}</span>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    idx < 3 ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-neutral-800/60 text-neutral-400 border-neutral-800'
                  }`}
                >
                  Flagged {count}×
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <EditableSectionHeading id="mt_testlog" defaultTitle="Test Log" defaultIcon={ClipboardList} subtitle={sortedTests.length ? 'All logged attempts, most recent first' : 'Nothing logged yet'} />
        {sortedTests.length === 0 ? (
          <p className="text-[13px] text-neutral-500 mt-4">
            No mock tests logged yet. Add your first one above — the score trend and weak-topic ranking will build up automatically from here.
          </p>
        ) : (
          <div className="space-y-2 mt-4">
            {[...sortedTests].reverse().map((t) => {
              const scoreEntries = Object.entries(t.scores || {}) as [string, { score: number; max: number }][];
              const totalScore = scoreEntries.reduce((sum, [, v]) => sum + (v?.score || 0), 0);
              const totalMax = scoreEntries.reduce((sum, [, v]) => sum + (v?.max || 0), 0);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 flex-wrap">
                  <div>
                    <div className="text-[13px] font-medium text-neutral-200">{t.label}</div>
                    <div className="text-[11px] text-neutral-500">{getDayName(t.date)}, {t.date}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    {scoreEntries.map(([key, v]) => {
                      const found = subjects.find((s) => s.key === key);
                      const initial = (found?.label || key).slice(0, 1).toUpperCase();
                      return (
                        <span key={key} className={getSubjectStyle(key, subjects).text}>
                          {initial} {v.score}/{v.max}
                        </span>
                      );
                    })}
                    <span className="font-bold text-neutral-100">{totalScore}/{totalMax}</span>
                    <button
                      onClick={() => handleDeleteTest(t.id)}
                      className="cursor-target p-1.5 rounded-lg text-neutral-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      title="Delete this test"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Opening / Intro Loader ----------
// A single-run splash animation: a counting percentage, a thin gradient
// progress line, then a clean upward "curtain" wipe that reveals the app.

