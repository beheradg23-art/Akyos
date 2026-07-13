// Training & Fuel tab: the gym block (with AI-generated exercise guides,
// falling back to the static EXERCISE_GUIDE) and the diet/meal log.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell, CheckCircle2, Circle, Target, Droplets, Flame, Activity,
  ArrowUpRight, Settings,
} from 'lucide-react';
import { ConfigContext, resolveDietValues, getLocalDateString, DailyCheckLog } from '../../lib/appConfig';
import { isSectionVisibleForDomains, type GoalDomain } from '../../lib/questionnaire';
import { EXERCISE_GUIDE } from '../../lib/staticContent';
import { Card, StatPill, ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { WeightTrackerCard } from '../shared/WeightTracker';
import { generateExerciseGuide } from '../../lib/contentGen';

export function TrainingFuelTab({ setModal, dietLog, setDietLog, currentDateStr }: { setModal: (data: ModalData | null) => void; dietLog: DailyCheckLog; setDietLog: React.Dispatch<React.SetStateAction<DailyCheckLog>>; currentDateStr: string }) {
  const { training, diet, dietOverrides, profile, domains } = React.useContext(ConfigContext);
  // Phase 9 Part 2: section-level domain gating, wiring in the mechanism
  // Phase 8 built (SECTION_DOMAIN_KEYS/isSectionVisibleForDomains in
  // questionnaire.ts) but never consumed. A diet-only account (no
  // 'fitness') no longer sees the workout-split section; a fitness-only
  // account (no 'diet') no longer sees the Fuel Matrix. `domains === null`
  // (legacy/unrestricted accounts, and every account until Phase 9 Part 1
  // actually started writing a real value) still sees both, unchanged.
  const showWorkout = isSectionVisibleForDomains('tf_workout', domains as GoalDomain[] | null);
  const showFuel = isSectionVisibleForDomains('tf_fuel', domains as GoalDomain[] | null);
  const [activeDay, setActiveDay] = useState(training[0].day);
  const dayData = training.find((d) => d.day === activeDay) || training[0];

  // If the routine gets edited in Settings and the previously-selected day
  // no longer exists, fall back to the first day instead of showing nothing.
  useEffect(() => {
    if (!training.find((d) => d.day === activeDay)) {
      setActiveDay(training[0].day);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training]);

  // Calories / protein / hydration auto-estimate from whatever meals are
  // configured below, unless overridden in Settings > Training & Fuel.
  const { resolved: dietValues } = useMemo(() => resolveDietValues(diet, dietOverrides, profile.weight), [diet, dietOverrides, profile.weight]);

  // Per-meal diet check-ins live in the parent (JEEDashboard) so the Daily
  // Matrix's "All 6 Meals Hit" box can auto-derive from this instead of being
  // a second, independent source of truth for the same thing.
  const todayStr = currentDateStr;
  const todayLog = dietLog[todayStr] || {};
  const mealsLoggedToday = diet.filter((m) => todayLog[m.name]).length;

  const toggleMeal = (mealName: string) => {
    setDietLog((prev) => {
      const day = { ...(prev[todayStr] || {}) };
      day[mealName] = !day[mealName];
      return { ...prev, [todayStr]: day };
    });
  };

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getLocalDateString(d);
      const count = Object.values(dietLog[dStr] || {}).filter(Boolean).length;
      days.push({ date: dStr, count });
    }
    return days;
  }, [dietLog]);

  const modeStyle = {
    gym: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    calisthenics: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
    rest: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  };

  const handleExerciseClick = async (exName, setsStr) => {
    const defaultData = { target: 'General Conditioning', instructions: ['Execute standard range of motion patterns safely.', 'Keep load linear.'], cues: 'Focus on proper core tracking.' };
    const known = EXERCISE_GUIDE[exName];

    if (known) {
      setModal({
        title: exName,
        subtitle: `Target Focus: ${known.target} · Routine Parameters: ${setsStr}`,
        icon: Dumbbell,
        arrayTitle: 'Step-By-Step Execution Instructions',
        arrayItems: known.instructions,
        cues: known.cues,
      });
      return;
    }

    // Not in the built-in library (i.e. a user-added exercise) — quietly
    // fill in a real form guide in the background instead of showing the
    // generic placeholder. No "AI" framing shown to the user.
    setModal({
      title: exName,
      subtitle: `Routine Parameters: ${setsStr}`,
      icon: Dumbbell,
      loading: true,
    });
    const generated = await generateExerciseGuide(exName);
    const targetedGuide = generated || defaultData;
    setModal({
      title: exName,
      subtitle: `Target Focus: ${targetedGuide.target} · Routine Parameters: ${setsStr}`,
      icon: Dumbbell,
      arrayTitle: 'Step-By-Step Execution Instructions',
      arrayItems: targetedGuide.instructions,
      cues: targetedGuide.cues,
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {showWorkout && (
      <Card>
        <EditableSectionHeading id="tf_workout" defaultTitle="Hybrid Vascularity Workout Split" defaultIcon={Dumbbell} subtitle="Select day to map active routines. Click any individual exercise to view strict mechanical form guides." />
        <div className="flex flex-wrap gap-2 mb-4">
          {training.map((d) => (
            <button
              key={d.day}
              onClick={() => setActiveDay(d.day)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-150 ${
                activeDay === d.day
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              {d.day}
            </button>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-[15px] font-semibold text-neutral-100">{dayData.day} Target Matrix</div>
              <div className="text-[12.5px] text-neutral-500">{dayData.focus}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${modeStyle[dayData.mode] || modeStyle.rest}`}>
              {dayData.mode}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {dayData.exercises.map((ex) => (
              <div 
                key={ex.name} 
                onClick={() => handleExerciseClick(ex.name, ex.sets)}
                className="flex items-center justify-between rounded-lg border border-neutral-800/70 bg-neutral-950/40 px-3.5 py-2.5 cursor-pointer group hover:bg-neutral-800/40 hover:border-neutral-600 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-neutral-300 group-hover:text-indigo-400 transition-colors">{ex.name}</span>
                  <ArrowUpRight className="h-3 w-3 text-neutral-600 group-hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
                <span className="text-[12px] font-medium tabular-nums text-neutral-500">{ex.sets}</span>
              </div>
            ))}
          </div>
        </Card>
      </Card>
      )}

      <WeightTrackerCard />

      {showFuel && (
      <Card>
        <EditableSectionHeading id="tf_fuel" defaultTitle="Fuel Matrix" defaultIcon={Flame} subtitle="Meals, targets & icons" />
        <div className="mb-4 flex flex-wrap gap-2.5">
          <StatPill icon={Flame} label="Calorie Target" value={dietValues.calories} accent="amber" />
          <StatPill icon={Activity} label="Protein Target" value={dietValues.protein} accent="violet" />
          <StatPill icon={Droplets} label="Hydration" value={dietValues.hydration} accent="blue" />
        </div>

        {diet.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500 mb-3">No meals configured yet — add some in Settings → Training & Fuel.</p>
        ) : (
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${diet.length > 0 && mealsLoggedToday === diet.length ? 'text-violet-400' : 'text-neutral-500'}`} />
            <span className="text-[12.5px] text-neutral-300">
              <span className="font-semibold text-neutral-100 tabular-nums">{mealsLoggedToday}/{diet.length}</span> meals logged today
              <span className="text-neutral-600"> · syncs the "All 6 Meals Hit" box on the Daily Matrix</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {last7Days.map((d) => {
              const pct = diet.length > 0 ? d.count / diet.length : 0;
              const isToday = d.date === todayStr;
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}/${diet.length} meals logged`}
                  className={`h-5 w-5 rounded-md flex items-center justify-center text-[8.5px] font-bold ${isToday ? 'ring-1 ring-neutral-500' : ''}`}
                  style={{
                    backgroundColor: pct === 0 ? 'rgba(255,255,255,0.04)' : `rgba(52,211,153,${0.15 + pct * 0.65})`,
                    color: pct > 0.6 ? '#2e1065' : '#71717a',
                  }}
                >
                  {d.count > 0 ? d.count : ''}
                </div>
              );
            })}
          </div>
        </div>
        )}

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {diet.map((m) => {
            const isLogged = !!todayLog[m.name];
            return (
              <Card
                key={m.id}
                onClick={() => setModal({
                  title: m.name,
                  subtitle: `Scheduled Timing Window: ${m.time}`,
                  icon: m.icon,
                  arrayTitle: 'Exact Nutrient Components',
                  arrayItems: m.items,
                  cues: 'Avoid heavy hydration consumption simultaneously during solid meals to keep enzyme kinetics tracking perfectly.'
                })}
                className={isLogged ? 'border-violet-500/30 bg-violet-500/[0.03]' : ''}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300">
                      <m.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-medium text-neutral-100 leading-none">{m.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{m.time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleMeal(m.name); }}
                      title={isLogged ? 'Logged — click to undo' : 'Mark as eaten today'}
                      aria-pressed={isLogged}
                      aria-label={`${m.name}: ${isLogged ? 'logged, click to undo' : 'mark as eaten today'}`}
                      className="cursor-target p-1 rounded-md hover:bg-neutral-800 transition-colors"
                    >
                      {isLogged ? (
                        <CheckCircle2 className="h-4 w-4 text-violet-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-neutral-600" />
                      )}
                    </button>
                    <ArrowUpRight className="h-3 w-3 text-neutral-600" />
                  </div>
                </div>
                <ul className="space-y-1">
                  {m.items.map((it, itIdx) => (
                    <li key={itIdx} className="flex items-start gap-1.5 text-[12px] text-neutral-400 leading-snug">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                      {it}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </Card>
      )}

      {!showWorkout && !showFuel && (
        <p className="text-[12.5px] text-neutral-500">
          Nothing to show here yet for your current goals — add a fitness or
          diet goal in Settings to unlock this tab's sections.
        </p>
      )}
    </div>
  );
}

// ---------- Tab Subcomponent: Syllabus ----------