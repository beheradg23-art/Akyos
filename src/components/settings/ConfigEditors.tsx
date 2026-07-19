// Settings tab: every "editable config" form — daily checklist items,
// timeline, training, diet, profile & goals, countdowns, overview summary
// overrides, subjects & syllabus, tab labels/icons, and section labels —
// plus the accordion shell (ConfigEditorTab) that hosts them all.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutGrid, Clock3, Dumbbell, BookOpen, Sparkles, Target, GraduationCap,
  Weight, Droplets, Moon, Sun, Utensils, Flame, ChevronRight, ChevronDown,
  Activity, ClipboardList, Trash2, Plus, Settings, Save, PenLine, RefreshCcw,
  Check, Heart, Droplet, Leaf, Waves,
} from 'lucide-react';
import { ThemeMode, THEME_OPTIONS, useTheme } from '../../lib/theme';
import {
  ConfigContext, CountdownItem, DietMeal, DietOverrideKey, OverviewOverrideKey,
  TabLabelKey, DEFAULT_TAB_LABELS, MAX_DIET_MEALS, ICON_LIBRARY, ICON_LIBRARY_KEYS,
  ICON_OPTIONS, ICON_OPTION_KEYS, COUNTDOWN_COLOR_PALETTE, COUNTDOWN_COLOR_NAMES,
  TAB_LABEL_KEYS, SECTION_LABEL_ROWS, makeBlankCountdown, makeBlankDietMeal,
  computeDietAutoValues, resolveDietValues, computeOverviewAutoValues, calculateAge,
  SUBJECT_COLOR_PALETTE,
} from '../../lib/appConfig';
import { Card, SectionHeading, RippleButton, DateField, TimeField } from '../ui/Primitives';
import { generateProfileTargets } from '../../lib/contentGen';

export const btnGhost = 'cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors';
export const btnSave = (dirty: boolean) => `cursor-target flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${dirty ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15' : 'border-neutral-800 bg-neutral-900 text-neutral-600'}`;
export const fieldInput = 'w-full rounded-lg border border-neutral-800 bg-neutral-950/50 px-2.5 py-1.5 text-[12px] text-neutral-200 focus:outline-none focus:border-neutral-600';
export const fieldLabel = 'text-[10px] uppercase tracking-wide text-neutral-600 font-semibold block mb-1';

export function TrackerItemsEditor() {
  const { trackerItems, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [items, setItems] = useState(trackerItems);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(trackerItems); setDirty(false); }, [trackerItems]);

  const updateLabel = (id: string, label: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, label } : it)));
    setDirty(true);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setDirty(true);
  };
  const addItem = () => {
    setItems((prev) => [...prev, { id: `custom_${Date.now()}`, label: 'New Objective' }]);
    setDirty(true);
  };
  const save = () => {
    if (!items.length) return;
    updateConfig({ trackerItems: items });
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={ClipboardList} title="Daily Checklist Items" subtitle="The objectives that make up the Daily Matrix sidebar" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('trackerItems'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input value={item.label} onChange={(e) => updateLabel(item.id, e.target.value)} className={`flex-1 ${fieldInput}`} />
            {item.id === 't6' && <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-600">Auto-synced</span>}
            <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.label || 'objective'}`} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <RippleButton onClick={addItem} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Objective
      </RippleButton>
      <p className="mt-3 text-[11px] text-neutral-600 leading-relaxed">
        "All 6 Meals Hit" stays wired to the Fuel Matrix meal log as long as it keeps its id — renaming its label is fine, but deleting it breaks that auto-sync.
      </p>
    </Card>
  );
}

export function TimelineEditor() {
  const { timeline, subjects, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [items, setItems] = useState(timeline);
  const [dirty, setDirty] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => { setItems(timeline); setDirty(false); }, [timeline]);

  const patch = (i: number, patchObj: Record<string, any>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patchObj } : it)));
    setDirty(true);
  };
  const removeBlock = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const addBlock = () => {
    setItems((prev) => {
      setOpenIdx(prev.length);
      return [...prev, { start: '12:00', end: '12:30', label: 'New Block', detail: '', type: 'prep', subject: undefined, longDesc: '', iconName: 'BookOpen', icon: BookOpen }];
    });
    setDirty(true);
  };
  const save = () => {
    if (!items.length) return;
    updateConfig({ timeline: items.map((it) => ({ ...it, icon: ICON_LIBRARY[it.iconName] || BookOpen })) });
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={Clock3} title="Master Timeline Blocks" subtitle="The time-boxed slots that make up the day's schedule" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('timeline'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((slot, i) => {
          const Icon = ICON_LIBRARY[slot.iconName] || BookOpen;
          const isOpen = openIdx === i;
          return (
            <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
              <button onClick={() => setOpenIdx(isOpen ? null : i)} aria-expanded={isOpen} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
                <Icon className="h-4 w-4 text-neutral-500 shrink-0" strokeWidth={1.75} />
                <span className="text-[11.5px] text-neutral-500 tabular-nums shrink-0 w-[92px]">{slot.start}–{slot.end}</span>
                <span className="text-[12.5px] text-neutral-200 flex-1 truncate">{slot.label}</span>
                <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-neutral-800/60">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={fieldLabel}>Start</label>
                      <TimeField value={slot.start} onChange={(e) => patch(i, { start: e.target.value })} className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>End</label>
                      <TimeField value={slot.end} onChange={(e) => patch(i, { end: e.target.value })} className={fieldInput} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Label</label>
                    <input value={slot.label} onChange={(e) => patch(i, { label: e.target.value })} className={fieldInput} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Detail</label>
                    <input value={slot.detail} onChange={(e) => patch(i, { detail: e.target.value })} className={fieldInput} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Long Description</label>
                    <textarea value={slot.longDesc} onChange={(e) => patch(i, { longDesc: e.target.value })} rows={2} className={`${fieldInput} resize-none`} />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className={fieldLabel}>Type</label>
                      <select value={slot.type} onChange={(e) => patch(i, { type: e.target.value })} className={fieldInput}>
                        {['study', 'gym', 'meal', 'prep', 'sleep'].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={fieldLabel}>Subject</label>
                      <select value={slot.subject || ''} onChange={(e) => patch(i, { subject: e.target.value || undefined })} className={fieldInput}>
                        <option value="">—</option>
                        {subjects.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={fieldLabel}>Icon</label>
                      <select value={slot.iconName} onChange={(e) => patch(i, { iconName: e.target.value })} className={fieldInput}>
                        {ICON_LIBRARY_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => removeBlock(i)} className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-rose-400/80 hover:text-rose-300 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove block
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RippleButton onClick={addBlock} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Block
      </RippleButton>
    </Card>
  );
}

export function TrainingEditor() {
  const { training, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [days, setDays] = useState(training);
  const [dirty, setDirty] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => { setDays(training); setDirty(false); }, [training]);

  const patchDay = (i: number, patchObj: Record<string, any>) => {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patchObj } : d)));
    setDirty(true);
  };
  const removeDay = (i: number) => {
    setDays((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const addDay = () => {
    setDays((prev) => {
      setOpenIdx(prev.length);
      return [...prev, { day: 'New Day', focus: '', exercises: [], mode: 'gym' }];
    });
    setDirty(true);
  };
  const patchExercise = (dayIdx: number, exIdx: number, patchObj: Record<string, any>) => {
    setDays((prev) => prev.map((d, idx) => (idx !== dayIdx ? d : { ...d, exercises: d.exercises.map((ex: any, ei: number) => (ei === exIdx ? { ...ex, ...patchObj } : ex)) })));
    setDirty(true);
  };
  const removeExercise = (dayIdx: number, exIdx: number) => {
    setDays((prev) => prev.map((d, idx) => (idx !== dayIdx ? d : { ...d, exercises: d.exercises.filter((_: any, ei: number) => ei !== exIdx) })));
    setDirty(true);
  };
  const addExercise = (dayIdx: number) => {
    setDays((prev) => prev.map((d, idx) => (idx !== dayIdx ? d : { ...d, exercises: [...d.exercises, { name: 'New Exercise', sets: '3×10' }] })));
    setDirty(true);
  };
  const save = () => {
    if (!days.length) return;
    updateConfig({ training: days });
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={Dumbbell} title="Training Split" subtitle="Gym / calisthenics days and their exercises" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('training'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>
      <div className="space-y-2">
        {days.map((d, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
              <button onClick={() => setOpenIdx(isOpen ? null : i)} aria-expanded={isOpen} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
                <span className="text-[12.5px] font-medium text-neutral-200 flex-1 truncate">{d.day} — {d.focus}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-600 shrink-0">{d.exercises.length} ex.</span>
                <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-neutral-800/60">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={fieldLabel}>Day Label</label>
                      <input value={d.day} onChange={(e) => patchDay(i, { day: e.target.value })} className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Mode</label>
                      <select value={d.mode} onChange={(e) => patchDay(i, { mode: e.target.value })} className={fieldInput}>
                        {['gym', 'calisthenics', 'rest'].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Focus</label>
                    <input value={d.focus} onChange={(e) => patchDay(i, { focus: e.target.value })} className={fieldInput} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={fieldLabel}>Exercises</label>
                    {d.exercises.map((ex: any, ei: number) => (
                      <div key={ei} className="flex items-center gap-2">
                        <input value={ex.name} onChange={(e) => patchExercise(i, ei, { name: e.target.value })} className={`flex-1 ${fieldInput}`} placeholder="Exercise name" />
                        <input value={ex.sets} onChange={(e) => patchExercise(i, ei, { sets: e.target.value })} className={`w-24 shrink-0 ${fieldInput}`} placeholder="Sets" />
                        <button onClick={() => removeExercise(i, ei)} aria-label={`Remove exercise ${ex.name || ei + 1}`} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addExercise(i)} className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add exercise
                    </button>
                  </div>
                  <button onClick={() => removeDay(i)} className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-rose-400/80 hover:text-rose-300 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove day
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RippleButton onClick={addDay} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Day
      </RippleButton>
    </Card>
  );
}

// Rows for the Calorie/Protein/Hydration targets — same AUTO/CUSTOM
// convention as OVERVIEW_OVERRIDE_ROWS above, just scoped to the Fuel
// Matrix itself instead of the Dashboard Overview.
export const DIET_OVERRIDE_ROWS: { key: DietOverrideKey; label: string; icon: any; hint: string }[] = [
  { key: 'calories', label: 'Calorie Target', icon: Flame, hint: 'Auto-estimated from the meals below' },
  { key: 'protein', label: 'Protein Target', icon: Activity, hint: 'Auto-estimated from the meals below' },
  { key: 'hydration', label: 'Hydration', icon: Droplets, hint: 'Auto-estimated from bodyweight + the meals below' },
];

// Fully editable Fuel Matrix: every meal (time, name, icon, food items) plus
// the Calorie/Protein/Hydration targets those meals imply. Capped at
// MAX_DIET_MEALS so "All 6 Meals Hit" on the Daily Matrix stays meaningful,
// and a brand-new account already has six sensible defaults to tweak
// instead of a blank page.
export function DietEditor() {
  const { diet, dietOverrides, profile, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [meals, setMeals] = useState<DietMeal[]>(diet);
  const [overrideDraft, setOverrideDraft] = useState<Record<DietOverrideKey, string>>(dietOverrides);
  const [dirty, setDirty] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => { setMeals(diet); setOverrideDraft(dietOverrides); setDirty(false); }, [diet, dietOverrides]);

  // Live preview — recalculates as the meals are edited, before Save is
  // even pressed, so someone can see the estimate move as they type.
  const autoPreview = useMemo(() => computeDietAutoValues(meals, profile.weight), [meals, profile.weight]);

  const patchMeal = (i: number, patchObj: Partial<DietMeal>) => {
    setMeals((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patchObj } : m)));
    setDirty(true);
  };
  const removeMeal = (i: number) => {
    setMeals((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const addMeal = () => {
    if (meals.length >= MAX_DIET_MEALS) return;
    setMeals((prev) => {
      setOpenIdx(prev.length);
      return [...prev, { ...makeBlankDietMeal(), icon: Utensils }];
    });
    setDirty(true);
  };
  const patchItem = (mealIdx: number, itemIdx: number, value: string) => {
    setMeals((prev) => prev.map((m, idx) => (idx !== mealIdx ? m : { ...m, items: m.items.map((it, ii) => (ii === itemIdx ? value : it)) })));
    setDirty(true);
  };
  const removeItem = (mealIdx: number, itemIdx: number) => {
    setMeals((prev) => prev.map((m, idx) => (idx !== mealIdx ? m : { ...m, items: m.items.filter((_, ii) => ii !== itemIdx) })));
    setDirty(true);
  };
  const addItem = (mealIdx: number) => {
    setMeals((prev) => prev.map((m, idx) => (idx !== mealIdx ? m : { ...m, items: [...m.items, ''] })));
    setDirty(true);
  };

  const setOverrideRow = (key: DietOverrideKey, value: string) => {
    setOverrideDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const useAutoRow = (key: DietOverrideKey) => {
    setOverrideDraft((prev) => ({ ...prev, [key]: '' }));
    setDirty(true);
  };
  const useCustomRow = (key: DietOverrideKey) => {
    setOverrideDraft((prev) => ({ ...prev, [key]: prev[key] || autoPreview[key] }));
    setDirty(true);
  };

  const save = () => {
    if (!meals.length) return;
    updateConfig({
      diet: meals.map((m) => ({ ...m, items: m.items.filter((it) => it.trim() !== '') })),
      dietOverrides: overrideDraft,
    });
    setDirty(false);
  };
  const resetAll = () => {
    resetConfigSection('diet');
    resetConfigSection('dietOverrides');
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={Utensils} title="Training & Fuel — Meals" subtitle={`Up to ${MAX_DIET_MEALS} meals · rename, retime, re-icon, or rewrite the food in each one`} />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={resetAll} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>

      {meals.length === 0 && (
        <p className="text-[12.5px] text-neutral-500 mb-3">No meals yet — add one below.</p>
      )}

      <div className="space-y-2">
        {meals.map((m, i) => {
          const isOpen = openIdx === i;
          const Icon = ICON_LIBRARY[m.iconName] || Utensils;
          return (
            <div key={m.id} className="rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
              <button onClick={() => setOpenIdx(isOpen ? null : i)} aria-expanded={isOpen} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-300">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <span className="text-[12.5px] font-medium text-neutral-200 flex-1 truncate">{m.name || 'Untitled meal'}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-600 shrink-0">{m.items.length} item{m.items.length === 1 ? '' : 's'}</span>
                <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-neutral-800/60">
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className={fieldLabel}>Meal Name</label>
                      <input value={m.name} onChange={(e) => patchMeal(i, { name: e.target.value })} placeholder="e.g. Breakfast" className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Time</label>
                      <input value={m.time} onChange={(e) => patchMeal(i, { time: e.target.value })} placeholder="e.g. 08:30 AM" className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Icon</label>
                      <select value={m.iconName} onChange={(e) => patchMeal(i, { iconName: e.target.value, icon: ICON_LIBRARY[e.target.value] || Utensils })} className={fieldInput}>
                        {ICON_LIBRARY_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={fieldLabel}>Food Items</label>
                    {m.items.map((it, itIdx) => (
                      <div key={itIdx} className="flex items-center gap-2">
                        <input value={it} onChange={(e) => patchItem(i, itIdx, e.target.value)} className={`flex-1 ${fieldInput}`} placeholder="e.g. 200g grilled chicken breast" />
                        <button onClick={() => removeItem(i, itIdx)} aria-label={`Remove food item ${it || itIdx + 1}`} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addItem(i)} className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add food item
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Quantities like <span className="text-neutral-500 font-medium">200g</span>, <span className="text-neutral-500 font-medium">2 rotis</span>, or <span className="text-neutral-500 font-medium">250ml milk</span> feed the calorie/protein/hydration auto-estimate below — anything unrecognised just won't add to it.
                  </p>
                  <button onClick={() => removeMeal(i)} className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-rose-400/80 hover:text-rose-300 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove meal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {meals.length >= MAX_DIET_MEALS ? (
        <p className="mt-3 text-[11.5px] text-neutral-600">Maximum of {MAX_DIET_MEALS} meals — remove one to add another.</p>
      ) : (
        <RippleButton onClick={addMeal} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Meal ({meals.length}/{MAX_DIET_MEALS})
        </RippleButton>
      )}

      <div className="mt-6 pt-5 border-t border-neutral-800/60">
        <div className="mb-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-600 font-semibold">Calorie / Protein / Hydration Targets</span>
          <p className="text-[11.5px] text-neutral-600 mt-1">Auto-estimated from the meals above using their bodyweight — override any row with your own number if you'd rather track it yourself.</p>
        </div>
        <div className="space-y-2.5">
          {DIET_OVERRIDE_ROWS.map((row) => {
            const isCustom = !!overrideDraft[row.key];
            return (
              <div key={row.key} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <row.icon className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.75} />
                    <span className="text-[12.5px] font-medium text-neutral-300 truncate">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 p-0.5 shrink-0">
                    <button
                      onClick={() => useAutoRow(row.key)}
                      className={`cursor-target rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition-colors ${
                        !isCustom ? 'bg-violet-500 text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      AUTO
                    </button>
                    <button
                      onClick={() => useCustomRow(row.key)}
                      className={`cursor-target rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition-colors ${
                        isCustom ? 'bg-violet-500 text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      CUSTOM
                    </button>
                  </div>
                </div>
                {isCustom ? (
                  <input value={overrideDraft[row.key]} onChange={(e) => setOverrideRow(row.key, e.target.value)} placeholder={autoPreview[row.key]} className={fieldInput} />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-neutral-500 italic">{row.hint}</span>
                    <span className="text-[12px] text-neutral-400 font-medium shrink-0">{autoPreview[row.key]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function ProfileEditor() {
  const { profile, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [draft, setDraft] = useState(profile);
  const [dirty, setDirty] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  useEffect(() => { setDraft(profile); setDirty(false); }, [profile]);

  const patch = (patchObj: Record<string, any>) => {
    setDraft((prev) => ({ ...prev, ...patchObj }));
    setDirty(true);
  };
  const patchTarget = (i: number, patchObj: Record<string, any>) => {
    setDraft((prev) => ({
      ...prev,
      targets: prev.targets.map((t: any, idx: number) => (idx === i ? { ...t, ...patchObj } : t)),
    }));
    setDirty(true);
  };
  const removeTarget = (i: number) => {
    setDraft((prev) => ({ ...prev, targets: prev.targets.filter((_: any, idx: number) => idx !== i) }));
    setDirty(true);
  };
  const addTarget = () => {
    setDraft((prev) => ({
      ...prev,
      targets: [...prev.targets, { rank: prev.targets.length + 1, name: 'New Target', course: '', tag: 'Target', color: 'blue', desc: '' }],
    }));
    setDirty(true);
  };
  const save = () => {
    updateConfig({ profile: draft });
    setDirty(false);
  };

  // This is the "hidden" content-generation hook for profile setup: type a
  // goal in plain English (e.g. "NEET 2027, aiming for a government
  // medical college") and the app quietly asks the backend for a realistic
  // starter list of targets instead of leaving three empty rows for the
  // user to fill in by hand. Nothing about this button says "AI" — from
  // the user's side it just looks like the app being helpful.
  const handleSuggestTargets = async () => {
    if (!draft.goalLabel.trim()) {
      setSuggestError('Enter your goal above first (e.g. "NEET 2027" or "UPSC CSE").');
      return;
    }
    setSuggesting(true);
    setSuggestError('');
    try {
      const result = await generateProfileTargets(draft.goalLabel);
      if (result?.targets?.length) {
        setDraft((prev) => ({
          ...prev,
          targets: result.targets,
          baselineLabel: result.baselineLabel || prev.baselineLabel,
        }));
        setDirty(true);
      } else {
        setSuggestError("Couldn't generate suggestions — fill targets in manually, or try again.");
      }
    } catch {
      setSuggestError("Couldn't generate suggestions — fill targets in manually, or try again.");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={GraduationCap} title="Profile & Goals" subtitle="Your identity, exam/goal, and priority targets — this is what makes the app yours" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('profile'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
        <div>
          <label className={fieldLabel}>Name</label>
          <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Goal / Exam</label>
          <input value={draft.goalLabel} onChange={(e) => patch({ goalLabel: e.target.value })} placeholder="e.g. NEET 2027, UPSC CSE, CAT 2026" className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Birthdate</label>
          <DateField value={draft.birthdate || ''} onChange={(e) => patch({ birthdate: e.target.value })} className={fieldInput} />
          {draft.birthdate ? (
            <p className="mt-1 text-[11px] text-neutral-500">
              {calculateAge(draft.birthdate) !== null ? `${calculateAge(draft.birthdate)} years old — updates automatically` : 'Enter a valid date'}
            </p>
          ) : null}
        </div>
        <div>
          <label className={fieldLabel}>Category</label>
          <input value={draft.category} onChange={(e) => patch({ category: e.target.value })} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Height (cm)</label>
          <input type="number" value={draft.height} onChange={(e) => patch({ height: +e.target.value })} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Weight (kg)</label>
          <input type="number" value={draft.weight} onChange={(e) => patch({ weight: +e.target.value })} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Baseline Label</label>
          <input value={draft.baselineLabel} onChange={(e) => patch({ baselineLabel: e.target.value })} placeholder="e.g. JEE Main Percentile" className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Baseline Score</label>
          <input type="number" value={draft.baseline} onChange={(e) => patch({ baseline: +e.target.value })} className={fieldInput} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] uppercase tracking-wide text-neutral-600 font-semibold">Priority Targets</span>
        <RippleButton onClick={handleSuggestTargets} disabled={suggesting} className={btnGhost}>
          <Sparkles className="h-3.5 w-3.5" /> {suggesting ? 'Thinking…' : 'Suggest targets for me'}
        </RippleButton>
      </div>
      {suggestError && <p className="text-[11.5px] text-rose-400 mb-2.5">{suggestError}</p>}

      <div className="space-y-2">
        {draft.targets.map((t: any, i: number) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={t.name} onChange={(e) => patchTarget(i, { name: e.target.value })} placeholder="Institution / outcome" className={fieldInput} />
              <input value={t.course} onChange={(e) => patchTarget(i, { course: e.target.value })} placeholder="Course / program" className={fieldInput} />
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input value={t.tag} onChange={(e) => patchTarget(i, { tag: e.target.value })} placeholder="Priority tag" className={fieldInput} />
              <select value={t.color} onChange={(e) => patchTarget(i, { color: e.target.value })} className={fieldInput}>
                <option value="blue">Blue</option>
                <option value="amber">Amber</option>
                <option value="emerald">Emerald</option>
              </select>
              <button onClick={() => removeTarget(i)} aria-label={`Remove target ${t.course || i + 1}`} className="cursor-target flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea value={t.desc} onChange={(e) => patchTarget(i, { desc: e.target.value })} placeholder="Short description with a concrete benchmark" rows={2} className={`${fieldInput} resize-none`} />
          </div>
        ))}
      </div>
      <RippleButton onClick={addTarget} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Target
      </RippleButton>
    </Card>
  );
}

// Standalone Countdown config — deliberately separate from ProfileEditor /
// Priority Targets above. A person can point this at any date+time they
// care about (e.g. the actual JEE Main exam date) without it needing to be
// one of their formal targets.
export function CountdownEditor() {
  const { countdowns, tabLabels, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [draft, setDraft] = useState<CountdownItem[]>(countdowns);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(countdowns); setDirty(false); }, [countdowns]);

  const patchItem = (id: string, patchObj: Partial<CountdownItem>) => {
    setDraft((prev) => prev.map((cd) => (cd.id === id ? { ...cd, ...patchObj } : cd)));
    setDirty(true);
  };
  const removeItem = (id: string) => {
    setDraft((prev) => prev.filter((cd) => cd.id !== id));
    setDirty(true);
  };
  const addItem = () => {
    setDraft((prev) => [...prev, makeBlankCountdown(prev.length)]);
    setDirty(true);
  };
  const save = () => {
    // Stamp a fresh start point for any item whose target date/time is new
    // or changed since the last save — that's what each countdown's own
    // depleting progress bar measures from. Editing just the label, or
    // leaving an existing date untouched, doesn't reset its bar.
    const savedById = new Map(countdowns.map((cd) => [cd.id, cd]));
    const next = draft.map((cd) => {
      const prevSaved = savedById.get(cd.id);
      const targetChanged = !prevSaved || prevSaved.targetDate !== cd.targetDate || prevSaved.targetTime !== cd.targetTime;
      return {
        ...cd,
        startMs: cd.targetDate ? (targetChanged || !cd.startMs ? Date.now() : cd.startMs) : null,
      };
    });
    updateConfig({ countdowns: next });
    setDraft(next);
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={Clock3} title="Countdown" subtitle={`Personal countdowns for the ${tabLabels.overview} tab — independent of your Priority Targets. Add as many as you like.`} />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('countdowns'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>

      <p className="text-[11.5px] text-neutral-600 mb-3">
        Each one shows on the {tabLabels.overview} tab as <span className="text-neutral-400 font-medium">DD:HH:MM</span> while more than a day remains, switching to a live <span className="text-neutral-400 font-medium">HH:MM:SS</span> once under 24 hours are left.
      </p>

      {draft.length === 0 && (
        <p className="text-[12.5px] text-neutral-500 mb-3">No countdowns yet — add one below.</p>
      )}

      <div className="space-y-2.5">
        {draft.map((cd) => (
          <div key={cd.id} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
            <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-start">
              <input value={cd.label} onChange={(e) => patchItem(cd.id, { label: e.target.value })} placeholder="e.g. JEE Main, Boards Exam, Interview Day" className={fieldInput} />
              <button onClick={() => removeItem(cd.id)} aria-label={`Remove countdown ${cd.label || ''}`} className="cursor-target flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className={fieldLabel}>Target Date</label>
                <DateField value={cd.targetDate || ''} onChange={(e) => patchItem(cd.id, { targetDate: e.target.value })} className={fieldInput} />
              </div>
              <div>
                <label className={fieldLabel}>Target Time</label>
                <TimeField value={cd.targetTime || '00:00'} onChange={(e) => patchItem(cd.id, { targetTime: e.target.value })} className={fieldInput} />
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Color</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COUNTDOWN_COLOR_NAMES.map((name) => {
                  const swatch = COUNTDOWN_COLOR_PALETTE[name];
                  const active = (cd.color || 'sky') === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={`${name}${active ? ' (selected)' : ''}`}
                      aria-pressed={active}
                      onClick={() => patchItem(cd.id, { color: name })}
                      className={`cursor-target h-6 w-6 rounded-full ${swatch.dot} transition-all ${
                        active ? 'ring-2 ring-offset-2 ring-offset-neutral-950 ring-neutral-200 scale-105' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <RippleButton onClick={addItem} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Countdown
      </RippleButton>
    </Card>
  );
}

export const SUBJECT_COLOR_NAMES = Object.keys(SUBJECT_COLOR_PALETTE);

// Each row is auto-computed from Timeline/Fuel Matrix by default (see
// computeOverviewAutoValues) — this editor just lets someone override any
// single row with their own text, or flip it back to "Auto" any time.
export const OVERVIEW_OVERRIDE_ROWS: { key: OverviewOverrideKey; label: string; icon: any; hint: string }[] = [
  { key: 'studySessions', label: 'Study Sessions', icon: BookOpen, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'training', label: 'Gym / Training', icon: Dumbbell, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'meals', label: 'Meals', icon: Utensils, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'sleep', label: 'Sleep Lock', icon: Moon, hint: 'Auto-read from your Sleep block in Settings → Timeline' },
  { key: 'calories', label: 'Calories', icon: Flame, hint: 'From your Fuel Matrix target' },
  { key: 'protein', label: 'Protein', icon: Activity, hint: 'From your Fuel Matrix target' },
  { key: 'hydration', label: 'Hydration', icon: Droplets, hint: 'From your Fuel Matrix target' },
];

export function OverviewSummaryEditor() {
  const { timeline, overviewOverrides, diet, dietOverrides, profile, tabLabels, sectionLabels, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [draft, setDraft] = useState<Record<OverviewOverrideKey, string>>(overviewOverrides);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(overviewOverrides); setDirty(false); }, [overviewOverrides]);

  const { resolved: dietValues } = useMemo(() => resolveDietValues(diet, dietOverrides, profile.weight), [diet, dietOverrides, profile.weight]);
  const auto = useMemo(() => computeOverviewAutoValues(timeline, dietValues), [timeline, dietValues]);

  const setRow = (key: OverviewOverrideKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const useAuto = (key: OverviewOverrideKey) => {
    setDraft((prev) => ({ ...prev, [key]: '' }));
    setDirty(true);
  };
  const useCustom = (key: OverviewOverrideKey) => {
    // Seed the field with the current auto value so someone is tweaking
    // real text instead of starting from a blank box.
    setDraft((prev) => ({ ...prev, [key]: prev[key] || auto[key] }));
    setDirty(true);
  };
  const save = () => {
    updateConfig({ overviewOverrides: draft });
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading
          icon={LayoutGrid}
          title={tabLabels.overview}
          subtitle={`${sectionLabels.ov_shape.label} and ${sectionLabels.ov_fuel.label} fill themselves in from your Timeline & Fuel Matrix — override any row here if you want it to say something else.`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('overviewOverrides'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>

      <div className="space-y-2.5">
        {OVERVIEW_OVERRIDE_ROWS.map((row) => {
          const isCustom = !!draft[row.key];
          return (
            <div key={row.key} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <row.icon className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.75} />
                  <span className="text-[12.5px] font-medium text-neutral-300 truncate">{row.label}</span>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 p-0.5 shrink-0">
                  <button
                    onClick={() => useAuto(row.key)}
                    className={`cursor-target rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition-colors ${
                      !isCustom ? 'bg-violet-500 text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    AUTO
                  </button>
                  <button
                    onClick={() => useCustom(row.key)}
                    className={`cursor-target rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition-colors ${
                      isCustom ? 'bg-violet-500 text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    CUSTOM
                  </button>
                </div>
              </div>
              {isCustom ? (
                <input value={draft[row.key]} onChange={(e) => setRow(row.key, e.target.value)} placeholder={auto[row.key]} className={fieldInput} />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-neutral-500 italic">{row.hint}</span>
                  <span className="text-[12px] text-neutral-400 font-medium shrink-0">{auto[row.key]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function SubjectsAndSyllabusEditor() {
  const { subjects, syllabus, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [localSubjects, setLocalSubjects] = useState(subjects);
  const [localSyllabus, setLocalSyllabus] = useState(syllabus);
  const [dirty, setDirty] = useState(false);
  const [openPhase, setOpenPhase] = useState<number | null>(null);

  useEffect(() => { setLocalSubjects(subjects); setLocalSyllabus(syllabus); setDirty(false); }, [subjects, syllabus]);

  const markDirty = () => setDirty(true);

  // ---- Subjects ----
  const patchSubject = (key: string, patch: Record<string, any>) => {
    setLocalSubjects((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    markDirty();
  };
  const addSubject = () => {
    const key = `subject_${Date.now()}`;
    const color = SUBJECT_COLOR_NAMES[localSubjects.length % SUBJECT_COLOR_NAMES.length];
    setLocalSubjects((prev) => [...prev, { key, label: 'New Subject', color, inMockTest: true }]);
    // Give the new subject an empty topic list in every existing phase so
    // it immediately shows up (empty) in the syllabus editor below instead
    // of silently missing until a phase happens to be re-saved.
    setLocalSyllabus((prev) => prev.map((p) => ({ ...p, subjects: { ...p.subjects, [key]: [] } })));
    markDirty();
  };
  const removeSubject = (key: string) => {
    setLocalSubjects((prev) => prev.filter((s) => s.key !== key));
    setLocalSyllabus((prev) => prev.map((p) => {
      const { [key]: _drop, ...rest } = p.subjects;
      return { ...p, subjects: rest };
    }));
    markDirty();
  };

  // ---- Syllabus phases ----
  const patchPhase = (phaseNum: number, patch: Record<string, any>) => {
    setLocalSyllabus((prev) => prev.map((p) => (p.phase === phaseNum ? { ...p, ...patch } : p)));
    markDirty();
  };
  const setPhaseTopics = (phaseNum: number, subjectKey: string, rawText: string) => {
    const topics = rawText.split('\n').map((t) => t.trim()).filter(Boolean);
    setLocalSyllabus((prev) => prev.map((p) =>
      p.phase === phaseNum ? { ...p, subjects: { ...p.subjects, [subjectKey]: topics } } : p
    ));
    markDirty();
  };
  const addPhase = () => {
    const nextNum = Math.max(0, ...localSyllabus.map((p) => p.phase)) + 1;
    setLocalSyllabus((prev) => [
      ...prev,
      {
        phase: nextNum,
        month: 'Month',
        label: 'New Phase',
        subjects: Object.fromEntries(localSubjects.map((s) => [s.key, []])),
      },
    ]);
    setOpenPhase(nextNum);
    markDirty();
  };
  const removePhase = (phaseNum: number) => {
    setLocalSyllabus((prev) => prev.filter((p) => p.phase !== phaseNum));
    markDirty();
  };

  const save = () => {
    if (!localSubjects.length || !localSyllabus.length) return;
    updateConfig({ subjects: localSubjects, syllabus: localSyllabus });
    setDirty(false);
  };
  const resetBoth = () => {
    resetConfigSection('subjects');
    resetConfigSection('syllabus');
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={BookOpen} title="Subjects & Syllabus" subtitle="What you're studying, and the month-by-month roadmap for each subject" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={resetBoth} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>

      {/* Subjects list */}
      <div className="mb-6">
        <label className={fieldLabel}>Subjects</label>
        <div className="space-y-2">
          {localSubjects.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${SUBJECT_COLOR_PALETTE[s.color]?.dot || 'bg-neutral-600'}`} />
              <input
                value={s.label}
                onChange={(e) => patchSubject(s.key, { label: e.target.value })}
                className={`flex-1 ${fieldInput}`}
              />
              <select
                value={s.color}
                onChange={(e) => patchSubject(s.key, { color: e.target.value })}
                className={`w-28 shrink-0 ${fieldInput}`}
              >
                {SUBJECT_COLOR_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="button"
                onClick={() => patchSubject(s.key, { inMockTest: !(s.inMockTest !== false) })}
                title={s.inMockTest !== false ? 'Shows a score box in the Mock Test Tracker — click to remove' : 'Hidden from the Mock Test Tracker — click to include'}
                aria-pressed={s.inMockTest !== false}
                aria-label={s.inMockTest !== false ? 'Shown in Mock Test Tracker, click to hide' : 'Hidden from Mock Test Tracker, click to show'}
                className={`cursor-target shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 h-8 text-[11px] font-medium transition-colors ${
                  s.inMockTest !== false
                    ? 'border-violet-500/30 bg-violet-500/[0.08] text-violet-300'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Mock Test</span>
              </button>
              <button
                onClick={() => removeSubject(s.key)}
                aria-label={`Remove subject ${s.label || s.key}`}
                className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <RippleButton onClick={addSubject} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Subject
        </RippleButton>
        <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed">
          The <span className="text-violet-300 font-medium">Mock Test</span> toggle controls whether a subject gets its own score box in the Mock Test Tracker form — turn it off for a catch-all like "Mixed / PYQ", or for any subject you'd rather not log per-test scores for. It's independent of syllabus content, and it never affects the subject's own column in the Syllabus Roadmap above.
        </p>
      </div>

      {/* Syllabus phases */}
      <div>
        <label className={fieldLabel}>Syllabus Phases</label>
        <div className="space-y-2">
          {localSyllabus.map((p) => {
            const isOpen = openPhase === p.phase;
            return (
              <div key={p.phase} className="rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
                <button onClick={() => setOpenPhase(isOpen ? null : p.phase)} aria-expanded={isOpen} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[11px] font-semibold text-neutral-300">{p.phase}</span>
                  <span className="text-[12.5px] text-neutral-200 flex-1 truncate">{p.month} — {p.label}</span>
                  <ChevronRight className={`h-3.5 w-3.5 text-neutral-600 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-neutral-800/60">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={fieldLabel}>Month</label>
                        <input value={p.month} onChange={(e) => patchPhase(p.phase, { month: e.target.value })} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Label</label>
                        <input value={p.label} onChange={(e) => patchPhase(p.phase, { label: e.target.value })} className={fieldInput} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {localSubjects.map((s) => (
                        <div key={s.key}>
                          <label className={fieldLabel}>{s.label} topics (one per line)</label>
                          <textarea
                            value={(p.subjects[s.key] || []).join('\n')}
                            onChange={(e) => setPhaseTopics(p.phase, s.key, e.target.value)}
                            rows={4}
                            className={`${fieldInput} resize-none`}
                          />
                        </div>
                      ))}
                    </div>
                    <RippleButton
                      onClick={() => removePhase(p.phase)}
                      className="cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11.5px] font-semibold text-neutral-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Phase
                    </RippleButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <RippleButton onClick={addPhase} className="cursor-target mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Phase
        </RippleButton>
      </div>
    </Card>
  );
}

// Each settings category collapses into its own dropdown so opening, say,
// "Master Timeline" doesn't require scrolling past Profile, Diet, Training,
// etc. Only the section the user taps is ever mounted/expanded — everything
// else stays tucked away as a single-line header.
// A small popover grid for picking one of ICON_OPTIONS. Shared by the Tab
// Names & Icons editor and any per-tab sub-section editor (e.g. Dashboard
// Overview's cards) so there's exactly one icon-picking UI in the app.
export function IconPickerButton({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = ICON_OPTIONS[value] || ICON_OPTIONS[ICON_OPTION_KEYS[0]];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change icon"
        className="cursor-target flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/60 hover:border-violet-500/50 transition-colors"
      >
        <SelectedIcon className="h-3.5 w-3.5 text-neutral-300" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1.5 grid grid-cols-6 gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl w-[196px]">
          {ICON_OPTION_KEYS.map((key) => {
            const Opt = ICON_OPTIONS[key];
            const isSelected = key === value;
            return (
              <button
                type="button"
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                title={key}
                aria-label={key}
                aria-pressed={isSelected}
                className={`cursor-target flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  isSelected ? 'bg-violet-500/20 border border-violet-500/50' : 'border border-transparent hover:bg-neutral-800'
                }`}
              >
                <Opt className="h-3.5 w-3.5 text-neutral-300" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TabLabelsEditor() {
  const { tabLabels, tabIcons, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [draftLabels, setDraftLabels] = useState<Record<TabLabelKey, string>>(tabLabels);
  const [draftIcons, setDraftIcons] = useState<Record<TabLabelKey, string>>(tabIcons);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraftLabels(tabLabels); setDraftIcons(tabIcons); setDirty(false); }, [tabLabels, tabIcons]);

  const setLabel = (key: TabLabelKey, value: string) => {
    setDraftLabels((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const setIcon = (key: TabLabelKey, value: string) => {
    setDraftIcons((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = () => {
    // Never let a tab go out with a blank label — fall back to its shipped
    // default instead of leaving a button with no text in the sidebar.
    const cleaned = { ...draftLabels };
    TAB_LABEL_KEYS.forEach((key) => {
      if (!cleaned[key] || !cleaned[key].trim()) cleaned[key] = DEFAULT_TAB_LABELS[key];
    });
    updateConfig({ tabLabels: cleaned, tabIcons: draftIcons });
    setDraftLabels(cleaned);
    setDirty(false);
  };

  const resetAll = () => {
    resetConfigSection('tabLabels');
    resetConfigSection('tabIcons');
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={PenLine} title="Tab Names & Icons" subtitle="Rename and re-icon the sidebar navigation" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={resetAll} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>
      <div className="space-y-2">
        {TAB_LABEL_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <IconPickerButton value={draftIcons[key]} onChange={(v) => setIcon(key, v)} />
            <input
              value={draftLabels[key] ?? ''}
              onChange={(e) => setLabel(key, e.target.value)}
              maxLength={40}
              className={`flex-1 ${fieldInput}`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-neutral-600 leading-relaxed">
        Tap an icon to swap it out. Renaming or re-iconing a tab only changes how it looks — its position and what it opens stay the same. Clear a name and save to restore its default.
      </p>
    </Card>
  );
}

// Rows are grouped by which tab they live in (Dashboard Overview, Timeline,
// Training & Fuel, Syllabus, Mock Tests, Clock, History, Account) so the
// editor reads as one list per tab rather than one long undifferentiated
// stack of 19+ rows.
export const SECTION_LABEL_GROUP_TAB_KEYS: TabLabelKey[] = Array.from(new Set(SECTION_LABEL_ROWS.map((r) => r.tabKey)));

export function SectionLabelsEditor() {
  const { sectionLabels, tabLabels, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
  const [draft, setDraft] = useState<Record<string, { label: string; icon: string }>>(sectionLabels);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(sectionLabels); setDirty(false); }, [sectionLabels]);

  const setLabel = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], label: value } }));
    setDirty(true);
  };
  const setIcon = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], icon: value } }));
    setDirty(true);
  };

  const save = () => {
    const cleaned = { ...draft };
    SECTION_LABEL_ROWS.forEach(({ key, defaultLabel }) => {
      if (!cleaned[key]?.label || !cleaned[key].label.trim()) {
        cleaned[key] = { ...cleaned[key], label: defaultLabel };
      }
    });
    updateConfig({ sectionLabels: cleaned });
    setDraft(cleaned);
    setDirty(false);
  };

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <SectionHeading icon={LayoutGrid} title="Section Labels" subtitle="Rename & re-icon the named panels inside every tab" />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton onClick={() => { resetConfigSection('sectionLabels'); setDirty(false); }} className={btnGhost}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </RippleButton>
          <RippleButton onClick={save} disabled={!dirty} className={btnSave(dirty)}>
            <Save className="h-3.5 w-3.5" /> Save
          </RippleButton>
        </div>
      </div>
      <div className="space-y-5">
        {SECTION_LABEL_GROUP_TAB_KEYS.map((tabKey) => (
          <div key={tabKey}>
            <h4 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">{tabLabels[tabKey] || DEFAULT_TAB_LABELS[tabKey]}</h4>
            <div className="space-y-2">
              {SECTION_LABEL_ROWS.filter((r) => r.tabKey === tabKey).map(({ key }) => (
                <div key={key} className="flex items-center gap-2">
                  <IconPickerButton value={draft[key]?.icon} onChange={(v) => setIcon(key, v)} />
                  <input
                    value={draft[key]?.label ?? ''}
                    onChange={(e) => setLabel(key, e.target.value)}
                    maxLength={40}
                    className={`flex-1 ${fieldInput}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-neutral-600 leading-relaxed">
        Covers every named panel across {SECTION_LABEL_GROUP_TAB_KEYS.map((k) => tabLabels[k] || DEFAULT_TAB_LABELS[k]).join(', ')}. Renaming or re-iconing only changes the label — what the panel shows stays the same. Clear a name and save to restore its default.
      </p>
    </Card>
  );
}

const THEME_OPTION_ICONS: Record<ThemeMode, React.ComponentType<{ className?: string }>> = {
  'mono-dark': Moon,
  'mono-light': Sun,
  'lagoon-fizz': Waves,
  blush: Heart,
  crimson: Droplet,
  jade: Leaf,
  colorful: Sparkles,
};

export function ThemeEditor() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="animate-fadeIn">
      <SectionHeading icon={Moon} title="Appearance" />
      <div className="space-y-2.5">
        {THEME_OPTIONS.map((opt) => {
          const Icon = THEME_OPTION_ICONS[opt.id];
          const active = theme === opt.id;
          return (
            <RippleButton
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              ariaLabel={opt.label}
              className={`w-full flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                active
                  ? 'border-violet-500/30 bg-violet-500/[0.06]'
                  : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/60">
                <Icon className="h-4.5 w-4.5 text-neutral-300" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-neutral-100">{opt.label}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">{opt.description}</p>
              </div>
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-violet-400 bg-violet-500/20' : 'border-neutral-700'
                }`}
              >
                {active && <Check className="h-3 w-3 text-violet-300" strokeWidth={2.5} />}
              </div>
            </RippleButton>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-neutral-600 leading-relaxed">
        Black &amp; White Minimalism desaturates every screen — colors, glows and gradients alike — down to grayscale (inverted to a light shell for the light variant). Every animation, including the moving gradients, keeps playing exactly as it does in color; only the colors themselves change.
        <br className="hidden sm:block" />
        The color washes work differently on purpose: they only re-hue the app's own violet/fuchsia accent — buttons, selected states, the brand gradient — everywhere it appears. Anything with its own distinct color (a countdown or subject you've set to a specific color, glass-panel backgrounds, etc.) stays exactly as you left it.
      </p>
    </Card>
  );
}


// Each row's `title`/`subtitle` can be a plain string OR a function of
// (tabLabels, sectionLabels, tabIcons) — used for rows that describe a tab
// (or a specific panel inside one) that's renameable in Tab Names & Icons /
// Section Labels, so this list of section headers never drifts out of sync
// with whatever the user has renamed things to. `tabKey` additionally lets
// the row's icon follow that tab's icon override.
export const SETTINGS_SECTIONS = [
  { key: 'theme', icon: Moon, title: 'Appearance', subtitle: 'Switch between the colorful app and Black & White Minimalism', Component: ThemeEditor },
  { key: 'tabLabels', icon: PenLine, title: 'Tab Names & Icons', subtitle: 'Rename and re-icon the sidebar navigation', Component: TabLabelsEditor },
  { key: 'sectionLabels', icon: LayoutGrid, title: 'Section Labels', subtitle: 'Rename & re-icon panels in every tab', Component: SectionLabelsEditor },
  { key: 'profile', icon: GraduationCap, title: 'Profile & Goals', subtitle: 'Identity, exam/goal & priority targets', Component: ProfileEditor },
  {
    key: 'countdown', icon: Clock3, tabKey: 'overview', title: 'Countdown',
    subtitle: (tabLabels) => `Personal countdowns for the ${tabLabels.overview} tab`,
    Component: CountdownEditor,
  },
  {
    key: 'overview', icon: LayoutGrid, tabKey: 'overview',
    title: (tabLabels) => tabLabels.overview,
    subtitle: (tabLabels, sectionLabels) => `Override ${sectionLabels.ov_shape.label} & ${sectionLabels.ov_fuel.label} text`,
    Component: OverviewSummaryEditor,
  },
  { key: 'checklist', icon: ClipboardList, title: 'Daily Checklist Items', subtitle: 'Objectives in the Daily Matrix sidebar', Component: TrackerItemsEditor },
  {
    key: 'timeline', icon: Clock3, tabKey: 'timeline',
    title: (tabLabels) => tabLabels.timeline,
    subtitle: "The day's time-boxed schedule blocks",
    Component: TimelineEditor,
  },
  { key: 'training', icon: Dumbbell, title: 'Training Split', subtitle: 'Gym / calisthenics days & exercises', Component: TrainingEditor },
  { key: 'diet', icon: Utensils, title: 'Training & Fuel — Meals', subtitle: 'Meal names, times, icons & food', Component: DietEditor },
  { key: 'subjects', icon: BookOpen, title: 'Subjects & Syllabus', subtitle: 'Subjects and the month-by-month roadmap', Component: SubjectsAndSyllabusEditor },
];



export function SettingsAccordionItem({ icon: Icon, title, subtitle, isOpen, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`cursor-target w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
          isOpen
            ? 'border-violet-500/30 bg-violet-500/[0.06]'
            : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900'
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/60">
          <Icon className="h-4.5 w-4.5 text-neutral-300" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold tracking-tight text-neutral-100">{title}</h3>
          {subtitle && <p className="text-[12px] text-neutral-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-violet-400' : 'text-neutral-500'}`}
          strokeWidth={1.75}
        />
      </button>
      {isOpen && <div className="mt-2.5 animate-fadeIn">{children}</div>}
    </div>
  );
}

export function ConfigEditorTab() {
  // null = everything collapsed. Opening a section closes whichever one was
  // open before it, so there's never more than one editor on screen.
  const [openKey, setOpenKey] = useState(null);
  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));
  const { tabLabels, tabIcons, sectionLabels } = React.useContext(ConfigContext);

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeading icon={Settings} title="Settings" subtitle="Tap a section to open just that part — everything else stays collapsed" />
      <div className="space-y-2.5">
        {SETTINGS_SECTIONS.map(({ key, icon, title, subtitle, tabKey, Component }) => {
          // Rows that mirror a live tab (title/subtitle given as functions)
          // resolve their copy from the current tabLabels/sectionLabels so a
          // rename in "Tab Names & Icons" is reflected here instead of
          // showing whatever the shipped default used to be. Their icon
          // likewise follows that tab's icon override, same as the sidebar.
          const resolvedTitle = typeof title === 'function' ? title(tabLabels, sectionLabels) : title;
          const resolvedSubtitle = typeof subtitle === 'function' ? subtitle(tabLabels, sectionLabels) : subtitle;
          const resolvedIcon = (tabKey && ICON_OPTIONS[tabIcons[tabKey]]) || icon;
          return (
            <SettingsAccordionItem
              key={key}
              icon={resolvedIcon}
              title={resolvedTitle}
              subtitle={resolvedSubtitle}
              isOpen={openKey === key}
              onToggle={() => toggle(key)}
            >
              <Component />
            </SettingsAccordionItem>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Main Root Dashboard Component ----------