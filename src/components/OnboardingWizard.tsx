import React, { useEffect, useState } from 'react';
import { NO_SELECT_CSS } from '../styles/noSelect';
import {
  Sparkles, Loader2, RefreshCcw, ArrowRight, ClipboardList,
  Clock3, Dumbbell, Target, CheckCircle2, BookOpen,
} from 'lucide-react';
import {
  generateChecklist,
  generateDailyTimeline,
  generateWeeklyTraining,
  generateProfileTargets,
  generateSyllabus,
} from '../lib/contentGen';

// ---------- First-run setup ----------
// Shown once, right after a new account picks its passcode (see App.tsx —
// gated on `akyos_onboarding_completed_v1`). Nothing here is hardcoded to
// any one person's goal: everything downstream (Daily Checklist, Master
// Timeline, Training Split, Profile targets) is generated from whatever
// this specific person types into the questionnaire below, then handed to
// the existing Settings editors to refine further. If generation fails for
// a section (offline, API hiccup), we fall back to a plain generic default
// for that section only — never to someone else's real data.

type Stage = 'intro' | 'generating' | 'review';

type ChecklistItem = { id: string; label: string };
type TimelineBlock = {
  start: string; end: string; label: string; detail: string;
  type: 'study' | 'gym' | 'meal' | 'prep' | 'sleep';
  subject?: string; longDesc: string; iconName: string;
};
type TrainingDay = { day: string; focus: string; mode: 'gym' | 'calisthenics' | 'rest'; exercises: { name: string; sets: string }[] };
type ProfileTarget = { rank: number; name: string; course: string; tag: string; color: string; desc: string };
type Subject = { key: string; label: string; color: string };
type SyllabusPhase = { phase: number; month: string; label: string; subjects: Record<string, string[]> };

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fallbackChecklist(): ChecklistItem[] {
  return [
    { id: 'ob_1', label: 'Morning routine done' },
    { id: 'ob_2', label: 'Main focus block completed' },
    { id: 'ob_3', label: 'Movement / exercise' },
    { id: 'ob_4', label: 'Wind down on time' },
  ];
}

function fallbackTimeline(wake: string, sleep: string): TimelineBlock[] {
  return [
    { start: wake, end: addMinutes(wake, 30), label: 'Wake & Prep', detail: 'Ease into the day', type: 'prep', longDesc: 'A simple start — hydrate and get ready for the day ahead.', iconName: 'Sunrise' },
    { start: addMinutes(wake, 30), end: addMinutes(wake, 210), label: 'Main Focus Block', detail: 'Your top priority for the day', type: 'study', longDesc: 'Edit this in Settings to describe exactly what you\'re working on.', iconName: 'BookOpen' },
    { start: addMinutes(wake, 210), end: addMinutes(wake, 240), label: 'Meal Break', detail: '', type: 'meal', longDesc: '', iconName: 'Utensils' },
    { start: addMinutes(wake, 240), end: subMinutes(sleep, 60), label: 'Second Focus Block', detail: 'Continue working toward your goal', type: 'study', longDesc: '', iconName: 'BookOpen' },
    { start: subMinutes(sleep, 60), end: sleep, label: 'Wind Down', detail: 'Screens off, plan tomorrow', type: 'prep', longDesc: '', iconName: 'Moon' },
    { start: sleep, end: sleep, label: 'Sleep', detail: 'Hard stop.', type: 'sleep', longDesc: '', iconName: 'Moon' },
  ];
}

function fallbackTraining(wantsTraining: boolean): TrainingDay[] {
  if (!wantsTraining) {
    return DAY_NAMES.map((day) => ({ day, focus: 'Rest / Recovery', mode: 'rest', exercises: [{ name: 'Not part of your current plan', sets: '—' }] }));
  }
  return DAY_NAMES.map((day, i) => (
    i % 2 === 0
      ? { day, focus: 'Full-Body Strength', mode: 'gym', exercises: [{ name: 'Squats', sets: '3×10' }, { name: 'Push-ups', sets: '3×12' }, { name: 'Rows', sets: '3×12' }] }
      : { day, focus: 'Active Recovery', mode: 'rest', exercises: [{ name: 'Light walk or stretch', sets: '20 min' }] }
  ));
}

function fallbackTargets(goalDescription: string): { targets: ProfileTarget[]; baselineLabel: string } {
  return {
    baselineLabel: 'Baseline Score',
    targets: [
      { rank: 1, name: goalDescription.slice(0, 60) || 'Your main goal', course: '', tag: 'Top Priority', color: 'blue', desc: 'Edit this in Settings > Profile & Goals to add specifics.' },
    ],
  };
}

// When the person's goal has no "subjects to study" component at all (or
// generation fails), fall back to a single generic subject/phase built
// from their own goal text — never to someone else's syllabus (e.g. JEE's
// math/physics/chem, which is just this app's own DEFAULT_SUBJECTS/
// DEFAULT_SYLLABUS fallback in App.tsx, used only if this step is skipped
// entirely).
function fallbackSyllabus(goalDescription: string, wantsSyllabus: boolean): { subjects: Subject[]; syllabus: SyllabusPhase[] } {
  if (!wantsSyllabus) {
    return {
      subjects: [{ key: 'general', label: 'General', color: 'sky' }],
      syllabus: [{ phase: 1, month: 'This month', label: 'Getting started', subjects: { general: [] } }],
    };
  }
  return {
    subjects: [{ key: 'subject_1', label: goalDescription.slice(0, 30) || 'Main Subject', color: 'sky' }],
    syllabus: [{ phase: 1, month: 'Month 1', label: 'Getting started', subjects: { subject_1: ['Add your first topic'] } }],
  };
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + mins + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function subMinutes(time: string, mins: number): string {
  return addMinutes(time, -mins);
}

const inputCls = 'w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50';
const labelCls = 'text-[11px] uppercase tracking-wide text-neutral-500 font-semibold block mb-1.5';

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: (partial: { trackerItems: ChecklistItem[]; timeline: TimelineBlock[]; training: TrainingDay[]; profile: any; subjects: Subject[]; syllabus: SyllabusPhase[] }) => void;
}) {
  const [stage, setStage] = useState<Stage>('intro');
  const [goalDescription, setGoalDescription] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [wake, setWake] = useState('06:00');
  const [sleep, setSleep] = useState('23:00');
  const [targetDate, setTargetDate] = useState('');
  const [wantsTraining, setWantsTraining] = useState(true);
  const [wantsSyllabus, setWantsSyllabus] = useState(true);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState('');

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineBlock[]>([]);
  const [training, setTraining] = useState<TrainingDay[]>([]);
  const [targets, setTargets] = useState<{ targets: ProfileTarget[]; baselineLabel: string }>({ targets: [], baselineLabel: 'Baseline Score' });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusPhase[]>([]);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  // Tracks which sections are showing generic fallback content rather than
  // the actual AI-generated plan (generation failed, timed out, or was
  // skipped). Surfaced in the review screen so the person knows what they're
  // looking at isn't personalized yet, instead of silently passing off a
  // placeholder as the real thing.
  const [usedFallback, setUsedFallback] = useState<Record<'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus', boolean>>({
    checklist: false, timeline: false, training: false, targets: false, syllabus: false,
  });

  const loadingMessages = [
    'Reading what you told us…',
    'Building your daily checklist…',
    'Laying out your timeline…',
    'Putting together your plan…',
  ];

  useEffect(() => {
    if (stage !== 'generating') return;
    const t = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length), 1400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const context = `Wake time: ${wake}. Sleep time: ${sleep}. Name: ${name || 'not given'}.`;

  const runGeneration = async () => {
    setStage('generating');
    setError('');

    const [checklistRes, timelineRes, trainingRes, targetsRes, syllabusRes] = await Promise.all([
      generateChecklist(goalDescription, context).catch(() => null),
      generateDailyTimeline(goalDescription, context).catch(() => null),
      wantsTraining ? generateWeeklyTraining(goalDescription, context).catch(() => null) : Promise.resolve(null),
      generateProfileTargets(goalDescription).catch(() => null),
      wantsSyllabus ? generateSyllabus(goalDescription, context).catch(() => null) : Promise.resolve(null),
    ]);

    const checklistOk = !!checklistRes?.items?.length;
    const timelineOk = !!timelineRes?.blocks?.length;
    const trainingOk = !wantsTraining || !!trainingRes?.days?.length;
    const targetsOk = !!targetsRes?.targets?.length;
    const syllabusOk = !wantsSyllabus || !!(syllabusRes?.subjects?.length && syllabusRes?.phases?.length);

    setChecklist(checklistOk ? checklistRes!.items.map((it, i) => ({ id: `ob_${i}`, label: it.label })) : fallbackChecklist());
    setTimeline(timelineOk ? timelineRes!.blocks : fallbackTimeline(wake, sleep));
    setTraining(trainingOk ? (trainingRes?.days ?? fallbackTraining(wantsTraining)) : fallbackTraining(wantsTraining));
    setTargets(
      targetsOk
        ? { targets: targetsRes!.targets, baselineLabel: targetsRes!.baselineLabel || 'Baseline Score' }
        : fallbackTargets(goalDescription)
    );
    if (syllabusOk && syllabusRes?.subjects?.length && syllabusRes?.phases?.length) {
      setSubjects(syllabusRes.subjects);
      setSyllabus(syllabusRes.phases);
    } else {
      const fb = fallbackSyllabus(goalDescription, wantsSyllabus);
      setSubjects(fb.subjects);
      setSyllabus(fb.syllabus);
    }

    setUsedFallback({
      checklist: !checklistOk,
      timeline: !timelineOk,
      training: !trainingOk,
      targets: !targetsOk,
      syllabus: !syllabusOk,
    });

    setStage('review');
  };

  const regenerate = async (section: 'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus') => {
    setRegenerating(section);
    try {
      if (section === 'checklist') {
        const res = await generateChecklist(goalDescription, context).catch(() => null);
        const ok = !!res?.items?.length;
        setChecklist(ok ? res!.items.map((it, i) => ({ id: `ob_${i}`, label: it.label })) : fallbackChecklist());
        setUsedFallback((f) => ({ ...f, checklist: !ok }));
      } else if (section === 'timeline') {
        const res = await generateDailyTimeline(goalDescription, context).catch(() => null);
        const ok = !!res?.blocks?.length;
        setTimeline(ok ? res!.blocks : fallbackTimeline(wake, sleep));
        setUsedFallback((f) => ({ ...f, timeline: !ok }));
      } else if (section === 'training') {
        const res = wantsTraining ? await generateWeeklyTraining(goalDescription, context).catch(() => null) : null;
        const ok = !!res?.days?.length;
        setTraining(ok ? res!.days : fallbackTraining(wantsTraining));
        setUsedFallback((f) => ({ ...f, training: !ok }));
      } else if (section === 'syllabus') {
        const res = wantsSyllabus ? await generateSyllabus(goalDescription, context).catch(() => null) : null;
        const ok = !!(res?.subjects?.length && res?.phases?.length);
        if (ok) {
          setSubjects(res!.subjects);
          setSyllabus(res!.phases);
        } else {
          const fb = fallbackSyllabus(goalDescription, wantsSyllabus);
          setSubjects(fb.subjects);
          setSyllabus(fb.syllabus);
        }
        setUsedFallback((f) => ({ ...f, syllabus: !ok }));
      } else {
        const res = await generateProfileTargets(goalDescription).catch(() => null);
        const ok = !!res?.targets?.length;
        setTargets(ok ? { targets: res!.targets, baselineLabel: res!.baselineLabel || 'Baseline Score' } : fallbackTargets(goalDescription));
        setUsedFallback((f) => ({ ...f, targets: !ok }));
      }
    } finally {
      setRegenerating(null);
    }
  };

  const finish = () => {
    onComplete({
      trackerItems: checklist,
      timeline,
      training,
      profile: {
        name: name || 'Your Name',
        goalLabel: goalDescription.slice(0, 60) || 'Add your goal',
        age: Number(age) || 18,
        height: 170,
        weight: 65,
        category: '',
        baseline: 0,
        baselineLabel: targets.baselineLabel,
        boards: 0,
        targetDate: targetDate || '',
        targets: targets.targets,
      },
      subjects,
      syllabus,
    });
  };

  const skip = () => {
    const fb = fallbackSyllabus(goalDescription, true);
    onComplete({
      trackerItems: fallbackChecklist(),
      timeline: fallbackTimeline(wake, sleep),
      training: fallbackTraining(true),
      profile: { name: name || 'Your Name', goalLabel: 'Add your goal' } as any,
      subjects: fb.subjects,
      syllabus: fb.syllabus,
    });
  };

  // ---------------- Intro ----------------
  if (stage === 'intro') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 py-10 overflow-y-auto">
        <style>{NO_SELECT_CSS}</style>
        <div className="w-full max-w-md">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>
          <h1 className="mb-1.5 text-[17px] font-semibold tracking-tight text-neutral-50">Let's set up Akyos for you</h1>
          <p className="mb-6 text-[12.5px] leading-relaxed text-neutral-500">
            Nothing here is a template built for someone else. Tell us what you're working toward and we'll build your checklist, schedule, and training plan around it — you can edit any of it afterward.
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>What are you working toward right now?</label>
              <textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="e.g. Preparing for UPSC prelims 2027, or getting my daily routine and fitness back on track"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Age</label>
                <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Optional" inputMode="numeric" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Wake time</label>
                <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sleep time</label>
                <input type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Target date (optional)</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} />
              <p className="mt-1 text-[11px] text-neutral-600">Powers the countdown widget on your Overview tab. Skip if your goal isn't date-bound.</p>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={wantsTraining} onChange={(e) => setWantsTraining(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              <span className="text-[12.5px] text-neutral-300">Include a weekly training / workout plan</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={wantsSyllabus} onChange={(e) => setWantsSyllabus(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              <span className="text-[12.5px] text-neutral-300">Include a subject / syllabus roadmap</span>
            </label>

            {error && <p className="text-[12px] text-rose-400">{error}</p>}

            <button
              onClick={() => (goalDescription.trim() ? runGeneration() : setError('Tell us a bit about your goal first — even a rough sentence is enough.'))}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity hover:opacity-90"
            >
              Generate my setup <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={skip} className="w-full text-center text-[12px] font-medium text-neutral-600 hover:text-neutral-400">
              Skip — I'll set everything up myself
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Generating ----------------
  if (stage === 'generating') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 gap-4">
        <style>{NO_SELECT_CSS}</style>
        <Loader2 className="h-7 w-7 text-violet-400 animate-spin" strokeWidth={2} />
        <p className="text-[13px] text-neutral-400">{loadingMessages[loadingMsgIdx]}</p>
      </div>
    );
  }

  // ---------------- Review ----------------
  const sectionCard = (
    icon: any,
    title: string,
    subtitle: string,
    key: 'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus',
    children: React.ReactNode
  ) => {
    const Icon = icon;
    const isFallback = usedFallback[key];
    return (
      <div className={`rounded-2xl border p-4 sm:p-5 ${isFallback ? 'border-amber-700/40 bg-amber-950/10' : 'border-neutral-800 bg-neutral-950/60'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 text-violet-400" strokeWidth={2} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-neutral-100">{title}</h3>
                {isFallback && (
                  <span
                    className="rounded-full border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-400"
                    title="AI generation didn't come through for this section, so this is generic placeholder content, not something built for your goal. Edit it directly or hit Regenerate to try again."
                  >
                    Generic — not generated
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-neutral-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => regenerate(key)}
            disabled={regenerating === key}
            aria-label={`Regenerate ${title}`}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`h-3 w-3 ${regenerating === key ? 'animate-spin' : ''}`} /> Regenerate
          </button>
        </div>
        {isFallback && (
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-amber-500/80">
            This section couldn't be generated from your goal, so it's showing generic placeholder content instead. Edit it in Settings after finishing, or try Regenerate now.
          </p>
        )}
        {children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center bg-zinc-950 px-6 py-10 overflow-y-auto">
      <style>{NO_SELECT_CSS}</style>
      <div className="w-full max-w-lg">
        <h1 className="mb-1.5 text-[17px] font-semibold tracking-tight text-neutral-50">Here's what we built</h1>
        <p className="mb-4 text-[12.5px] leading-relaxed text-neutral-500">
          Not quite right? Regenerate any section, or just continue — everything below stays fully editable in Settings afterward.
        </p>

        {Object.values(usedFallback).some(Boolean) && (
          <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/10 px-4 py-2.5 text-[12px] leading-relaxed text-amber-400/90">
            One or more sections below (marked "Generic — not generated") couldn't be built from your goal and are showing generic placeholder content instead of a real plan. Regenerate them, or edit directly in Settings once you're in.
          </div>
        )}

        <div className="space-y-3">
          {sectionCard(ClipboardList, 'Daily Checklist', `${checklist.length} objectives`, 'checklist', (
            <ul className="space-y-1.5">
              {checklist.slice(0, 6).map((it) => (
                <li key={it.id} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400/60 shrink-0" /> {it.label}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Clock3, 'Daily Timeline', `${timeline.length} blocks, ${wake}–${sleep}`, 'timeline', (
            <ul className="space-y-1.5">
              {timeline.slice(0, 6).map((b, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="text-neutral-600 tabular-nums text-[11px] w-[92px] shrink-0">{b.start}–{b.end}</span> {b.label}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Dumbbell, 'Training Split', wantsTraining ? `${training.length} days planned` : 'Not included', 'training', (
            <ul className="space-y-1.5">
              {training.slice(0, 7).map((d, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="text-neutral-600 text-[11px] w-[70px] shrink-0">{d.day.slice(0, 3)}</span> {d.focus}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Target, 'Goal Targets', `${targets.targets.length} target${targets.targets.length === 1 ? '' : 's'}`, 'targets', (
            <ul className="space-y-1.5">
              {targets.targets.map((t, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300">
                  <span className="font-semibold text-neutral-200">{t.name}</span>{t.course ? ` — ${t.course}` : ''}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(BookOpen, 'Syllabus Roadmap', wantsSyllabus ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'}, ${syllabus.length} phase${syllabus.length === 1 ? '' : 's'}` : 'Not included', 'syllabus', (
            <ul className="space-y-1.5">
              {subjects.map((s) => (
                <li key={s.key} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-violet-400/60 shrink-0" /> {s.label}
                </li>
              ))}
            </ul>
          ))}
        </div>

        <button
          onClick={finish}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity hover:opacity-90"
        >
          Looks good — Enter Akyos <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={() => setStage('intro')} className="mt-3 w-full text-center text-[12px] font-medium text-neutral-600 hover:text-neutral-400">
          Start over
        </button>
      </div>
    </div>
  );
}