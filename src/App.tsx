import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutGrid, Clock3, Dumbbell, BookOpen, Sparkles,
  CheckCircle2, Circle, Target, GraduationCap, Ruler, Weight,
  Droplets, Sunrise, Sun, Moon, Utensils, Flame,
  AlertTriangle, ChevronRight, ChevronDown, Eye, Smile, Scissors, Wind,
  TrendingUp, Activity, Timer, Calendar, X, ArrowUpRight, FlameKindling,
  ChevronLeft, Lock, Music2, Play, Pause, SkipForward,
  Search, RotateCcw,
  Crown, Swords, Download, Upload, ShieldCheck, ClipboardList, BarChart3, Trash2, Plus, Bell, BellOff,
  Settings, Save, GripVertical, PenLine, RefreshCcw, UserCircle2, KeyRound, LogOut, Loader2
} from 'lucide-react';
import AuthGate from './components/AuthGate';
import OnboardingWizard from './components/OnboardingWizard';
import { useCloudAutoSync } from './lib/cloudSync';
import CloudSyncCard from './components/CloudSyncCard';
import PushNotificationsCard from './components/PushNotificationsCard';
import AlarmsPanel from './components/AlarmsPanel';
import { supabase } from './lib/supabaseClient';
import { generateTopicDetails, generateExerciseGuide, generateProfileTargets } from './lib/contentGen';
import { subscribeToPush, messageServiceWorker } from './lib/pushNotifications';
import { startActiveTimer, clearActiveTimer } from './lib/activeTimers';
import { Toaster, toast } from './lib/toast';
import { haptic } from './lib/haptics';
import PasswordField from './components/PasswordField';
import PasscodeChangeCard from './components/PasscodeChangeCard';

// Every account gets asked this exactly once, right after their first
// passcode is set up (see OnboardingWizard.tsx). Synced via cloudSync's
// SYNC_KEYS so finishing it on one device doesn't re-trigger it on another.
const ONBOARDING_STORAGE_KEY = 'akyos_onboarding_completed_v1';

// --- shared "liquid" animated gradient fill (same treatment as AuthGate) --
//
// Every icon badge, primary button, avatar, and progress fill that used to
// be a flat static gradient (bg-gradient-to-br from-indigo-600 via-violet-
// 600 to-fuchsia-500) is filled with this instead: the brand color stops
// slowly drift via an animated background-position, and a soft diagonal
// light sheen is layered on top (as a second background-image) so it
// periodically glides across the shape for a glossy, liquid feel — all on
// one element, no extra DOM needed. The shine layer is built from several
// close, low-contrast stops (rather than a hard jump straight to a bright
// peak) so it reads as a gentle glow passing through, not a visible seam.
const LIQUID_GRADIENT_KEYFRAMES = `
  @keyframes akyos-liquid-fill {
    0%   { background-position: 0% 50%, 0% 50%; }
    50%  { background-position: 100% 50%, 100% 50%; }
    100% { background-position: 0% 50%, 0% 50%; }
  }
`;
const LIQUID_ANIMATION = 'akyos-liquid-fill 6s ease-in-out infinite';
const LIQUID_GRADIENT_FILL: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ' +
    'linear-gradient(115deg, #4f46e5 0%, #7c3aed 22%, #d946ef 45%, #7c3aed 68%, #4f46e5 85%, #d946ef 100%)',
  backgroundSize: '340% 340%, 300% 300%',
  backgroundPosition: '0% 50%, 0% 50%',
  animation: LIQUID_ANIMATION,
};

// Merges the liquid gradient fill into an element's style, safely combining
// its infinite animation with any one-shot animation the element already
// has (e.g. a fade/slide-in) instead of one overwriting the other.
function liquidFillStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  const { animation: extraAnimation, ...rest } = extra;
  return {
    ...LIQUID_GRADIENT_FILL,
    animation: extraAnimation ? `${extraAnimation}, ${LIQUID_ANIMATION}` : LIQUID_ANIMATION,
    ...rest,
  };
}

// Same moving-sheen treatment as liquidFillStyle, but for the handful of
// spots that use a different (non brand-indigo/violet/fuchsia) color pair,
// e.g. the Pomodoro "break" state. Takes the base color stops only —
// the shine layer, sizing, and animation stay identical everywhere so
// every gradient in the app moves and blends the same way.
function liquidFillStyleFor(baseGradient: string, extra: React.CSSProperties = {}): React.CSSProperties {
  const { animation: extraAnimation, ...rest } = extra;
  return {
    backgroundImage:
      'linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ' +
      baseGradient,
    backgroundSize: '340% 340%, 300% 300%',
    backgroundPosition: '0% 50%, 0% 50%',
    animation: extraAnimation ? `${extraAnimation}, ${LIQUID_ANIMATION}` : LIQUID_ANIMATION,
    ...rest,
  };
}




// ---------- Deep Interactive Knowledge Matrix ----------

const TOPIC_DETAILS = {
  'Basic Maths': { chapters: ['Logarithms', 'Wavy Curve Method', 'Modulus Equations'], focus: ['Properties of log, characteristic & mantissa', 'Solving complex polynomial inequalities via signs', 'Absolute value function properties and graphs'] },
  'Logs': { chapters: ['Logarithmic Identities', 'Log Equations'], focus: ['Base change theorem applications', 'Domain restrictions ($\log_a x$ requires $x>0, a>0, a\neq 1$)'] },
  'Quadratics': { chapters: ['Nature of Roots', 'Location of Roots', 'Common Roots condition'], focus: ['Discriminant analysis under conditions', 'Interval constraints for roots relative to a value $k$', 'Symmetric expressions of roots'] },
  'Sequences & Series': { chapters: ['AP & GP', 'AGP & Special Series'], focus: ['Sigma notation calculations ($\sum n, \sum n^2$)', 'Arithmetico-Geometric series telescoping elimination', 'Infinite GP convergence criteria'] },
  'Trigonometry': { chapters: ['Compound Angles', 'Trigonometric Equations'], focus: ['Transformation formulas', 'General solutions of $\sin \theta = \sin \alpha$', 'Boundness concepts inside identities'] },
  'Units & Dimensions': { chapters: ['Dimensional Analysis', 'Error & Vernier Calipers'], focus: ['Principle of Homogeneity', 'Least count errors, screw gauge pitch calculations', 'Significant figures tracking'] },
  'Vectors': { chapters: ['Vector Algebra', 'Relative Motion Introduction'], focus: ['Dot and cross product physical interpretations', 'Component splitting across skewed axes', 'Triangle & polygon laws'] },
  'Kinematics (1D/2D)': { chapters: ['Motion in 1D', 'Projectile Motion', 'Relative Velocity'], focus: ['Calculus-based kinematic variable transitions', 'Trajectory equations, maximum range configurations', 'Rain-man and river-boat vector drift triangles'] },
  'NLM & Friction': { chapters: ['Newton\'s Laws', 'Friction Mechanics', 'Pseudo Forces'], focus: ['Rigid free-body diagram constraints', 'Static vs kinetic threshold switching', 'Accelerating reference frames tracking'] },
  'WPE': { chapters: ['Work-Energy Theorem', 'Potential Energy Curves', 'Vertical Circular Motion'], focus: ['Work done by variable forces via line integrals', 'Conservative vs non-conservative field transitions', 'Critical velocity parameters at the highest point'] },
  'Mole Concept': { chapters: ['Stoichiometry', 'Concentration Terms', 'Limiting Reagent'], focus: ['Empirical and molecular formula processing', 'Molarity, Molality, Mole fraction conversions', 'Sequential and parallel reaction math'] },
  'Atomic Structure': { chapters: ['Bohr\'s Model', 'Quantum Numbers', 'Dual Nature'], focus: ['Rydberg formula line spectrum limits', 'Radial and angular nodes distribution graphs', 'Hund\'s rule and Pauli exclusion violations'] },
  'Periodic Table': { chapters: ['Periodic Trends', 'Screening Effect'], focus: ['Slater\'s rules for $Z_{\text{eff}}$ estimation', 'Exceptional ionization energy orders (N vs O, Ga vs Al)', 'Electron gain enthalpy trends'] },
  'Chemical Bonding': { chapters: ['VSEPR Theory', 'Hybridization', 'Molecular Orbital Theory'], focus: ['Steric number calculations, shape vs geometry', 'Dipole moments in cis/trans and aromatic molecules', 'Bond order and magnetic behavior of diatomic species'] },
  'GOC': { chapters: ['Electronic Effects', 'Acidic & Basic Strength', 'Aromaticity'], focus: ['Resonance energy and hyperconjugation structures', 'Stability of carbocations, carbanions, and free radicals', 'Huckel\'s $4n+2$ pi electron rules'] }
};

const EXERCISE_GUIDE = {
  'Lat Pulldowns': { target: 'Lats & Teres Major', instructions: ['Sit flat on pad, lock thighs under rollers.', 'Grip the bar slightly wider than shoulder width.', 'Pull vertically to upper chest level by driving elbows down.', 'Squeeze shoulder blades tightly at the base, slow negative.'], cues: 'Do not use momentum or lean backward excessively.' },
  'Seated Cable Rows': { target: 'Mid-Back & Rhomboids', instructions: ['Keep spine neutral, knees slightly bent.', 'Pull attachment toward lower abdomen.', 'Retract scapula completely upon contraction.', 'Extend arms fully forward to feel maximum stretch.'], cues: 'Focus on pulling with your elbows, not pulling with your biceps.' },
  'DB Lateral Raises': { target: 'Lateral Deltoids', instructions: ['Lean slightly forward from hips.', 'Raise dumbbells out to your sides in a slight arc.', 'Ensure pinkies are tilted marginally upward at the top.', 'Control descent back to initial position.'], cues: 'Keep arms slightly bent; do not shrug the traps up.' },
  'Behind-the-Back Wrist Curls': { target: 'Forearm Flexors', instructions: ['Stand holding a barbell behind your glutes.', 'Let the bar roll down into your fingers.', 'Curl the bar up using forearm strength only.'], cues: 'High reps for massive blood pump; protect the wrist angle.' },
  'Dead-hang holds': { target: 'Grip Strength & Decompression', instructions: ['Hang completely vertical from a pull-up bar.', 'Engage the shoulder blades slightly (active hang).', 'Maintain deep nasal breathing pattern.'], cues: 'Focus on maximum duration to failure.' },
  'Negative Pull-ups': { target: 'Pull-up Strength Foundation', instructions: ['Jump or step up until chin clears the bar.', 'Lower your body as slowly as possible over 5 full seconds.', 'Maintain complete body tension until dead hang position.'], cues: 'Do not drop suddenly at the bottom half of the movement.' },
  'Standard Push-ups': { target: 'Pectorals & Triceps', instructions: ['Maintain rigid straight-line plank alignment.', 'Lower chest to 1 inch off floor.', 'Push back up aggressively locking out chest.'], cues: 'Keep elbows tucked at a 45-degree angle.' },
  'Goblet Squats': { target: 'Quadriceps & Glutes', instructions: ['Hold dumbbell vertically directly against your upper chest.', 'Drop hips straight down keeping torso fully upright.', 'Break parallel depth smoothly.', 'Drive upwards evenly through your heels.'], cues: 'Keep knees tracking in line with toes.' },
  'Romanian Deadlifts': { target: 'Hamstrings & Glutes', instructions: ['Stand tall with barbell/dumbbells at hip level.', 'Hinge backwards from the hips, sliding weight down thighs.', 'Keep shins perfectly vertical.', 'Squeeze glutes hard at absolute lockout.'], cues: 'Maintain natural flat lower back curve throughout.' },
  'Hanging Leg / Knee Raises': { target: 'Lower Rectus Abdominis', instructions: ['Hang with straight arms from overhead rack.', 'Raise toes/knees upwards avoiding body swing.', 'Control the eccentric drop stage explicitly.'], cues: 'Initiate tilt from pelvis, do not just lift legs.' },
  'Stomach Vacuums': { target: 'Transverse Abdominis (Core Width)', instructions: ['Exhale all air entirely from your lungs.', 'Suck stomach in deeply underneath the ribcage.', 'Hold this isometric hollow vacuum position for 60 seconds.'], cues: 'Perform strictly on an empty stomach for maximum compression.' },
  'Overhead DB Press': { target: 'Anterior Deltoids & Triceps', instructions: ['Sit or stand tall bracing standard core architecture.', 'Press dumbbells vertically above head line.', 'Lower weights carefully until thumbs reach ear level.'], cues: 'Do not hyperextend the lumbar spine.' },
  'Incline DB Bench Press': { target: 'Upper Chest Clavicular Head', instructions: ['Set bench angle strictly to 30 degrees.', 'Press weights vertically directly over face.', 'Lower under tight control to upper pec level.'], cues: 'Keep feet planted flat on floor for power transfer.' },
  'Diamond Push-ups': { target: 'Triceps Medial Head & Inner Chest', instructions: ['Form diamond configuration shape with hands under chest.', 'Lower body down, keeping elbows pinned tight to ribcage.', 'Press upwards to full lockout.'], cues: 'Excellent calisthenics push-day finisher.' },
  'Pike Push-ups': { target: 'Vertical Push / Shoulders', instructions: ['Elevate hips into inverted V-position geometry.', 'Lower crown of head forward toward ground.', 'Press away forcefully to starting angle.'], cues: 'Keep gaze on feet to safeguard neck alignment.' },
  'L-Sit Progressions': { target: 'Absolute Core Compression Strength', instructions: ['Sit on floor/parallelets with hands adjacent to hips.', 'Press into floor to lift hips and legs simultaneously.', 'Keep legs locked locked straight out parallel to earth.'], cues: 'Tuck knees to chest first if full variation is too heavy.' },
  'Straight-Arm Cable Pull-overs': { target: 'Lower Lat Isolation', instructions: ['Face cable stack holding rope or bar extension.', 'Hinge slightly forward at torso structure.', 'Pull arms downward to hips in clean circular arc.'], cues: 'Keep elbow flexion static throughout range.' },
  'Face Pulls': { target: 'Rear Delts & Rotator Cuff', instructions: ['Set cable at upper chest height with rope attachment.', 'Pull center of rope straight toward nose bridge.', 'Flare elbows wide out, pulling hands backward past ears.'], cues: 'Hold contraction for 1 second to optimize posture correction.' },
  'Hammer Curls': { target: 'Brachialis & Brachioradialis', instructions: ['Hold dumbbells with neutral vertical grip.', 'Curl weights up without rotating wrists.', 'Keep elbows pinned stationary at sides.'], cues: 'Creates width across arms when viewed from front.' },
  'Finger Roll Grip Curls': { target: 'Deep Forearm Flexor Thickness', instructions: ['Let barbell roll down to absolute fingertips.', 'Close hand tightly, then perform wrist extension curl.'], cues: 'Extremely effective high-pump burnout routine.' }
};

// Same convention as DEFAULT_TRACKER_ITEMS / DEFAULT_TIMELINE / DEFAULT_TRAINING
// above: this is the fallback used whenever an account hasn't saved its own
// `profile` yet (i.e. every existing account today, since this field is new),
// so nothing changes visually for anyone until they actually edit it in
// Settings > Profile & Goals. It's also the "Reset to default" target there.
// This is a neutral placeholder, not any one person's real identity — the
// onboarding wizard writes a real profile immediately after signup, so this
// only ever shows briefly (or as the "Reset to default" target in Settings).
const DEFAULT_PROFILE = {
  name: 'Your Name',
  goalLabel: 'Add your goal',
  // Birthdate ('YYYY-MM-DD') replaces the old static `age` field — age is
  // now always derived from this via calculateAge() so it keeps itself
  // correct instead of going stale. Defaults to ~18 years ago (computed
  // inline, not via the helper further below, since this runs at module
  // load before that helper's dependencies are initialized) so the
  // placeholder profile still reads as "18-year-old" like before.
  birthdate: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })(),
  height: 170,
  weight: 65,
  category: '',
  baseline: 0,
  baselineLabel: 'Baseline Score',
  boards: 0,
  targets: [
    { rank: 1, name: 'Add your first target', course: 'Course / program', tag: 'Top Priority', color: 'blue', desc: 'Edit this in Settings > Profile & Goals — describe what you\'re aiming for and why it matters.' },
  ],
};

// Standalone personal countdowns — deliberately NOT tied to `profile.targets`.
// Someone might want a live countdown to, say, JEE Main's actual exam date
// without that date needing to exist as one of their formal priority targets.
// Fully editable in Settings > Countdown, and there can be more than one
// (e.g. "JEE Main" + "Boards" + "Scholarship Interview" all ticking at
// once). Empty by default so nothing is fabricated until the user adds one.
type CountdownItem = {
  id: string;
  label: string;
  targetDate: string; // 'YYYY-MM-DD'
  targetTime: string; // 'HH:MM', 24h — defaults to midnight of targetDate
  // Timestamp (ms) of when this countdown was set — powers its depleting
  // progress bar (full at startMs, empty at the target). Auto-set whenever
  // the target date/time is (re)saved; null falls back to a generic span.
  startMs: number | null;
  // Name from COUNTDOWN_COLOR_PALETTE — lets each countdown stand apart
  // visually when several are ticking side by side in the same card.
  color: string;
};

const DEFAULT_COUNTDOWNS: CountdownItem[] = [];

const makeCountdownId = () => `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// `existingCount` rotates through the palette so each newly-added countdown
// defaults to a different color than the ones already there, instead of
// everything piling up on the same 'sky' every time.
const makeBlankCountdown = (existingCount = 0): CountdownItem => ({
  id: makeCountdownId(),
  label: '',
  targetDate: '',
  targetTime: '00:00',
  startMs: null,
  color: COUNTDOWN_COLOR_NAMES[existingCount % COUNTDOWN_COLOR_NAMES.length],
});

const DEFAULT_TIMELINE = [
  { start: '05:00', end: '05:20', label: 'Wake & Prep', detail: 'Pre-breakfast drinks, Vitamin D3', icon: Sunrise, type: 'prep', longDesc: 'Instant waking routine. Rehydrating the system with 500ml water + Chia seeds immediately to eliminate sleep inertia. Take single high-dose Vitamin D3 drop.' },
  { start: '05:20', end: '08:30', label: 'Study Slot 1 — Mathematics', detail: 'Allen Lectures at 1.5x–2x + active practice', icon: BookOpen, type: 'study', subject: 'math', longDesc: 'Peak cognitive availability window. Focus exclusively on core algebraic and trigonometric proof systems. Complete minimum 25 high-tier questions.' },
  { start: '08:30', end: '08:50', label: 'Breakfast Window', detail: 'Clean fuel block', icon: Utensils, type: 'meal', longDesc: '4 whole eggs, 3 whites, oats base. Ensure exact macronutrient absorption timing prior to the grueling Physics block.' },
  { start: '08:50', end: '11:30', label: 'Study Slot 2 — Physics', detail: 'Concepts and basic problem sets', icon: BookOpen, type: 'study', subject: 'physics', longDesc: 'Mechanics integration. Moving away from memorized shortcuts into deep vector analysis and calculus application frameworks.' },
  { start: '11:30', end: '13:00', label: 'Gym & Shower Window', detail: 'Dead-hour optimization — gym is empty', icon: Dumbbell, type: 'gym', longDesc: 'Hypertrophy or calisthenics application. Gym floor empty; maximize efficiency, execute within 65 minutes, return for rapid protein shake recovery.' },
  { start: '13:00', end: '13:25', label: 'Lunch', detail: 'High-protein recovery + Omega-3 Fish Oil', icon: Utensils, type: 'meal', longDesc: '200g chicken breast cooked clean + 2 whole wheat rotis and huge fiber salad pile. Take Omega-3 pills.' },
  { start: '13:25', end: '16:30', label: 'Study Slot 3 — Chemistry', detail: 'Physical / Organic alternating rotation', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'GOC mechanisms tracking or Mole concept numerical testing. Prevent midday fatigue by keeping hand writing actively moving.' },
  { start: '16:30', end: '16:50', label: 'Midday Snack Window', detail: 'Micronutrient / gut health reset', icon: Utensils, type: 'meal', longDesc: '200g clean curd base for gut microbiome + 1 antioxidant fruit source (apple/guava) + 15 raw structural almonds.' },
  { start: '16:50', end: '20:00', label: 'Study Slot 4 — Inorganic Chemistry', detail: 'Memorization or lecture backlog cleanup', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'High repetition memorization layer (NCERT alignments, block configurations, trend anomalies). Bullet journal exceptions.' },
  { start: '20:00', end: '20:25', label: 'Dinner Window', detail: 'Clean, low-carb evening plate', icon: Utensils, type: 'meal', longDesc: '150g pure lean chicken breast or paneer equivalent + hot vegetable stew array. Keep carbs light to avoid heavy morning fog.' },
  { start: '20:25', end: '22:00', label: 'Study Slot 5 — Mixed Advanced PYQs', detail: 'Past 5 years, timed conditions', icon: Timer, type: 'study', subject: 'mixed', longDesc: 'Testing mental endurance under fatigued constraints. Mimic real exam stress conditions across combined conceptual formats.' },
  { start: '22:00', end: '22:20', label: 'Night Snack Window', detail: 'Casein-rich slow protein feed', icon: Utensils, type: 'meal', longDesc: '250ml warm milk + 30g roasted chana. Sustained amino acid release engine covering 8 hours of fast sleep synthesis.' },
  { start: '22:20', end: '23:00', label: 'Plan & Wind Down', detail: 'Next day chapters, Magnesium, screens off', icon: Moon, type: 'prep', longDesc: 'Hard checklist preparation for tomorrow. Take structural Magnesium glycinate, terminate all short-wave blue lights, execute breathing resets.' },
  { start: '23:00', end: '23:00', label: 'Sleep Lock', detail: 'Hard stop.', icon: Moon, type: 'sleep', longDesc: 'Absolute system shutdown. Dark room settings optimized for rapid entry into deep REM sleep cycle.' },
];

// ---------- Fuel Matrix: Diet (fully editable — see ConfigContext.diet) ----------
// Used to be a hardcoded DIET constant. Now every meal — its time, name,
// icon, and food items — lives in config and is editable in Settings >
// Training & Fuel, capped at MAX_DIET_MEALS so the Daily Matrix's "All 6
// Meals Hit" box stays meaningful. The old third slot was called
// "Post-Workout Lunch"; renamed to plain "Lunch" since most people don't
// train right before lunch specifically.
const MAX_DIET_MEALS = 6;

type DietMeal = {
  id: string;
  time: string;
  name: string;
  items: string[];
  iconName: string;
  icon: any;
};

// Icon-bearing source of truth (mirrors the DEFAULT_TIMELINE convention —
// the "storable" iconName-only version is built once ICON_LIBRARY exists,
// further below).
const DEFAULT_DIET_MEALS_RAW = [
  { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', 'Sattu drink (2 tbsp sattu + water + black salt)'], icon: Sunrise },
  { time: '08:30 AM', name: 'Breakfast', items: ['4 whole eggs + 3 egg whites', '60g oats in water', '1 banana'], icon: Sun },
  { time: '01:00 PM', name: 'Lunch', items: ['1 scoop Whey Isolate in water', '200g grilled/boiled chicken breast', '2 rotis', '1 bowl green sabzi', 'Large mixed salad'], icon: Dumbbell },
  { time: '04:30 PM', name: 'Midday Snack', items: ['200g curd', '1 apple or guava', '15 raw almonds'], icon: Sun },
  { time: '08:00 PM', name: 'Dinner', items: ['150g chicken breast', 'Warm vegetable stew', 'Green salad'], icon: Moon },
  { time: '10:00 PM', name: 'Night Snack', items: ['250ml toned milk', '30g roasted chana'], icon: Moon },
];

const makeDietMealId = () => `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const makeBlankDietMeal = (): Omit<DietMeal, 'icon'> => ({
  id: makeDietMealId(),
  time: '',
  name: 'New Meal',
  items: [],
  iconName: 'Utensils',
});

// ---- Diet target overrides (Calories / Protein / Hydration) ----
// Same "auto unless overridden" convention as OverviewOverrideKey below —
// each defaults to '' (meaning "use the auto-estimate computed from the
// meals above") and only holds real text once someone types a custom value.
type DietOverrideKey = 'calories' | 'protein' | 'hydration';
const DIET_OVERRIDE_KEYS: DietOverrideKey[] = ['calories', 'protein', 'hydration'];
const DEFAULT_DIET_OVERRIDES: Record<DietOverrideKey, string> = { calories: '', protein: '', hydration: '' };

function hydrateDietOverrides(raw: any): Record<DietOverrideKey, string> {
  const out = { ...DEFAULT_DIET_OVERRIDES };
  if (raw && typeof raw === 'object') {
    for (const k of DIET_OVERRIDE_KEYS) {
      if (typeof raw[k] === 'string') out[k] = raw[k];
    }
  }
  return out;
}

// ---- Lightweight nutrition estimator ----
// Not a real food database — just enough per-item approximations (common
// staples plus generic fallbacks) so a new user's calorie / protein /
// hydration targets fill themselves in reasonably from whatever meals they
// type, instead of staying stuck on one person's old hardcoded numbers.
// Every estimate is still fully overridable with real text in Settings.
type NutritionBasis = 'per100g' | 'per100ml' | 'piece';
const FOOD_NUTRITION_DB: Record<string, { basis: NutritionBasis; cal: number; protein: number; waterMl?: number }> = {
  'egg white': { basis: 'piece', cal: 17, protein: 3.6 },
  'egg': { basis: 'piece', cal: 78, protein: 6 },
  'whey': { basis: 'piece', cal: 120, protein: 25 }, // per scoop
  'oats': { basis: 'per100g', cal: 389, protein: 16.9 },
  'banana': { basis: 'piece', cal: 105, protein: 1.3 },
  'chicken': { basis: 'per100g', cal: 165, protein: 31 },
  'paneer': { basis: 'per100g', cal: 265, protein: 18 },
  'tofu': { basis: 'per100g', cal: 144, protein: 15 },
  'fish': { basis: 'per100g', cal: 140, protein: 24 },
  'roti': { basis: 'piece', cal: 120, protein: 3 },
  'chapati': { basis: 'piece', cal: 120, protein: 3 },
  'rice': { basis: 'per100g', cal: 130, protein: 2.7 },
  'dal': { basis: 'per100g', cal: 116, protein: 9 },
  'lentil': { basis: 'per100g', cal: 116, protein: 9 },
  'sabzi': { basis: 'per100g', cal: 80, protein: 3 },
  'vegetable': { basis: 'per100g', cal: 65, protein: 2.5 },
  'salad': { basis: 'per100g', cal: 20, protein: 1 },
  'curd': { basis: 'per100g', cal: 60, protein: 3.5, waterMl: 75 },
  'yogurt': { basis: 'per100g', cal: 60, protein: 3.5, waterMl: 75 },
  'almond': { basis: 'piece', cal: 7, protein: 0.26 },
  'peanut butter': { basis: 'per100g', cal: 588, protein: 25 },
  'peanut': { basis: 'piece', cal: 6, protein: 0.27 },
  'cashew': { basis: 'piece', cal: 9, protein: 0.2 },
  'apple': { basis: 'piece', cal: 95, protein: 0.5 },
  'guava': { basis: 'piece', cal: 68, protein: 2.6 },
  'orange': { basis: 'piece', cal: 62, protein: 1.2 },
  'milk': { basis: 'per100ml', cal: 60, protein: 3.2, waterMl: 100 },
  'chana': { basis: 'per100g', cal: 364, protein: 19 },
  'chickpea': { basis: 'per100g', cal: 364, protein: 19 },
  'sattu': { basis: 'per100g', cal: 380, protein: 20 },
  'soy': { basis: 'per100g', cal: 336, protein: 52 },
  'bread': { basis: 'piece', cal: 80, protein: 3 },
  'potato': { basis: 'per100g', cal: 87, protein: 1.9 },
  'water': { basis: 'per100ml', cal: 0, protein: 0, waterMl: 100 },
  'lemon': { basis: 'piece', cal: 17, protein: 0.6 },
  'chia': { basis: 'per100g', cal: 486, protein: 17 },
};
// Multi-word keys need to be checked before their shorter substrings (e.g.
// "peanut butter" before "peanut"), so this list is sorted longest-first.
const FOOD_NUTRITION_KEYS = Object.keys(FOOD_NUTRITION_DB).sort((a, b) => b.length - a.length);

// Rough gram/ml equivalents for the units people actually type.
const UNIT_TO_GRAMS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, tbsp: 15, tsp: 5, scoop: 30, cup: 240 };
const UNIT_TO_ML: Record<string, number> = { ml: 1, l: 1000, litre: 1000, liter: 1000, tbsp: 15, tsp: 5, cup: 240, glass: 250 };

// Parses one free-text food fragment (e.g. "200g grilled chicken breast")
// into an approximate {cal, protein, waterMl} contribution. Silently
// contributes nothing for anything unrecognised (supplements, spices,
// "black salt", etc.) rather than guessing wildly.
function estimateFragmentNutrition(fragmentRaw: string) {
  const fragment = fragmentRaw.toLowerCase().trim();
  if (!fragment) return { cal: 0, protein: 0, waterMl: 0 };

  const foodKey = FOOD_NUTRITION_KEYS.find((k) => fragment.includes(k));
  if (!foodKey) return { cal: 0, protein: 0, waterMl: 0 };
  const food = FOOD_NUTRITION_DB[foodKey];

  const qtyMatch = /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|ml|l|litre|liter|tbsp|tsp|scoop|cup|glass)?/.exec(fragment);
  const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
  const unit = qtyMatch?.[2];

  let multiplier = 1;
  if (food.basis === 'per100g') {
    const grams = unit ? qty * (UNIT_TO_GRAMS[unit] ?? 1) : qty * 100; // bare number, no unit -> assume ~grams-scale serving
    multiplier = grams / 100;
  } else if (food.basis === 'per100ml') {
    const ml = unit ? qty * (UNIT_TO_ML[unit] ?? 1) : qty * 100;
    multiplier = ml / 100;
  } else {
    // 'piece' basis — a bare count of whole units (eggs, rotis, almonds…)
    multiplier = qty;
  }

  return {
    cal: food.cal * multiplier,
    protein: food.protein * multiplier,
    waterMl: (food.waterMl || 0) * multiplier,
  };
}

// A single item string like "4 whole eggs + 3 egg whites" bundles more than
// one food, so it's split on common separators before estimating.
function estimateItemNutrition(item: string) {
  const fragments = (item || '').split(/\+|,|\band\b/gi);
  return fragments.reduce((sum, frag) => {
    const n = estimateFragmentNutrition(frag);
    return { cal: sum.cal + n.cal, protein: sum.protein + n.protein, waterMl: sum.waterMl + n.waterMl };
  }, { cal: 0, protein: 0, waterMl: 0 });
}

// Sums every item across every meal into a day-level estimate, then formats
// it the same way the old hardcoded DIET.target/protein/hydration strings
// used to read — this is what each Fuel Matrix row shows unless overridden.
function computeDietAutoValues(meals: DietMeal[], profileWeightKg?: number): Record<DietOverrideKey, string> {
  const totals = (meals || []).reduce((sum, m) => {
    const mealTotal = (m.items || []).reduce((s, it) => {
      const n = estimateItemNutrition(it);
      return { cal: s.cal + n.cal, protein: s.protein + n.protein, waterMl: s.waterMl + n.waterMl };
    }, { cal: 0, protein: 0, waterMl: 0 });
    return { cal: sum.cal + mealTotal.cal, protein: sum.protein + mealTotal.protein, waterMl: sum.waterMl + mealTotal.waterMl };
  }, { cal: 0, protein: 0, waterMl: 0 });

  const hasAnyFood = totals.cal > 0 || totals.protein > 0;
  const calRounded = Math.round(totals.cal / 25) * 25;
  const proteinRounded = Math.round(totals.protein);

  // Hydration: a standard 35ml/kg bodyweight baseline (falls back to a 70kg
  // reference if no profile weight is set yet) plus whatever liquid the
  // logged meals already account for, so liquid-heavy meals ask for a touch
  // less separate drinking water.
  const baselineL = (profileWeightKg && profileWeightKg > 0 ? profileWeightKg : 70) * 0.035;
  const dietLiquidL = totals.waterMl / 1000;
  const totalL = Math.round((baselineL + dietLiquidL) * 2) / 2; // nearest 0.5L

  return {
    calories: hasAnyFood ? `~${calRounded} kcal` : 'Add meals below to auto-estimate',
    protein: hasAnyFood ? `~${proteinRounded}g protein` : 'Add meals below to auto-estimate',
    hydration: `~${totalL.toFixed(1)}L water/day`,
  };
}

// Merges the auto-estimate with whatever the person has overridden — an
// empty override string means "stay on auto" for that row, same convention
// as resolveOverviewValues below.
function resolveDietValues(meals: DietMeal[], overrides: Record<DietOverrideKey, string>, profileWeightKg?: number) {
  const auto = computeDietAutoValues(meals, profileWeightKg);
  const resolved = {} as Record<DietOverrideKey, string>;
  for (const k of DIET_OVERRIDE_KEYS) {
    resolved[k] = overrides?.[k] ? overrides[k] : auto[k];
  }
  return { auto, resolved };
}

// ---------- Dashboard Overview: "Today's Shape" / "Fuel Snapshot" ----------
// These two Overview cards used to be permanently hardcoded strings, so
// editing the Timeline in Settings never actually updated them. They now
// auto-derive from real config (Timeline block types/durations, and the
// Fuel Matrix target) so a new user sees correct numbers without touching
// anything — but each row can still be overridden with custom text via
// Settings > Dashboard Overview if someone wants to say something other
// than what the schedule implies.
type OverviewOverrideKey = 'studySessions' | 'training' | 'meals' | 'sleep' | 'calories' | 'protein' | 'hydration';

const OVERVIEW_OVERRIDE_KEYS: OverviewOverrideKey[] = ['studySessions', 'training', 'meals', 'sleep', 'calories', 'protein', 'hydration'];

const DEFAULT_OVERVIEW_OVERRIDES: Record<OverviewOverrideKey, string> = {
  studySessions: '',
  training: '',
  meals: '',
  sleep: '',
  calories: '',
  protein: '',
  hydration: '',
};

function hydrateOverviewOverrides(raw: any): Record<OverviewOverrideKey, string> {
  const out = { ...DEFAULT_OVERVIEW_OVERRIDES };
  if (raw && typeof raw === 'object') {
    for (const k of OVERVIEW_OVERRIDE_KEYS) {
      if (typeof raw[k] === 'string') out[k] = raw[k];
    }
  }
  return out;
}

// 'HH:MM' -> minutes since midnight. Tolerant of missing/malformed values
// so a half-edited timeline block doesn't blow up the summary card.
function timeStrToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return 0;
  return Math.max(0, Math.min(23, parseInt(m[1], 10))) * 60 + Math.max(0, Math.min(59, parseInt(m[2], 10)));
}

function slotDurationMinutes(slot: { start: string; end: string }): number {
  const start = timeStrToMinutes(slot.start);
  const end = timeStrToMinutes(slot.end);
  // Overnight-safe: if the block's end time is earlier than its start
  // (e.g. crosses midnight), treat it as continuing into the next day.
  return end >= start ? end - start : (24 * 60 - start) + end;
}

function formatMinutesDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatClock12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return '—';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

// Reads the live Timeline + resolved Fuel Matrix values to build every auto
// value — this is what each Overview row shows unless the person has typed
// a custom override for that specific row in Settings > Dashboard Overview.
// `dietResolved` is whatever the Fuel Matrix (Settings > Training & Fuel)
// currently shows for calories/protein/hydration — auto-estimated from the
// meals there, or that section's own custom override, whichever is active —
// so this Overview row can still be independently overridden on top of that.
function computeOverviewAutoValues(timeline: any[], dietResolved: Record<DietOverrideKey, string>): Record<OverviewOverrideKey, string> {
  const studySlots = (timeline || []).filter((s) => s.type === 'study');
  const gymSlots = (timeline || []).filter((s) => s.type === 'gym');
  const mealSlots = (timeline || []).filter((s) => s.type === 'meal');
  const sleepSlot = (timeline || []).find((s) => s.type === 'sleep');

  const studyMinutes = studySlots.reduce((sum, s) => sum + slotDurationMinutes(s), 0);
  const gymMinutes = gymSlots.reduce((sum, s) => sum + slotDurationMinutes(s), 0);

  return {
    studySessions: studySlots.length
      ? `${studySlots.length} block${studySlots.length === 1 ? '' : 's'} · ~${formatMinutesDuration(studyMinutes)}`
      : 'Not scheduled',
    training: gymSlots.length ? `${formatMinutesDuration(gymMinutes)} window` : 'Rest day',
    meals: mealSlots.length ? `${mealSlots.length} fuel window${mealSlots.length === 1 ? '' : 's'}` : 'Not scheduled',
    sleep: sleepSlot ? `${formatClock12(sleepSlot.start)} sharp` : 'Not scheduled',
    calories: dietResolved.calories,
    protein: dietResolved.protein,
    hydration: dietResolved.hydration,
  };
}

// Merges auto-computed values with whatever the person has overridden —
// an empty override string means "stay on auto" for that row.
function resolveOverviewValues(timeline: any[], overrides: Record<OverviewOverrideKey, string>, dietResolved: Record<DietOverrideKey, string>) {
  const auto = computeOverviewAutoValues(timeline, dietResolved);
  const resolved = {} as Record<OverviewOverrideKey, string>;
  for (const k of OVERVIEW_OVERRIDE_KEYS) {
    resolved[k] = overrides?.[k] ? overrides[k] : auto[k];
  }
  return { auto, resolved };
}

const DEFAULT_TRAINING = [
  { day: 'Monday', focus: 'Gym Upper Body (Pull Focus)', exercises: [{ name: 'Lat Pulldowns', sets: '4×12' }, { name: 'Seated Cable Rows', sets: '3×12' }, { name: 'DB Lateral Raises', sets: '4×20' }, { name: 'Behind-the-Back Wrist Curls', sets: '4×20 (high pump)' }], mode: 'gym' },
  { day: 'Tuesday', focus: 'Calisthenics Pull & Push Basics', exercises: [{ name: 'Dead-hang holds', sets: '4×Max' }, { name: 'Negative Pull-ups', sets: '4×5 (5-sec slow descent)' }, { name: 'Standard Push-ups', sets: '4×12' }], mode: 'calisthenics' },
  { day: 'Wednesday', focus: 'Legs & Deep Core Compression', exercises: [{ name: 'Goblet Squats', sets: '4×12' }, { name: 'Romanian Deadlifts', sets: '3×12' }, { name: 'Hanging Leg / Knee Raises', sets: '4×12' }, { name: 'Stomach Vacuums (structural planks)', sets: '3×60s' }], mode: 'gym' },
  { day: 'Thursday', focus: 'Gym Upper Body (Push Focus)', exercises: [{ name: 'Overhead DB Press', sets: '4×10' }, { name: 'Incline DB Bench Press', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }], mode: 'gym' },
  { day: 'Friday', focus: 'Calisthenics Push & Absolute Core', exercises: [{ name: 'Diamond Push-ups', sets: '4×12' }, { name: 'Pike Push-ups', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }, { name: 'L-Sit Progressions', sets: '4×Max holds' }], mode: 'calisthenics' },
  { day: 'Saturday', focus: 'Back & Shoulder Hypertrophy Burnout', exercises: [{ name: 'Straight-Arm Cable Pull-overs', sets: '4×12' }, { name: 'Face Pulls', sets: '3×20' }, { name: 'DB Lateral Raises (drop sets)', sets: '4×20' }, { name: 'Hammer Curls', sets: '3×12' }, { name: 'Finger Roll Grip Curls', sets: '4×25' }], mode: 'gym' },
  { day: 'Sunday', focus: 'Full Rest Day', exercises: [{ name: 'Deep physical stretching', sets: '—' }, { name: 'Zero training load', sets: '—' }, { name: 'Mental recovery', sets: '—' }], mode: 'rest' },
];

// ---------- Subjects & Syllabus (now user-editable, see ConfigContext) ----------
// DEFAULT_SUBJECTS / DEFAULT_SYLLABUS below are the fallback used for any
// account that hasn't customized its own subject list yet (i.e. every
// existing account today, since these fields are new) — same convention as
// DEFAULT_TRACKER_ITEMS / DEFAULT_TIMELINE / DEFAULT_TRAINING / DEFAULT_PROFILE.
// `color` is a name from SUBJECT_COLOR_PALETTE (a fixed set of Tailwind
// class strings), not a raw class, since Tailwind can't resolve dynamically
// built class names like `text-${color}-400`.
const DEFAULT_SUBJECTS = [
  { key: 'math', label: 'Mathematics', color: 'sky', inMockTest: true },
  { key: 'physics', label: 'Physics', color: 'violet', inMockTest: true },
  { key: 'chem', label: 'Chemistry', color: 'fuchsia', inMockTest: true },
  { key: 'mixed', label: 'Mixed / PYQ', color: 'amber', inMockTest: false },
];

const DEFAULT_SYLLABUS = [
  { phase: 1, month: 'July', label: 'Core Foundations', subjects: {
    math: ['Basic Maths', 'Logs', 'Quadratics', 'Sequences & Series', 'Trigonometry'],
    physics: ['Units & Dimensions', 'Vectors', 'Kinematics (1D/2D)', 'NLM & Friction', 'WPE'],
    chem: ['Mole Concept', 'Atomic Structure', 'Periodic Table', 'Chemical Bonding', 'GOC'],
  }},
  { phase: 2, month: 'August', label: "11th Heavyweights", subjects: {
    math: ['Complex Numbers', 'P&C', 'Binomial Theorem', 'Coordinate Geometry (Lines, Circles, Conics)'],
    physics: ['COM & Collisions', 'Rotational Motion', 'Gravitation', 'SHM', 'Fluids', 'Waves & Sound', 'Thermodynamics & KTG'],
    chem: ['Chemical & Ionic Equilibrium', 'Thermodynamics', 'Redox', 'Hydrocarbons'],
  }},
  { phase: 3, month: 'September', label: '12th Core Mechanical Blocks', subjects: {
    math: ['Functions', 'ITF', 'Limits, Continuity, Differentiability', 'MOD', 'AOD', 'Matrices & Determinants'],
    physics: ['Electrostatics', 'Gauss Law', 'Capacitance', 'Current Electricity', 'Magnetic Effects', 'Magnetism & Matter'],
    chem: ['Solutions', 'Electrochemistry', 'Kinetics', 'Coordination Compounds', 'd/f-Block', 'Alkyl/Aryl Halides', 'Alcohols, Phenols & Ethers'],
  }},
  { phase: 4, month: 'October', label: 'High-Scoring Finales', subjects: {
    math: ['Indefinite/Definite Integration', 'Area under curves', 'Differential Equations', 'Vectors', '3D Geometry', 'Probability', 'Statistics'],
    physics: ['EMI', 'AC', 'EM Waves', 'Ray & Wave Optics', 'Modern Physics', 'Semiconductors'],
    chem: ['Aldehydes, Ketones, Carboxylic Acids', 'Amines', 'p-Block', 'Biomolecules', 'Polymers', 'Surface Chemistry'],
  }},
];

// A subject's presence in the Mock Test Tracker form used to be inferred
// silently from whether it had any syllabus content anywhere (a catch-all
// like "Mixed / PYQ" has none, so it never got a score box). That's now an
// explicit, user-editable `inMockTest` flag on each subject (see Settings >
// Subjects & Syllabus). For subjects saved before this flag existed, fall
// back to that same syllabus-content inference so existing setups don't
// change until the person actually touches the new toggle.
function hydrateSubjects(rawSubjects: any, syllabusForInference: any[]): any[] {
  const list = Array.isArray(rawSubjects) && rawSubjects.length ? rawSubjects : DEFAULT_SUBJECTS;
  return list.map((s: any) => ({
    ...s,
    inMockTest: typeof s.inMockTest === 'boolean'
      ? s.inMockTest
      : syllabusForInference.some((p: any) => Array.isArray(p?.subjects?.[s.key])),
  }));
}
// The syllabus roadmap shows *what* to study, but nothing previously tracked
// *when a topic was last revisited* — the actual mechanism behind forgetting
// month-1 material by month-4. This gives every topic a "last revised" stamp
// and flags anything gone stale.
//
// Topic names aren't unique across phases (e.g. "Vectors" appears in both
// Phase 1 physics and Phase 4 math), so tracking is keyed by phase+subject+topic.

const REVISION_FRESH_DAYS = 7;   // revised within this window: considered fresh
const REVISION_DUE_DAYS = 14;    // beyond this: overdue, needs attention

function getTopicRevisionKey(phase, subject, topic) {
  return `${phase}|${subject}|${topic}`;
}

function getDaysSinceDate(dateStr) {
  const then = new Date(dateStr + 'T00:00:00').getTime();
  const now = new Date(getLocalDateString() + 'T00:00:00').getTime();
  return Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
}

function getRevisionStatus(lastRevisedStr) {
  if (!lastRevisedStr) return { status: 'never', days: null };
  const days = getDaysSinceDate(lastRevisedStr);
  if (days < REVISION_FRESH_DAYS) return { status: 'fresh', days };
  if (days < REVISION_DUE_DAYS) return { status: 'due', days };
  return { status: 'overdue', days };
}

// Was a module-level const built off a hardcoded ['math','physics','chem']
// list; now a function over whatever subject keys the live syllabus (from
// ConfigContext) actually contains, so a user's own custom subject list
// works the same way the original 3 did.
function getAllSyllabusTopics(syllabus: any[]) {
  return syllabus.flatMap((p) =>
    Object.keys(p.subjects).flatMap((subject) =>
      p.subjects[subject].map((topic: string) => ({
        key: getTopicRevisionKey(p.phase, subject, topic),
        topic,
        subject,
        phase: p.phase,
        month: p.month,
      }))
    )
  );
}

const DEFAULT_TRACKER_ITEMS = [
  { id: 't1', label: '5 AM Wake-Up' },
  { id: 't2', label: 'Math Block' },
  { id: 't3', label: 'Physics Block' },
  { id: 't4', label: 'Chemistry Block' },
  { id: 't5', label: '11:30 AM Gym' },
  { id: 't6', label: 'All 6 Meals Hit' },
  { id: 't7', label: 'Supplements' },
  { id: 't8', label: 'Grooming Routine' },
  { id: 't9', label: '4L+ Water Hit' },
  { id: 't10', label: '11 PM Sleep Lock' },
];

// ---------- Config Editability ----------
// TRACKER_ITEMS, TIMELINE, and TRAINING used to be hardcoded constants —
// updating the daily routine as the exam gets closer meant editing source
// code. They're now user-editable, backed by localStorage, with these
// DEFAULT_* arrays as the fallback / "Reset to default" target. Everything
// downstream reads the *live* config (via ConfigContext) instead of these
// constants directly.

// Icons can't survive JSON.stringify, so timeline blocks are persisted with
// an `iconName` string key into this small curated set, and resolved back to
// a component at render time.
const ICON_LIBRARY: Record<string, any> = {
  Sunrise, Sun, Moon, BookOpen, Utensils, Dumbbell, Timer, Sparkles,
  Target, Flame, Activity, Droplets, Bell, ClipboardList, Music2,
};
const ICON_LIBRARY_KEYS = Object.keys(ICON_LIBRARY);

function resolveIconName(icon: any): string {
  const found = Object.entries(ICON_LIBRARY).find(([, comp]) => comp === icon);
  return found ? found[0] : 'BookOpen';
}

const DEFAULT_TIMELINE_STORABLE = DEFAULT_TIMELINE.map((slot) => ({
  ...slot,
  iconName: resolveIconName(slot.icon),
}));

function hydrateTimeline(rawList: any[]): any[] {
  return rawList.map((slot, i) => ({
    start: slot.start ?? '00:00',
    end: slot.end ?? slot.start ?? '00:00',
    label: slot.label || `Block ${i + 1}`,
    detail: slot.detail || '',
    type: ['study', 'gym', 'meal', 'prep', 'sleep'].includes(slot.type) ? slot.type : 'prep',
    subject: slot.subject || undefined,
    longDesc: slot.longDesc || '',
    iconName: slot.iconName && ICON_LIBRARY[slot.iconName] ? slot.iconName : 'BookOpen',
    icon: ICON_LIBRARY[slot.iconName] || BookOpen,
  }));
}

// Same "storable" convention as DEFAULT_TIMELINE_STORABLE above — this is
// what a brand-new account's Fuel Matrix starts from, and what "Reset to
// default" in Settings > Training & Fuel restores.
const DEFAULT_DIET_STORABLE = DEFAULT_DIET_MEALS_RAW.map((m, i) => ({
  id: `diet_default_${i}`,
  time: m.time,
  name: m.name,
  items: m.items,
  iconName: resolveIconName(m.icon),
}));

function hydrateDiet(rawList: any): DietMeal[] {
  const list = Array.isArray(rawList) && rawList.length ? rawList : DEFAULT_DIET_STORABLE;
  // Hard-capped at MAX_DIET_MEALS even on load, so old/foreign data can
  // never sneak past the 6-meal ceiling enforced in the Settings editor.
  return list.slice(0, MAX_DIET_MEALS).map((m: any, i: number) => {
    const iconName = typeof m?.iconName === 'string' && ICON_LIBRARY[m.iconName] ? m.iconName : 'Utensils';
    return {
      id: typeof m?.id === 'string' && m.id ? m.id : makeDietMealId(),
      time: typeof m?.time === 'string' ? m.time : '',
      name: typeof m?.name === 'string' && m.name ? m.name : `Meal ${i + 1}`,
      items: Array.isArray(m?.items) ? m.items.filter((it: any) => typeof it === 'string') : [],
      iconName,
      icon: ICON_LIBRARY[iconName] || Utensils,
    };
  });
}

function serializeConfig(config: { trackerItems: any[]; timeline: any[]; training: any[]; profile: any; subjects: any[]; syllabus: any[]; countdowns: any[]; overviewOverrides: Record<OverviewOverrideKey, string>; diet: DietMeal[]; dietOverrides: Record<DietOverrideKey, string>; tabLabels: Record<TabLabelKey, string>; tabIcons: Record<TabLabelKey, string>; sectionLabels: Record<string, { label: string; icon: string }> }) {
  return {
    trackerItems: config.trackerItems,
    training: config.training,
    timeline: config.timeline.map(({ icon, ...rest }) => rest),
    profile: config.profile,
    subjects: config.subjects,
    syllabus: config.syllabus,
    countdowns: config.countdowns,
    overviewOverrides: config.overviewOverrides,
    diet: config.diet.map(({ icon, ...rest }) => rest),
    dietOverrides: config.dietOverrides,
    tabLabels: config.tabLabels,
    tabIcons: config.tabIcons,
    sectionLabels: config.sectionLabels,
  };
}

function hydrateCountdown(raw: any, fallbackIndex = 0): CountdownItem {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : makeCountdownId(),
    label: typeof raw?.label === 'string' ? raw.label : '',
    targetDate: typeof raw?.targetDate === 'string' ? raw.targetDate : '',
    targetTime: typeof raw?.targetTime === 'string' ? raw.targetTime : '00:00',
    startMs: typeof raw?.startMs === 'number' ? raw.startMs : null,
    // Older saves (before colors existed) get one assigned by rotation
    // rather than everything defaulting to the same 'sky'.
    color: typeof raw?.color === 'string' && COUNTDOWN_COLOR_PALETTE[raw.color]
      ? raw.color
      : COUNTDOWN_COLOR_NAMES[fallbackIndex % COUNTDOWN_COLOR_NAMES.length],
  };
}

function deserializeConfig(raw: any) {
  // Migration chain, oldest to newest, so nobody's already-set countdown
  // silently disappears when this shipped as multi-countdown:
  //  1. `countdowns` array (current shape) — used as-is if present.
  //  2. a single `countdown` object (the shape this shipped with initially)
  //     — wrapped into a one-item array.
  //  3. `profile.targetDate` (the very first version, before Settings had
  //     its own Countdown section at all) — wrapped into a one-item array.
  let migratedCountdowns: CountdownItem[] | null = null;
  if (!Array.isArray(raw?.countdowns)) {
    if (raw?.countdown && typeof raw.countdown === 'object' && raw.countdown.targetDate) {
      migratedCountdowns = [hydrateCountdown(raw.countdown)];
    } else if (typeof raw?.profile?.targetDate === 'string' && raw.profile.targetDate) {
      migratedCountdowns = [hydrateCountdown({
        targetDate: raw.profile.targetDate,
        label: raw?.profile?.targets?.[0]?.name || raw?.profile?.goalLabel || '',
      })];
    }
  }

  return {
    trackerItems: Array.isArray(raw?.trackerItems) && raw.trackerItems.length ? raw.trackerItems : DEFAULT_TRACKER_ITEMS,
    training: Array.isArray(raw?.training) && raw.training.length ? raw.training : DEFAULT_TRAINING,
    timeline: Array.isArray(raw?.timeline) && raw.timeline.length ? hydrateTimeline(raw.timeline) : hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
    profile: raw?.profile && typeof raw.profile === 'object'
      ? {
          ...DEFAULT_PROFILE,
          ...raw.profile,
          // Migration: pre-birthdate saves only have a static numeric
          // `age`. Back-calculate an approximate birthdate from it so age
          // starts auto-updating going forward instead of staying frozen.
          birthdate: typeof raw.profile.birthdate === 'string' && raw.profile.birthdate
            ? raw.profile.birthdate
            : typeof raw.profile.age === 'number'
            ? estimateBirthdateFromLegacyAge(raw.profile.age)
            : DEFAULT_PROFILE.birthdate,
        }
      : DEFAULT_PROFILE,
    subjects: hydrateSubjects(raw?.subjects, Array.isArray(raw?.syllabus) && raw.syllabus.length ? raw.syllabus : DEFAULT_SYLLABUS),
    syllabus: Array.isArray(raw?.syllabus) && raw.syllabus.length ? raw.syllabus : DEFAULT_SYLLABUS,
    countdowns: Array.isArray(raw?.countdowns)
      ? raw.countdowns.map((cd: any, i: number) => hydrateCountdown(cd, i))
      : (migratedCountdowns ?? DEFAULT_COUNTDOWNS),
    overviewOverrides: hydrateOverviewOverrides(raw?.overviewOverrides),
    diet: hydrateDiet(raw?.diet),
    dietOverrides: hydrateDietOverrides(raw?.dietOverrides),
    tabLabels: hydrateTabLabels(raw?.tabLabels),
    tabIcons: hydrateTabIcons(raw?.tabIcons),
    sectionLabels: hydrateSectionLabels(raw?.sectionLabels),
  };
}

const CONFIG_STORAGE_KEY = 'app_config_v1';

// Shared icon palette for every "pick an icon" control in Settings — both
// the sidebar Tab Names & Icons editor and any per-tab sub-section editor
// (e.g. Dashboard Overview's cards) draw from this same set, referenced by
// a short string key so it can be stored in localStorage/JSON safely
// (React components can't be serialized, so we never store the icon itself).
const ICON_OPTIONS: Record<string, any> = {
  layoutGrid: LayoutGrid,
  clock3: Clock3,
  dumbbell: Dumbbell,
  bookOpen: BookOpen,
  clipboardList: ClipboardList,
  timer: Timer,
  calendar: Calendar,
  settings: Settings,
  userCircle2: UserCircle2,
  target: Target,
  graduationCap: GraduationCap,
  flame: Flame,
  activity: Activity,
  trendingUp: TrendingUp,
  sparkles: Sparkles,
  crown: Crown,
  swords: Swords,
  shieldCheck: ShieldCheck,
  barChart3: BarChart3,
  music2: Music2,
  bell: Bell,
  checkCircle2: CheckCircle2,
  sun: Sun,
  moon: Moon,
  utensils: Utensils,
  droplets: Droplets,
  ruler: Ruler,
  weight: Weight,
  smile: Smile,
  eye: Eye,
  rotateCcw: RotateCcw,
  alertTriangle: AlertTriangle,
};

const ICON_OPTION_KEYS = Object.keys(ICON_OPTIONS);

// Tab names AND icons shown in the sidebar are user-editable (Settings >
// Tab Names & Icons), same "auto unless overridden" convention as
// OverviewOverrideKey above. Keyed by every sidebar destination — the 7
// TABS entries (defined further below) plus the two pinned Settings/Account
// buttons, which aren't in TABS since they're rendered separately at the
// bottom of the rail.
type TabLabelKey = 'overview' | 'timeline' | 'training' | 'syllabus' | 'mocktests' | 'ashclock' | 'history' | 'settings' | 'account';

const TAB_LABEL_KEYS: TabLabelKey[] = ['overview', 'timeline', 'training', 'syllabus', 'mocktests', 'ashclock', 'history', 'settings', 'account'];

const DEFAULT_TAB_LABELS: Record<TabLabelKey, string> = {
  overview: 'Dashboard Overview',
  timeline: 'Master Timeline',
  training: 'Training & Fuel',
  syllabus: 'Syllabus Roadmap',
  mocktests: 'Mock Test Tracker',
  ashclock: 'Clock',
  history: 'Performance Calendar',
  settings: 'Settings',
  account: 'Account',
};

// Matches each tab's shipped icon (see TABS below, and the pinned
// Settings/Account buttons in the sidebar).
const DEFAULT_TAB_ICONS: Record<TabLabelKey, string> = {
  overview: 'layoutGrid',
  timeline: 'clock3',
  training: 'dumbbell',
  syllabus: 'bookOpen',
  mocktests: 'clipboardList',
  ashclock: 'timer',
  history: 'calendar',
  settings: 'settings',
  account: 'userCircle2',
};

function hydrateTabLabels(raw: any): Record<TabLabelKey, string> {
  const out = { ...DEFAULT_TAB_LABELS };
  if (raw && typeof raw === 'object') {
    for (const k of TAB_LABEL_KEYS) {
      if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k];
    }
  }
  return out;
}

function hydrateTabIcons(raw: any): Record<TabLabelKey, string> {
  const out = { ...DEFAULT_TAB_ICONS };
  if (raw && typeof raw === 'object') {
    for (const k of TAB_LABEL_KEYS) {
      if (typeof raw[k] === 'string' && ICON_OPTIONS[raw[k]]) out[k] = raw[k];
    }
  }
  return out;
}

// Sub-section labels/icons — the named panels *inside* a tab (e.g. Dashboard
// Overview's "Profile", "Targets", "Today's Shape" cards). Each entry is
// keyed by a stable id prefixed with the tab it lives in ('ov_' = Dashboard
// Overview, 'tl_' = Timeline, 'tf_' = Training & Fuel, 'syl_' = Syllabus,
// 'mt_' = Mock Tests, 'ac_' = Account, 'hist_' = History, 'clk_' = Clock) so
// every tab's sub-sections can share this one map without id collisions.
// `group` is display-only metadata used to cluster rows by tab in Settings.
const SECTION_LABEL_ROWS: { key: string; defaultLabel: string; defaultIcon: string; group: string; tabKey: TabLabelKey }[] = [
  // Dashboard Overview
  { key: 'ov_countdown', defaultLabel: 'Countdown', defaultIcon: 'target', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_profile', defaultLabel: 'Profile', defaultIcon: 'graduationCap', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_targets', defaultLabel: 'Targets', defaultIcon: 'target', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_shape', defaultLabel: "Today's Shape", defaultIcon: 'clock3', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_fuel', defaultLabel: 'Fuel Snapshot', defaultIcon: 'flame', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_syllabus', defaultLabel: 'Syllabus Runway', defaultIcon: 'calendar', group: 'Dashboard Overview', tabKey: 'overview' },
  // Timeline
  { key: 'tl_master', defaultLabel: 'Master Timeline', defaultIcon: 'clock3', group: 'Timeline', tabKey: 'timeline' },
  { key: 'tl_weight', defaultLabel: 'Body Weight Trend', defaultIcon: 'trendingUp', group: 'Timeline', tabKey: 'timeline' },
  // Training & Fuel
  { key: 'tf_workout', defaultLabel: 'Hybrid Vascularity Workout Split', defaultIcon: 'dumbbell', group: 'Training & Fuel', tabKey: 'training' },
  { key: 'tf_fuel', defaultLabel: 'Fuel Matrix', defaultIcon: 'flame', group: 'Training & Fuel', tabKey: 'training' },
  // Syllabus
  { key: 'syl_runway', defaultLabel: 'Syllabus Runway', defaultIcon: 'bookOpen', group: 'Syllabus', tabKey: 'syllabus' },
  { key: 'syl_revision', defaultLabel: 'Revision Due', defaultIcon: 'rotateCcw', group: 'Syllabus', tabKey: 'syllabus' },
  // Mock Tests
  { key: 'mt_log', defaultLabel: 'Log a Mock Test', defaultIcon: 'clipboardList', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_trend', defaultLabel: 'Score Trend', defaultIcon: 'barChart3', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_weak', defaultLabel: 'Weak Topic Priority', defaultIcon: 'alertTriangle', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_testlog', defaultLabel: 'Test Log', defaultIcon: 'clipboardList', group: 'Mock Tests', tabKey: 'mocktests' },
  // Clock
  { key: 'clk_subjecthours', defaultLabel: 'Subject Hours', defaultIcon: 'barChart3', group: 'Clock', tabKey: 'ashclock' },
  // History
  { key: 'hist_heatmap', defaultLabel: 'Execution Heatmap Analytics', defaultIcon: 'calendar', group: 'History', tabKey: 'history' },
  // Account
  { key: 'ac_account', defaultLabel: 'Account', defaultIcon: 'userCircle2', group: 'Account', tabKey: 'account' },
  { key: 'ac_backup', defaultLabel: 'Data Backup & Restore', defaultIcon: 'shieldCheck', group: 'Account', tabKey: 'account' },
];

const DEFAULT_SECTION_LABELS: Record<string, { label: string; icon: string }> = SECTION_LABEL_ROWS.reduce(
  (acc, { key, defaultLabel, defaultIcon }) => ({ ...acc, [key]: { label: defaultLabel, icon: defaultIcon } }),
  {} as Record<string, { label: string; icon: string }>
);

function hydrateSectionLabels(raw: any): Record<string, { label: string; icon: string }> {
  const out: Record<string, { label: string; icon: string }> = {};
  for (const { key, defaultLabel, defaultIcon } of SECTION_LABEL_ROWS) {
    const r = raw && typeof raw === 'object' ? raw[key] : null;
    out[key] = {
      label: r && typeof r.label === 'string' && r.label.trim() ? r.label : defaultLabel,
      icon: r && typeof r.icon === 'string' && ICON_OPTIONS[r.icon] ? r.icon : defaultIcon,
    };
  }
  return out;
}

const ConfigContext = React.createContext<{
  trackerItems: any[];
  timeline: any[];
  training: any[];
  profile: any;
  subjects: any[];
  syllabus: any[];
  countdowns: CountdownItem[];
  overviewOverrides: Record<OverviewOverrideKey, string>;
  diet: DietMeal[];
  dietOverrides: Record<DietOverrideKey, string>;
  tabLabels: Record<TabLabelKey, string>;
  tabIcons: Record<TabLabelKey, string>;
  sectionLabels: Record<string, { label: string; icon: string }>;
  updateConfig: (partial: Record<string, any>) => void;
  resetConfigSection: (key: 'trackerItems' | 'timeline' | 'training' | 'profile' | 'subjects' | 'syllabus' | 'countdowns' | 'overviewOverrides' | 'diet' | 'dietOverrides' | 'tabLabels' | 'tabIcons' | 'sectionLabels') => void;
}>({
  trackerItems: DEFAULT_TRACKER_ITEMS,
  timeline: hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
  training: DEFAULT_TRAINING,
  profile: DEFAULT_PROFILE,
  subjects: DEFAULT_SUBJECTS,
  syllabus: DEFAULT_SYLLABUS,
  countdowns: DEFAULT_COUNTDOWNS,
  overviewOverrides: DEFAULT_OVERVIEW_OVERRIDES,
  diet: hydrateDiet(DEFAULT_DIET_STORABLE),
  dietOverrides: DEFAULT_DIET_OVERRIDES,
  tabLabels: DEFAULT_TAB_LABELS,
  tabIcons: DEFAULT_TAB_ICONS,
  sectionLabels: DEFAULT_SECTION_LABELS,
  updateConfig: () => {},
  resetConfigSection: () => {},
});

// ---------- Hunter Rank Progression (Solo Leveling-flavored meta layer) ----------
// Rank climbs permanently based on total lifetime days where every single
// Daily Matrix objective was hit — a slow-burn reward tied to real consistency,
// not just today's percentage.
const HUNTER_RANKS = [
  { rank: 'E', threshold: 0, label: 'E-Rank Hunter', color: '#94a3b8' },
  { rank: 'D', threshold: 5, label: 'D-Rank Hunter', color: '#38bdf8' },
  { rank: 'C', threshold: 15, label: 'C-Rank Hunter', color: '#22d3ee' },
  { rank: 'B', threshold: 30, label: 'B-Rank Hunter', color: '#a78bfa' },
  { rank: 'A', threshold: 60, label: 'A-Rank Hunter', color: '#fbbf24' },
  { rank: 'S', threshold: 100, label: 'S-Rank — Shadow Monarch', color: '#f472b6' },
];

function getHunterRank(clearedDays) {
  let current = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) {
    if (clearedDays >= r.threshold) current = r;
  }
  return current;
}

// Counts consecutive fully-cleared days leading up to today. If today isn't
// finished yet, it doesn't break the streak — it just isn't counted yet,
// so the flame doesn't die mid-afternoon just because the day is in progress.
function computeCurrentStreak(globalHistory, todayStr, trackerItems = DEFAULT_TRACKER_ITEMS) {
  const isDayComplete = (dateStr) => {
    const dayObj = globalHistory[dateStr];
    return !!dayObj && trackerItems.every((item) => dayObj[item.id]);
  };

  let streak = 0;
  const cursor = new Date(todayStr + 'T00:00:00');
  if (!isDayComplete(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const dStr = getLocalDateString(cursor);
    if (!isDayComplete(dStr)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

const TABS = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutGrid },
  { id: 'timeline', label: 'Master Timeline', icon: Clock3 },
  { id: 'training', label: 'Training & Fuel', icon: Dumbbell },
  { id: 'syllabus', label: 'Syllabus Roadmap', icon: BookOpen },
  { id: 'mocktests', label: 'Mock Test Tracker', icon: ClipboardList },
  { id: 'ashclock', label: 'Clock', icon: Timer },
  { id: 'history', label: 'Performance Calendar', icon: Calendar },
];

// Subject color is stored as a *name* (e.g. 'sky'), never a raw Tailwind
// class — Tailwind can't resolve a dynamically built string like
// `text-${color}-400`, so every place that used to index into a hardcoded
// SUBJECT_STYLE map now calls getSubjectStyle(key, subjects) instead, which
// looks the chosen color up in this fixed palette. Same 'color name' idea
// generateProfileTargets() already uses for targets[].color.
const SUBJECT_COLOR_PALETTE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  sky:      { text: 'text-indigo-400',      bg: 'bg-indigo-500/10',      border: 'border-indigo-500/30',      dot: 'bg-indigo-400' },
  violet:   { text: 'text-violet-400',   bg: 'bg-violet-500/10',   border: 'border-violet-500/30',   dot: 'bg-violet-400' },
  fuchsia:  { text: 'text-fuchsia-400',  bg: 'bg-fuchsia-500/10',  border: 'border-fuchsia-500/30',  dot: 'bg-fuchsia-400' },
  amber:    { text: 'text-amber-400',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    dot: 'bg-amber-400' },
  emerald:  { text: 'text-emerald-400',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  dot: 'bg-emerald-400' },
  rose:     { text: 'text-rose-400',     bg: 'bg-rose-500/10',     border: 'border-rose-500/30',     dot: 'bg-rose-400' },
};

function getSubjectStyle(key: string, subjects: { key: string; color: string }[]) {
  const found = subjects.find((s) => s.key === key);
  return SUBJECT_COLOR_PALETTE[found?.color || 'sky'];
}

// Hex counterparts of SUBJECT_COLOR_PALETTE for contexts (raw SVG stroke/fill
// attributes) where a Tailwind class string doesn't apply.
const SUBJECT_COLOR_HEX: Record<string, string> = {
  sky: '#38bdf8',
  violet: '#a78bfa',
  fuchsia: '#e879f9',
  amber: '#fbbf24',
  emerald: '#34d399',
  rose: '#fb7185',
};

function getSubjectHex(key: string, subjects: { key: string; color: string }[]) {
  const found = subjects.find((s) => s.key === key);
  return SUBJECT_COLOR_HEX[found?.color || 'sky'];
}

// Same 'stored as a name' convention as SUBJECT_COLOR_PALETTE, but with a
// wider set — countdowns often sit side by side in one card, so more
// variants means less chance two active targets look identical.
const COUNTDOWN_COLOR_PALETTE: Record<string, { text: string; tileBg: string; tileBorder: string; barBg: string; dot: string }> = {
  sky:      { text: 'text-indigo-400',      tileBg: 'bg-indigo-500/[0.03]',      tileBorder: 'border-indigo-500/20',      barBg: 'bg-indigo-500/60',      dot: 'bg-indigo-400' },
  violet:   { text: 'text-violet-400',   tileBg: 'bg-violet-500/[0.03]',   tileBorder: 'border-violet-500/20',   barBg: 'bg-violet-500/60',   dot: 'bg-violet-400' },
  fuchsia:  { text: 'text-fuchsia-400',  tileBg: 'bg-fuchsia-500/[0.03]',  tileBorder: 'border-fuchsia-500/20',  barBg: 'bg-fuchsia-500/60',  dot: 'bg-fuchsia-400' },
  amber:    { text: 'text-amber-400',    tileBg: 'bg-amber-500/[0.03]',    tileBorder: 'border-amber-500/20',    barBg: 'bg-amber-500/60',    dot: 'bg-amber-400' },
  emerald:  { text: 'text-emerald-400',  tileBg: 'bg-emerald-500/[0.03]',  tileBorder: 'border-emerald-500/20',  barBg: 'bg-emerald-500/60',  dot: 'bg-emerald-400' },
  rose:     { text: 'text-rose-400',     tileBg: 'bg-rose-500/[0.03]',     tileBorder: 'border-rose-500/20',     barBg: 'bg-rose-500/60',     dot: 'bg-rose-400' },
  cyan:     { text: 'text-cyan-400',     tileBg: 'bg-cyan-500/[0.03]',     tileBorder: 'border-cyan-500/20',     barBg: 'bg-cyan-500/60',     dot: 'bg-cyan-400' },
  orange:   { text: 'text-orange-400',   tileBg: 'bg-orange-500/[0.03]',   tileBorder: 'border-orange-500/20',   barBg: 'bg-orange-500/60',   dot: 'bg-orange-400' },
  lime:     { text: 'text-lime-400',     tileBg: 'bg-lime-500/[0.03]',     tileBorder: 'border-lime-500/20',     barBg: 'bg-lime-500/60',     dot: 'bg-lime-400' },
  pink:     { text: 'text-pink-400',     tileBg: 'bg-pink-500/[0.03]',     tileBorder: 'border-pink-500/20',     barBg: 'bg-pink-500/60',     dot: 'bg-pink-400' },
  indigo:   { text: 'text-indigo-400',   tileBg: 'bg-indigo-500/[0.03]',   tileBorder: 'border-indigo-500/20',   barBg: 'bg-indigo-500/60',   dot: 'bg-indigo-400' },
  teal:     { text: 'text-teal-400',     tileBg: 'bg-teal-500/[0.03]',     tileBorder: 'border-teal-500/20',     barBg: 'bg-teal-500/60',     dot: 'bg-teal-400' },
};

const COUNTDOWN_COLOR_NAMES = Object.keys(COUNTDOWN_COLOR_PALETTE);

function getCountdownColor(name?: string) {
  return COUNTDOWN_COLOR_PALETTE[name || 'sky'] || COUNTDOWN_COLOR_PALETTE.sky;
}

// ---------- Helper Functions for Date & LocalStorage ----------

const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localizedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localizedDate.toISOString().split('T')[0];
};

const getDayName = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');

// Derives a whole-years age from a 'YYYY-MM-DD' birthdate, as of today.
// Returns null for anything blank/unparseable so callers can show a
// friendly placeholder instead of "NaN-year-old".
function calculateAge(birthdate: string | undefined | null): number | null {
  if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

// One-way migration for accounts saved before `birthdate` existed: they only
// have a static `age` number, which would otherwise never update again. We
// back-calculate an approximate birthdate (today minus that many years) so
// age starts auto-updating from here on, instead of staying frozen forever.
function estimateBirthdateFromLegacyAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return getLocalDateString(d);
}

// Precise, ticking countdown to an exact date+time (not just a day count).
// >= 24h remaining  -> "DD:HH:MM" (days:hours:minutes)
// <  24h remaining  -> "HH:MM:SS" (hours:minutes:seconds), ticks live
function getPreciseCountdown(targetDateStr: string, targetTimeStr: string, nowMs: number) {
  const time = /^\d{2}:\d{2}$/.test(targetTimeStr || '') ? targetTimeStr : '00:00';
  const targetMs = new Date(`${targetDateStr}T${time}:00`).getTime();
  const diffMs = targetMs - nowMs;

  if (!targetDateStr || Number.isNaN(targetMs)) return null;

  if (diffMs <= 0) {
    return { expired: true, mode: 'hms' as const, text: '00:00:00', days: 0, hours: 0, minutes: 0, seconds: 0, targetMs, diffMs: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (diffMs >= 24 * 60 * 60 * 1000) {
    return { expired: false, mode: 'dhm' as const, text: `${pad2(days)}:${pad2(hours)}:${pad2(minutes)}`, days, hours, minutes, seconds, targetMs, diffMs };
  }
  return { expired: false, mode: 'hms' as const, text: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`, days, hours, minutes, seconds, targetMs, diffMs };
}

// ---------- Fluid Interaction Engine ----------
// Dependency-free primitives that give every tap/click a soft expanding
// ripple, and give the whole app a lagging "magnetic" cursor that swells
// over anything interactive — the same language used across lusion.co.

function useRipple() {
  const [ripples, setRipples] = useState([]);

  const spawnRipple = (e, el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 650);
  };

  const rippleNodes = ripples.map((r) => (
    <span
      key={r.id}
      className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/25 animate-ripple"
      style={{ left: r.x, top: r.y }}
    />
  ));

  return [spawnRipple, rippleNodes];
}

function MagneticCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const isFine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFine || reducedMotion) return;
    setActive(true);

    const handleMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    const handleOver = (e) => {
      if (e.target.closest && e.target.closest('.cursor-target')) setHovering(true);
    };
    const handleOut = (e) => {
      if (e.target.closest && e.target.closest('.cursor-target')) setHovering(false);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseout', handleOut);

    let raf;
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.current.x}px, ${target.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseout', handleOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!active) return null;

  return (
    <>
      <div ref={dotRef} className="pointer-events-none fixed left-0 top-0 z-[9999] h-1.5 w-1.5 rounded-full bg-neutral-50" style={{ willChange: 'transform' }} />
      <div
        ref={ringRef}
        className={`pointer-events-none fixed left-0 top-0 z-[9999] rounded-full border bg-transparent mix-blend-difference transition-[width,height,border-color,border-width] duration-200 ease-out ${
          hovering ? 'h-11 w-11 border-2 border-neutral-50' : 'h-8 w-8 border border-neutral-300/70'
        }`}
        style={{ willChange: 'transform' }}
      />
    </>
  );
}

// ---------- Interactive Modular Overlay Engine ----------

function GlobalDetailModal({ modalData, onClose }) {
  if (!modalData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg overflow-hidden border border-neutral-800 bg-neutral-900 rounded-2xl shadow-2xl animate-modalPop">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300">
              {modalData.icon ? <modalData.icon className="h-4 w-4" /> : <FlameKindling className="h-4 w-4 text-indigo-400" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{modalData.title}</h3>
              <p className="text-xs text-neutral-500">{modalData.subtitle || 'System Deep-Dive Data'}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-target p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-all duration-150 active:scale-90">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {modalData.loading && (
            <div className="flex items-center gap-2.5 text-sm text-neutral-500 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          )}

          {modalData.textBody && (
            <p className="text-sm text-neutral-400 leading-relaxed bg-neutral-950/40 border border-neutral-800/60 p-3 rounded-xl">{modalData.textBody}</p>
          )}

          {modalData.arrayItems && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">{modalData.arrayTitle || 'Target Items'}</div>
              <ul className="space-y-2">
                {modalData.arrayItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300 bg-neutral-950/30 px-3 py-2 rounded-lg border border-neutral-800/40">
                    <span className="text-xs text-neutral-600 mt-0.5 font-mono">[{idx + 1}]</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modalData.focusPoints && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">High-Yield Exam Focus Areas</div>
              <ul className="space-y-2">
                {modalData.focusPoints.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300 bg-indigo-500/[0.03] border border-indigo-500/20 px-3 py-2 rounded-lg">
                    <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modalData.cues && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wide mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Critical Technique Cue
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">{modalData.cues}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- "System" Quest-Clear Notification ----------
// A small Solo Leveling homage: the moment the Daily Matrix hits 100%,
// the game's iconic glowing blue system window drops in to acknowledge it.
// Fires once per day, and calls out a Hunter Rank-up when the lifetime
// streak of fully-cleared days crosses a new threshold.

function TypewriterText({ text }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span>
      {shown}
      <span className="inline-block w-[2px] h-[0.95em] bg-indigo-300/80 ml-0.5 align-middle animate-questCursorBlink" />
    </span>
  );
}

function QuestClearNotification({ data, onDismiss }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'
  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: 6 + Math.random() * 88,
        delay: Math.random() * 1.3,
        duration: 1.8 + Math.random() * 1.6,
        size: 2 + Math.random() * 3,
      })),
    [data]
  );

  useEffect(() => {
    if (!data) return;
    setPhase('in');
    const outTimer = setTimeout(() => setPhase('out'), 4300);
    const closeTimer = setTimeout(() => onDismiss(), 4800);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-start justify-center pt-24 sm:pt-28 px-4 pointer-events-none ${
        phase === 'out' ? 'animate-questOut' : 'animate-questIn'
      }`}
    >
      <div className="relative w-full max-w-md pointer-events-auto">
        <div className="absolute -inset-6 bg-indigo-500/20 blur-3xl rounded-3xl animate-pulseGlow" />

        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="absolute bottom-0 rounded-full bg-indigo-300 animate-questSparkle"
              style={{
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="relative rounded-2xl border border-indigo-400/40 bg-gradient-to-b from-[#0d0a1f]/95 to-[#08061a]/95 backdrop-blur-xl shadow-[0_0_50px_-8px_rgba(129,140,248,0.45)] overflow-hidden">
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-300/80" />
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-indigo-300/80" />
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-indigo-300/80" />
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-300/80" />

          <div className="absolute inset-0 animate-questSweep bg-gradient-to-r from-transparent via-indigo-300/10 to-transparent" />

          <div className="relative px-6 py-6 text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-indigo-400/70 font-semibold mb-2">— System —</p>
            <h3 className="text-lg font-bold text-indigo-50 tracking-wide mb-1 min-h-[1.5em]">
              <TypewriterText text="Daily Quest Cleared!" />
            </h3>
            <p className="text-[12px] text-indigo-200/60 mb-4">All {trackerItems.length} objectives completed for today.</p>

            {data.isNewRank && (
              <div className="mb-4 animate-fadeInUp" style={{ animationDelay: '1.3s' }}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-semibold mb-1">Rank Up</div>
                <div className="text-2xl font-black tracking-tight" style={{ color: data.rank.color }}>
                  {data.rank.label}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-indigo-300/50">
              <span className="h-1 w-1 rounded-full bg-indigo-400 animate-dotBreathe" />
              Return to the grind, Hunter.
              <span className="h-1 w-1 rounded-full bg-indigo-400 animate-dotBreathe" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Streak Flame ----------
// A small "on fire" indicator for consecutive fully-cleared days — grows from
// a single spark to a full blaze as the streak climbs, with drifting embers
// and a flickering core. Purely decorative, purely earned.

function StreakFlame({ streak }) {
  const tier = streak >= 30 ? 'inferno' : streak >= 14 ? 'blaze' : streak >= 5 ? 'ember' : 'spark';

  const emberCount = tier === 'inferno' ? 7 : tier === 'blaze' ? 5 : tier === 'ember' ? 3 : 2;
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }, (_, i) => ({
        id: i,
        left: 20 + Math.random() * 60,
        delay: Math.random() * 1.6,
        duration: 1.3 + Math.random() * 1.1,
        size: 1.5 + Math.random() * 2,
      })),
    [emberCount, streak]
  );

  const coreColor = tier === 'inferno' ? '#fef9c3' : tier === 'blaze' ? '#fb923c' : tier === 'ember' ? '#f97316' : '#f59e0b';
  const glowColor = tier === 'inferno' ? 'bg-yellow-300/50' : tier === 'blaze' ? 'bg-orange-500/40' : 'bg-orange-500/30';

  if (streak <= 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/[0.06] px-3.5 py-1.5">
      <div className="relative w-4 h-4 flex items-center justify-center overflow-visible">
        <span className={`absolute inset-0 rounded-full blur-md animate-flameGlow ${glowColor}`} />
        {embers.map((e) => (
          <span
            key={e.id}
            className="absolute bottom-0 rounded-full animate-emberRise"
            style={{
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              background: 'radial-gradient(circle, #fef3c7, #f97316)',
              animationDelay: `${e.delay}s`,
              animationDuration: `${e.duration}s`,
            }}
          />
        ))}
        <Flame
          className="relative h-3.5 w-3.5 animate-flameFlicker"
          style={{ color: coreColor }}
          strokeWidth={2.2}
          fill={coreColor}
          fillOpacity={0.28}
        />
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: coreColor }}>
        {streak}-Day Streak
      </span>
    </div>
  );
}

// Compact, icon-only versions of the streak / hunter rank / execution quotient
// badges for narrow phone widths where there isn't room for the full pills.
// Tapping one expands it horizontally to reveal its label; tapping any other
// badge (or anywhere outside the strip) collapses it again, and only one can
// be expanded at a time.
function MobileStatusStrip({ streak, hunterRank, overallPct }) {
  const [expanded, setExpanded] = useState<null | 'streak' | 'rank' | 'eq'>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [expanded]);

  const toggle = (key: 'streak' | 'rank' | 'eq') => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 lg:hidden">
      {streak > 0 && (
        <button
          onClick={() => toggle('streak')}
          aria-label={`${streak}-day streak`}
          className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-orange-500/30 bg-orange-500/[0.08] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            expanded === 'streak' ? 'max-w-[140px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
          }`}
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400" strokeWidth={2.2} fill="#f97316" fillOpacity={0.28} />
          <span
            className={`whitespace-nowrap text-[11px] font-semibold text-orange-300 tabular-nums overflow-hidden transition-all duration-200 ${
              expanded === 'streak' ? 'max-w-[110px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
            }`}
          >
            {streak}-Day Streak
          </span>
        </button>
      )}

      <button
        onClick={() => toggle('rank')}
        aria-label={hunterRank.label}
        className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded === 'rank' ? 'max-w-[160px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
        }`}
        style={{ borderColor: `${hunterRank.color}40`, backgroundColor: `${hunterRank.color}0d` }}
      >
        <Swords className="h-3.5 w-3.5 shrink-0" style={{ color: hunterRank.color }} />
        <span
          className={`whitespace-nowrap text-[11px] font-medium overflow-hidden transition-all duration-200 ${
            expanded === 'rank' ? 'max-w-[130px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
          }`}
          style={{ color: hunterRank.color }}
        >
          {hunterRank.label}
        </span>
      </button>

      <button
        onClick={() => toggle('eq')}
        aria-label={`Execution Quotient ${overallPct}%`}
        className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-neutral-800 bg-neutral-900/60 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded === 'eq' ? 'max-w-[170px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 animate-pulse" />
        <span
          className={`whitespace-nowrap text-[11px] font-medium text-neutral-400 overflow-hidden transition-all duration-200 ${
            expanded === 'eq' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
          }`}
        >
          EQ: <span className="text-violet-400 tabular-nums">{overallPct}%</span>
        </span>
      </button>
    </div>
  );
}

// ---------- Standardized Scannable Structural UI Elements ----------

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/60">
        <Icon className="h-4.5 w-4.5 text-neutral-300" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-100">{title}</h2>
        {subtitle && <p className="text-[13px] text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Card({ children, className = '', onClick }) {
  const ref = useRef(null);
  const fineRef = useRef(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleMove = (e) => {
    if (!fineRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - py) * 7, ry: (px - 0.5) * 7 });
    setSpot({ x: px * 100, y: py * 100 });
    setHovering(true);
  };

  const handleLeave = () => {
    setHovering(false);
    setPressed(false);
    setTilt({ rx: 0, ry: 0 });
  };

  const handleDown = (e) => {
    setPressed(true);
    if (onClick) spawnRipple(e, ref.current);
  };

  const handleUp = () => setPressed(false);

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      className={`cursor-target relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm p-5 will-change-transform ${
        onClick ? 'cursor-pointer hover:border-neutral-700' : ''
      } ${className}`}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${pressed ? 0.975 : 1})`,
        transition: hovering ? 'transform 100ms linear' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {hovering && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.06), transparent 65%)` }}
        />
      )}
      {onClick && rippleNodes}
      <div className="relative">{children}</div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, accent = 'neutral' }) {
  const accents = {
    neutral: 'text-neutral-300',
    blue: 'text-indigo-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
    rose: 'text-rose-400'
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${accents[accent]}`} strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 leading-none mb-1">{label}</div>
        <div className="text-[13px] font-medium text-neutral-200 leading-none truncate">{value}</div>
      </div>
    </div>
  );
}

// ---------- Dynamic Engine: Countdown Matrix Widget ----------

// Was hardcoded to two fixed JEE-specific dates ('2026-11-01' mocks,
// '2027-01-22' JEE Main) shown to every account regardless of their actual
// goal, then briefly tied to `profile.targetDate`. Now fully standalone —
// driven by its own `countdown` config section (Settings > Countdown),
// deliberately independent of `profile.targets` so someone can track a date
// that isn't one of their formal priority targets. Ticks live: shows
// "DD:HH:MM" while more than a day remains, and switches to a live
// second-by-second "HH:MM:SS" once under 24 hours remain.
// Renders every countdown the user has set up in Settings > Countdown.
// A single shared 1s ticker drives all of them (one interval, not N) —
// each countdown is rendered by CountdownEntry below, all inside one shared
// card, sorted so the countdown ending soonest is always first. Zero
// configured countdowns falls back to a single prompt card.
function CountdownMatrix() {
  const { countdowns } = React.useContext(ConfigContext);
  const hasAny = Array.isArray(countdowns) && countdowns.length > 0;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasAny) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasAny]);

  if (!hasAny) {
    return (
      <Card className="border border-neutral-800/80 bg-gradient-to-br from-neutral-900/90 to-neutral-950/40">
        <EditableSectionHeading id="ov_countdown" defaultTitle="Countdown" defaultIcon={Target} subtitle="Set a target date to see it here" />
        <p className="text-[12.5px] text-neutral-500">
          Add one in <span className="text-neutral-300 font-medium">Settings &gt; Countdown</span> to track live time remaining toward it — you can add more than one.
        </p>
      </Card>
    );
  }

  // Every countdown lives inside this single card — resolve each one's
  // live result first, then sort so whichever ends soonest always sits
  // first, next-soonest right after, and so on. Anything expired sinks to
  // the bottom (it already happened), and anything still missing a target
  // date sinks under that, since there's nothing to rank it by yet.
  const resolved = countdowns.map((cd) => {
    const targetDate: string = cd?.targetDate || '';
    const targetTime: string = cd?.targetTime || '00:00';
    const result = targetDate ? getPreciseCountdown(targetDate, targetTime, nowMs) : null;
    return { cd, result };
  });

  const sorted = [...resolved].sort((a, b) => {
    if (!a.result && !b.result) return 0;
    if (!a.result) return 1;
    if (!b.result) return -1;
    if (a.result.expired !== b.result.expired) return a.result.expired ? 1 : -1;
    return a.result.diffMs - b.result.diffMs;
  });

  const count = sorted.length;
  // Fluid tile sizing: fewer countdowns get more breathing room, more of
  // them squeeze down and wrap via auto-fit so the row always fills the
  // available width instead of leaving gaps or forcing a fixed column count.
  const minTileWidth = count === 1 ? 240 : count === 2 ? 200 : count === 3 ? 165 : 140;

  return (
    <Card className="border border-neutral-800/80 bg-gradient-to-br from-neutral-900/90 to-neutral-950/40">
      <EditableSectionHeading
        id="ov_countdown"
        defaultIcon={Target}
        defaultTitle="Countdown"
        subtitle={count > 1 ? `${count} targets, nearest first` : 'Time remaining toward your target'}
      />
      <div
        className="grid gap-3 items-stretch"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minTileWidth}px, 1fr))` }}
      >
        {sorted.map(({ cd, result }) => (
          <CountdownEntry key={cd.id} countdown={cd} result={result} compact={count > 2} />
        ))}
      </div>
    </Card>
  );
}

function CountdownEntry({ countdown, result, compact }: { countdown: CountdownItem; result: ReturnType<typeof getPreciseCountdown> | null; compact: boolean }) {
  const label = countdown?.label || 'Your Countdown';
  const palette = getCountdownColor(countdown?.color);

  if (!countdown?.targetDate || !result) {
    // An incomplete entry (label set but no date yet, etc.) — don't hide it
    // entirely, just nudge back to Settings rather than showing bad math.
    return (
      <div className={`rounded-xl border ${palette.tileBorder} ${palette.tileBg} p-3.5 flex flex-col justify-between min-w-0`}>
        <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 mb-1 truncate">{label}</div>
        <p className="text-[11.5px] text-neutral-500 leading-snug">
          Missing a target date — finish it in <span className="text-neutral-300 font-medium">Settings &gt; Countdown</span>.
        </p>
      </div>
    );
  }

  const unitLabels = result.mode === 'dhm' ? 'DAYS : HRS : MINS' : 'HRS : MINS : SECS';

  // Depleting bar: full when this countdown was first set, empty at the
  // target. `startMs` is stamped automatically whenever the target
  // date/time is (re)saved in Settings > Countdown. Older/migrated
  // countdowns without a startMs fall back to a generic 180-day span so the
  // bar still shows something sensible.
  const FALLBACK_SPAN_MS = 180 * 24 * 60 * 60 * 1000;
  const startMs: number | null = typeof countdown?.startMs === 'number' ? countdown.startMs : null;
  const totalSpanMs = startMs ? Math.max(result.targetMs - startMs, 1) : FALLBACK_SPAN_MS;
  const remainingPct = result.expired ? 0 : Math.max(0, Math.min(100, (result.diffMs / totalSpanMs) * 100));

  return (
    <div className={`rounded-xl border ${palette.tileBorder} ${palette.tileBg} p-3.5 flex flex-col justify-between min-w-0`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${palette.dot}`} />
        <div className={`text-[10px] uppercase font-bold tracking-widest ${palette.text}/80 truncate`}>{label}</div>
      </div>
      <div className={compact ? 'mt-2.5' : 'mt-4'}>
        <span className={`${compact ? 'text-xl' : 'text-3xl'} font-bold font-mono tracking-tight tabular-nums ${result.expired ? 'text-neutral-500' : palette.text}`}>
          {result.text}
        </span>
      </div>
      <div className="mt-1 text-[9.5px] tracking-widest text-neutral-600 font-medium truncate">{result.expired ? 'ARRIVED' : unitLabels}</div>
      <div className="mt-2 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${palette.barBg}`} style={{ width: `${remainingPct}%` }} />
      </div>
    </div>
  );
}

// ---------- Bento Box Daily Execution Tracker Sidebar ----------

function TrackerItemButton({ item, isChecked, onToggle, isDerived }) {
  const ref = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleDown = (e) => {
    setPressed(true);
    spawnRipple(e, ref.current);
  };
  const handleUp = () => setPressed(false);
  const handleClick = () => {
    haptic.light();
    onToggle?.();
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      title={isDerived ? 'Auto-synced from the Fuel Matrix meal log — click to go log meals' : undefined}
      className={`cursor-target relative flex flex-col items-start justify-between overflow-hidden p-3.5 rounded-xl border text-left transition-colors duration-200 group ${
        isChecked
          ? 'bg-violet-500/[0.08] border-violet-500/30 shadow-[inset_0_0_12px_rgba(167,139,250,0.05)]'
          : 'bg-neutral-900/40 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700'
      }`}
      style={{
        transform: `scale(${pressed ? 0.955 : 1})`,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="flex w-full justify-between items-start mb-2.5">
        {isChecked ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-violet-400 shrink-0" strokeWidth={2} />
        ) : (
          <Circle className="h-4.5 w-4.5 text-neutral-600 group-hover:text-neutral-400 shrink-0 transition-colors" strokeWidth={1.75} />
        )}
        {isDerived && (
          <span className="text-[8.5px] uppercase tracking-wider font-bold text-neutral-600 group-hover:text-neutral-400 transition-colors">Auto</span>
        )}
      </div>
      <span className={`text-[11.5px] font-medium leading-snug transition-colors ${isChecked ? 'text-violet-200/90' : 'text-neutral-300 group-hover:text-neutral-200'}`}>
        {item.label}
      </span>
      {rippleNodes}
    </button>
  );
}

function DailyTracker({ currentDayStr, checked, onToggle, setActiveTab }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [timeLeft, setTimeLeft] = useState('');

  // Live midnight countdown logic
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = tomorrow.getTime() - now.getTime();

      const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
      const m = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

      setTimeLeft(`${h}:${m}:${s}`);
    };

    updateTimer(); 
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, []);

  const total = trackerItems.length;
  const done = trackerItems.filter((i) => checked[i.id]).length;
  const pct = Math.round((done / total) * 100);
  const formattedDay = useMemo(() => getDayName(currentDayStr), [currentDayStr]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm p-5 lg:sticky lg:top-6">
      
      {/* Bento Header & Timer */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight text-neutral-100">Daily Matrix</h3>
          <span className="text-[12px] font-medium text-neutral-500">{done}/{total}</span>
        </div>
        
        <div className="flex justify-between items-center bg-neutral-950/40 border border-neutral-800/60 rounded-lg p-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Current Cycle</span>
            <span className="text-[12px] text-neutral-300 font-medium">{formattedDay}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Day Ending In</span>
            <div className="flex items-center gap-1.5 text-violet-400/90 font-mono text-[13px] font-semibold tracking-tight">
              <Timer className="h-3.5 w-3.5" />
              {timeLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="relative h-2 w-full overflow-visible rounded-full bg-neutral-800">
          <div className="h-full w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={liquidFillStyle({ width: `${pct}%` })}
            />
          </div>
          {pct >= 70 && pct < 100 && (
            <div
              className="absolute top-0 h-2 pointer-events-none transition-all duration-500 ease-out"
              style={{ left: `${pct}%`, transform: 'translateX(-4px)' }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute bottom-0 rounded-full animate-emberRise"
                  style={{
                    left: `${i * 3}px`,
                    width: 2 + (i % 2),
                    height: 2 + (i % 2),
                    background: 'radial-gradient(circle, #fef3c7, #fb923c)',
                    animationDelay: `${i * 0.32}s`,
                    animationDuration: '1.1s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[20px] font-semibold text-neutral-100 tabular-nums">{pct}%</span>
          <span className="text-[11px] text-neutral-500">
            {pct === 100 ? 'Day complete' : pct >= 70 ? "You're on fire" : pct >= 60 ? 'On pace' : pct === 0 ? 'Not started' : 'In progress'}
          </span>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-2 gap-2.5">
        {trackerItems.map((item) => {
          const isDerived = item.id === 't6';
          return (
            <TrackerItemButton
              key={item.id}
              item={item}
              isChecked={!!checked[item.id]}
              isDerived={isDerived}
              onToggle={isDerived ? () => setActiveTab && setActiveTab('training') : () => onToggle(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Performance Calendar Matrix ----------

// ---------- Data Backup & Restore ----------
// Everything in this app lives only in this browser's localStorage. There is
// no server, no account, no sync — clear site data or switch devices and the
// entire history is gone for good. This gives a way out: a single JSON file
// download that captures the Daily Matrix history plus Ash's Clock state,
// and a matching import to restore it anywhere.

function DataBackupCard({ globalHistory, setGlobalHistory }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const collectBackupPayload = () => ({
    _meta: {
      app: 'Akyos',
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    jee_command_history_v2: globalHistory,
    mock_test_log: localStorage.getItem('mock_test_log'),
    topic_revision_log: localStorage.getItem('topic_revision_log'),
    diet_log_v1: localStorage.getItem('diet_log_v1'),
    weight_log_v1: localStorage.getItem('weight_log_v1'),
    ash_clock_focus_min: localStorage.getItem('ash_clock_focus_min'),
    ash_clock_break_min: localStorage.getItem('ash_clock_break_min'),
    ash_clock_hunter_level: localStorage.getItem('ash_clock_hunter_level'),
    ash_clock_quests_cleared: localStorage.getItem('ash_clock_quests_cleared'),
    pomodoro_subject_log: localStorage.getItem('pomodoro_subject_log'),
    ash_clock_last_subject: localStorage.getItem('ash_clock_last_subject'),
    app_config_v1: localStorage.getItem('app_config_v1'),
  });

  const handleExport = () => {
    try {
      const payload = collectBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `command-center-backup-${getLocalDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded — keep it somewhere safe (Drive, email to yourself, etc).');
    } catch {
      toast.error('Could not create the backup file. Try again.');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result || ''));
        if (!parsed || typeof parsed !== 'object' || !parsed.jee_command_history_v2) {
          throw new Error('Not a valid backup file');
        }

        setGlobalHistory(parsed.jee_command_history_v2);

        const passthroughKeys = [
          'mock_test_log', 'topic_revision_log', 'diet_log_v1', 'weight_log_v1',
          'ash_clock_focus_min', 'ash_clock_break_min', 'ash_clock_hunter_level',
          'ash_clock_quests_cleared', 'pomodoro_subject_log', 'ash_clock_last_subject',
          'app_config_v1',
        ];
        passthroughKeys.forEach((key) => {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            localStorage.setItem(key, parsed[key]);
          }
        });

        toast.success('Restored — reloading to apply everything…');
        setTimeout(() => window.location.reload(), 1100);
      } catch {
        toast.error('That file is invalid or corrupted — nothing was changed.');
      }
    };
    reader.readAsText(file);
  };

  const dayCount = Object.keys(globalHistory || {}).length;

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <EditableSectionHeading
          id="ac_backup"
          defaultTitle="Data Backup & Restore"
          defaultIcon={ShieldCheck}
          subtitle={`${dayCount} day${dayCount === 1 ? '' : 's'} of history, stored only in this browser`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton
            onClick={handleExport}
            className="cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </RippleButton>
          <RippleButton
            onClick={handleImportClick}
            className="cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </RippleButton>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      <p className="mt-4 text-[12.5px] text-neutral-500 leading-relaxed">
        Everything here — the Daily Matrix history, streak, Hunter Rank, mock test scores, and weight log — lives only in this browser's storage. Clearing site data, switching devices, or reinstalling the browser erases it permanently, with no way to recover it. Export a backup file regularly, and import it to restore everything on a new device or after a reset.
      </p>
    </Card>
  );
}

// ---------- Change Password (inside Account Menu) ----------

function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Inline error stays for form validation (wrong length / mismatch) since
  // that's tied to a specific field the person needs to look at right now.
  // The final outcome (saved / failed) goes through the shared toast so it
  // reads the same way as every other "Saved ✓" moment in the app.
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');
    if (newPassword.length < 6) {
      setFieldError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Those didn't match — try again.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      haptic.success();
      toast.success('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      haptic.error();
      toast.error(err?.message || 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={liquidFillStyle()}>
          <KeyRound className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
        </div>
        <h3 className="text-[13.5px] font-bold text-neutral-100">Change Password</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <PasswordField
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password (min 6 characters)"
          autoComplete="new-password"
          showStrength
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
        />
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
        />
        {fieldError && <p className="text-[12px] text-rose-400">{fieldError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg py-2.5 text-[12.5px] font-semibold text-neutral-950 transition-opacity disabled:opacity-50"
          style={liquidFillStyle()}
        >
          {busy ? 'Saving…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

// ---------- Account Menu ----------
// Slide-over panel replacing the old standalone "Config & Settings" tab.
// Holds account identity, cloud sync, password change, data backup/restore,
// the entry point into Settings, and sign out — everything that isn't
// day-to-day tracking content lives here now instead of the main nav.

function AccountPage({
  globalHistory, setGlobalHistory,
}: {
  globalHistory: any;
  setGlobalHistory: (v: any) => void;
}) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleSignOut = async () => {
    sessionStorage.removeItem('dcc_cloud_synced_this_session');
    localStorage.removeItem('dcc_passcode_hash');
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="max-w-xl space-y-5 animate-fadeIn">
      <EditableSectionHeading id="ac_account" defaultTitle="Account" defaultIcon={UserCircle2} subtitle="Profile, cloud sync, security & backups" />

      <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-gradient-to-br from-violet-500/[0.08] via-neutral-950 to-indigo-500/[0.05] p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-neutral-950" style={liquidFillStyle()}>
          {email ? email[0].toUpperCase() : <UserCircle2 className="h-6 w-6 text-neutral-950" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-neutral-100">{email || 'Not signed in'}</p>
          <p className="text-[11.5px] text-neutral-500">Signed in via Supabase</p>
        </div>
      </div>

      <CloudSyncCard />
      <PushNotificationsCard />
      <ChangePasswordCard />
      <PasscodeChangeCard />

      <DataBackupCard globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} />

      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-[13px] font-semibold text-rose-300 transition-colors hover:bg-rose-950/40"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>
    </div>
  );
}

function PerformanceCalendar({ globalHistory, setGlobalHistory, setModal }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [currentNavDate, setCurrentNavDate] = useState(new Date());
  
  const year = currentNavDate.getFullYear();
  const month = currentNavDate.getMonth();

  const monthName = currentNavDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push(dayStr);
    }
    return cells;
  }, [year, month, daysInMonth, firstDayIndex]);

  const handlePastDateClick = (dateStr) => {
    if (!dateStr) return;
    const itemsCompleted = globalHistory[dateStr] || {};
    const arrayItems = trackerItems.map(item => {
      return `${itemsCompleted[item.id] ? '✅' : '❌'} ${item.label}`;
    });
    const completedCount = Object.values(itemsCompleted).filter(Boolean).length;
    const percentage = Math.round((completedCount / trackerItems.length) * 100);

    setModal({
      title: `Execution Analysis: ${dateStr}`,
      subtitle: `${getDayName(dateStr)} · Efficiency Index: ${percentage}%`,
      icon: Calendar,
      arrayTitle: `Logged Metric Parameters (${completedCount}/${trackerItems.length})`,
      arrayItems: arrayItems,
      cues: percentage === 100 ? 'Absolute perfect operation architecture verified.' : 'Identify points of focus slippage to correct trends.'
    });
  };

  const getHeatmapColor = (dateStr) => {
    if (!dateStr || !globalHistory[dateStr]) return 'bg-neutral-900 border-neutral-800 text-neutral-600';
    const checks = globalHistory[dateStr];
    const score = Object.values(checks).filter(Boolean).length;
    const pct = score / trackerItems.length;

    if (score === 0) return 'bg-neutral-900 border-neutral-800 text-neutral-500';
    if (pct <= 0.3) return 'bg-rose-950/60 border-rose-800/40 text-rose-300 hover:bg-rose-900/50';
    if (pct <= 0.6) return 'bg-amber-950/60 border-amber-800/40 text-amber-300 hover:bg-amber-900/50';
    if (pct < 1) return 'bg-violet-950/40 border-violet-800/40 text-violet-300 hover:bg-violet-900/40';
    return 'text-neutral-950 border-violet-400 font-bold';
  };

  // Perfect (100%) days get the animated liquid gradient fill instead of a
  // flat one; this stays separate from getHeatmapColor because that helper
  // only returns className strings, not inline style.
  const isPerfectHeatmapDay = (dateStr: string) => {
    if (!dateStr || !globalHistory[dateStr]) return false;
    const checks = globalHistory[dateStr];
    const score = Object.values(checks).filter(Boolean).length;
    return score / trackerItems.length >= 1;
  };

  return (
    <div className="space-y-5">
      <Card className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <EditableSectionHeading id="hist_heatmap" defaultTitle="Execution Heatmap Analytics" defaultIcon={Calendar} subtitle="Persistent performance velocity tracing" />
        <div className="flex items-center gap-2 border border-neutral-800 bg-neutral-950/80 p-1 rounded-xl">
          <button 
            onClick={() => setCurrentNavDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[100px] text-center text-neutral-200">{monthName} {year}</span>
          <button 
            onClick={() => setCurrentNavDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <ArrowUpRight className="h-4 w-4 rotate-45" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((dateStr, idx) => {
          const isCurrentDay = dateStr === getLocalDateString();
          return (
            <div
              key={idx}
              onClick={() => dateStr && handlePastDateClick(dateStr)}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative text-xs transition-all duration-150 ${
                dateStr ? 'cursor-pointer hover:scale-105' : 'opacity-0 pointer-events-none'
              } ${getHeatmapColor(dateStr)} ${isCurrentDay ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-neutral-950' : ''}`}
              style={isPerfectHeatmapDay(dateStr) ? liquidFillStyle() : undefined}
            >
              {dateStr && (
                <>
                  <span className="font-mono">{parseInt(dateStr.split('-')[2])}</span>
                  {globalHistory[dateStr] && Object.values(globalHistory[dateStr]).filter(Boolean).length > 0 && (
                    <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dateStr === getLocalDateString() || Object.values(globalHistory[dateStr]).filter(Boolean).length === trackerItems.length ? 'bg-neutral-950' : 'bg-current'}`} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap gap-4 items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500 font-mono">Legend Matrix:</span>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-neutral-900 border border-neutral-800" /> <span>0%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-rose-950/60 border border-rose-800/40" /> <span>1-30%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-amber-950/60 border border-amber-800/40" /> <span>31-60%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-violet-950/40 border border-violet-800/40" /> <span>61-99%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded" style={liquidFillStyle()} /> <span>100%</span></div>
        </div>
        <p className="text-[11px] text-neutral-500">Click any historic metric square to trace detailed logs.</p>
      </div>
    </Card>
    </div>
  );
}

// ---------- Tab Subcomponent: Overview ----------

// Renders a SectionHeading for a named sub-section of any tab, applying
// any custom label/icon saved in Settings > Section Labels (falling back to
// the shipped default whenever nothing's been overridden yet). `id` must
// match a key registered in SECTION_LABEL_ROWS above.
function EditableSectionHeading({ id, defaultTitle, defaultIcon, subtitle }: { id: string; defaultTitle: string; defaultIcon: any; subtitle: string }) {
  const { sectionLabels } = React.useContext(ConfigContext);
  const override = sectionLabels[id];
  const Icon = (override && ICON_OPTIONS[override.icon]) || defaultIcon;
  const title = (override && override.label) || defaultTitle;
  return <SectionHeading icon={Icon} title={title} subtitle={subtitle} />;
}

function OverviewTab({ setModal }) {
  const { profile, syllabus, timeline, overviewOverrides, diet, dietOverrides } = React.useContext(ConfigContext);
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
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Timeline ----------

function TimelineTab({ setModal, notificationsEnabled, notificationPermission, onToggleNotifications }) {
  const { timeline, subjects } = React.useContext(ConfigContext);
  const typeStyle = {
    study: 'border-l-indigo-500',
    gym: 'border-l-violet-500',
    meal: 'border-l-amber-500',
    prep: 'border-l-neutral-600',
    sleep: 'border-l-violet-500',
  };
  const typeBg = {
    study: 'bg-indigo-500/10 text-indigo-400',
    gym: 'bg-violet-500/10 text-violet-400',
    meal: 'bg-amber-500/10 text-amber-400',
    prep: 'bg-neutral-800 text-neutral-400',
    sleep: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <EditableSectionHeading id="tl_master" defaultTitle="Master Timeline" defaultIcon={Clock3} subtitle="Interactive structural day architecture — Click any block for tactical execution logs" />
        <RippleButton
          onClick={onToggleNotifications}
          className={`cursor-target shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            notificationsEnabled
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15'
              : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          {notificationsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {notificationsEnabled ? 'Block Reminders On' : 'Enable Block Reminders'}
        </RippleButton>
      </div>
      {notificationPermission === 'denied' && (
        <p className="text-[11.5px] text-rose-400/80 mb-4">
          Notifications are blocked for this site in your browser settings — allow them there first, then try again.
        </p>
      )}
      {notificationsEnabled && notificationPermission === 'granted' && (
        <p className="text-[11.5px] text-neutral-600 mb-4">
          You'll get a ping 5 minutes before each block starts — this now works even if the app is closed or your phone is asleep, as long as Push Notifications is on for this device (Account &gt; Push Notifications).
        </p>
      )}
      <div className="space-y-2.5">
        {timeline.map((slot, i) => {
          const Icon = slot.icon;
          const sub = slot.subject ? getSubjectStyle(slot.subject, subjects) : null;
          return (
            <div
              key={i}
              onClick={() => setModal({
                title: slot.label,
                subtitle: `Time Block: ${slot.start} - ${slot.end}`,
                icon: slot.icon,
                textBody: slot.longDesc || slot.detail,
                arrayTitle: 'Tactical Blueprint',
                arrayItems: slot.subject ? ['Execute active recall models', 'Avoid passive consumption modes', 'Track mistake logs inside errors catalog'] : ['Execute standard systemic recovery actions']
              })}
              className={`flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 border-l-2 ${typeStyle[slot.type]} px-4 py-3.5 cursor-pointer transition-all hover:bg-neutral-900/90 hover:translate-x-1`}
            >
              <div className="w-[92px] shrink-0 tabular-nums text-[12.5px] font-medium text-neutral-400">
                {slot.start === slot.end ? slot.start : `${slot.start}–${slot.end}`}
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeBg[slot.type]}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-medium text-neutral-100">{slot.label}</span>
                  {sub && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sub.bg} ${sub.text}`}>
                      {slot.subject}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-neutral-500 mt-0.5">{slot.detail}</div>
              </div>
              <ArrowUpRight className="h-3 w-3 text-neutral-600 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Training & Fuel ----------

// ---------- Weight Trend (recomposition tracking) ----------

const WEIGHT_LOG_KEY = 'weight_log_v1';

function WeightTrendChart({ entries }) {
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

function WeightTrackerCard() {
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

function TrainingFuelTab({ setModal, dietLog, setDietLog, currentDateStr }) {
  const { training, diet, dietOverrides, profile } = React.useContext(ConfigContext);
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
      <div>
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
      </div>

      <WeightTrackerCard />

      <div>
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
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Syllabus ----------

function SyllabusTab({ setModal }) {
  const { subjects, syllabus } = React.useContext(ConfigContext);
  const allSyllabusTopics = useMemo(() => getAllSyllabusTopics(syllabus), [syllabus]);
  const [activePhase, setActivePhase] = useState(1);
  const phase = syllabus.find((p) => p.phase === activePhase) || syllabus[0];

  const [revisionLog, setRevisionLog] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('topic_revision_log');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('topic_revision_log', JSON.stringify(revisionLog));
    } catch {
      /* storage unavailable — fail silently */
    }
  }, [revisionLog]);

  const markRevised = (key: string) => {
    setRevisionLog((prev) => ({ ...prev, [key]: getLocalDateString() }));
  };

  // Topics revised at least once before, now gone stale — sorted worst-first.
  // Topics never touched at all are excluded here (not "overdue", just not
  // started yet); they still get a neutral badge inline in the topic lists.
  const staleTopics = useMemo(() => {
    return allSyllabusTopics
      .map((t) => ({ ...t, ...getRevisionStatus(revisionLog[t.key]) }))
      .filter((t) => t.status === 'due' || t.status === 'overdue')
      .sort((a, b) => (b.days || 0) - (a.days || 0));
  }, [revisionLog, allSyllabusTopics]);

  const handleTopicClick = async (topicName) => {
    const defaultMeta = {
      chapters: ['General Conceptual Practice Modules'],
      focus: ['Complete all textbook back exercises', 'Review core formulas & dynamic testing metrics'],
    };
    const known = TOPIC_DETAILS[topicName];

    if (known) {
      setModal({
        title: topicName,
        subtitle: `Syllabus Structural Tracking Units`,
        icon: BookOpen,
        arrayTitle: 'Sub-Chapters Checklist',
        arrayItems: known.chapters,
        focusPoints: known.focus,
      });
      return;
    }

    // A topic the user added themselves — quietly generate a real
    // chapter/focus breakdown instead of the generic placeholder.
    setModal({
      title: topicName,
      subtitle: `Syllabus Structural Tracking Units`,
      icon: BookOpen,
      loading: true,
    });
    const generated = await generateTopicDetails(topicName);
    const meta = generated || defaultMeta;
    setModal({
      title: topicName,
      subtitle: `Syllabus Structural Tracking Units`,
      icon: BookOpen,
      arrayTitle: 'Sub-Chapters Checklist',
      arrayItems: meta.chapters,
      focusPoints: meta.focus,
    });
  };

  return (
    <div className="animate-fadeIn">
      <EditableSectionHeading id="syl_runway" defaultTitle="Syllabus Runway" defaultIcon={BookOpen} subtitle="Absolute deadline stack. Click on any topic/chapter box to reveal specific deep focus items." />

      {staleTopics.length > 0 && (
        <Card className="mb-5 border border-amber-500/20">
          <EditableSectionHeading
            id="syl_revision"
            defaultTitle="Revision Due"
            defaultIcon={RotateCcw}
            subtitle={`${staleTopics.length} topic${staleTopics.length === 1 ? '' : 's'} revised before, now going stale — oldest first`}
          />
          <div className="space-y-2 mt-4">
            {staleTopics.slice(0, 8).map((t) => (
              <div
                key={t.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 flex-wrap"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${t.status === 'overdue' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                  <button onClick={() => handleTopicClick(t.topic)} className="cursor-target text-[13px] text-neutral-200 hover:text-neutral-50 text-left truncate">
                    {t.topic}
                  </button>
                  <span className={`text-[10.5px] shrink-0 ${getSubjectStyle(t.subject, subjects).text}`}>{t.month}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t.status === 'overdue' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                    {t.days}d ago
                  </span>
                  <RippleButton
                    onClick={() => markRevised(t.key)}
                    className="cursor-target flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Mark Revised
                  </RippleButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {syllabus.map((p) => (
          <button
            key={p.phase}
            onClick={() => setActivePhase(p.phase)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-all duration-150 ${
              activePhase === p.phase
                ? 'border-indigo-500/40 bg-indigo-500/[0.08]'
                : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${activePhase === p.phase ? 'bg-indigo-500/20 text-indigo-300' : 'bg-neutral-800 text-neutral-400'}`}>
              {p.phase}
            </span>
            <div>
              <div className={`text-[12.5px] font-medium ${activePhase === p.phase ? 'text-indigo-300' : 'text-neutral-300'}`}>{p.month}</div>
              <div className="text-[10.5px] text-neutral-500">{p.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {subjects
          .filter((s) => Array.isArray(phase.subjects[s.key]))
          .map((s) => {
            const style = getSubjectStyle(s.key, subjects);
            return (
          <Card key={s.key} className={`border ${style.border}`}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <span className={`text-[13px] font-semibold ${style.text}`}>{s.label}</span>
            </div>
            <ul className="space-y-2">
              {phase.subjects[s.key].map((topic) => {
                const key = getTopicRevisionKey(activePhase, s.key, topic);
                const { status, days } = getRevisionStatus(revisionLog[key]);
                const dotColor =
                  status === 'never' ? 'bg-neutral-700' :
                  status === 'fresh' ? 'bg-violet-400' :
                  status === 'due' ? 'bg-amber-400' : 'bg-rose-400';
                const badgeText =
                  status === 'never' ? 'Not yet revised' :
                  status === 'fresh' ? `Revised ${days === 0 ? 'today' : `${days}d ago`}` :
                  status === 'due' ? `Due · ${days}d ago` : `Overdue · ${days}d ago`;
                const badgeClass =
                  status === 'never' ? 'text-neutral-600' :
                  status === 'fresh' ? 'text-violet-400' :
                  status === 'due' ? 'text-amber-400' : 'text-rose-400';

                return (
                  <li
                    key={topic}
                    className="flex flex-col gap-1.5 text-[12.5px] text-neutral-300 leading-snug p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/40 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div onClick={() => handleTopicClick(topic)} className="flex items-start gap-2 cursor-pointer min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-600 group-hover:text-indigo-400" strokeWidth={2} />
                        <span className="group-hover:text-neutral-100 truncate">{topic}</span>
                      </div>
                      <ArrowUpRight
                        onClick={() => handleTopicClick(topic)}
                        className="h-3 w-3 shrink-0 text-neutral-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-5.5">
                      <span className={`flex items-center gap-1.5 text-[10.5px] ${badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} /> {badgeText}
                      </span>
                      <button
                        onClick={() => markRevised(key)}
                        title="Mark as revised today"
                        className="cursor-target shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Revise
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
            );
          })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Mock Test Tracker ----------
// A dependency-free SVG line chart tracing Math/Physics/Chem scores over time.
function ScoreTrendChart({ tests, subjects }) {
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

function MockTestTab() {
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

// ---------- Access Gate ----------
// A simple client-side passcode screen. Note: this only hides the UI from
// casual access — the code lives in the frontend bundle, so it is not real
// security against someone who inspects the source.

const APP_PASSCODE = '091224';

function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (value.length !== APP_PASSCODE.length) return;
    if (value === APP_PASSCODE) {
      setExiting(true);
      const t = setTimeout(() => onUnlock(), 320);
      return () => clearTimeout(t);
    }
    setError(true);
    const t = setTimeout(() => {
      setValue('');
      setError(false);
      if (inputRef.current) inputRef.current.focus();
    }, 500);
    return () => clearTimeout(t);
  }, [value, onUnlock]);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, APP_PASSCODE.length);
    setValue(digits);
  };

  const boxes = Array.from({ length: APP_PASSCODE.length });

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 transition-all duration-300 ease-out ${
        exiting ? 'opacity-0 scale-[0.97]' : 'opacity-100 scale-100'
      }`}
      onClick={() => inputRef.current && inputRef.current.focus()}
    >
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
        <Lock className="h-5 w-5 text-neutral-950" strokeWidth={2} />
      </div>

      <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">Restricted Access</h1>
      <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
        This app holds personal data. Enter the passcode to continue.
      </p>

      <div className={`relative flex gap-2.5 ${error ? 'animate-shake' : ''}`}>
        {boxes.map((_, i) => {
          const filled = i < value.length;
          const isCurrent = i === value.length;
          return (
            <div
              key={i}
              className={`flex h-12 w-10 items-center justify-center rounded-xl border text-lg font-semibold tabular-nums transition-colors duration-150 ${
                error
                  ? 'border-rose-500/50 bg-rose-500/[0.06] text-rose-300'
                  : isCurrent
                  ? 'border-indigo-500/50 bg-neutral-900/80 text-neutral-100'
                  : filled
                  ? 'border-neutral-700 bg-neutral-900/80 text-neutral-100'
                  : 'border-neutral-800 bg-neutral-900/40 text-neutral-700'
              }`}
            >
              {filled ? value[i] : ''}
            </div>
          );
        })}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="Passcode"
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
        />
      </div>

      <p className={`mt-5 h-4 text-[12px] font-medium text-rose-400 transition-opacity duration-150 ${error ? 'opacity-100' : 'opacity-0'}`}>
        Incorrect passcode
      </p>
    </div>
  );
}

// ---------- Opening / Intro Loader ----------
// A single-run splash animation: a counting percentage, a thin gradient
// progress line, then a clean upward "curtain" wipe that reveals the app.

function IntroLoader({ onFinish }) {
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading -> collapsing -> wiping -> done

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setPhase('done');
      onFinish();
      return;
    }

    const duration = 1900;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — settles gently near 100
      setPercent(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase('collapsing');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'collapsing') {
      const t1 = setTimeout(() => setPhase('wiping'), 260);
      return () => clearTimeout(t1);
    }
    if (phase === 'wiping') {
      const t2 = setTimeout(() => setPhase('done'), 820);
      return () => clearTimeout(t2);
    }
    if (phase === 'done') {
      onFinish();
    }
  }, [phase, onFinish]);

  const handleSkip = () => {
    if (phase === 'loading') setPhase('collapsing');
  };

  if (phase === 'done') return null;

  return (
    <div
      onClick={handleSkip}
      role="presentation"
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 transition-transform duration-[820ms] ease-[cubic-bezier(0.76,0,0.24,1)] cursor-pointer ${
        phase === 'wiping' ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div
        className={`flex flex-col items-center transition-all duration-300 ease-out ${
          phase === 'loading' ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
        }`}
      >
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-violet-500/20" style={liquidFillStyle({ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' })}>
          <GraduationCap className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
        </div>

        <span
          className="mb-6 text-[10px] font-medium uppercase tracking-[0.35em] text-neutral-500 animate-fadeInUp"
          style={{ animationDelay: '70ms' }}
        >
          Akyos
        </span>

        <div className="flex items-start leading-none tabular-nums">
          <span
            className="font-extralight text-transparent bg-clip-text bg-gradient-to-br from-neutral-50 to-neutral-500"
            style={{ fontSize: 'clamp(3.25rem, 13vw, 6rem)' }}
          >
            {percent}
          </span>
          <span
            className="mt-1 font-extralight text-neutral-600"
            style={{ fontSize: 'clamp(1.1rem, 3.4vw, 1.75rem)' }}
          >
            %
          </span>
        </div>

        <div className="mt-6 h-px w-36 sm:w-52 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={liquidFillStyle({ width: `${percent}%` })}
          />
        </div>

        <span
          className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-600 animate-fadeInUp"
          style={{ animationDelay: '150ms' }}
        >
          Your Answer to Chaos
        </span>
      </div>
    </div>
  );
}

// ---------- Config Editor (Settings Tab) ----------
// Makes TRACKER_ITEMS, TIMELINE, and TRAINING editable in-app instead of
// requiring a source-code edit every time the routine changes. Each editor
// keeps a local draft copy so nothing is written to the live config (and
// therefore to every other tab reading it) until "Save" is pressed.

const btnGhost = 'cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors';
const btnSave = (dirty: boolean) => `cursor-target flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${dirty ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15' : 'border-neutral-800 bg-neutral-900 text-neutral-600'}`;
const fieldInput = 'w-full rounded-lg border border-neutral-800 bg-neutral-950/50 px-2.5 py-1.5 text-[12px] text-neutral-200 focus:outline-none focus:border-neutral-600';
const fieldLabel = 'text-[10px] uppercase tracking-wide text-neutral-600 font-bold block mb-1';

function TrackerItemsEditor() {
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
            <button onClick={() => removeItem(item.id)} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
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

function TimelineEditor() {
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
              <button onClick={() => setOpenIdx(isOpen ? null : i)} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
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
                      <input type="time" value={slot.start} onChange={(e) => patch(i, { start: e.target.value })} className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>End</label>
                      <input type="time" value={slot.end} onChange={(e) => patch(i, { end: e.target.value })} className={fieldInput} />
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

function TrainingEditor() {
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
              <button onClick={() => setOpenIdx(isOpen ? null : i)} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
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
                        <button onClick={() => removeExercise(i, ei)} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
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
const DIET_OVERRIDE_ROWS: { key: DietOverrideKey; label: string; icon: any; hint: string }[] = [
  { key: 'calories', label: 'Calorie Target', icon: Flame, hint: 'Auto-estimated from the meals below' },
  { key: 'protein', label: 'Protein Target', icon: Activity, hint: 'Auto-estimated from the meals below' },
  { key: 'hydration', label: 'Hydration', icon: Droplets, hint: 'Auto-estimated from bodyweight + the meals below' },
];

// Fully editable Fuel Matrix: every meal (time, name, icon, food items) plus
// the Calorie/Protein/Hydration targets those meals imply. Capped at
// MAX_DIET_MEALS so "All 6 Meals Hit" on the Daily Matrix stays meaningful,
// and a brand-new account already has six sensible defaults to tweak
// instead of a blank page.
function DietEditor() {
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
              <button onClick={() => setOpenIdx(isOpen ? null : i)} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
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
                        <button onClick={() => removeItem(i, itIdx)} className="cursor-target shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
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
          <span className="text-[11px] uppercase tracking-wide text-neutral-600 font-bold">Calorie / Protein / Hydration Targets</span>
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

function ProfileEditor() {
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
          <input type="date" value={draft.birthdate || ''} onChange={(e) => patch({ birthdate: e.target.value })} className={fieldInput} />
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
        <span className="text-[11px] uppercase tracking-wide text-neutral-600 font-bold">Priority Targets</span>
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
              <button onClick={() => removeTarget(i)} className="cursor-target flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors">
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
function CountdownEditor() {
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
              <button onClick={() => removeItem(cd.id)} className="cursor-target flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className={fieldLabel}>Target Date</label>
                <input type="date" value={cd.targetDate || ''} onChange={(e) => patchItem(cd.id, { targetDate: e.target.value })} className={fieldInput} />
              </div>
              <div>
                <label className={fieldLabel}>Target Time</label>
                <input type="time" value={cd.targetTime || '00:00'} onChange={(e) => patchItem(cd.id, { targetTime: e.target.value })} className={fieldInput} />
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

const SUBJECT_COLOR_NAMES = Object.keys(SUBJECT_COLOR_PALETTE);

// Each row is auto-computed from Timeline/Fuel Matrix by default (see
// computeOverviewAutoValues) — this editor just lets someone override any
// single row with their own text, or flip it back to "Auto" any time.
const OVERVIEW_OVERRIDE_ROWS: { key: OverviewOverrideKey; label: string; icon: any; hint: string }[] = [
  { key: 'studySessions', label: 'Study Sessions', icon: BookOpen, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'training', label: 'Gym / Training', icon: Dumbbell, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'meals', label: 'Meals', icon: Utensils, hint: 'Auto-counted from Settings → Timeline' },
  { key: 'sleep', label: 'Sleep Lock', icon: Moon, hint: 'Auto-read from your Sleep block in Settings → Timeline' },
  { key: 'calories', label: 'Calories', icon: Flame, hint: 'From your Fuel Matrix target' },
  { key: 'protein', label: 'Protein', icon: Activity, hint: 'From your Fuel Matrix target' },
  { key: 'hydration', label: 'Hydration', icon: Droplets, hint: 'From your Fuel Matrix target' },
];

function OverviewSummaryEditor() {
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

function SubjectsAndSyllabusEditor() {
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
                <button onClick={() => setOpenPhase(isOpen ? null : p.phase)} className="cursor-target w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
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
                            className={`${fieldInput} resize-none font-mono`}
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
function IconPickerButton({ value, onChange }: { value: string; onChange: (key: string) => void }) {
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

function TabLabelsEditor() {
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
const SECTION_LABEL_GROUP_TAB_KEYS: TabLabelKey[] = Array.from(new Set(SECTION_LABEL_ROWS.map((r) => r.tabKey)));

function SectionLabelsEditor() {
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
            <h4 className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">{tabLabels[tabKey] || DEFAULT_TAB_LABELS[tabKey]}</h4>
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

// Each row's `title`/`subtitle` can be a plain string OR a function of
// (tabLabels, sectionLabels, tabIcons) — used for rows that describe a tab
// (or a specific panel inside one) that's renameable in Tab Names & Icons /
// Section Labels, so this list of section headers never drifts out of sync
// with whatever the user has renamed things to. `tabKey` additionally lets
// the row's icon follow that tab's icon override.
const SETTINGS_SECTIONS = [
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



function SettingsAccordionItem({ icon: Icon, title, subtitle, isOpen, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
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

function ConfigEditorTab() {
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

export default function JEEDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  useCloudAutoSync(unlocked);
  const [introDone, setIntroDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => {
    try {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') return true;
      // Backward compatibility: anyone who already has a saved config from
      // before this wizard existed has clearly already set things up their
      // own way — don't interrupt them with onboarding retroactively.
      if (localStorage.getItem(CONFIG_STORAGE_KEY)) {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [modal, setModal] = useState(null);

  // ---------- Swipe-to-switch-tabs (Instagram-style) ----------
  // Purely additive: the click-based tab bar above still works exactly as
  // before. This just lets a left/right swipe anywhere on the workspace
  // move to the next/previous tab in the TABS array.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipePeek, setSwipePeek] = useState<'left' | 'right' | null>(null);

  const SWIPE_MIN_DISTANCE = 60; // px — how far a swipe must travel to count
  const SWIPE_MAX_OFF_AXIS = 70; // px — how vertical it can drift before we treat it as a scroll instead

  const goToAdjacentTab = (direction: 1 | -1) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= TABS.length) return;
    setActiveTab(TABS[nextIndex].id);
  };

  const handleWorkspaceTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't hijack gestures meant for form controls, sliders, or the
    // (already horizontally-scrollable) tab bar itself.
    if (target.closest('input, textarea, select, nav, [data-no-swipe]')) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleWorkspaceTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
      setSwipePeek(dx < 0 ? 'left' : 'right');
    } else {
      setSwipePeek(null);
    }
  };

  const handleWorkspaceTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipePeek(null);
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;
    goToAdjacentTab(dx < 0 ? 1 : -1); // swipe left goes to next tab, swipe right goes to previous tab
  };

  // Editable Config — Daily Checklist / Timeline / Training routine.
  // Everything else in the app reads this through ConfigContext instead of
  // the DEFAULT_* module constants, so edits made in the Settings tab
  // propagate everywhere immediately without a page reload.
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return deserializeConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
      console.error('Error hydrating config from localStorage', e);
      return deserializeConfig(null);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(serializeConfig(config)));
    } catch (e) {
      console.error('Error persisting config to localStorage', e);
    }
  }, [config]);

  const updateConfig = (partial: Record<string, any>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const resetConfigSection = (key: 'trackerItems' | 'timeline' | 'training' | 'profile' | 'subjects' | 'syllabus' | 'countdowns' | 'overviewOverrides' | 'diet' | 'dietOverrides' | 'tabLabels' | 'tabIcons' | 'sectionLabels') => {
    setConfig((prev) => ({
      ...prev,
      [key]: key === 'timeline'
        ? hydrateTimeline(DEFAULT_TIMELINE_STORABLE)
        : key === 'training'
        ? DEFAULT_TRAINING
        : key === 'profile'
        ? DEFAULT_PROFILE
        : key === 'subjects'
        ? DEFAULT_SUBJECTS
        : key === 'syllabus'
        ? DEFAULT_SYLLABUS
        : key === 'countdowns'
        ? DEFAULT_COUNTDOWNS
        : key === 'overviewOverrides'
        ? DEFAULT_OVERVIEW_OVERRIDES
        : key === 'diet'
        ? hydrateDiet(DEFAULT_DIET_STORABLE)
        : key === 'dietOverrides'
        ? DEFAULT_DIET_OVERRIDES
        : key === 'tabLabels'
        ? DEFAULT_TAB_LABELS
        : key === 'tabIcons'
        ? DEFAULT_TAB_ICONS
        : key === 'sectionLabels'
        ? DEFAULT_SECTION_LABELS
        : DEFAULT_TRACKER_ITEMS,
    }));
  };

  // Core Data Persistence Engine (Localised ISO keys)
  const [currentDateStr, setCurrentDateStr] = useState(() => getLocalDateString());
  
  const [globalHistory, setGlobalHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('jee_command_history_v2');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error hydrating localStorage state map', e);
      return {};
    }
  });

  // Automated System Clock Alignment Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = getLocalDateString();
      if (todayStr !== currentDateStr) {
        setCurrentDateStr(todayStr);
      }
    }, 30000); // Pulse check every 30 seconds
    return () => clearInterval(interval);
  }, [currentDateStr]);

  // Synchronize dynamic updates directly into hardware memory
  useEffect(() => {
    localStorage.setItem('jee_command_history_v2', JSON.stringify(globalHistory));
  }, [globalHistory]);

  // Per-meal diet check-ins (Fuel Matrix). Lifted up here — rather than kept
  // local to TrainingFuelTab — specifically so the Daily Matrix's "All 6
  // Meals Hit" box can auto-derive from it instead of being tracked twice.
  const [dietLog, setDietLog] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('diet_log_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('diet_log_v1', JSON.stringify(dietLog));
    } catch {
      /* storage unavailable — fail silently */
    }
  }, [dietLog]);

  const allMealsHitToday = useMemo(() => {
    const todayMeals = dietLog[currentDateStr] || {};
    return config.diet.length > 0 && config.diet.every((m) => todayMeals[m.name]);
  }, [dietLog, currentDateStr, config.diet]);

  // Keep the Daily Matrix's t6 box in lockstep with the Fuel Matrix meal log,
  // rather than letting it drift as an independent manual checkbox.
  useEffect(() => {
    setGlobalHistory((prev) => {
      const day = prev[currentDateStr] || {};
      if (!!day.t6 === allMealsHitToday) return prev;
      return {
        ...prev,
        [currentDateStr]: { ...day, t6: allMealsHitToday },
      };
    });
  }, [allMealsHitToday, currentDateStr]);

  // ---- Time-block notifications ----
  // The Master Timeline is a strict schedule but nothing previously enforced
  // it. This effect still does a foreground-only reminder via the local
  // Notification API (fires immediately, no round trip). The *reliable*
  // version — 5 min before each block, even with the app closed — is handled
  // server-side by the push-scheduler Edge Function, which reads
  // `timeline_notifications_enabled` + `app_config_v1.timeline` from each
  // user's cloud-synced data once a minute. See supabase/functions/push-scheduler.
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem('timeline_notifications_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    try {
      localStorage.setItem('timeline_notifications_enabled', String(notificationsEnabled));
    } catch {
      /* storage unavailable — fail silently */
    }
  }, [notificationsEnabled]);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      // Leaves the push subscription itself alone (that's a per-device toggle
      // in Account > Push Notifications) — this only stops Timeline reminders
      // specifically, both the foreground ones below and the server-side ones
      // the push-scheduler sends by reading `timeline_notifications_enabled`.
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) await subscribeToPush(userId);
    }
  };

  // Schedules one timer per remaining timeline block for today, 5 minutes
  // ahead of its start time. Re-runs at midnight rollover (currentDateStr
  // changes) and whenever the feature is toggled, always clearing prior
  // timers first so nothing double-fires.
  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = new Date();

    config.timeline.forEach((slot) => {
      if (slot.start === slot.end) return; // zero-length marker (Sleep Lock) — nothing to alert before
      const [h, m] = slot.start.split(':').map(Number);
      const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const alertTime = new Date(slotTime.getTime() - 5 * 60 * 1000);
      const msUntil = alertTime.getTime() - now.getTime();
      if (msUntil <= 0) return;

      const timer = setTimeout(() => {
        try {
          new Notification(`Starting soon: ${slot.label}`, {
            body: `${slot.detail} — begins at ${slot.start}`,
            tag: `timeline-${slot.start}`,
          });
        } catch {
          /* Notification constructor can throw in some restricted contexts */
        }
      }, msUntil);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [notificationsEnabled, currentDateStr, config.timeline]);

  // Read current active item checklist matrix
  const checked = useMemo(() => {
    return globalHistory[currentDateStr] || {};
  }, [globalHistory, currentDateStr]);

  const toggleCheck = (itemId) => {
    setGlobalHistory((prev) => {
      const currentDayMetrics = { ...prev[currentDateStr] };
      currentDayMetrics[itemId] = !currentDayMetrics[itemId];
      return {
        ...prev,
        [currentDateStr]: currentDayMetrics,
      };
    });
  };

  const doneCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const totalCount = config.trackerItems.length;
  const overallPct = Math.round((doneCount / totalCount) * 100);

  // Lifetime count of fully-cleared days across all recorded history — the
  // number that actually drives Hunter Rank, independent of today's progress.
  const clearedDaysCount = useMemo(() => {
    return Object.values(globalHistory).filter((dayObj) =>
      config.trackerItems.every((item) => (dayObj as any)?.[item.id])
    ).length;
  }, [globalHistory, config.trackerItems]);

  const hunterRank = useMemo(() => getHunterRank(clearedDaysCount), [clearedDaysCount]);
  const currentStreak = useMemo(
    () => computeCurrentStreak(globalHistory, currentDateStr, config.trackerItems),
    [globalHistory, currentDateStr, config.trackerItems]
  );

  // Fires the "System" quest-clear notification exactly once, the moment
  // today's Daily Matrix transitions from incomplete to 100%.
  const [questClear, setQuestClear] = useState<{ rank: typeof HUNTER_RANKS[number]; isNewRank: boolean } | null>(null);
  const wasCompleteRef = useRef(overallPct === 100);
  const shownForDateRef = useRef<string | null>(null);

  useEffect(() => {
    const justCompleted = !wasCompleteRef.current && overallPct === 100;
    if (justCompleted && shownForDateRef.current !== currentDateStr) {
      shownForDateRef.current = currentDateStr;
      const priorRank = getHunterRank(Math.max(clearedDaysCount - 1, 0));
      const newRank = getHunterRank(clearedDaysCount);
      setQuestClear({ rank: newRank, isNewRank: newRank.rank !== priorRank.rank });
    }
    wasCompleteRef.current = overallPct === 100;
  }, [overallPct, currentDateStr, clearedDaysCount]);

  if (!unlocked) {
    return <AuthGate onUnlock={() => setUnlocked(true)} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingWizard
        onComplete={(generated) => {
          updateConfig(generated);
          try {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
          } catch (e) {
            console.error('[Onboarding] failed to persist completion flag', e);
          }
          setOnboardingDone(true);
        }}
      />
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab setModal={setModal} />;
      case 'timeline': return (
        <TimelineTab
          setModal={setModal}
          notificationsEnabled={notificationsEnabled}
          notificationPermission={notificationPermission}
          onToggleNotifications={handleToggleNotifications}
        />
      );
      case 'training': return <TrainingFuelTab setModal={setModal} dietLog={dietLog} setDietLog={setDietLog} currentDateStr={currentDateStr} />;
      case 'syllabus': return <SyllabusTab setModal={setModal} />;
      case 'mocktests': return <MockTestTab />;
      case 'ashclock': return <AshClockTab />;
      case 'history': return <PerformanceCalendar globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} setModal={setModal} />;
      case 'settings': return <ConfigEditorTab />;
      case 'account': return <AccountPage globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} />;
      default: return null;
    }
  };

  return (
    <ConfigContext.Provider
      value={{
        trackerItems: config.trackerItems,
        timeline: config.timeline,
        training: config.training,
        profile: config.profile,
        subjects: config.subjects,
        syllabus: config.syllabus,
        countdowns: config.countdowns,
        overviewOverrides: config.overviewOverrides,
        diet: config.diet,
        dietOverrides: config.dietOverrides,
        tabLabels: config.tabLabels,
        tabIcons: config.tabIcons,
        sectionLabels: config.sectionLabels,
        updateConfig,
        resetConfigSection,
      }}
    >
    <div className="min-h-screen w-full bg-zinc-950 text-neutral-200 font-sans antialiased relative lg:flex">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-indigo-600/10 blur-[110px]" />
      </div>
      {!introDone && <IntroLoader onFinish={() => setIntroDone(true)} />}

      {/* Sidebar backdrop — mobile/tablet drawer scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation — persistent rail on desktop (minimized until hovered), sliding drawer on mobile */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r border-neutral-800/70 bg-neutral-950/98 transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 lg:bg-neutral-950/50 lg:backdrop-blur-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarExpanded ? 'lg:w-[240px]' : 'lg:w-[68px]'}`}
      >
        <div className={`flex items-center gap-2.5 px-4 pt-5 pb-4 ${!sidebarExpanded ? 'lg:justify-center lg:gap-0 lg:px-0' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md shadow-violet-500/20" style={liquidFillStyle()}>
            <GraduationCap className="h-4 w-4 text-neutral-950" strokeWidth={2} />
          </div>
          <span className={`text-[13px] font-semibold tracking-tight text-neutral-200 truncate overflow-hidden transition-all duration-200 ${sidebarExpanded ? 'lg:max-w-[140px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>Akyos</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar" role="tablist" aria-label="Main sections">
          <div className="space-y-1">
            {TABS.map((tab) => {
              const Icon = ICON_OPTIONS[config.tabIcons[tab.id as TabLabelKey]] || tab.icon;
              const isActive = activeTab === tab.id;
              const label = config.tabLabels[tab.id as TabLabelKey] || tab.label;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                  title={label}
                  aria-label={label}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  className={`cursor-target group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 active:scale-[0.98] ${
                    !sidebarExpanded ? 'lg:w-11 lg:h-11 lg:justify-center lg:gap-0 lg:px-0 lg:py-0 lg:mx-auto' : ''
                  } ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className={`truncate overflow-hidden transition-all duration-200 ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings & Account — pinned to the bottom of the rail */}
        <div className="mt-auto border-t border-neutral-800/70 px-3 py-3 space-y-1">
          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            title={config.tabLabels.settings}
            aria-label={config.tabLabels.settings}
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            className={`cursor-target flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 active:scale-[0.98] ${
              !sidebarExpanded ? 'lg:w-11 lg:h-11 lg:justify-center lg:gap-0 lg:px-0 lg:py-0 lg:mx-auto' : ''
            } ${
              activeTab === 'settings'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
            }`}
          >
            {(() => { const SettingsIcon = ICON_OPTIONS[config.tabIcons.settings] || Settings; return <SettingsIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />; })()}
            <span className={`truncate overflow-hidden transition-all duration-200 ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{config.tabLabels.settings}</span>
          </button>
          <button
            onClick={() => { setActiveTab('account'); setSidebarOpen(false); }}
            title={config.tabLabels.account}
            aria-label={config.tabLabels.account}
            role="tab"
            aria-selected={activeTab === 'account'}
            aria-current={activeTab === 'account' ? 'page' : undefined}
            className={`cursor-target flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 active:scale-[0.98] ${
              !sidebarExpanded ? 'lg:w-11 lg:h-11 lg:justify-center lg:gap-0 lg:px-0 lg:py-0 lg:mx-auto' : ''
            } ${
              activeTab === 'account'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
            }`}
          >
            {(() => { const AccountIcon = ICON_OPTIONS[config.tabIcons.account] || UserCircle2; return <AccountIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />; })()}
            <span className={`truncate overflow-hidden transition-all duration-200 ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{config.tabLabels.account}</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 flex-1 min-w-0">

        {/* Sticky header — brand, streak, rank, and EQ stay pinned while the page scrolls beneath */}
        <header
          onMouseEnter={() => setSidebarExpanded(false)}
          className="sticky top-0 z-30 flex flex-row items-center justify-between gap-3 border-b border-neutral-800/70 bg-zinc-950/85 backdrop-blur-xl px-4 sm:px-6 lg:px-8 py-3.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20 transition-transform active:scale-95 lg:pointer-events-none lg:cursor-default"
              style={liquidFillStyle()}
            >
              <GraduationCap className="h-5.5 w-5.5 text-neutral-950" strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-neutral-50 leading-none truncate">Akyos</h1>
              <p className="text-[12.5px] text-neutral-500 mt-1 truncate">Your Answer to Chaos</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <MobileStatusStrip streak={currentStreak} hunterRank={hunterRank} overallPct={overallPct} />
            <StreakFlame streak={currentStreak} />
            <div
              className="hidden lg:flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-500"
              style={{ borderColor: `${hunterRank.color}40`, backgroundColor: `${hunterRank.color}0d` }}
            >
              <Swords className="h-3 w-3" style={{ color: hunterRank.color }} />
              <span className="text-[11.5px] font-medium" style={{ color: hunterRank.color }}>
                {hunterRank.label}
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[11.5px] font-medium text-neutral-400">Execution Quotient: <span className="text-violet-400 tabular-nums">{overallPct}%</span></span>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6">

        {/* Dashboard Grid Workspace Layout — swipe left/right anywhere here to move between tabs */}
        <div
          className={`relative grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 transition-transform duration-150 ease-out touch-pan-y ${
            swipePeek === 'left' ? '-translate-x-2' : swipePeek === 'right' ? 'translate-x-2' : 'translate-x-0'
          }`}
          onTouchStart={handleWorkspaceTouchStart}
          onTouchMove={handleWorkspaceTouchMove}
          onTouchEnd={handleWorkspaceTouchEnd}
          onTouchCancel={handleWorkspaceTouchEnd}
        >
          {/* Faint edge hints that appear mid-swipe, Instagram-style */}
          <div
            className={`pointer-events-none fixed left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-neutral-900/80 border border-neutral-700 p-2 transition-opacity duration-150 ${
              swipePeek === 'right' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft className="h-4 w-4 text-neutral-300" />
          </div>
          <div
            className={`pointer-events-none fixed right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-neutral-900/80 border border-neutral-700 p-2 transition-opacity duration-150 ${
              swipePeek === 'left' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </div>

          <main>{renderTab()}</main>
          <aside>
            <DailyTracker currentDayStr={currentDateStr} checked={checked} onToggle={toggleCheck} setActiveTab={setActiveTab} />
          </aside>
        </div>

        <footer className="mt-8 pb-2 text-center">
          <p className="text-[11px] text-neutral-600">Built By Ash - With Love and Peace</p>
        </footer>
        </div>
      </div>

      {/* Global Context-Aware Modal Overlay */}
      <GlobalDetailModal modalData={modal} onClose={() => setModal(null)} />

      {/* "System" Quest-Clear Notification — fires on hitting 100% for the day */}
      <QuestClearNotification data={questClear} onDismiss={() => setQuestClear(null)} />

      {/* Global Fluid Cursor (desktop / fine-pointer only) */}
      <MagneticCursor />

      {/* Embedded Support Custom Styles */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Branded keyboard-focus ring, app-wide. Several inputs already
           swap outline-none for a border-color change on focus (a fine
           substitute), but every button, link, and nav item was falling
           back to the browser's unstyled default outline — inconsistent
           and off-brand. One rule here covers all of them at once. Scoped
           to :focus-visible so mouse/touch clicks stay exactly as before;
           only actual keyboard navigation gets the ring. */
        :focus-visible {
          outline: 2px solid rgba(167, 139, 250, 0.75);
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Respect the OS-level "reduce motion" preference. Nothing here
           is deleted, just collapsed to near-instant, so people sensitive
           to motion (or vestibular conditions) still get every state
           change, just without the drifting gradients, ripples, tilts,
           and cursor-follow loop. */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
        ${LIQUID_GRADIENT_KEYFRAMES}
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.18s ease-out forwards; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideInRight { animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes rippleExpand {
          from { transform: translate(-50%, -50%) scale(0); opacity: 0.35; }
          to { transform: translate(-50%, -50%) scale(26); opacity: 0; }
        }
        .animate-ripple { animation: rippleExpand 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          60% { opacity: 1; transform: scale(1.015) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalPop { animation: modalPop 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 400ms ease-in-out; }
        @keyframes discSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-discSpin { animation: discSpin 6s linear infinite; }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.06); }
        }
        .animate-pulseGlow { animation: pulseGlow 2.6s ease-in-out infinite; }
        @keyframes eqBar {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
        .animate-eqBar1 { animation: eqBar 0.85s ease-in-out infinite; animation-delay: -0.6s; transform-origin: bottom; }
        .animate-eqBar2 { animation: eqBar 0.7s ease-in-out infinite; animation-delay: -0.2s; transform-origin: bottom; }
        .animate-eqBar3 { animation: eqBar 0.95s ease-in-out infinite; animation-delay: -0.9s; transform-origin: bottom; }
        .animate-eqBar4 { animation: eqBar 0.65s ease-in-out infinite; animation-delay: -0.35s; transform-origin: bottom; }
        @keyframes slideInFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideInFade { animation: slideInFade 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }

        /* ---- Ash's Clock: vertical fade/slide digit mechanics ---- */
        .fade-unit {
          position: relative;
          width: calc(var(--fade-h) * 0.72);
          height: var(--fade-h);
          border-radius: 10px;
          overflow: hidden;
          background: linear-gradient(180deg, #2d1a4d 0%, #1a0f2e 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgba(147,51,234,0.16);
        }
        .fade-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: calc(var(--fade-h) * 0.52);
          font-weight: 800;
          font-family: 'Courier New', monospace;
          color: #f3e8ff;
          font-variant-numeric: tabular-nums;
        }
        @keyframes fadeNumInUp {
          from { opacity: 0; transform: translateY(38%); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fadeNumOutUp {
          from { opacity: 1; transform: translateY(0); filter: blur(0); }
          to { opacity: 0; transform: translateY(-38%); filter: blur(2px); }
        }
        @keyframes fadeNumInDown {
          from { opacity: 0; transform: translateY(-38%); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fadeNumOutDown {
          from { opacity: 1; transform: translateY(0); filter: blur(0); }
          to { opacity: 0; transform: translateY(38%); filter: blur(2px); }
        }
        .fade-num-in-up { animation: fadeNumInUp 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-out-up { animation: fadeNumOutUp 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-in-down { animation: fadeNumInDown 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-out-down { animation: fadeNumOutDown 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes questIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-questIn { animation: questIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes questOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-10px) scale(0.97); }
        }
        .animate-questOut { animation: questOut 0.5s ease-in forwards; }
        @keyframes questSparkle {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-150px) scale(1); opacity: 0; }
        }
        .animate-questSparkle { animation: questSparkle linear infinite; }
        @keyframes questSweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        .animate-questSweep { animation: questSweep 2.6s ease-in-out infinite; }
        @keyframes questCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-questCursorBlink { animation: questCursorBlink 0.8s step-end infinite; }
        @keyframes flameFlicker {
          0%, 100% { transform: scale(1) rotate(-2deg); opacity: 0.95; }
          25% { transform: scale(1.08) rotate(2deg); opacity: 1; }
          50% { transform: scale(0.95) rotate(-3deg); opacity: 0.88; }
          75% { transform: scale(1.05) rotate(1deg); opacity: 1; }
        }
        .animate-flameFlicker { animation: flameFlicker 1.4s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes flameGlow {
          0%, 100% { opacity: 0.45; transform: scale(0.85); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
        .animate-flameGlow { animation: flameGlow 1.8s ease-in-out infinite; }
        @keyframes emberRise {
          0% { transform: translateY(0) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-16px) scale(1); opacity: 0; }
        }
        .animate-emberRise { animation: emberRise linear infinite; }
        @keyframes dotBreathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-dotBreathe { animation: dotBreathe 1.6s ease-in-out infinite; }
        @media (pointer: fine) {
          * { cursor: none !important; }
        }
      `}</style>
      <Toaster />
    </div>
    </ConfigContext.Provider>
  );
}

// ---------- Tab Subcomponent: Ash's Clock (Fade-Digit Clock + Pomodoro) ----------

const DEFAULT_FOCUS_MIN = 50;
const DEFAULT_BREAK_MIN = 10;

// Small ripple-enabled button, reusing the same click-ripple language as the
// bento grid Cards elsewhere in the app (see useRipple above).
function RippleButton({
  children, onClick, className = '', disabled = false, title, style,
}: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; title?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleDown = (e: any) => {
    if (disabled) return;
    spawnRipple(e, ref.current);
  };

  return (
    <button
      ref={ref}
      onClick={disabled ? undefined : onClick}
      onMouseDown={handleDown}
      onTouchStart={handleDown}
      disabled={disabled}
      title={title}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {children}
      {rippleNodes}
    </button>
  );
}

// Single digit that fades + slides out one direction and fades + slides in
// from the opposite side — upward when the value the digit belongs to is
// increasing (the live clock), downward when it's decreasing (the pomodoro
// countdown). This replaces the earlier 3D flip mechanic with something
// quieter and closer to an odometer roll.
function FadeDigit({ char, size = 84, direction = 'up' }: { char: string; size?: number | string; direction?: 'up' | 'down' }) {
  const [current, setCurrent] = useState(char);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (char !== current) {
      setOutgoing(current);
      setCurrent(char);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setOutgoing(null), 420);
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  const styleVar = { ['--fade-h' as any]: typeof size === 'number' ? `${size}px` : size };
  const inClass = direction === 'up' ? 'fade-num-in-up' : 'fade-num-in-down';
  const outClass = direction === 'up' ? 'fade-num-out-up' : 'fade-num-out-down';

  return (
    <div className="fade-unit" style={styleVar}>
      {outgoing !== null && (
        <span key={`out-${outgoing}`} className={`fade-num ${outClass}`}>{outgoing}</span>
      )}
      <span key={`in-${current}`} className={`fade-num ${inClass}`}>{current}</span>
    </div>
  );
}

function FadePair({ value, size = 84, direction = 'up' }: { value: string; size?: number | string; direction?: 'up' | 'down' }) {
  const chars = value.padStart(2, '0').split('');
  return (
    <div className="flex gap-1">
      <FadeDigit char={chars[0]} size={size} direction={direction} />
      <FadeDigit char={chars[1]} size={size} direction={direction} />
    </div>
  );
}

function FadeColon({ size = 84 }: { size?: number | string }) {
  const dotStyle = typeof size === 'number'
    ? { width: Math.max(5, size * 0.09), height: Math.max(5, size * 0.09) }
    : { width: 'clamp(4px, 1.4vw, 7px)', height: 'clamp(4px, 1.4vw, 7px)' };
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ height: size }}>
      <span
        className="block rounded-full bg-purple-400/80 animate-dotBreathe"
        style={{ ...dotStyle, boxShadow: '0 0 8px rgba(192,132,252,0.8)' }}
      />
      <span
        className="block rounded-full bg-purple-400/80 animate-dotBreathe"
        style={{ ...dotStyle, boxShadow: '0 0 8px rgba(192,132,252,0.8)', animationDelay: '0.3s' }}
      />
    </div>
  );
}

function LiveClockView() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours24 = now.getHours();
  const isPM = hours24 >= 12;
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const hh = hours12.toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col items-center py-6 w-full">
      <div className="flex items-end gap-1.5 sm:gap-3 max-w-full">
        <FadePair value={hh} size="clamp(38px, 10vw, 64px)" direction="up" />
        <FadeColon size="clamp(38px, 10vw, 64px)" />
        <FadePair value={mm} size="clamp(38px, 10vw, 64px)" direction="up" />
        <FadeColon size="clamp(38px, 10vw, 64px)" />
        <FadePair value={ss} size="clamp(38px, 10vw, 64px)" direction="up" />
        <span className="ml-1 sm:ml-2 mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-bold text-purple-300/80 tracking-widest shrink-0">{isPM ? 'PM' : 'AM'}</span>
      </div>
      <p className="mt-6 text-[12.5px] text-neutral-500 tracking-wide">{dateLabel}</p>
      <p className="mt-1 text-[10px] text-purple-400/50 tracking-[0.2em] uppercase">Hunter's Association Standard Time</p>
    </div>
  );
}

function PomodoroView({ onSessionComplete }) {
  const { subjects } = React.useContext(ConfigContext);
  const [focusMinutes, setFocusMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_focus_min');
    return saved ? parseInt(saved, 10) : DEFAULT_FOCUS_MIN;
  });
  const [breakMinutes, setBreakMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_break_min');
    return saved ? parseInt(saved, 10) : DEFAULT_BREAK_MIN;
  });

  const [subject, setSubject] = useState<string>(() => localStorage.getItem('ash_clock_last_subject') || subjects[0]?.key || 'math');
  useEffect(() => { localStorage.setItem('ash_clock_last_subject', subject); }, [subject]);

  const [sessionType, setSessionType] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(() => focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);

  const [hunterLevel, setHunterLevel] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_hunter_level');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [questsCleared, setQuestsCleared] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_quests_cleared');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [systemMessage, setSystemMessage] = useState<string>(
    "[The Gate is sealed. Awaiting the Hunter's command to begin the Focus Quest.]"
  );

  const intervalRef = useRef<any>(null);

  // Needed so the running session survives the app being backgrounded/closed:
  // the server-side scheduler pushes the "session complete" notification by
  // reading the active_timers row this component keeps in sync.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const secondsLeftRef = useRef(secondsLeft);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);

  // Live-updating "N:NN remaining" notification while the session runs —
  // this only needs the tab alive in the background (screen off is fine),
  // not a server push, so it just talks to the service worker directly.
  useEffect(() => {
    if (!isRunning) return;
    const sendLiveUpdate = () => {
      const s = secondsLeftRef.current;
      const mm2 = Math.floor(s / 60).toString().padStart(2, '0');
      const ss2 = (s % 60).toString().padStart(2, '0');
      messageServiceWorker({
        type: 'POMODORO_LIVE_UPDATE',
        title: sessionType === 'focus' ? '⚔️ Focus Gate in progress' : '🌙 Rest Zone',
        body: `${mm2}:${ss2} remaining${sessionType === 'focus' ? ` · ${subject}` : ''}`,
      });
    };
    sendLiveUpdate();
    const liveInterval = setInterval(sendLiveUpdate, 20000);
    return () => clearInterval(liveInterval);
  }, [isRunning, sessionType, subject]);

  useEffect(() => { localStorage.setItem('ash_clock_focus_min', String(focusMinutes)); }, [focusMinutes]);
  useEffect(() => { localStorage.setItem('ash_clock_break_min', String(breakMinutes)); }, [breakMinutes]);
  useEffect(() => { localStorage.setItem('ash_clock_hunter_level', String(hunterLevel)); }, [hunterLevel]);
  useEffect(() => { localStorage.setItem('ash_clock_quests_cleared', String(questsCleared)); }, [questsCleared]);

  // If duration settings change while idle, keep the countdown in sync
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMinutes, breakMinutes]);

  const playChime = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {
      // Silent environments (or browsers blocking autoplay) just skip the chime.
    }
  };

  const handleSessionComplete = () => {
    playChime();
    haptic.success();
    if (userId) clearActiveTimer(userId, 'pomodoro');
    messageServiceWorker({
      type: 'POMODORO_COMPLETE',
      title: sessionType === 'focus' ? '⚔️ Focus Gate cleared!' : '🌙 Rest Zone complete',
      body:
        sessionType === 'focus'
          ? `${subject} session done — time to rest.`
          : "Break's over — a new Gate awaits, Hunter.",
    });
    if (sessionType === 'focus') {
      const nextQuests = questsCleared + 1;
      setQuestsCleared(nextQuests);
      onSessionComplete?.(subject, focusMinutes);
      if (nextQuests % 4 === 0) {
        const nextLevel = hunterLevel + 1;
        setHunterLevel(nextLevel);
        setSystemMessage(`[Quest Clear!] EXP acquired. Hunter Level Up -> Lv. ${nextLevel}. Rest Zone unlocked.`);
      } else {
        setSystemMessage('[Quest Clear!] EXP acquired. Entering the Rest Zone — mana regenerating.');
      }
      setSessionType('break');
      setSecondsLeft(breakMinutes * 60);
    } else {
      setSystemMessage('[Rest complete.] A new Gate has appeared. Arise, Hunter.');
      setSessionType('focus');
      setSecondsLeft(focusMinutes * 60);
    }
    setIsRunning(false);
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            handleSessionComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const totalSeconds = (sessionType === 'focus' ? focusMinutes : breakMinutes) * 60;
  const progressPct = totalSeconds ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  const handleStartPause = () => {
    if (!isRunning) {
      const freshStart = secondsLeft === 0;
      const newSecondsLeft = freshStart ? (sessionType === 'focus' ? focusMinutes : breakMinutes) * 60 : secondsLeft;
      if (freshStart) setSecondsLeft(newSecondsLeft);
      setSystemMessage(
        sessionType === 'focus'
          ? '[Quest Alert] A Focus Gate has opened. Clear it before the timer expires.'
          : '[Rest Zone] Recovering mana. The next Gate awaits.'
      );
      if (userId) {
        startActiveTimer(userId, 'pomodoro', new Date(Date.now() + newSecondsLeft * 1000), { subject, sessionType });
      }
    } else {
      if (userId) clearActiveTimer(userId, 'pomodoro');
      messageServiceWorker({ type: 'POMODORO_LIVE_CLEAR' });
    }
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
    setSystemMessage("[Timer reset.] Awaiting the Hunter's command.");
    if (userId) clearActiveTimer(userId, 'pomodoro');
    messageServiceWorker({ type: 'POMODORO_LIVE_CLEAR' });
  };

  const handleSkip = () => {
    setIsRunning(false);
    handleSessionComplete();
  };

  const adjustMinutes = (which: 'focus' | 'break', delta: number) => {
    if (isRunning) return;
    if (which === 'focus') {
      setFocusMinutes((m) => Math.max(5, Math.min(180, m + delta)));
    } else {
      setBreakMinutes((m) => Math.max(1, Math.min(60, m + delta)));
    }
  };

  return (
    <div className="flex flex-col items-center py-4">
      {/* Hunter Rank strip */}
      <div className="flex items-center gap-3 mb-5 text-[11px] font-semibold tracking-wide">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-800/40 text-purple-300">
          <Crown className="w-3.5 h-3.5" /> Hunter Lv. {hunterLevel}
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-fuchsia-950/40 border border-fuchsia-800/30 text-fuchsia-300">
          <Swords className="w-3.5 h-3.5" /> {questsCleared} Quests Cleared
        </span>
      </div>

      {/* Session badge */}
      <div
        className={`mb-4 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase border ${
          sessionType === 'focus'
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
            : 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
        }`}
      >
        {sessionType === 'focus' ? 'Focus Gate' : 'Rest Zone'}
      </div>

      {/* Subject tag — which gate is this? */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap justify-center">
        {subjects.map((s) => (
          <RippleButton
            key={s.key}
            onClick={() => !isRunning && setSubject(s.key)}
            disabled={isRunning}
            className={`cursor-target rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              subject === s.key
                ? `${getSubjectStyle(s.key, subjects).bg} ${getSubjectStyle(s.key, subjects).text} ${getSubjectStyle(s.key, subjects).border}`
                : 'bg-neutral-900/60 text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            {s.label}
          </RippleButton>
        ))}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 max-w-full">
        <FadePair value={mm} size="clamp(46px, 14vw, 88px)" direction="down" />
        <FadeColon size="clamp(46px, 14vw, 88px)" />
        <FadePair value={ss} size="clamp(46px, 14vw, 88px)" direction="down" />
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-5">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={
            sessionType === 'focus'
              ? liquidFillStyle({ width: `${progressPct}%` })
              : liquidFillStyleFor('linear-gradient(115deg, #f0abfc 0%, #f472b6 35%, #fb7185 65%, #f472b6 85%, #f0abfc 100%)', { width: `${progressPct}%` })
          }
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-6">
        <RippleButton
          onClick={handleReset}
          className="cursor-target rounded-full p-2.5 text-neutral-500 hover:text-purple-300 transition-colors active:scale-90"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </RippleButton>
        <RippleButton
          onClick={handleStartPause}
          className="cursor-target rounded-full w-14 h-14 flex items-center justify-center text-neutral-950 shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-transform"
          style={liquidFillStyle()}
          title={isRunning ? 'Pause' : 'Arise'}
        >
          {isRunning ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-0.5" fill="currentColor" />}
        </RippleButton>
        <RippleButton
          onClick={handleSkip}
          className="cursor-target rounded-full p-2.5 text-neutral-500 hover:text-purple-300 transition-colors active:scale-90"
          title="Skip to next session"
        >
          <SkipForward className="w-5 h-5" fill="currentColor" />
        </RippleButton>
      </div>

      {/* System message banner */}
      <div className="mt-6 w-full max-w-md text-center px-4 py-2.5 rounded-xl bg-purple-950/30 border border-purple-800/30">
        <p className="text-[11px] font-mono text-purple-300/80 leading-relaxed">{systemMessage}</p>
      </div>

      {/* Duration settings */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md">
        <div className="flex-1 flex items-center justify-between bg-neutral-950/40 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="text-[11px] font-semibold text-neutral-400">Focus (min)</span>
          <div className="flex items-center gap-2">
            <RippleButton
              onClick={() => adjustMinutes('focus', -5)}
              disabled={isRunning}
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              −
            </RippleButton>
            <span className="text-sm font-bold text-purple-300 w-8 text-center tabular-nums">{focusMinutes}</span>
            <RippleButton
              onClick={() => adjustMinutes('focus', 5)}
              disabled={isRunning}
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              +
            </RippleButton>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-between bg-neutral-950/40 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="text-[11px] font-semibold text-neutral-400">Break (min)</span>
          <div className="flex items-center gap-2">
            <RippleButton
              onClick={() => adjustMinutes('break', -1)}
              disabled={isRunning}
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              −
            </RippleButton>
            <span className="text-sm font-bold text-fuchsia-300 w-8 text-center tabular-nums">{breakMinutes}</span>
            <RippleButton
              onClick={() => adjustMinutes('break', 1)}
              disabled={isRunning}
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              +
            </RippleButton>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[10px] text-purple-400/40 tracking-[0.15em] uppercase text-center">
        Sung Jinwoo trained relentlessly to become the strongest — this is your Gate.
      </p>
    </div>
  );
}

function PomodoroSubjectStats({ log, subjects }) {
  const todayStr = getLocalDateString();

  const totals = useMemo(() => {
    const all: Record<string, number> = {};
    const today: Record<string, number> = {};
    log.forEach((entry: any) => {
      all[entry.subject] = (all[entry.subject] || 0) + entry.minutes;
      if (entry.date === todayStr) today[entry.subject] = (today[entry.subject] || 0) + entry.minutes;
    });
    return { all, today };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const grandTotal: number = Object.values(totals.all).reduce((a: number, b: number) => a + b, 0);
  const maxSubjectMinutes = Math.max(1, ...Object.values(totals.all).length ? Object.values(totals.all) : [0]);

  // Show every subject the user has ever logged time against, even if it's
  // since been removed from config.subjects (their history shouldn't vanish),
  // union'd with the current subject list (so a brand new subject with 0
  // minutes still shows a bar at 0).
  const displaySubjects = useMemo(() => {
    const known = new Map(subjects.map((s: any) => [s.key, s]));
    const keys = new Set([...subjects.map((s: any) => s.key), ...Object.keys(totals.all)]);
    return Array.from(keys).map((key) => known.get(key) || { key, label: key });
  }, [subjects, totals.all]);

  const formatHrs = (mins: number) => {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Card>
      <EditableSectionHeading
        id="clk_subjecthours"
        defaultTitle="Subject Hours"
        defaultIcon={BarChart3}
        subtitle={grandTotal > 0 ? `${formatHrs(grandTotal)} logged across all Focus Gates — checking Chemistry isn't quietly falling behind` : 'Complete a tagged Focus Gate to start building this up'}
      />
      {grandTotal === 0 ? (
        <p className="text-[13px] text-neutral-500 mt-4">
          No Pomodoro sessions logged yet. Tag a subject above and clear a Focus Gate — hours per subject will build up here automatically.
        </p>
      ) : (
        <div className="space-y-3 mt-4">
          {displaySubjects.map((s: any) => {
            const style = getSubjectStyle(s.key, subjects);
            const allMin = totals.all[s.key] || 0;
            const todayMin = totals.today[s.key] || 0;
            const pct = (allMin / maxSubjectMinutes) * 100;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-semibold ${style.text}`}>{s.label}</span>
                  <span className="text-[11.5px] text-neutral-400 tabular-nums">
                    {formatHrs(allMin)} total{todayMin > 0 ? ` · ${formatHrs(todayMin)} today` : ''}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden">
                  <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AshClockTab() {
  const { subjects } = React.useContext(ConfigContext);
  const [mode, setMode] = useState<'clock' | 'pomodoro' | 'alarm'>('clock');

  const [pomodoroLog, setPomodoroLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pomodoro_subject_log');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pomodoro_subject_log', JSON.stringify(pomodoroLog));
    } catch {
      /* storage unavailable — fail silently, nothing to do here */
    }
  }, [pomodoroLog]);

  const handleSessionComplete = (subject: string, minutes: number) => {
    setPomodoroLog((prev) => [...prev, { id: `pom_${Date.now()}`, date: getLocalDateString(), subject, minutes }]);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative overflow-hidden border border-purple-900/30 bg-gradient-to-br from-[#1a0f2e] via-neutral-950 to-[#150a26] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="absolute -top-32 -left-20 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-72 h-72 rounded-full bg-fuchsia-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-purple-500/20" style={liquidFillStyle()}>
              <Timer className="h-5.5 w-5.5 text-neutral-50" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100 leading-tight">Clock</h3>
              <p className="text-[12px] text-purple-300/60 mt-0.5 italic">"Even the Shadow Monarch answers to time."</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-purple-800/40 bg-purple-950/30 p-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <RippleButton
              onClick={() => setMode('clock')}
              className={`cursor-target shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[10.5px] sm:text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'clock' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              CLOCK
            </RippleButton>
            <RippleButton
              onClick={() => setMode('pomodoro')}
              className={`cursor-target shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[10.5px] sm:text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'pomodoro' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              POMODORO
            </RippleButton>
            <RippleButton
              onClick={() => setMode('alarm')}
              className={`cursor-target shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[10.5px] sm:text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'alarm' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              ALARM
            </RippleButton>
          </div>
        </div>

        <div className="relative">
          {mode === 'clock' ? (
            <LiveClockView />
          ) : mode === 'pomodoro' ? (
            <PomodoroView onSessionComplete={handleSessionComplete} />
          ) : (
            <AlarmsPanel />
          )}
        </div>
      </div>

      {mode === 'pomodoro' && <PomodoroSubjectStats log={pomodoroLog} subjects={subjects} />}
    </div>
  );
}