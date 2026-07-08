import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutGrid, Clock3, Dumbbell, BookOpen, Sparkles,
  CheckCircle2, Circle, Target, GraduationCap, Ruler, Weight,
  Droplets, Sunrise, Sun, Moon, Utensils, Flame,
  AlertTriangle, ChevronRight, Eye, Smile, Scissors, Wind,
  TrendingUp, Activity, Timer, Calendar, X, ArrowUpRight, FlameKindling,
  ChevronLeft, Lock
} from 'lucide-react';

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

const TIMELINE = [
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

const TRAINING = [
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

const GROOMING = [
  { icon: Eye, title: 'Dark Circles', issue: 'Deep, prominent shadows from history of late-night scrolling', plan: '11 PM sleep lock + Caffeine 5% + EGCG topical serum, applied at night', tag: 'skincare', details: ['Cleanse target areas under lower orbital bone gently.', 'Apply 2 concentrated drops of serum onto pad of ring finger.', 'Pat softly inside an outside-in arc vector map without skin pulling.'] },
  { icon: Wind, title: 'Tonsillitis', issue: 'Chronic Grade 2 hypertrophy, currently asymptomatic', plan: 'Watchful waiting + 0.5% Betadine gargles twice a week', tag: 'watch', details: ['Mix 5-10ml Betadine with equal parts lukewarm water.', 'Gargle continuously for 45 seconds targeting rear pharyngeal areas.', 'Avoid consuming liquids for 20 minutes post application.'] },
  { icon: Smile, title: 'Yellow Teeth', issue: 'Plaque / surface staining', plan: 'Hydrogen peroxide whitening strips + schedule dental scaling appointment', tag: 'dental', details: ['Apply active layer strip across perfectly dried dental framework.', 'Leave for 30 minutes flat; eliminate saliva accumulation blocks.', 'Rinse thoroughly; enforce strict ban on tannin liquids (coffee/tea).'] },
  { icon: Ruler, title: 'Facial Asymmetry & Jawline', issue: 'Lack of jaw definition', plan: 'Nasal breathing, mewing posture, supine back-sleeping, chewing hard foods evenly', tag: 'posture', details: ['Seal lips completely, transition standard respiration strictly nasal.', 'Rest full posterior third of tongue hard against internal upper palate.', 'Train symmetrical masseter activation when chewing whole nutrient sources.'] },
  { icon: Scissors, title: 'Body Hair', issue: 'High density, unwanted', plan: 'Electric trimmer touch-ups every Sunday', tag: 'routine', details: ['Schedule macro trim window post Sunday noon workout.', 'Clean apparatus elements; run baseline guard settings to protect skin mechanics.'] },
  { icon: Eye, title: 'Eyesight', issue: '-3 prescription both eyes, 6/6 corrected vision', plan: 'Blue-light / anti-glare glasses for heavy screen study', tag: 'vision', details: ['Enforce 20-20-20 rule during 3-hour continuous lecture stacks.', 'Sterilize protective lens glass structures daily before morning math slot.'] },
];

const TRACKER_ITEMS = [
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

const TABS = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutGrid },
  { id: 'timeline', label: 'Master Timeline', icon: Clock3 },
  { id: 'training', label: 'Training & Fuel', icon: Dumbbell },
  { id: 'syllabus', label: 'JEE Syllabus Roadmap', icon: BookOpen },
  { id: 'grooming', label: 'Clinical Grooming', icon: Sparkles },
  { id: 'strava', label: 'Strava Sync', icon: Activity },
  { id: 'history', label: 'Performance Calendar', icon: Calendar },
];

const SUBJECT_STYLE = {
  math: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', dot: 'bg-sky-400' },
  physics: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  chem: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  mixed: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
};

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

function TrackerItemButton({ item, isChecked, onToggle }) {
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
      </div>
      <span className={`text-[11.5px] font-medium leading-snug transition-colors ${isChecked ? 'text-emerald-200/90' : 'text-neutral-300 group-hover:text-neutral-200'}`}>
        {item.label}
      </span>
      {rippleNodes}
    </button>
  );
}

function DailyTracker({ currentDayStr, checked, onToggle }) {
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

  const total = TRACKER_ITEMS.length;
  const done = TRACKER_ITEMS.filter((i) => checked[i.id]).length;
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
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[20px] font-semibold text-neutral-100 tabular-nums">{pct}%</span>
          <span className="text-[11px] text-neutral-500">
            {pct === 100 ? 'Day complete' : pct >= 60 ? 'On pace' : pct === 0 ? 'Not started' : 'In progress'}
          </span>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-2 gap-2.5">
        {TRACKER_ITEMS.map((item) => (
          <TrackerItemButton
            key={item.id}
            item={item}
            isChecked={!!checked[item.id]}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Performance Calendar Matrix ----------

function PerformanceCalendar({ globalHistory, setModal }) {
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
    const arrayItems = TRACKER_ITEMS.map(item => {
      return `${itemsCompleted[item.id] ? '✅' : '❌'} ${item.label}`;
    });
    const completedCount = Object.values(itemsCompleted).filter(Boolean).length;
    const percentage = Math.round((completedCount / TRACKER_ITEMS.length) * 100);

    setModal({
      title: `Execution Analysis: ${dateStr}`,
      subtitle: `${getDayName(dateStr)} · Efficiency Index: ${percentage}%`,
      icon: Calendar,
      arrayTitle: `Logged Metric Parameters (${completedCount}/${TRACKER_ITEMS.length})`,
      arrayItems: arrayItems,
      cues: percentage === 100 ? 'Absolute perfect operation architecture verified.' : 'Identify points of focus slippage to correct trends.'
    });
  };

  const getHeatmapColor = (dateStr) => {
    if (!dateStr || !globalHistory[dateStr]) return 'bg-neutral-900 border-neutral-800 text-neutral-600';
    const checks = globalHistory[dateStr];
    const score = Object.values(checks).filter(Boolean).length;
    const pct = score / TRACKER_ITEMS.length;

    if (score === 0) return 'bg-neutral-900 border-neutral-800 text-neutral-500';
    if (pct <= 0.3) return 'bg-rose-950/60 border-rose-800/40 text-rose-300 hover:bg-rose-900/50';
    if (pct <= 0.6) return 'bg-amber-950/60 border-amber-800/40 text-amber-300 hover:bg-amber-900/50';
    if (pct < 1) return 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40';
    return 'bg-gradient-to-br from-emerald-500 to-teal-500 text-neutral-950 border-emerald-400 font-bold';
  };

  return (
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
                    <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dateStr === getLocalDateString() || Object.values(globalHistory[dateStr]).filter(Boolean).length === TRACKER_ITEMS.length ? 'bg-neutral-950' : 'bg-current'}`} />
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
  );
}

// ---------- Tab Subcomponent: Overview ----------

function OverviewTab({ setModal }) {
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
            <StatPill icon={Weight} label="Weight" value="76 kg" />
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

function TimelineTab({ setModal }) {
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
      <SectionHeading icon={Clock3} title="Master Timeline" subtitle="Interactive structural day architecture — Click any block for tactical execution logs" />
      <div className="space-y-2.5">
        {TIMELINE.map((slot, i) => {
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

function TrainingFuelTab({ setModal }) {
  const [activeDay, setActiveDay] = useState(TRAINING[0].day);
  const dayData = TRAINING.find((d) => d.day === activeDay);

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
          {TRAINING.map((d) => (
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
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${modeStyle[dayData.mode]}`}>
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

      <div>
        <SectionHeading icon={Flame} title="V-Taper Fuel Matrix" subtitle={`${DIET.target} · ${DIET.protein}`} />
        <div className="mb-4 flex flex-wrap gap-2.5">
          <StatPill icon={Flame} label="Calorie Target" value="~2200–2300 kcal" accent="amber" />
          <StatPill icon={Activity} label="Protein Target" value="165g–175g+" accent="emerald" />
          <StatPill icon={Droplets} label="Hydration" value={DIET.hydration} accent="blue" />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {DIET.meals.map((m) => (
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
                <ArrowUpRight className="h-3 w-3 text-neutral-600" />
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
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Syllabus ----------

function SyllabusTab({ setModal }) {
  const [activePhase, setActivePhase] = useState(1);
  const phase = SYLLABUS.find((p) => p.phase === activePhase);

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
              {phase.subjects[s.key].map((topic) => (
                <li 
                  key={topic} 
                  onClick={() => handleTopicClick(topic)}
                  className="flex items-center justify-between gap-2 text-[12.5px] text-neutral-300 leading-snug p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/40 cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-600 group-hover:text-sky-400" strokeWidth={2} />
                    <span className="group-hover:text-neutral-100">{topic}</span>
                  </div>
                  <ArrowUpRight className="h-3 w-3 text-neutral-600 opacity-0 group-hover:opacity-100 transition-all" />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
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

// ---------- Main Root Dashboard Component ----------

export default function JEEDashboard() {
  const [unlocked, setUnlocked] = useState(false);
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
  const [introDone, setIntroDone] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [modal, setModal] = useState(null);

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
  const totalCount = TRACKER_ITEMS.length;
  const overallPct = Math.round((doneCount / totalCount) * 100);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab setModal={setModal} />;
      case 'timeline': return <TimelineTab setModal={setModal} />;
      case 'training': return <TrainingFuelTab setModal={setModal} />;
      case 'syllabus': return <SyllabusTab setModal={setModal} />;
      case 'grooming': return <GroomingTab setModal={setModal} />;
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
      case 'history': return <PerformanceCalendar globalHistory={globalHistory} setModal={setModal} />;
      default: return null;
    }
  };

  return (
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

        {/* Dashboard Grid Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <main>{renderTab()}</main>
          <aside>
            <DailyTracker currentDayStr={currentDateStr} checked={checked} onToggle={toggleCheck} />
          </aside>
        </div>

        <footer className="mt-8 pb-2 text-center">
          <p className="text-[11px] text-neutral-600">Target Configured: IIT Bombay Aerospace. Everything else remains basic scaffolding.</p>
        </footer>
      </div>

      {/* Global Context-Aware Modal Overlay */}
      <GlobalDetailModal modalData={modal} onClose={() => setModal(null)} />

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
        @media (pointer: fine) {
          * { cursor: none !important; }
        }
      `}</style>
    </div>
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