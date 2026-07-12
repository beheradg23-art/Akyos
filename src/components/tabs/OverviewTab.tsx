// Dashboard Overview tab: profile summary, countdowns, daily stat pills
// (study/training/meals/sleep/calories/protein/hydration), and the goal
// targets list.
import React, { useState, useMemo } from 'react';
import {
  Clock3, Dumbbell, BookOpen, Target, GraduationCap, Ruler, Weight,
  Droplets, Moon, Utensils, Flame, TrendingUp, Activity, Calendar,
  ArrowUpRight, Settings,
} from 'lucide-react';
import { ConfigContext, resolveDietValues, resolveOverviewValues, calculateAge } from '../../lib/appConfig';
import { isSectionVisibleForDomains, type GoalDomain } from '../../lib/questionnaire';
import { Card, StatPill, ModalData } from '../ui/Primitives';
import { CountdownMatrix } from '../shared/CountdownMatrix';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { WEIGHT_LOG_KEY } from '../shared/WeightTracker';

export function OverviewTab({ setModal }: { setModal: (data: ModalData | null) => void }) {
  const { profile, syllabus, timeline, overviewOverrides, diet, dietOverrides, domains } = React.useContext(ConfigContext);
  // Phase 9 Part 2: Overview is a CORE tab (always shown, every account),
  // so unlike tf_workout/tf_fuel — whose parent tab is itself domain-gated
  // — nothing was narrowing "Syllabus Runway" for a non-exam account until
  // now. See questionnaire.ts's SECTION_DOMAIN_KEYS comment for the full
  // reasoning; this is the same isSectionVisibleForDomains mechanism
  // TrainingFuelTab.tsx now uses.
  const showSyllabus = isSectionVisibleForDomains('ov_syllabus', domains as GoalDomain[] | null);
  const latestWeight = useMemo(() => {
    try {
      const saved = localStorage.getItem(WEIGHT_LOG_KEY);
      const entries = saved ? JSON.parse(saved) : [];
      if (!entries.length) return null;
      return [...entries].sort((a: any, b: any) => a.date.localeCompare(b.date)).pop();
    } catch {
      return null;
    }
  }, []);

  // Fuel Matrix's own resolved values (auto-estimated from its meals, or its
  // own custom override) feed into the Overview's calories/protein/hydration
  // rows below, which can then still be independently overridden on top.
  const { resolved: dietValues } = useMemo(() => resolveDietValues(diet, dietOverrides, profile.weight), [diet, dietOverrides, profile.weight]);

  // Auto-derives from the live Timeline + resolved Fuel Matrix values, unless
  // the person has typed a custom override for a given row in
  // Settings > Dashboard Overview.
  const { resolved: shapeValues } = useMemo(() => resolveOverviewValues(timeline, overviewOverrides, dietValues), [timeline, overviewOverrides, dietValues]);

  const colorClass = (color: string) =>
    color === 'blue'
      ? 'border-indigo-500/25 bg-indigo-500/[0.06] hover:bg-indigo-500/[0.12]'
      : color === 'emerald'
      ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]'
      : 'border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]';

  return (
    <div className="space-y-5 animate-fadeIn">
      <CountdownMatrix />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="md:col-span-2 xl:col-span-2">
          <EditableSectionHeading id="ov_profile" defaultTitle="Profile" defaultIcon={GraduationCap} subtitle="Core identity & academic baseline" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <div>
              <div className="text-[20px] font-semibold text-neutral-100 leading-tight">{profile.name}</div>
              <div className="text-[13px] text-neutral-500">{calculateAge(profile.birthdate) ?? '—'}-year-old · {profile.goalLabel}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatPill icon={Ruler} label="Height" value={`${profile.height} cm`} />
            <StatPill icon={Weight} label="Weight" value={latestWeight ? `${latestWeight.weight} kg` : `${profile.weight} kg`} />
            <StatPill icon={Target} label="Category" value={profile.category} accent="amber" />
            <StatPill icon={TrendingUp} label={profile.baselineLabel || 'Baseline'} value={`${profile.baseline}${typeof profile.baseline === 'number' && profile.baseline <= 100 ? ' %ile' : ''}`} accent="blue" />
          </div>
          {profile.boards ? (
            <p className="mt-3 text-[12px] text-neutral-500 leading-relaxed">
              Boards / prior benchmark: {profile.boards}%.
            </p>
          ) : null}
        </Card>

        <Card>
          <EditableSectionHeading id="ov_targets" defaultTitle="Targets" defaultIcon={Target} subtitle="Ranked by priority (Click to view matrix)" />
          <div className="space-y-2.5">
            {profile.targets.map((t) => (
              <div
                key={t.rank}
                onClick={() => setModal({
                  title: t.name,
                  subtitle: t.tag,
                  icon: Target,
                  textBody: t.desc,
                  arrayTitle: 'Key Focus Vectors',
                  arrayItems: ['Set specific focus vectors for this target in Settings → Profile & Goals.']
                })}
                className={`rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.02] ${colorClass(t.color)}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-semibold ${t.color === 'blue' ? 'text-indigo-300' : 'text-amber-300'}`}>{t.name}</span>
                  <ArrowUpRight className="h-3 w-3 text-neutral-500" />
                </div>
                <div className="text-[12px] text-neutral-400 mt-0.5">{t.course}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <EditableSectionHeading id="ov_shape" defaultTitle="Today's Shape" defaultIcon={Clock3} subtitle="Session load map summary" />
          <div className="space-y-2">
            {[
              { label: 'Study Sessions', value: shapeValues.studySessions, icon: BookOpen },
              { label: 'Gym / Training', value: shapeValues.training, icon: Dumbbell },
              { label: 'Meals', value: shapeValues.meals, icon: Utensils },
              { label: 'Sleep Lock', value: shapeValues.sleep, icon: Moon },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg border border-neutral-800/70 bg-neutral-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <r.icon className="h-3.5 w-3.5 text-neutral-500" strokeWidth={1.75} />
                  <span className="text-[12.5px] text-neutral-400">{r.label}</span>
                </div>
                <span className="text-[12.5px] font-medium text-neutral-200">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <EditableSectionHeading id="ov_fuel" defaultTitle="Fuel Snapshot" defaultIcon={Flame} subtitle="V-Taper matrix ratios" />
          <div className="space-y-2.5">
            <StatPill icon={Flame} label="Calories" value={shapeValues.calories} accent="amber" />
            <StatPill icon={Activity} label="Protein" value={shapeValues.protein} accent="violet" />
            <StatPill icon={Droplets} label="Hydration" value={shapeValues.hydration} accent="blue" />
          </div>
        </Card>

        {showSyllabus && (
        <Card>
          <EditableSectionHeading id="ov_syllabus" defaultTitle="Syllabus Runway" defaultIcon={Calendar} subtitle="4-month deadline progression" />
          <div className="space-y-2">
            {syllabus.map((p) => (
              <div key={p.phase} className="flex items-center gap-3 rounded-lg border border-neutral-800/70 bg-neutral-950/40 px-3 py-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[11px] font-semibold text-neutral-300">
                  {p.phase}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-neutral-200 truncate">{p.month} — {p.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Timeline ----------