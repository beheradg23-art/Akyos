// Large static reference data: fallback topic explanations (Syllabus tab)
// and exercise guides (Training & Fuel tab). These back-stop the AI-generated
// content from lib/contentGen — if generation fails or hasn't run yet, the
// tab looks up the topic/exercise name here instead of showing nothing.




// ---------- Deep Interactive Knowledge Matrix ----------

export const TOPIC_DETAILS = {
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

export const EXERCISE_GUIDE = {
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
