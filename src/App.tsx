import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutGrid, Clock3, Dumbbell, BookOpen, Sparkles,
  CheckCircle2, Circle, Target, GraduationCap, Ruler, Weight,
  Droplets, Sunrise, Sun, Moon, Utensils, Flame,
  AlertTriangle, ChevronRight, Eye, Smile, Scissors, Wind,
  TrendingUp, Activity, Timer, Calendar, X, ArrowUpRight, FlameKindling,
  ChevronLeft, Lock, Music2, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Search, Disc3, ListMusic, RotateCcw,
  Crown, Swords, Download, Upload, ShieldCheck, ClipboardList, BarChart3, Trash2, Plus, Bell, BellOff,
  Settings, Save, GripVertical, PenLine, RefreshCcw
} from 'lucide-react';
import AuthGate from './components/AuthGate';
import { useCloudAutoSync } from './lib/cloudSync';
import CloudSyncCard from './components/CloudSyncCard';




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

const PROFILE = {
  name: 'Ashutosh Behera',
  age: 18,
  height: 188,
  weight: 76,
  category: 'OBC-NCL',
  baseline: 83,
  boards: 82,
  targets: [
    { rank: 1, name: 'IIT Bombay', course: 'Aerospace Engineering', tag: 'Absolute Top Priority', color: 'blue', desc: 'Closing Rank Target: Under AIR 800. Main leverage point: Advanced Physics mechanics dominance.' },
    { rank: 2, name: 'IIT Delhi', course: 'Computer Science / Electrical Engineering', tag: 'Primary Target', color: 'blue', desc: 'Requires balanced sub-1200 rank profile. Excellent infrastructure backup path.' },
    { rank: 3, name: 'IIIT Delhi', course: 'Computer Science / Electrical Engineering', tag: 'Secondary Target', color: 'amber', desc: 'Safe alternative via JEE Main percentile targets (>99.5%ile). Quality tech campus culture.' },
  ],
};

const DEFAULT_TIMELINE = [
  { start: '05:00', end: '05:20', label: 'Wake & Prep', detail: 'Pre-breakfast drinks, Vitamin D3', icon: Sunrise, type: 'prep', longDesc: 'Instant waking routine. Rehydrating the system with 500ml water + Chia seeds immediately to eliminate sleep inertia. Take single high-dose Vitamin D3 drop.' },
  { start: '05:20', end: '08:30', label: 'Study Slot 1 — Mathematics', detail: 'Allen Lectures at 1.5x–2x + active practice', icon: BookOpen, type: 'study', subject: 'math', longDesc: 'Peak cognitive availability window. Focus exclusively on core algebraic and trigonometric proof systems. Complete minimum 25 high-tier questions.' },
  { start: '08:30', end: '08:50', label: 'Breakfast Window', detail: 'Clean fuel block', icon: Utensils, type: 'meal', longDesc: '4 whole eggs, 3 whites, oats base. Ensure exact macronutrient absorption timing prior to the grueling Physics block.' },
  { start: '08:50', end: '11:30', label: 'Study Slot 2 — Physics', detail: 'Concepts and basic problem sets', icon: BookOpen, type: 'study', subject: 'physics', longDesc: 'Mechanics integration. Moving away from memorized shortcuts into deep vector analysis and calculus application frameworks.' },
  { start: '11:30', end: '13:00', label: 'Gym & Shower Window', detail: 'Dead-hour optimization — gym is empty', icon: Dumbbell, type: 'gym', longDesc: 'Hypertrophy or calisthenics application. Gym floor empty; maximize efficiency, execute within 65 minutes, return for rapid protein shake recovery.' },
  { start: '13:00', end: '13:25', label: 'Post-Workout Lunch', detail: 'High-protein recovery + Omega-3 Fish Oil', icon: Utensils, type: 'meal', longDesc: '200g chicken breast cooked clean + 2 whole wheat rotis and huge fiber salad pile. Take Omega-3 pills.' },
  { start: '13:25', end: '16:30', label: 'Study Slot 3 — Chemistry', detail: 'Physical / Organic alternating rotation', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'GOC mechanisms tracking or Mole concept numerical testing. Prevent midday fatigue by keeping hand writing actively moving.' },
  { start: '16:30', end: '16:50', label: 'Midday Snack Window', detail: 'Micronutrient / gut health reset', icon: Utensils, type: 'meal', longDesc: '200g clean curd base for gut microbiome + 1 antioxidant fruit source (apple/guava) + 15 raw structural almonds.' },
  { start: '16:50', end: '20:00', label: 'Study Slot 4 — Inorganic Chemistry', detail: 'Memorization or lecture backlog cleanup', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'High repetition memorization layer (NCERT alignments, block configurations, trend anomalies). Bullet journal exceptions.' },
  { start: '20:00', end: '20:25', label: 'Dinner Window', detail: 'Clean, low-carb evening plate', icon: Utensils, type: 'meal', longDesc: '150g pure lean chicken breast or paneer equivalent + hot vegetable stew array. Keep carbs light to avoid heavy morning fog.' },
  { start: '20:25', end: '22:00', label: 'Study Slot 5 — Mixed Advanced PYQs', detail: 'Past 5 years, timed conditions', icon: Timer, type: 'study', subject: 'mixed', longDesc: 'Testing mental endurance under fatigued constraints. Mimic real exam stress conditions across combined conceptual formats.' },
  { start: '22:00', end: '22:20', label: 'Night Snack Window', detail: 'Casein-rich slow protein feed', icon: Utensils, type: 'meal', longDesc: '250ml warm milk + 30g roasted chana. Sustained amino acid release engine covering 8 hours of fast sleep synthesis.' },
  { start: '22:20', end: '23:00', label: 'Plan & Wind Down', detail: 'Next day chapters, Magnesium, screens off', icon: Moon, type: 'prep', longDesc: 'Hard checklist preparation for tomorrow. Take structural Magnesium glycinate, terminate all short-wave blue lights, execute breathing resets.' },
  { start: '23:00', end: '23:00', label: 'Sleep Lock', detail: 'Hard stop.', icon: Moon, type: 'sleep', longDesc: 'Absolute system shutdown. Dark room settings optimized for rapid entry into deep REM sleep cycle.' },
];

const DIET = {
  target: '~2200–2300 kcal · clean body recomposition',
  protein: '165g–175g+ protein target · fats kept minimal',
  hydration: '4 – 4.5 L water spread evenly across the day',
  meals: [
    { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', 'Sattu drink (2 tbsp sattu + water + black salt)'], icon: Sunrise },
    { time: '08:30 AM', name: 'Breakfast', items: ['4 whole eggs + 3 egg whites', '60g oats in water', '1 banana'], icon: Sun },
    { time: '01:00 PM', name: 'Post-Workout Lunch', items: ['1 scoop Whey Isolate in water', '200g grilled/boiled chicken breast', '2 rotis', '1 bowl green sabzi', 'Large mixed salad'], icon: Dumbbell },
    { time: '04:30 PM', name: 'Midday Snack', items: ['200g curd', '1 apple or guava', '15 raw almonds'], icon: Sun },
    { time: '08:00 PM', name: 'Dinner', items: ['150g chicken breast', 'Warm vegetable stew', 'Green salad'], icon: Moon },
    { time: '10:00 PM', name: 'Night Snack', items: ['250ml toned milk', '30g roasted chana'], icon: Moon },
  ],
};

const DEFAULT_TRAINING = [
  { day: 'Monday', focus: 'Gym Upper Body (Pull Focus)', exercises: [{ name: 'Lat Pulldowns', sets: '4×12' }, { name: 'Seated Cable Rows', sets: '3×12' }, { name: 'DB Lateral Raises', sets: '4×20' }, { name: 'Behind-the-Back Wrist Curls', sets: '4×20 (high pump)' }], mode: 'gym' },
  { day: 'Tuesday', focus: 'Calisthenics Pull & Push Basics', exercises: [{ name: 'Dead-hang holds', sets: '4×Max' }, { name: 'Negative Pull-ups', sets: '4×5 (5-sec slow descent)' }, { name: 'Standard Push-ups', sets: '4×12' }], mode: 'calisthenics' },
  { day: 'Wednesday', focus: 'Legs & Deep Core Compression', exercises: [{ name: 'Goblet Squats', sets: '4×12' }, { name: 'Romanian Deadlifts', sets: '3×12' }, { name: 'Hanging Leg / Knee Raises', sets: '4×12' }, { name: 'Stomach Vacuums (structural planks)', sets: '3×60s' }], mode: 'gym' },
  { day: 'Thursday', focus: 'Gym Upper Body (Push Focus)', exercises: [{ name: 'Overhead DB Press', sets: '4×10' }, { name: 'Incline DB Bench Press', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }], mode: 'gym' },
  { day: 'Friday', focus: 'Calisthenics Push & Absolute Core', exercises: [{ name: 'Diamond Push-ups', sets: '4×12' }, { name: 'Pike Push-ups', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }, { name: 'L-Sit Progressions', sets: '4×Max holds' }], mode: 'calisthenics' },
  { day: 'Saturday', focus: 'Back & Shoulder Hypertrophy Burnout', exercises: [{ name: 'Straight-Arm Cable Pull-overs', sets: '4×12' }, { name: 'Face Pulls', sets: '3×20' }, { name: 'DB Lateral Raises (drop sets)', sets: '4×20' }, { name: 'Hammer Curls', sets: '3×12' }, { name: 'Finger Roll Grip Curls', sets: '4×25' }], mode: 'gym' },
  { day: 'Sunday', focus: 'Full Rest Day', exercises: [{ name: 'Deep physical stretching', sets: '—' }, { name: 'Zero training load', sets: '—' }, { name: 'Mental recovery', sets: '—' }], mode: 'rest' },
];

const SYLLABUS = [
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

// ---------- Spaced-Repetition Revision Tracking ----------
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

const ALL_SYLLABUS_TOPICS = SYLLABUS.flatMap((p) =>
  (['math', 'physics', 'chem']).flatMap((subject) =>
    p.subjects[subject].map((topic) => ({
      key: getTopicRevisionKey(p.phase, subject, topic),
      topic,
      subject,
      phase: p.phase,
      month: p.month,
    }))
  )
);

const GROOMING = [
  { icon: Eye, title: 'Dark Circles', issue: 'Deep, prominent shadows from history of late-night scrolling', plan: '11 PM sleep lock + Caffeine 5% + EGCG topical serum, applied at night', tag: 'skincare', details: ['Cleanse target areas under lower orbital bone gently.', 'Apply 2 concentrated drops of serum onto pad of ring finger.', 'Pat softly inside an outside-in arc vector map without skin pulling.'] },
  { icon: Wind, title: 'Tonsillitis', issue: 'Chronic Grade 2 hypertrophy, currently asymptomatic', plan: 'Watchful waiting + 0.5% Betadine gargles twice a week', tag: 'watch', details: ['Mix 5-10ml Betadine with equal parts lukewarm water.', 'Gargle continuously for 45 seconds targeting rear pharyngeal areas.', 'Avoid consuming liquids for 20 minutes post application.'] },
  { icon: Smile, title: 'Yellow Teeth', issue: 'Plaque / surface staining', plan: 'Hydrogen peroxide whitening strips + schedule dental scaling appointment', tag: 'dental', details: ['Apply active layer strip across perfectly dried dental framework.', 'Leave for 30 minutes flat; eliminate saliva accumulation blocks.', 'Rinse thoroughly; enforce strict ban on tannin liquids (coffee/tea).'] },
  { icon: Ruler, title: 'Facial Asymmetry & Jawline', issue: 'Lack of jaw definition', plan: 'Nasal breathing, mewing posture, supine back-sleeping, chewing hard foods evenly', tag: 'posture', details: ['Seal lips completely, transition standard respiration strictly nasal.', 'Rest full posterior third of tongue hard against internal upper palate.', 'Train symmetrical masseter activation when chewing whole nutrient sources.'] },
  { icon: Scissors, title: 'Body Hair', issue: 'High density, unwanted', plan: 'Electric trimmer touch-ups every Sunday', tag: 'routine', details: ['Schedule macro trim window post Sunday noon workout.', 'Clean apparatus elements; run baseline guard settings to protect skin mechanics.'] },
  { icon: Eye, title: 'Eyesight', issue: '-3 prescription both eyes, 6/6 corrected vision', plan: 'Blue-light / anti-glare glasses for heavy screen study', tag: 'vision', details: ['Enforce 20-20-20 rule during 3-hour continuous lecture stacks.', 'Sterilize protective lens glass structures daily before morning math slot.'] },
];

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

function serializeConfig(config: { trackerItems: any[]; timeline: any[]; training: any[] }) {
  return {
    trackerItems: config.trackerItems,
    training: config.training,
    timeline: config.timeline.map(({ icon, ...rest }) => rest),
  };
}

function deserializeConfig(raw: any) {
  return {
    trackerItems: Array.isArray(raw?.trackerItems) && raw.trackerItems.length ? raw.trackerItems : DEFAULT_TRACKER_ITEMS,
    training: Array.isArray(raw?.training) && raw.training.length ? raw.training : DEFAULT_TRAINING,
    timeline: Array.isArray(raw?.timeline) && raw.timeline.length ? hydrateTimeline(raw.timeline) : hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
  };
}

const CONFIG_STORAGE_KEY = 'app_config_v1';

const ConfigContext = React.createContext<{
  trackerItems: any[];
  timeline: any[];
  training: any[];
  updateConfig: (partial: Record<string, any>) => void;
  resetConfigSection: (key: 'trackerItems' | 'timeline' | 'training') => void;
}>({
  trackerItems: DEFAULT_TRACKER_ITEMS,
  timeline: hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
  training: DEFAULT_TRAINING,
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
  { rank: 'C', threshold: 15, label: 'C-Rank Hunter', color: '#34d399' },
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
  { id: 'syllabus', label: 'JEE Syllabus Roadmap', icon: BookOpen },
  { id: 'mocktests', label: 'Mock Test Tracker', icon: ClipboardList },
  { id: 'ashclock', label: "Ash's Clock", icon: Timer },
  { id: 'grooming', label: 'Clinical Grooming', icon: Sparkles },
  { id: 'spotify', label: 'Spotify Player', icon: Music2 },
  { id: 'strava', label: 'Strava Sync', icon: Activity },
  { id: 'history', label: 'Performance Calendar', icon: Calendar },
  { id: 'settings', label: 'Config & Settings', icon: Settings },
];

const SUBJECT_STYLE = {
  math: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', dot: 'bg-sky-400' },
  physics: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  chem: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  mixed: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
};

const POMODORO_SUBJECTS = [
  { key: 'math', label: 'Math' },
  { key: 'physics', label: 'Physics' },
  { key: 'chem', label: 'Chemistry' },
  { key: 'mixed', label: 'Mixed / PYQ' },
];

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

const getDeadlineCountdown = (targetDateStr) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

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
    if (!isFine) return;
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
              {modalData.icon ? <modalData.icon className="h-4 w-4" /> : <FlameKindling className="h-4 w-4 text-sky-400" />}
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
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300 bg-sky-500/[0.03] border border-sky-500/20 px-3 py-2 rounded-lg">
                    <ChevronRight className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
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
      <span className="inline-block w-[2px] h-[0.95em] bg-sky-300/80 ml-0.5 align-middle animate-questCursorBlink" />
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
        <div className="absolute -inset-6 bg-sky-500/20 blur-3xl rounded-3xl animate-pulseGlow" />

        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="absolute bottom-0 rounded-full bg-sky-300 animate-questSparkle"
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

        <div className="relative rounded-2xl border border-sky-400/40 bg-gradient-to-b from-[#04101f]/95 to-[#010a16]/95 backdrop-blur-xl shadow-[0_0_50px_-8px_rgba(56,189,248,0.45)] overflow-hidden">
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-sky-300/80" />
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-sky-300/80" />
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-sky-300/80" />
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-sky-300/80" />

          <div className="absolute inset-0 animate-questSweep bg-gradient-to-r from-transparent via-sky-300/10 to-transparent" />

          <div className="relative px-6 py-6 text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-sky-400/70 font-semibold mb-2">— System —</p>
            <h3 className="text-lg font-bold text-sky-50 tracking-wide mb-1 min-h-[1.5em]">
              <TypewriterText text="Daily Quest Cleared!" />
            </h3>
            <p className="text-[12px] text-sky-200/60 mb-4">All {trackerItems.length} objectives completed for today.</p>

            {data.isNewRank && (
              <div className="mb-4 animate-fadeInUp" style={{ animationDelay: '1.3s' }}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-semibold mb-1">Rank Up</div>
                <div className="text-2xl font-black tracking-tight" style={{ color: data.rank.color }}>
                  {data.rank.label}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-sky-300/50">
              <span className="h-1 w-1 rounded-full bg-sky-400 animate-dotBreathe" />
              Return to the grind, Hunter.
              <span className="h-1 w-1 rounded-full bg-sky-400 animate-dotBreathe" />
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
    <div className="hidden sm:flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/[0.06] px-3.5 py-1.5">
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
    blue: 'text-sky-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
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

function CountdownMatrix() {
  const daysToMocks = useMemo(() => getDeadlineCountdown('2026-11-01'), []);
  const daysToJEE = useMemo(() => getDeadlineCountdown('2027-01-22'), []);

  return (
    <Card className="border border-neutral-800/80 bg-gradient-to-br from-neutral-900/90 to-neutral-950/40">
      <SectionHeading icon={Target} title="Exam Micro-Horizon" subtitle="Strict spatial countdown telemetry" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-amber-500/80 mb-1">Target Engine 1</div>
            <div className="text-[14px] font-semibold text-neutral-200">Days Left for Mocks</div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 font-mono tracking-tight">{daysToMocks}</span>
            <span className="text-xs text-neutral-500 font-medium">Days remaining</span>
          </div>
          <div className="mt-2 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (daysToMocks/120)*100))}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.02] p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-sky-400/80 mb-1">Target Engine 2</div>
            <div className="text-[14px] font-semibold text-neutral-200">Days Left for JEE Main</div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-sky-400 font-mono tracking-tight">{daysToJEE}</span>
            <span className="text-xs text-neutral-500 font-medium">Days remaining</span>
          </div>
          <div className="mt-2 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500/60 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (daysToJEE/200)*100))}%` }} />
          </div>
        </div>
      </div>
    </Card>
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

  return (
    <button
      ref={ref}
      onClick={onToggle}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      title={isDerived ? 'Auto-synced from the Fuel Matrix meal log — click to go log meals' : undefined}
      className={`cursor-target relative flex flex-col items-start justify-between overflow-hidden p-3.5 rounded-xl border text-left transition-colors duration-200 group ${
        isChecked
          ? 'bg-emerald-500/[0.08] border-emerald-500/30 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]'
          : 'bg-neutral-900/40 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700'
      }`}
      style={{
        transform: `scale(${pressed ? 0.955 : 1})`,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="flex w-full justify-between items-start mb-2.5">
        {isChecked ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" strokeWidth={2} />
        ) : (
          <Circle className="h-4.5 w-4.5 text-neutral-600 group-hover:text-neutral-400 shrink-0 transition-colors" strokeWidth={1.75} />
        )}
        {isDerived && (
          <span className="text-[8.5px] uppercase tracking-wider font-bold text-neutral-600 group-hover:text-neutral-400 transition-colors">Auto</span>
        )}
      </div>
      <span className={`text-[11.5px] font-medium leading-snug transition-colors ${isChecked ? 'text-emerald-200/90' : 'text-neutral-300 group-hover:text-neutral-200'}`}>
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
            <div className="flex items-center gap-1.5 text-emerald-400/90 font-mono text-[13px] font-semibold tracking-tight">
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
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
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
// download that captures the Daily Matrix history plus the cached Strava/
// Spotify/Ash's Clock state, and a matching import to restore it anywhere.

function DataBackupCard({ globalHistory, setGlobalHistory }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const collectBackupPayload = () => ({
    _meta: {
      app: 'Ashutosh — Dynamic Command Center',
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
    strava_activities: localStorage.getItem('strava_activities'),
    strava_connected: localStorage.getItem('strava_connected'),
    spotify_profile: localStorage.getItem('spotify_profile'),
    spotify_recent: localStorage.getItem('spotify_recent'),
    spotify_connected: localStorage.getItem('spotify_connected'),
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
      setStatus({ type: 'success', message: 'Backup downloaded — keep it somewhere safe (Drive, email to yourself, etc).' });
    } catch {
      setStatus({ type: 'error', message: 'Could not create the backup file. Try again.' });
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
          'strava_activities', 'strava_connected',
          'spotify_profile', 'spotify_recent', 'spotify_connected',
          'app_config_v1',
        ];
        passthroughKeys.forEach((key) => {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            localStorage.setItem(key, parsed[key]);
          }
        });

        setStatus({ type: 'success', message: 'Restored — reloading to apply everything…' });
        setTimeout(() => window.location.reload(), 1100);
      } catch {
        setStatus({ type: 'error', message: 'That file is invalid or corrupted — nothing was changed.' });
      }
    };
    reader.readAsText(file);
  };

  const dayCount = Object.keys(globalHistory || {}).length;

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeading
          icon={ShieldCheck}
          title="Data Backup & Restore"
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
        Everything here — the Daily Matrix history, streak, Hunter Rank, mock test scores, weight log, and cached Strava/Spotify data — lives only in this browser's storage. Clearing site data, switching devices, or reinstalling the browser erases it permanently, with no way to recover it. Export a backup file regularly, and import it to restore everything on a new device or after a reset.
      </p>

      {status && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium animate-fadeIn ${
            status.type === 'success'
              ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-800/40 bg-rose-950/30 text-rose-300'
          }`}
        >
          {status.message}
        </div>
      )}
    </Card>
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
    if (pct < 1) return 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40';
    return 'bg-gradient-to-br from-emerald-500 to-teal-500 text-neutral-950 border-emerald-400 font-bold';
  };

  return (
    <div className="space-y-5">
      <DataBackupCard globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} />
      <Card className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <SectionHeading icon={Calendar} title="Execution Heatmap Analytics" subtitle="Persistent performance velocity tracing" />
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
              } ${getHeatmapColor(dateStr)} ${isCurrentDay ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-neutral-950' : ''}`}
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
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-emerald-950/40 border border-emerald-800/40" /> <span>61-99%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-gradient-to-br from-emerald-500 to-teal-500" /> <span>100%</span></div>
        </div>
        <p className="text-[11px] text-neutral-500">Click any historic metric square to trace detailed logs.</p>
      </div>
    </Card>
    </div>
  );
}

// ---------- Tab Subcomponent: Overview ----------

function OverviewTab({ setModal }) {
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

  return (
    <div className="space-y-5 animate-fadeIn">
      <CountdownMatrix />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="md:col-span-2 xl:col-span-2">
          <SectionHeading icon={GraduationCap} title="Profile" subtitle="Core identity & academic baseline" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <div>
              <div className="text-[20px] font-semibold text-neutral-100 leading-tight">{PROFILE.name}</div>
              <div className="text-[13px] text-neutral-500">{PROFILE.age}-year-old Male · Drop year, prepping for JEE 2027</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatPill icon={Ruler} label="Height" value="188 cm" />
            <StatPill icon={Weight} label="Weight" value={latestWeight ? `${latestWeight.weight} kg` : `${PROFILE.weight} kg`} />
            <StatPill icon={Target} label="Category" value="OBC-NCL" accent="amber" />
            <StatPill icon={TrendingUp} label="JEE Main Baseline" value="83 %ile" accent="blue" />
          </div>
          <p className="mt-3 text-[12px] text-neutral-500 leading-relaxed">
            Baseline achieved with zero self-study — just sitting in class. CBSE 12th boards: 82%.
          </p>
        </Card>

        <Card>
          <SectionHeading icon={Target} title="Targets" subtitle="Ranked by priority (Click to view matrix)" />
          <div className="space-y-2.5">
            {PROFILE.targets.map((t) => (
              <div
                key={t.rank}
                onClick={() => setModal({
                  title: t.name,
                  subtitle: t.tag,
                  icon: Target,
                  textBody: t.desc,
                  arrayTitle: 'Key Focus Vectors',
                  arrayItems: ['Target Cutoff Percentile: 99.92+', 'Advanced Focus: High weightage mechanics & organic structures']
                })}
                className={`rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.02] ${t.color === 'blue' ? 'border-sky-500/25 bg-sky-500/[0.06] hover:bg-sky-500/[0.12]' : 'border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-semibold ${t.color === 'blue' ? 'text-sky-300' : 'text-amber-300'}`}>{t.name}</span>
                  <ArrowUpRight className="h-3 w-3 text-neutral-500" />
                </div>
                <div className="text-[12px] text-neutral-400 mt-0.5">{t.course}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading icon={Clock3} title="Today's Shape" subtitle="Session load map summary" />
          <div className="space-y-2">
            {[
              { label: 'Study Sessions', value: '5 blocks · ~13h 40m', icon: BookOpen },
              { label: 'Gym / Training', value: '1h 30m window', icon: Dumbbell },
              { label: 'Meals', value: '6 fuel windows', icon: Utensils },
              { label: 'Sleep Lock', value: '11:00 PM sharp', icon: Moon },
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
          <SectionHeading icon={Flame} title="Fuel Snapshot" subtitle="V-Taper matrix ratios" />
          <div className="space-y-2.5">
            <StatPill icon={Flame} label="Calories" value={DIET.target.split('·')[0].trim()} accent="amber" />
            <StatPill icon={Activity} label="Protein" value="165–175g+" accent="emerald" />
            <StatPill icon={Droplets} label="Hydration" value="4–4.5 L / day" accent="blue" />
          </div>
        </Card>

        <Card>
          <SectionHeading icon={Calendar} title="Syllabus Runway" subtitle="4-month deadline progression" />
          <div className="space-y-2">
            {SYLLABUS.map((p) => (
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

        <Card className="md:col-span-2 xl:col-span-3">
          <SectionHeading icon={AlertTriangle} title="Clinical Watchlist" subtitle="Grooming & medical target points" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {GROOMING.map((g) => (
              <div 
                key={g.title} 
                onClick={() => setModal({
                  title: g.title,
                  subtitle: `Category: ${g.tag.toUpperCase()}`,
                  icon: g.icon,
                  textBody: g.issue,
                  arrayTitle: 'Action Execution Protocol',
                  arrayItems: g.details || [g.plan]
                })}
                className="rounded-lg border border-neutral-800/70 bg-neutral-950/40 p-2.5 flex flex-col items-center text-center gap-1.5 cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-600 transition-all"
              >
                <g.icon className="h-4 w-4 text-amber-400/90" strokeWidth={1.75} />
                <span className="text-[11px] font-medium text-neutral-300 leading-tight">{g.title}</span>
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
  const { timeline } = React.useContext(ConfigContext);
  const typeStyle = {
    study: 'border-l-sky-500',
    gym: 'border-l-emerald-500',
    meal: 'border-l-amber-500',
    prep: 'border-l-neutral-600',
    sleep: 'border-l-violet-500',
  };
  const typeBg = {
    study: 'bg-sky-500/10 text-sky-400',
    gym: 'bg-emerald-500/10 text-emerald-400',
    meal: 'bg-amber-500/10 text-amber-400',
    prep: 'bg-neutral-800 text-neutral-400',
    sleep: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <SectionHeading icon={Clock3} title="Master Timeline" subtitle="Interactive structural day architecture — Click any block for tactical execution logs" />
        <RippleButton
          onClick={onToggleNotifications}
          className={`cursor-target shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            notificationsEnabled
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
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
          You'll get a ping 5 minutes before each block starts, for as long as this tab stays open — browser notifications can't wake up a fully closed tab.
        </p>
      )}
      <div className="space-y-2.5">
        {timeline.map((slot, i) => {
          const Icon = slot.icon;
          const sub = slot.subject ? SUBJECT_STYLE[slot.subject] : null;
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
  const baseline = first ? first.weight : PROFILE.weight;
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
        <SectionHeading icon={TrendingUp} title="Body Weight Trend" subtitle="Weekly weigh-ins — the real check on whether the recomposition plan is working" />
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
            <StatPill icon={Calendar} label="Since First Log" value={`${delta > 0 ? '+' : ''}${delta} kg`} accent={delta === 0 ? 'neutral' : delta > 0 ? 'emerald' : 'blue'} />
            {delta30 !== null && (
              <StatPill icon={TrendingUp} label="Last 30 Days" value={`${delta30 > 0 ? '+' : ''}${delta30} kg`} accent={delta30 === 0 ? 'neutral' : delta30 > 0 ? 'emerald' : 'blue'} />
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
  const { training } = React.useContext(ConfigContext);
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

  // Per-meal diet check-ins live in the parent (JEEDashboard) so the Daily
  // Matrix's "All 6 Meals Hit" box can auto-derive from this instead of being
  // a second, independent source of truth for the same thing.
  const todayStr = currentDateStr;
  const todayLog = dietLog[todayStr] || {};
  const mealsLoggedToday = DIET.meals.filter((m) => todayLog[m.name]).length;

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
    gym: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
    calisthenics: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    rest: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  };

  const handleExerciseClick = (exName, setsStr) => {
    const defaultData = { target: 'General Conditioning', instructions: ['Execute standard range of motion patterns safely.', 'Keep load linear.'], cues: 'Focus on proper core tracking.' };
    const targetedGuide = EXERCISE_GUIDE[exName] || defaultData;
    
    setModal({
      title: exName,
      subtitle: `Target Focus: ${targetedGuide.target} · Routine Parameters: ${setsStr}`,
      icon: Dumbbell,
      arrayTitle: 'Step-By-Step Execution Instructions',
      arrayItems: targetedGuide.instructions,
      cues: targetedGuide.cues
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <SectionHeading icon={Dumbbell} title="Hybrid Vascularity Workout Split" subtitle="Select day to map active routines. Click any individual exercise to view strict mechanical form guides." />
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
                  <span className="text-[12.5px] text-neutral-300 group-hover:text-sky-400 transition-colors">{ex.name}</span>
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
        <SectionHeading icon={Flame} title="V-Taper Fuel Matrix" subtitle={`${DIET.target} · ${DIET.protein}`} />
        <div className="mb-4 flex flex-wrap gap-2.5">
          <StatPill icon={Flame} label="Calorie Target" value="~2200–2300 kcal" accent="amber" />
          <StatPill icon={Activity} label="Protein Target" value="165g–175g+" accent="emerald" />
          <StatPill icon={Droplets} label="Hydration" value={DIET.hydration} accent="blue" />
        </div>

        <div className="mb-4 flex items-center justify-between flex-wrap gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${mealsLoggedToday === DIET.meals.length ? 'text-emerald-400' : 'text-neutral-500'}`} />
            <span className="text-[12.5px] text-neutral-300">
              <span className="font-semibold text-neutral-100 tabular-nums">{mealsLoggedToday}/{DIET.meals.length}</span> meals logged today
              <span className="text-neutral-600"> · syncs the "All 6 Meals Hit" box on the Daily Matrix</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {last7Days.map((d) => {
              const pct = d.count / DIET.meals.length;
              const isToday = d.date === todayStr;
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}/${DIET.meals.length} meals logged`}
                  className={`h-5 w-5 rounded-md flex items-center justify-center text-[8.5px] font-bold ${isToday ? 'ring-1 ring-neutral-500' : ''}`}
                  style={{
                    backgroundColor: pct === 0 ? 'rgba(255,255,255,0.04)' : `rgba(52,211,153,${0.15 + pct * 0.65})`,
                    color: pct > 0.6 ? '#052e1f' : '#71717a',
                  }}
                >
                  {d.count > 0 ? d.count : ''}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {DIET.meals.map((m) => {
            const isLogged = !!todayLog[m.name];
            return (
              <Card
                key={m.name}
                onClick={() => setModal({
                  title: m.name,
                  subtitle: `Scheduled Timing Window: ${m.time}`,
                  icon: m.icon,
                  arrayTitle: 'Exact Nutrient Components',
                  arrayItems: m.items,
                  cues: 'Avoid heavy hydration consumption simultaneously during solid meals to keep enzyme kinetics tracking perfectly.'
                })}
                className={isLogged ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : ''}
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
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-neutral-600" />
                      )}
                    </button>
                    <ArrowUpRight className="h-3 w-3 text-neutral-600" />
                  </div>
                </div>
                <ul className="space-y-1">
                  {m.items.map((it) => (
                    <li key={it} className="flex items-start gap-1.5 text-[12px] text-neutral-400 leading-snug">
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
  const [activePhase, setActivePhase] = useState(1);
  const phase = SYLLABUS.find((p) => p.phase === activePhase);

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
    return ALL_SYLLABUS_TOPICS
      .map((t) => ({ ...t, ...getRevisionStatus(revisionLog[t.key]) }))
      .filter((t) => t.status === 'due' || t.status === 'overdue')
      .sort((a, b) => (b.days || 0) - (a.days || 0));
  }, [revisionLog]);

  const handleTopicClick = (topicName) => {
    const meta = TOPIC_DETAILS[topicName] || { 
      chapters: ['General Conceptual Practice Modules'], 
      focus: ['Complete all textbook back exercises', 'Review core formulas & dynamic testing metrics'] 
    };

    setModal({
      title: topicName,
      subtitle: `Syllabus Structural Tracking Units`,
      icon: BookOpen,
      arrayTitle: 'Sub-Chapters Checklist',
      arrayItems: meta.chapters,
      focusPoints: meta.focus
    });
  };

  return (
    <div className="animate-fadeIn">
      <SectionHeading icon={BookOpen} title="JEE Syllabus Runway" subtitle="4-month absolute deadline stack. Click on any topic/chapter box to reveal specific deep focus items." />

      {staleTopics.length > 0 && (
        <Card className="mb-5 border border-amber-500/20">
          <SectionHeading
            icon={RotateCcw}
            title="Revision Due"
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
                  <span className={`text-[10.5px] shrink-0 ${SUBJECT_STYLE[t.subject].text}`}>{t.month}</span>
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
        {SYLLABUS.map((p) => (
          <button
            key={p.phase}
            onClick={() => setActivePhase(p.phase)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-all duration-150 ${
              activePhase === p.phase
                ? 'border-sky-500/40 bg-sky-500/[0.08]'
                : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${activePhase === p.phase ? 'bg-sky-500/20 text-sky-300' : 'bg-neutral-800 text-neutral-400'}`}>
              {p.phase}
            </span>
            <div>
              <div className={`text-[12.5px] font-medium ${activePhase === p.phase ? 'text-sky-300' : 'text-neutral-300'}`}>{p.month}</div>
              <div className="text-[10.5px] text-neutral-500">{p.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { key: 'math', title: 'Mathematics', style: SUBJECT_STYLE.math },
          { key: 'physics', title: 'Physics', style: SUBJECT_STYLE.physics },
          { key: 'chem', title: 'Chemistry', style: SUBJECT_STYLE.chem },
        ].map((s) => (
          <Card key={s.key} className={`border ${s.style.border}`}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className={`h-2 w-2 rounded-full ${s.style.dot}`} />
              <span className={`text-[13px] font-semibold ${s.style.text}`}>{s.title}</span>
            </div>
            <ul className="space-y-2">
              {phase.subjects[s.key].map((topic) => {
                const key = getTopicRevisionKey(activePhase, s.key, topic);
                const { status, days } = getRevisionStatus(revisionLog[key]);
                const dotColor =
                  status === 'never' ? 'bg-neutral-700' :
                  status === 'fresh' ? 'bg-emerald-400' :
                  status === 'due' ? 'bg-amber-400' : 'bg-rose-400';
                const badgeText =
                  status === 'never' ? 'Not yet revised' :
                  status === 'fresh' ? `Revised ${days === 0 ? 'today' : `${days}d ago`}` :
                  status === 'due' ? `Due · ${days}d ago` : `Overdue · ${days}d ago`;
                const badgeClass =
                  status === 'never' ? 'text-neutral-600' :
                  status === 'fresh' ? 'text-emerald-400' :
                  status === 'due' ? 'text-amber-400' : 'text-rose-400';

                return (
                  <li
                    key={topic}
                    className="flex flex-col gap-1.5 text-[12.5px] text-neutral-300 leading-snug p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/40 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div onClick={() => handleTopicClick(topic)} className="flex items-start gap-2 cursor-pointer min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-600 group-hover:text-sky-400" strokeWidth={2} />
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
        ))}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Mock Test Tracker ----------
// A dependency-free SVG line chart tracing Math/Physics/Chem scores over time.
function ScoreTrendChart({ tests }) {
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

  const series = [
    { key: 'math', color: '#38bdf8', label: 'Math' },
    { key: 'physics', color: '#a78bfa', label: 'Physics' },
    { key: 'chem', color: '#34d399', label: 'Chemistry' },
  ];

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
  const [tests, setTests] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mock_test_log');
      const parsed = saved ? JSON.parse(saved) : [];
      // Back-compat: earlier version stored raw numbers per subject with an
      // implicit fixed 100 max. Normalize those into { score, max } shape.
      return parsed.map((t: any) => ({
        ...t,
        scores: {
          math: typeof t.scores?.math === 'number' ? { score: t.scores.math, max: 100 } : t.scores?.math,
          physics: typeof t.scores?.physics === 'number' ? { score: t.scores.physics, max: 100 } : t.scores?.physics,
          chem: typeof t.scores?.chem === 'number' ? { score: t.scores.chem, max: 100 } : t.scores?.chem,
        },
      }));
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
  const [formMath, setFormMath] = useState('');
  const [formMathMax, setFormMathMax] = useState('100');
  const [formPhysics, setFormPhysics] = useState('');
  const [formPhysicsMax, setFormPhysicsMax] = useState('100');
  const [formChem, setFormChem] = useState('');
  const [formChemMax, setFormChemMax] = useState('100');
  const [formWeakTopics, setFormWeakTopics] = useState<string[]>([]);

  const activePhaseData = SYLLABUS.find((p) => p.phase === formPhase);

  const toggleWeakTopic = (topic: string) => {
    setFormWeakTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  };

  const resetForm = () => {
    setFormLabel('');
    setFormMath('');
    setFormPhysics('');
    setFormChem('');
    // Max-marks fields deliberately are NOT reset — most students sit a run of
    // tests from the same series with the same marking scheme, so keeping
    // the last-used max marks pre-filled saves re-typing every single time.
    setFormWeakTopics([]);
  };

  const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

  const handleAddTest = () => {
    if (!formMath && !formPhysics && !formChem) return;
    const mathMax = Math.max(1, Number(formMathMax) || 100);
    const physicsMax = Math.max(1, Number(formPhysicsMax) || 100);
    const chemMax = Math.max(1, Number(formChemMax) || 100);
    const entry = {
      id: `mt_${Date.now()}`,
      date: formDate,
      label: formLabel.trim() || 'Untitled Test',
      scores: {
        math: { score: clamp(Number(formMath) || 0, mathMax), max: mathMax },
        physics: { score: clamp(Number(formPhysics) || 0, physicsMax), max: physicsMax },
        chem: { score: clamp(Number(formChem) || 0, chemMax), max: chemMax },
      },
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

  const subjectMeta = [
    { key: 'math', title: 'Mathematics' },
    { key: 'physics', title: 'Physics' },
    { key: 'chem', title: 'Chemistry' },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <Card>
        <SectionHeading
          icon={ClipboardList}
          title="Log a Mock Test"
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
          <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <label className={`text-[11px] uppercase tracking-wider font-bold block mb-2 sm:mb-1.5 ${SUBJECT_STYLE.math.text}`}>Math</label>
            <div className="flex items-stretch gap-2">
              <input
                type="number" inputMode="decimal" min={0} value={formMath}
                onChange={(e) => setFormMath(e.target.value)}
                placeholder="Score"
                className="w-full min-w-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3 sm:py-2 text-base sm:text-[13px] font-semibold text-neutral-50 placeholder:font-normal placeholder:text-neutral-600 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
              />
              <span className="flex items-center text-neutral-600 text-[13px] shrink-0">/</span>
              <input
                type="number" inputMode="decimal" min={1} value={formMathMax}
                onChange={(e) => setFormMathMax(e.target.value)}
                title="Full marks for this subject in this test"
                className="w-20 sm:w-16 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-3 sm:py-2 text-base sm:text-[13px] font-medium text-neutral-300 text-center focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
              />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <label className={`text-[11px] uppercase tracking-wider font-bold block mb-2 sm:mb-1.5 ${SUBJECT_STYLE.physics.text}`}>Physics</label>
            <div className="flex items-stretch gap-2">
              <input
                type="number" inputMode="decimal" min={0} value={formPhysics}
                onChange={(e) => setFormPhysics(e.target.value)}
                placeholder="Score"
                className="w-full min-w-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3 sm:py-2 text-base sm:text-[13px] font-semibold text-neutral-50 placeholder:font-normal placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
              />
              <span className="flex items-center text-neutral-600 text-[13px] shrink-0">/</span>
              <input
                type="number" inputMode="decimal" min={1} value={formPhysicsMax}
                onChange={(e) => setFormPhysicsMax(e.target.value)}
                title="Full marks for this subject in this test"
                className="w-20 sm:w-16 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-3 sm:py-2 text-base sm:text-[13px] font-medium text-neutral-300 text-center focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
              />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <label className={`text-[11px] uppercase tracking-wider font-bold block mb-2 sm:mb-1.5 ${SUBJECT_STYLE.chem.text}`}>Chem</label>
            <div className="flex items-stretch gap-2">
              <input
                type="number" inputMode="decimal" min={0} value={formChem}
                onChange={(e) => setFormChem(e.target.value)}
                placeholder="Score"
                className="w-full min-w-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3 sm:py-2 text-base sm:text-[13px] font-semibold text-neutral-50 placeholder:font-normal placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
              />
              <span className="flex items-center text-neutral-600 text-[13px] shrink-0">/</span>
              <input
                type="number" inputMode="decimal" min={1} value={formChemMax}
                onChange={(e) => setFormChemMax(e.target.value)}
                title="Full marks for this subject in this test"
                className="w-20 sm:w-16 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-3 sm:py-2 text-base sm:text-[13px] font-medium text-neutral-300 text-center focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>
          </div>
        </div>
        <p className="text-[10.5px] text-neutral-600 -mt-3.5 mb-5">Enter the actual full marks for each subject — it doesn't need to be 100, and can differ subject to subject or test to test.</p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">Flag Weak Topics (optional)</label>
            <div className="flex gap-1 flex-wrap">
              {SYLLABUS.map((p) => (
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
            {subjectMeta.map((s) => (
              <div key={s.key}>
                <div className={`text-[11px] font-semibold mb-1.5 ${SUBJECT_STYLE[s.key].text}`}>{s.title}</div>
                <div className="space-y-1.5">
                  {activePhaseData?.subjects[s.key].map((topic) => (
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
          <SectionHeading icon={BarChart3} title="Score Trend" subtitle={`${sortedTests.length} test${sortedTests.length === 1 ? '' : 's'} logged — shown as % of that test's max marks`} />
          <div className="mt-4">
            <ScoreTrendChart tests={sortedTests} />
          </div>
        </Card>
      )}

      {weakTopicCounts.length > 0 && (
        <Card>
          <SectionHeading icon={AlertTriangle} title="Weak Topic Priority" subtitle="Ranked by how often each topic has been flagged across your logged tests" />
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
        <SectionHeading icon={ClipboardList} title="Test Log" subtitle={sortedTests.length ? 'All logged attempts, most recent first' : 'Nothing logged yet'} />
        {sortedTests.length === 0 ? (
          <p className="text-[13px] text-neutral-500 mt-4">
            No mock tests logged yet. Add your first one above — the score trend and weak-topic ranking will build up automatically from here.
          </p>
        ) : (
          <div className="space-y-2 mt-4">
            {[...sortedTests].reverse().map((t) => {
              const totalScore = t.scores.math.score + t.scores.physics.score + t.scores.chem.score;
              const totalMax = t.scores.math.max + t.scores.physics.max + t.scores.chem.max;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 flex-wrap">
                  <div>
                    <div className="text-[13px] font-medium text-neutral-200">{t.label}</div>
                    <div className="text-[11px] text-neutral-500">{getDayName(t.date)}, {t.date}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className={SUBJECT_STYLE.math.text}>M {t.scores.math.score}/{t.scores.math.max}</span>
                    <span className={SUBJECT_STYLE.physics.text}>P {t.scores.physics.score}/{t.scores.physics.max}</span>
                    <span className={SUBJECT_STYLE.chem.text}>C {t.scores.chem.score}/{t.scores.chem.max}</span>
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

// ---------- Tab Subcomponent: Grooming ----------

function GroomingTab({ setModal }) {
  const tagStyle = {
    skincare: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    watch: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dental: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    posture: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    routine: 'bg-neutral-800 text-neutral-400 border-neutral-700',
    vision: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  };

  return (
    <div className="animate-fadeIn">
      <SectionHeading icon={Sparkles} title="Clinical Grooming" subtitle="Self-reported clinical optimization map — Click blocks for meticulous execution instructions" />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" strokeWidth={1.75} />
        <p className="text-[12px] text-amber-200/90 leading-relaxed">
          These are Ashutosh's own stated fixes, not clinical guidance. Anything involving the tonsils, teeth, or eyes is worth confirming with an actual doctor or dentist before committing to a routine.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {GROOMING.map((g) => (
          <Card 
            key={g.title}
            onClick={() => setModal({
              title: g.title,
              subtitle: `Tag Axis Focus: ${g.tag.toUpperCase()}`,
              icon: g.icon,
              textBody: `Identified Condition Parameter: ${g.issue}`,
              arrayTitle: 'Step-By-Step Execution Protocol',
              arrayItems: g.details
            })}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                  <g.icon className="h-4 w-4 text-neutral-300" strokeWidth={1.75} />
                </div>
                <span className="text-[13px] font-semibold text-neutral-100">{g.title}</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600" />
            </div>
            <div className="mb-2.5">
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-500 mb-1">Issue Parameters</div>
              <p className="text-[12px] text-neutral-400 leading-snug">{g.issue}</p>
            </div>
            <div className="mb-3">
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-500 mb-1">Stated Plan</div>
              <p className="text-[12px] text-neutral-300 leading-snug">{g.plan}</p>
            </div>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tagStyle[g.tag]}`}>
              {g.tag}
            </span>
          </Card>
        ))}
      </div>
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
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg shadow-sky-500/10">
        <Lock className="h-5 w-5 text-neutral-950" strokeWidth={2} />
      </div>

      <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">Restricted Access</h1>
      <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
        This command center holds personal data. Enter the passcode to continue.
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
                  ? 'border-sky-500/50 bg-neutral-900/80 text-neutral-100'
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
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg shadow-sky-500/10 animate-fadeInUp">
          <GraduationCap className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
        </div>

        <span
          className="mb-6 text-[10px] font-medium uppercase tracking-[0.35em] text-neutral-500 animate-fadeInUp"
          style={{ animationDelay: '70ms' }}
        >
          Ashutosh Behera
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
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>

        <span
          className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-600 animate-fadeInUp"
          style={{ animationDelay: '150ms' }}
        >
          JEE 2027 · Drop-Year OS
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
const btnSave = (dirty: boolean) => `cursor-target flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${dirty ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-neutral-800 bg-neutral-900 text-neutral-600'}`;
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
  const { timeline, updateConfig, resetConfigSection } = React.useContext(ConfigContext);
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
                        {['math', 'physics', 'chem', 'mixed'].map((s) => <option key={s} value={s}>{s}</option>)}
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

function ConfigEditorTab() {
  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeading icon={Settings} title="Config & Settings" subtitle="Edit the Daily Checklist, Timeline, and Training Split — changes apply everywhere instantly, no code required" />
      <CloudSyncCard />
      <TrackerItemsEditor />
      <TimelineEditor />
      <TrainingEditor />
    </div>
  );
}

// ---------- Main Root Dashboard Component ----------

export default function JEEDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  useCloudAutoSync(unlocked);
  // --- Strava Sync Engine States ---
  // This reads cached workouts from the browser disk immediately on page load
  const [stravaActivities, setStravaActivities] = useState<any[]>(() => {
    const savedActivities = localStorage.getItem('strava_activities');
    return savedActivities ? JSON.parse(savedActivities) : [];
  });
  
  const [isStravaLoading, setIsStravaLoading] = useState(false);
  const [isStravaSyncing, setIsStravaSyncing] = useState(false);
  const [stravaLastSynced, setStravaLastSynced] = useState<number | null>(null);

  // This new state tracks whether the user is connected to hide/show buttons
  const [isStravaConnected, setIsStravaConnected] = useState(() => {
    return localStorage.getItem('strava_connected') === 'true';
  });

  // The actual OAuth tokens — without these persisted, "connected" is just
  // a flag with nothing behind it, and the app can never pull fresh data
  // without forcing a full reconnect.
  const [stravaTokens, setStravaTokens] = useState<{ access_token: string; refresh_token: string; expires_at: number } | null>(() => {
    try {
      const saved = localStorage.getItem('strava_tokens');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const persistStravaTokens = (tokens: { access_token: string; refresh_token: string; expires_at: number }) => {
    setStravaTokens(tokens);
    localStorage.setItem('strava_tokens', JSON.stringify(tokens));
  };

  // Pulls fresh activities using only the stored refresh_token — no popup,
  // no reconnect. Safe to call on a timer or whenever the tab regains focus.
  const syncStravaActivities = async (refreshToken?: string) => {
    const tokenToUse = refreshToken ?? stravaTokens?.refresh_token;
    if (!tokenToUse) return;

    setIsStravaSyncing(true);
    try {
      const response = await fetch('/api/strava-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokenToUse }),
      });

      if (response.status === 401) {
        // Refresh token was rejected — Strava access was revoked elsewhere.
        // Reflect that honestly instead of pretending we're still connected.
        handleStravaDisconnect();
        return;
      }

      if (!response.ok) return;

      const result = await response.json();
      setStravaActivities(result.activities);
      localStorage.setItem('strava_activities', JSON.stringify(result.activities));
      persistStravaTokens(result.tokens);
      setStravaLastSynced(Date.now());
    } catch {
      // Network hiccup — leave existing cached data in place and try again
      // on the next scheduled sync rather than disconnecting the user.
    } finally {
      setIsStravaSyncing(false);
    }
  };

  useEffect(() => {
    const handleStravaMessage = (event: any) => {
      // Accept data from local environments or your live production domain
      const isTrustedOrigin = 
        event.origin === window.location.origin || 
        event.origin.includes('vercel.app') || 
        event.origin.includes('webcontainer.io');

      if (!isTrustedOrigin) return;

      if (event.data && event.data.type === 'STRAVA_DATA') {
        const activities = event.data.data;
        const tokens = event.data.tokens;
        
        // 1. Update the React interface states
        setStravaActivities(activities);
        setIsStravaConnected(true);
        setStravaLastSynced(Date.now());
        
        // 2. Lock the data into the browser disk memory
        localStorage.setItem('strava_activities', JSON.stringify(activities));
        localStorage.setItem('strava_connected', 'true');
        if (tokens) {
          persistStravaTokens(tokens);
        }
        
        setIsStravaLoading(false);
      }
    };

    window.addEventListener('message', handleStravaMessage);
    return () => window.removeEventListener('message', handleStravaMessage);
  }, []);

  // Keep data fresh without any user action: sync once on load, then every
  // 5 minutes while connected, and again whenever the tab regains focus.
  useEffect(() => {
    if (!isStravaConnected || !stravaTokens?.refresh_token) return;

    syncStravaActivities();

    const intervalId = setInterval(() => syncStravaActivities(), 5 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncStravaActivities();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStravaConnected]);

  const handleStravaDisconnect = () => {
    // 1. Clear out the live React application states
    setStravaActivities([]);
    setIsStravaConnected(false);
    setStravaTokens(null);
    setStravaLastSynced(null);
    
    // 2. Erase the cached entries from the browser disk storage
    localStorage.removeItem('strava_activities');
    localStorage.removeItem('strava_connected');
    localStorage.removeItem('strava_tokens');
  };
  
  const handleStravaConnect = () => {
    setIsStravaLoading(true);
    
    // Hardcoded Client ID to guarantee it doesn't read as undefined or empty
    const clientId = "263722"; 
    
    // Dynamic URL detection: If it sees '.vercel.app', it forces the live domain
    const isLive = window.location.hostname.includes('vercel.app');
    const targetOrigin = isLive 
      ? 'https://ashutoshbehera.vercel.app' 
      : window.location.origin;

    const redirectUri = encodeURIComponent(`${targetOrigin}/api/strava-callback`);
    const scope = "activity:read_all";
    
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    
    window.open(stravaAuthUrl, 'Connect with Strava', 'width=600,height=800');
  };

  // --- Spotify Sync Engine States ---
  // Mirrors the Strava engine exactly: refresh_token persisted to disk means
  // the session survives a hard refresh, a closed tab, or a new day — no
  // re-authorization popup required unless the user explicitly disconnects
  // or revokes access from Spotify's own account settings.
  const [spotifyTokens, setSpotifyTokens] = useState<{ access_token: string; refresh_token: string; expires_at: number } | null>(() => {
    try {
      const saved = localStorage.getItem('spotify_tokens');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isSpotifyConnected, setIsSpotifyConnected] = useState(() => {
    return localStorage.getItem('spotify_connected') === 'true';
  });

  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [isSpotifySyncing, setIsSpotifySyncing] = useState(false);
  const [spotifyLastSynced, setSpotifyLastSynced] = useState<number | null>(null);

  const [spotifyProfile, setSpotifyProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('spotify_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [spotifyRecentlyPlayed, setSpotifyRecentlyPlayed] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('spotify_recent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const persistSpotifyTokens = (tokens: { access_token: string; refresh_token: string; expires_at: number }) => {
    setSpotifyTokens(tokens);
    localStorage.setItem('spotify_tokens', JSON.stringify(tokens));
  };

  // Pulls a fresh access_token + profile + recently-played using only the
  // stored refresh_token. Safe to call on a timer or on tab focus — this is
  // what keeps the "connected" state alive across refreshes indefinitely.
  const syncSpotifyData = async (refreshToken?: string) => {
    const tokenToUse = refreshToken ?? spotifyTokens?.refresh_token;
    if (!tokenToUse) return;

    setIsSpotifySyncing(true);
    try {
      const response = await fetch('/api/spotify-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokenToUse }),
      });

      if (response.status === 401) {
        // Refresh token rejected — access was revoked on Spotify's side.
        handleSpotifyDisconnect();
        return;
      }

      if (!response.ok) return;

      const result = await response.json();
      setSpotifyProfile(result.profile);
      setSpotifyRecentlyPlayed(result.recentlyPlayed || []);
      localStorage.setItem('spotify_profile', JSON.stringify(result.profile));
      localStorage.setItem('spotify_recent', JSON.stringify(result.recentlyPlayed || []));
      persistSpotifyTokens(result.tokens);
      setSpotifyLastSynced(Date.now());
    } catch {
      // Network hiccup — keep cached data, retry on next scheduled sync.
    } finally {
      setIsSpotifySyncing(false);
    }
  };

  useEffect(() => {
    const handleSpotifyMessage = (event: any) => {
      const isTrustedOrigin =
        event.origin === window.location.origin ||
        event.origin.includes('vercel.app') ||
        event.origin.includes('webcontainer.io');

      if (!isTrustedOrigin) return;

      if (event.data && event.data.type === 'SPOTIFY_DATA') {
        const { profile, recentlyPlayed, tokens } = event.data;

        setSpotifyProfile(profile);
        setSpotifyRecentlyPlayed(recentlyPlayed || []);
        setIsSpotifyConnected(true);
        setSpotifyLastSynced(Date.now());

        localStorage.setItem('spotify_profile', JSON.stringify(profile));
        localStorage.setItem('spotify_recent', JSON.stringify(recentlyPlayed || []));
        localStorage.setItem('spotify_connected', 'true');
        if (tokens) persistSpotifyTokens(tokens);

        setIsSpotifyLoading(false);
      }
    };

    window.addEventListener('message', handleSpotifyMessage);
    return () => window.removeEventListener('message', handleSpotifyMessage);
  }, []);

  // Keep the account data fresh automatically: once on load, every 5 minutes
  // while connected, and again the instant the tab regains focus — same
  // real-time-feeling cadence as the Strava engine.
  useEffect(() => {
    if (!isSpotifyConnected || !spotifyTokens?.refresh_token) return;

    syncSpotifyData();

    const intervalId = setInterval(() => syncSpotifyData(), 5 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncSpotifyData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpotifyConnected]);

  const handleSpotifyDisconnect = () => {
    setSpotifyProfile(null);
    setSpotifyRecentlyPlayed([]);
    setIsSpotifyConnected(false);
    setSpotifyTokens(null);
    setSpotifyLastSynced(null);

    localStorage.removeItem('spotify_profile');
    localStorage.removeItem('spotify_recent');
    localStorage.removeItem('spotify_connected');
    localStorage.removeItem('spotify_tokens');
  };

  const handleSpotifyConnect = () => {
    setIsSpotifyLoading(true);

    // Replace with your own Spotify Developer Dashboard Client ID —
    // the same way the Strava client_id above is wired up.
    const clientId = '2f4cd23001604c63936002f1d7a52660';

    const isLive = window.location.hostname.includes('vercel.app');
    const targetOrigin = isLive
      ? 'https://ashutoshbehera.vercel.app'
      : window.location.origin;

    const redirectUri = encodeURIComponent(`${targetOrigin}/api/spotify-callback`);
    const scope = encodeURIComponent(
      'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read'
    );

    const spotifyAuthUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

    window.open(spotifyAuthUrl, 'Connect with Spotify', 'width=600,height=800');
  };

  const [introDone, setIntroDone] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
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

  const resetConfigSection = (key: 'trackerItems' | 'timeline' | 'training') => {
    setConfig((prev) => ({
      ...prev,
      [key]: key === 'timeline'
        ? hydrateTimeline(DEFAULT_TIMELINE_STORABLE)
        : key === 'training'
        ? DEFAULT_TRAINING
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
    return DIET.meals.every((m) => todayMeals[m.name]);
  }, [dietLog, currentDateStr]);

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

  // ---- Time-block browser notifications ----
  // The Master Timeline is a strict schedule but nothing previously enforced
  // it — this pings 5 minutes before each block starts, for as long as the
  // tab stays open. No service worker here, so it can't wake a fully closed
  // tab; this is a best-effort foreground reminder, not a background push.
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
      case 'grooming': return <GroomingTab setModal={setModal} />;
      case 'spotify':
        return (
          <SpotifyTab
            spotifyTokens={spotifyTokens}
            isSpotifyConnected={isSpotifyConnected}
            isSpotifyLoading={isSpotifyLoading}
            handleSpotifyConnect={handleSpotifyConnect}
            handleSpotifyDisconnect={handleSpotifyDisconnect}
            spotifyProfile={spotifyProfile}
            spotifyRecentlyPlayed={spotifyRecentlyPlayed}
            isSpotifySyncing={isSpotifySyncing}
            spotifyLastSynced={spotifyLastSynced}
            onManualSync={() => syncSpotifyData()}
            persistSpotifyTokens={persistSpotifyTokens}
          />
        );
      case 'strava': 
        return (
          <StravaTab 
            stravaActivities={stravaActivities} 
            isStravaLoading={isStravaLoading} 
            handleStravaConnect={handleStravaConnect} 
            isStravaConnected={isStravaConnected}
            handleStravaDisconnect={handleStravaDisconnect}
            isStravaSyncing={isStravaSyncing}
            stravaLastSynced={stravaLastSynced}
            onManualSync={() => syncStravaActivities()}
          />
        );
      case 'history': return <PerformanceCalendar globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} setModal={setModal} />;
      case 'settings': return <ConfigEditorTab />;
      default: return null;
    }
  };

  return (
    <ConfigContext.Provider
      value={{
        trackerItems: config.trackerItems,
        timeline: config.timeline,
        training: config.training,
        updateConfig,
        resetConfigSection,
      }}
    >
    <div className="min-h-screen w-full bg-zinc-950 text-neutral-200 font-sans antialiased">
      {!introDone && <IntroLoader onFinish={() => setIntroDone(true)} />}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">

        {/* Header Elements */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg shadow-sky-500/10">
              <GraduationCap className="h-5.5 w-5.5 text-neutral-950" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight text-neutral-50 leading-none">Ashutosh — Dynamic Command Center</h1>
              <p className="text-[12.5px] text-neutral-500 mt-1">JEE 2027 Drop-Year Core Operating System</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <StreakFlame streak={currentStreak} />
            <div
              className="hidden sm:flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-500"
              style={{ borderColor: `${hunterRank.color}40`, backgroundColor: `${hunterRank.color}0d` }}
            >
              <Swords className="h-3 w-3" style={{ color: hunterRank.color }} />
              <span className="text-[11.5px] font-medium" style={{ color: hunterRank.color }}>
                {hunterRank.label}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11.5px] font-medium text-neutral-400">Execution Quotient: <span className="text-emerald-400 tabular-nums">{overallPct}%</span></span>
            </div>
          </div>
        </header>

        {/* Navigation Layer */}
        <nav className="mb-6 flex gap-1.5 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40 p-1.5 no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cursor-target flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {tab.label}
              </button>
            );
          })}
        </nav>

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
          <p className="text-[11px] text-neutral-600">Target Configured: IIT Bombay Aerospace. Everything else remains basic scaffolding.</p>
        </footer>
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
    </div>
    </ConfigContext.Provider>
  );
}



interface StravaTabProps {
  stravaActivities: any[];
  isStravaLoading: boolean;
  handleStravaConnect: () => void;
  isStravaConnected: boolean;
  handleStravaDisconnect: () => void;
  isStravaSyncing: boolean;
  stravaLastSynced: number | null;
  onManualSync: () => void;
}

// ---------- Tab Subcomponent: Strava Feed ----------
function StravaTab({
  stravaActivities,
  isStravaLoading,
  handleStravaConnect,
  isStravaConnected,
  handleStravaDisconnect,
  isStravaSyncing,
  stravaLastSynced,
  onManualSync,
}: StravaTabProps) {
  const lastSyncedLabel = stravaLastSynced
    ? new Date(stravaLastSynced).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-orange-500 font-semibold text-sm uppercase tracking-wider">
              <span>🎛️ Telemetry Engine</span>
            </div>
            <h3 className="text-lg font-bold text-neutral-200 mt-1">Strava Integration Panel</h3>
            <p className="text-xs text-neutral-500">
              {isStravaConnected
                ? isStravaSyncing
                  ? 'Syncing latest activity data…'
                  : lastSyncedLabel
                    ? `Connected · last synced ${lastSyncedLabel}`
                    : 'Connected to Strava'
                : 'Secure real-time athletic activity telemetry synchronization'}
            </p>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {isStravaConnected && (
              <button
                onClick={onManualSync}
                disabled={isStravaSyncing}
                className="px-3 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold rounded-xl transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Sync now"
              >
                <Activity className={`w-3.5 h-3.5 ${isStravaSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={isStravaConnected ? handleStravaDisconnect : handleStravaConnect}
              className={
                isStravaConnected
                  ? "w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-red-950/40 border border-neutral-700 hover:border-red-800 text-neutral-300 hover:text-red-400 font-bold rounded-xl transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-2 group cursor-target active:scale-98"
                  : "w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-neutral-950 font-bold rounded-xl shadow-lg shadow-orange-500/10 transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-2 group cursor-target active:scale-98"
              }
            >
              <Activity className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              {isStravaConnected ? 'DISCONNECT STRAVA' : 'CONNECT STRAVA ACCOUNT'}
            </button>
          </div>
        </div>

        {stravaActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {stravaActivities.map((activity: any) => {
              const activityDate = new Date(activity.start_date_local).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric'
              });
              
              return (
                <div key={activity.id} className="flex items-center justify-between p-3.5 bg-neutral-950/40 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="text-xl bg-neutral-900 border border-neutral-800 p-2 rounded-lg">
                      {activity.type === 'Run' ? '🏃' : activity.type === 'Ride' ? '🚴' : activity.type === 'Swim' ? '🏊' : '💪'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-200 truncate max-w-[200px]">{activity.name}</p>
                      <span className="text-[11px] text-neutral-500 font-medium">{activityDate} · {activity.type}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-xs font-bold text-orange-400">
                      {(activity.distance / 1000).toFixed(2)} km
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {Math.floor(activity.moving_time / 60)} mins
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-950/20 rounded-xl border border-dashed border-neutral-800">
            <p className="text-xs text-neutral-400 font-medium mb-1">No Strava metrics imported yet.</p>
            <p className="text-[11px] text-neutral-500">Trigger standard authorization protocol above to download your logs.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Spotify Live Player ----------

interface SpotifyTabProps {
  spotifyTokens: { access_token: string; refresh_token: string; expires_at: number } | null;
  isSpotifyConnected: boolean;
  isSpotifyLoading: boolean;
  handleSpotifyConnect: () => void;
  handleSpotifyDisconnect: () => void;
  spotifyProfile: any;
  spotifyRecentlyPlayed: any[];
  isSpotifySyncing: boolean;
  spotifyLastSynced: number | null;
  onManualSync: () => void;
  persistSpotifyTokens: (tokens: { access_token: string; refresh_token: string; expires_at: number }) => void;
}

function formatMs(ms: number) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function SpotifyTab({
  spotifyTokens,
  isSpotifyConnected,
  isSpotifyLoading,
  handleSpotifyConnect,
  handleSpotifyDisconnect,
  spotifyProfile,
  spotifyRecentlyPlayed,
  isSpotifySyncing,
  spotifyLastSynced,
  onManualSync,
  persistSpotifyTokens,
}: SpotifyTabProps) {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<any>(null);
  const [localPosition, setLocalPosition] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const accessTokenRef = useRef<string | undefined>(spotifyTokens?.access_token);
  const positionTickRef = useRef<any>(null);
  const searchDebounceRef = useRef<any>(null);

  useEffect(() => {
    accessTokenRef.current = spotifyTokens?.access_token;
  }, [spotifyTokens?.access_token]);

  const lastSyncedLabel = spotifyLastSynced
    ? new Date(spotifyLastSynced).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  // ----- Load the Web Playback SDK once we have a live session -----
  useEffect(() => {
    if (!isSpotifyConnected || !spotifyTokens?.access_token) return;

    const initPlayer = () => {
      const w = window as any;
      if (!w.Spotify) return;

      setPlayerStatus('connecting');

      const spotifyPlayer = new w.Spotify.Player({
        name: 'Command Center Player',
        getOAuthToken: (cb: (token: string) => void) => cb(accessTokenRef.current || ''),
        volume: 0.5,
      });

      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setPlayerStatus('ready');
        setPlayerError(null);
        // Transfer playback to this browser tab so it becomes the active device.
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessTokenRef.current}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(() => {});
      });

      spotifyPlayer.addListener('not_ready', () => setPlayerStatus('idle'));

      spotifyPlayer.addListener('initialization_error', () => {
        setPlayerStatus('error');
        setPlayerError('This browser could not initialize the player.');
      });
      spotifyPlayer.addListener('authentication_error', () => {
        setPlayerStatus('error');
        setPlayerError('Session expired — reconnect your account.');
      });
      spotifyPlayer.addListener('account_error', () => {
        setPlayerStatus('error');
        setPlayerError('Spotify Premium is required for in-browser playback.');
      });

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        if (!state) return;
        setPlaybackState(state);
        setLocalPosition(state.position);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    const w = window as any;
    if (w.Spotify) {
      initPlayer();
    } else if (!document.getElementById('spotify-player-sdk')) {
      const script = document.createElement('script');
      script.id = 'spotify-player-sdk';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
      w.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      player?.disconnect?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpotifyConnected]);

  // ----- Local ticking progress bar between state_changed events -----
  useEffect(() => {
    if (positionTickRef.current) clearInterval(positionTickRef.current);
    if (playbackState && !playbackState.paused) {
      positionTickRef.current = setInterval(() => {
        setLocalPosition((p) => Math.min(p + 1000, playbackState.duration || p + 1000));
      }, 1000);
    }
    return () => clearInterval(positionTickRef.current);
  }, [playbackState?.paused, playbackState?.track_window?.current_track?.id]);

  // ----- Track search against Spotify's catalog (debounced) -----
  useEffect(() => {
    if (!searchQuery.trim() || !spotifyTokens?.access_token) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=8`,
          { headers: { Authorization: `Bearer ${accessTokenRef.current}` } }
        );
        const data = await res.json();
        setSearchResults(data?.tracks?.items || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, spotifyTokens?.access_token]);

  const playUri = async (uri: string) => {
    if (!deviceId || !accessTokenRef.current) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessTokenRef.current}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    }).catch(() => {});
  };

  const togglePlay = () => player?.togglePlay?.();
  const skipNext = () => player?.nextTrack?.();
  const skipPrev = () => player?.previousTrack?.();

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    player?.setVolume?.(v);
  };

  const currentTrack = playbackState?.track_window?.current_track;
  const isPlaying = playbackState && !playbackState.paused;
  const duration = playbackState?.duration || currentTrack?.duration_ms || 0;
  const progressPct = duration ? Math.min(100, (localPosition / duration) * 100) : 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header / Connect Panel */}
      <div className="border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/20">
              {isSpotifyConnected && isPlaying && (
                <span className="absolute inset-0 rounded-xl bg-emerald-400 animate-pulseGlow" />
              )}
              <Music2 className="h-5.5 w-5.5 text-neutral-950 relative" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-200 leading-tight">Spotify Live Player</h3>
              <p className="text-[12px] text-neutral-500 mt-0.5">
                {isSpotifyConnected
                  ? spotifyProfile?.display_name
                    ? `Connected as ${spotifyProfile.display_name}${lastSyncedLabel ? ` · synced ${lastSyncedLabel}` : ''}`
                    : isSpotifySyncing
                      ? 'Syncing account…'
                      : 'Connected to Spotify'
                  : 'Stream and control your music directly from this dashboard'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {isSpotifyConnected && (
              <button
                onClick={onManualSync}
                disabled={isSpotifySyncing}
                className="px-3 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold rounded-xl transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Sync now"
              >
                <Activity className={`w-3.5 h-3.5 ${isSpotifySyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={isSpotifyConnected ? handleSpotifyDisconnect : handleSpotifyConnect}
              disabled={isSpotifyLoading}
              className={
                isSpotifyConnected
                  ? "w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-red-950/40 border border-neutral-700 hover:border-red-800 text-neutral-300 hover:text-red-400 font-bold rounded-xl transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-2 group cursor-target active:scale-98"
                  : "w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-neutral-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition-all duration-200 text-xs tracking-wider flex items-center justify-center gap-2 group cursor-target active:scale-98 disabled:opacity-60"
              }
            >
              <Music2 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              {isSpotifyLoading ? 'CONNECTING…' : isSpotifyConnected ? 'DISCONNECT SPOTIFY' : 'CONNECT SPOTIFY ACCOUNT'}
            </button>
          </div>
        </div>

        {!isSpotifyConnected && (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-950/20 rounded-xl border border-dashed border-neutral-800">
            <Disc3 className="w-8 h-8 text-neutral-700 mb-2" />
            <p className="text-xs text-neutral-400 font-medium mb-1">No Spotify account linked yet.</p>
            <p className="text-[11px] text-neutral-500 max-w-sm">
              Link your account once — the session stays connected across refreshes automatically, no repeated logins. Requires Spotify Premium for direct in-browser playback.
            </p>
          </div>
        )}

        {isSpotifyConnected && playerStatus === 'error' && (
          <div className="flex items-center gap-2 py-3 px-4 bg-red-950/20 border border-red-900/40 rounded-xl text-[11.5px] text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {playerError}
          </div>
        )}
      </div>

      {isSpotifyConnected && (
        <>
          {/* Now Playing / Player Card */}
          <div className="relative overflow-hidden border border-emerald-900/30 bg-gradient-to-br from-emerald-950/20 via-neutral-900 to-neutral-950 rounded-2xl p-6 shadow-xl">
            {isPlaying && (
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl animate-pulseGlow" />
            )}

            <div className="relative flex flex-col sm:flex-row items-center gap-5">
              {/* Album Art */}
              <div className="relative shrink-0">
                <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-neutral-800 shadow-lg ${isPlaying ? 'animate-discSpin' : ''}`}>
                  {currentTrack?.album?.images?.[0]?.url ? (
                    <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                      <Disc3 className="w-8 h-8 text-neutral-600" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/40 pointer-events-none" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-950 border-2 border-neutral-800" />
              </div>

              {/* Track Info + Progress */}
              <div className="flex-1 w-full min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <p className="text-sm font-bold text-neutral-100 truncate max-w-[260px]">
                    {currentTrack?.name || (playerStatus === 'ready' ? 'Nothing playing yet' : 'Waking up the player…')}
                  </p>
                  {isPlaying && (
                    <span className="flex items-end gap-[2px] h-3">
                      <span className="w-[3px] bg-emerald-400 rounded-full animate-eqBar1 h-full" />
                      <span className="w-[3px] bg-emerald-400 rounded-full animate-eqBar2 h-full" />
                      <span className="w-[3px] bg-emerald-400 rounded-full animate-eqBar3 h-full" />
                      <span className="w-[3px] bg-emerald-400 rounded-full animate-eqBar4 h-full" />
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-neutral-500 mb-3 truncate">
                  {currentTrack?.artists?.map((a: any) => a.name).join(', ') || 'Search a track below to start streaming'}
                </p>

                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10.5px] text-neutral-600 font-mono tabular-nums">
                  <span>{formatMs(localPosition)}</span>
                  <span>{formatMs(duration)}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="relative flex items-center justify-center gap-4 mt-6">
              <button
                onClick={skipPrev}
                disabled={playerStatus !== 'ready'}
                className="cursor-target p-2.5 text-neutral-400 hover:text-neutral-100 transition-colors disabled:opacity-30 active:scale-90"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                disabled={playerStatus !== 'ready'}
                className="cursor-target w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-neutral-950 shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
              >
                {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
              </button>
              <button
                onClick={skipNext}
                disabled={playerStatus !== 'ready'}
                className="cursor-target p-2.5 text-neutral-400 hover:text-neutral-100 transition-colors disabled:opacity-30 active:scale-90"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </button>

              <div className="hidden sm:flex items-center gap-2 ml-4">
                {volume === 0 ? <VolumeX className="w-4 h-4 text-neutral-500" /> : volume < 0.5 ? <Volume1 className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-neutral-500" />}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-400"
                />
              </div>
            </div>

            {playerStatus === 'connecting' && (
              <p className="relative text-center text-[10.5px] text-neutral-600 mt-4">Initializing browser playback device…</p>
            )}
          </div>

          {/* Search */}
          <div className="border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950/40 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search any song, artist, or album…"
                className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
              />
              {isSearching && <span className="text-[10.5px] text-neutral-600">searching…</span>}
            </div>

            {searchOpen && searchQuery.trim() && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {searchResults.length === 0 && !isSearching && (
                  <p className="text-[11.5px] text-neutral-600 py-4 text-center">No matches found.</p>
                )}
                {searchResults.map((track: any) => (
                  <button
                    key={track.id}
                    onClick={() => playUri(track.uri)}
                    disabled={playerStatus !== 'ready'}
                    className="cursor-target w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-800/60 transition-all text-left disabled:opacity-40 animate-slideInFade group"
                  >
                    <img
                      src={track.album?.images?.[track.album.images.length - 1]?.url}
                      alt={track.name}
                      className="w-10 h-10 rounded-md object-cover shrink-0 bg-neutral-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-neutral-200 truncate">{track.name}</p>
                      <p className="text-[11px] text-neutral-500 truncate">{track.artists?.map((a: any) => a.name).join(', ')}</p>
                    </div>
                    <Play className="w-4 h-4 text-neutral-600 group-hover:text-emerald-400 transition-colors shrink-0" fill="currentColor" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recently Played */}
          <div className="border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950/40 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <ListMusic className="w-4 h-4 text-neutral-500" />
              <h4 className="text-sm font-bold text-neutral-300">Recently Played</h4>
            </div>

            {spotifyRecentlyPlayed.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                {spotifyRecentlyPlayed.map((item: any, idx: number) => {
                  const track = item.track || item;
                  return (
                    <button
                      key={`${track.id}-${idx}`}
                      onClick={() => playUri(track.uri)}
                      disabled={playerStatus !== 'ready'}
                      className="cursor-target flex items-center gap-3 p-3 bg-neutral-950/40 border border-neutral-800 rounded-xl hover:border-emerald-800/50 hover:bg-emerald-950/10 transition-all text-left disabled:opacity-50 group"
                    >
                      <img
                        src={track.album?.images?.[track.album.images.length - 1]?.url}
                        alt={track.name}
                        className="w-10 h-10 rounded-md object-cover shrink-0 bg-neutral-800"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-neutral-200 truncate">{track.name}</p>
                        <span className="text-[11px] text-neutral-500 truncate block">{track.artists?.map((a: any) => a.name).join(', ')}</span>
                      </div>
                      <Play className="w-3.5 h-3.5 text-neutral-700 group-hover:text-emerald-400 transition-colors shrink-0" fill="currentColor" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-neutral-950/20 rounded-xl border border-dashed border-neutral-800">
                <p className="text-xs text-neutral-400 font-medium mb-1">No listening history synced yet.</p>
                <p className="text-[11px] text-neutral-500">Play a track above or on any device — it'll show up here on the next sync.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


// ---------- Tab Subcomponent: Ash's Clock (Fade-Digit Clock + Pomodoro) ----------

const DEFAULT_FOCUS_MIN = 50;
const DEFAULT_BREAK_MIN = 10;

// Small ripple-enabled button, reusing the same click-ripple language as the
// bento grid Cards elsewhere in the app (see useRipple above).
function RippleButton({
  children, onClick, className = '', disabled = false, title,
}: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; title?: string }) {
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
  const [focusMinutes, setFocusMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_focus_min');
    return saved ? parseInt(saved, 10) : DEFAULT_FOCUS_MIN;
  });
  const [breakMinutes, setBreakMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_break_min');
    return saved ? parseInt(saved, 10) : DEFAULT_BREAK_MIN;
  });

  const [subject, setSubject] = useState<string>(() => localStorage.getItem('ash_clock_last_subject') || 'math');
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
      if (secondsLeft === 0) {
        setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
      }
      setSystemMessage(
        sessionType === 'focus'
          ? '[Quest Alert] A Focus Gate has opened. Clear it before the timer expires.'
          : '[Rest Zone] Recovering mana. The next Gate awaits.'
      );
    }
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
    setSystemMessage("[Timer reset.] Awaiting the Hunter's command.");
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
        {POMODORO_SUBJECTS.map((s) => (
          <RippleButton
            key={s.key}
            onClick={() => !isRunning && setSubject(s.key)}
            disabled={isRunning}
            className={`cursor-target rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              subject === s.key
                ? `${SUBJECT_STYLE[s.key].bg} ${SUBJECT_STYLE[s.key].text} ${SUBJECT_STYLE[s.key].border}`
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
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            sessionType === 'focus'
              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500'
              : 'bg-gradient-to-r from-fuchsia-400 to-pink-400'
          }`}
          style={{ width: `${progressPct}%` }}
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
          className="cursor-target rounded-full w-14 h-14 flex items-center justify-center bg-gradient-to-br from-purple-500 to-fuchsia-600 text-neutral-950 shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-transform"
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

function PomodoroSubjectStats({ log }) {
  const todayStr = getLocalDateString();

  const totals = useMemo(() => {
    const all: Record<string, number> = { math: 0, physics: 0, chem: 0, mixed: 0 };
    const today: Record<string, number> = { math: 0, physics: 0, chem: 0, mixed: 0 };
    log.forEach((entry: any) => {
      all[entry.subject] = (all[entry.subject] || 0) + entry.minutes;
      if (entry.date === todayStr) today[entry.subject] = (today[entry.subject] || 0) + entry.minutes;
    });
    return { all, today };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const grandTotal: number = Object.values(totals.all).reduce((a: number, b: number) => a + b, 0);
  const maxSubjectMinutes = Math.max(1, ...Object.values(totals.all));

  const formatHrs = (mins: number) => {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Card>
      <SectionHeading
        icon={BarChart3}
        title="Subject Hours"
        subtitle={grandTotal > 0 ? `${formatHrs(grandTotal)} logged across all Focus Gates — checking Chemistry isn't quietly falling behind` : 'Complete a tagged Focus Gate to start building this up'}
      />
      {grandTotal === 0 ? (
        <p className="text-[13px] text-neutral-500 mt-4">
          No Pomodoro sessions logged yet. Tag a subject above and clear a Focus Gate — hours per subject will build up here automatically.
        </p>
      ) : (
        <div className="space-y-3 mt-4">
          {POMODORO_SUBJECTS.map((s) => {
            const allMin = totals.all[s.key] || 0;
            const todayMin = totals.today[s.key] || 0;
            const pct = (allMin / maxSubjectMinutes) * 100;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-semibold ${SUBJECT_STYLE[s.key].text}`}>{s.label}</span>
                  <span className="text-[11.5px] text-neutral-400 tabular-nums">
                    {formatHrs(allMin)} total{todayMin > 0 ? ` · ${formatHrs(todayMin)} today` : ''}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden">
                  <div className={`h-full rounded-full ${SUBJECT_STYLE[s.key].dot}`} style={{ width: `${pct}%` }} />
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
  const [mode, setMode] = useState<'clock' | 'pomodoro'>('clock');

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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-700 shadow-lg shadow-purple-500/20">
              <Timer className="h-5.5 w-5.5 text-neutral-50" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100 leading-tight">Ash's Clock</h3>
              <p className="text-[12px] text-purple-300/60 mt-0.5 italic">"Even the Shadow Monarch answers to time."</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-purple-800/40 bg-purple-950/30 p-1">
            <RippleButton
              onClick={() => setMode('clock')}
              className={`cursor-target rounded-full px-4 py-1.5 text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'clock' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              CLOCK
            </RippleButton>
            <RippleButton
              onClick={() => setMode('pomodoro')}
              className={`cursor-target rounded-full px-4 py-1.5 text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'pomodoro' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              POMODORO
            </RippleButton>
          </div>
        </div>

        <div className="relative">
          {mode === 'clock' ? <LiveClockView /> : <PomodoroView onSessionComplete={handleSessionComplete} />}
        </div>
      </div>

      {mode === 'pomodoro' && <PomodoroSubjectStats log={pomodoroLog} />}
    </div>
  );
}