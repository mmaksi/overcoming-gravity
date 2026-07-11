import { Attribute, Category, Measurement, RepStyle } from "@/lib/domain/types";
import {
  CustomWorkout,
  DefaultTemplate,
  Exercise,
  ExerciseNote,
  Profile,
  Program,
  ProgramRun,
  WorkoutSession,
} from "@/lib/domain/schemas";

/** Shape of the whole dev database (data/db.json). */
export type DbData = {
  exercises: Exercise[];
  defaultTemplate: DefaultTemplate;
  profiles: Profile[];
  programs: Program[];
  runs: ProgramRun[];
  sessions: WorkoutSession[];
  exerciseNotes: ExerciseNote[];
  customWorkouts: CustomWorkout[];
};

function ex(
  id: string,
  title: string,
  category: Category,
  attribute: Attribute,
  progressions: [name: string, description: string][],
  opts: { measurement?: Measurement; repStyle?: RepStyle } = {},
): Exercise {
  return {
    id,
    title,
    category,
    attribute,
    measurement: opts.measurement ?? "reps",
    repStyle: opts.repStyle ?? "standard",
    progressions: progressions.map(([name, description], order) => ({
      id: `${id}-p${order}`,
      name,
      order,
      description,
    })),
  };
}

const exercises: Exercise[] = [
  // Warm-up -----------------------------------------------------------------
  ex("wrist-prep", "Wrist Circles & Prep", "both", "warmup", [
    ["Basic circles", "Slow circles both directions, then palm lifts on the floor."],
    ["Loaded rocks", "Rock weight over the hands in quadruped to load the wrists gently."],
    ["Fingertip work", "Fingertip push-up holds to build resilient wrists and fingers."],
  ]),
  ex("band-dislocates", "Band Shoulder Dislocates", "both", "warmup", [
    ["Wide grip", "Hands far apart; easy pass-overs to open the shoulders."],
    ["Medium grip", "Narrow the grip as mobility improves; keep arms straight."],
    ["Narrow grip", "Close grip pass-overs — significant shoulder mobility."],
  ]),
  ex("scap-pulls", "Scapula Pulls", "pull", "warmup", [
    ["Two-arm", "From a dead hang, depress and retract the shoulder blades without bending the elbows."],
    ["Slow tempo", "3–5s up and down per rep for control under load."],
    ["One-arm assisted", "Shift weight to one arm; the other hand assists lightly."],
  ]),
  ex("scap-pushups", "Scapula Push-ups", "push", "warmup", [
    ["On knees", "Protract and retract the shoulder blades in a kneeling plank."],
    ["Full plank", "Same movement in a full plank; elbows stay locked."],
    ["Ring plank", "On rings — instability makes the serratus work overtime."],
  ]),
  ex("jumping-jacks", "Jumping Jacks", "both", "warmup", [
    ["Standard", "Two minutes easy pace to raise the pulse."],
    ["Fast pace", "Short fast bursts to finish the general warm-up."],
  ]),

  // Skill -------------------------------------------------------------------
  ex("front-lever", "Front Lever", "pull", "skill", [
    ["Tuck", "Knees pulled to the chest, hips at bar height, arms straight. Build to 20s."],
    ["Advanced tuck", "Open the hip angle to ~90°; keep the back flat."],
    ["Single leg", "One leg extended fully, the other tucked; swap sides evenly."],
    ["Straddle", "Both legs extended wide; squeeze toward full over time."],
    ["Full", "Body fully horizontal under the bar with straight arms."],
  ], { measurement: "time" }),
  ex("back-lever", "Back Lever", "both", "skill", [
    ["German hang", "Skin-the-cat to a relaxed hang behind the body; builds shoulder extension."],
    ["Tuck", "Knees tucked, facing the floor; find the balance point."],
    ["Advanced tuck", "Hips open to ~90°, back flat, arms locked."],
    ["Straddle", "Legs wide and extended; brace hard through the glutes."],
    ["Full", "Fully horizontal facing down, arms straight behind you."],
  ], { measurement: "time" }),
  ex("handstand", "Handstand", "push", "skill", [
    ["Wall plank", "Feet on a box or low wall walk-ups; stack shoulders over hands."],
    ["Chest-to-wall hold", "Nose to the wall, hollow body, push tall through the shoulders."],
    ["Back-to-wall hold", "Kick up with heels resting on the wall; practice taking heels off."],
    ["Freestanding", "Balance without support; fingertip corrections, 30s+ goal."],
  ], { measurement: "time" }),
  ex("l-sit", "L-sit", "both", "skill", [
    ["Foot-supported", "Hands on floor or parallettes, heels lightly supported."],
    ["Tuck", "Knees to chest, feet off the floor, shoulders depressed."],
    ["One leg", "Extend one leg at a time; keep both hips level."],
    ["Full L-sit", "Both legs horizontal, knees locked, toes pointed."],
  ], { measurement: "time" }),
  ex("planche", "Planche", "push", "skill", [
    ["Planche lean", "Plank with shoulders pushed far past the wrists; straight arms."],
    ["Tuck", "Knees tucked tight, feet off the floor, full protraction."],
    ["Advanced tuck", "Flatten the back and open the hips to ~90°."],
    ["Straddle", "Legs wide and extended behind you; elite strength required."],
  ], { measurement: "time" }),

  // Strength ----------------------------------------------------------------
  ex("pull-up", "Pull-up", "pull", "strength", [
    ["Band-assisted", "A band under the feet reduces bodyweight; full range every rep."],
    ["Negatives", "Jump to the top, lower under control in 3–5s."],
    ["Full pull-up", "Dead hang to chin over the bar, no kipping."],
    ["Chest-to-bar", "Pull higher until the chest touches; builds lever strength."],
    ["Weighted", "Add load with a belt or vest; progress in small jumps."],
  ]),
  ex("dip", "Dip", "push", "strength", [
    ["Support hold", "Lock out on bars or rings and simply hold; 30s target."],
    ["Negatives", "Lower from support to full depth in 3–5s."],
    ["Full dip", "Full range: shoulder below elbow at the bottom, lockout at top."],
    ["Ring dip", "The instability of rings roughly doubles the difficulty."],
    ["Weighted", "Add external load once 10+ clean ring dips are easy."],
  ]),
  ex("push-up", "Push-up", "push", "strength", [
    ["Incline", "Hands elevated on a box or bar; easier angle."],
    ["Full push-up", "Chest to the floor, body in one line."],
    ["Diamond", "Hands together under the chest; triceps-heavy."],
    ["Pseudo planche", "Hands turned back beside the hips, shoulders leaned far forward."],
  ]),
  ex("row", "Bodyweight Row", "pull", "strength", [
    ["Incline row", "Body at a steep angle under a high bar or rings."],
    ["Horizontal row", "Body horizontal under a low bar; chest to the bar."],
    ["Archer row", "One arm does most of the work, the other stays straight."],
    ["One-arm row", "Full single-arm row on a ring; anti-rotation core work."],
  ]),
  ex("pike-press", "Pike Push-up / HSPU", "push", "strength", [
    ["Pike push-up", "Hips high, head toward the floor between the hands."],
    ["Elevated pike push-up", "Feet on a box to shift more weight onto the shoulders."],
    ["Wall HSPU", "Handstand push-up with heels on the wall; full range with blocks."],
    ["Freestanding HSPU", "Handstand push-up in balance — the end boss of pressing."],
  ]),
  ex("muscle-up", "Muscle-up", "both", "strength", [
    ["High pull-up", "Pull explosively to the sternum or lower chest."],
    ["Explosive chest-to-bar", "Add speed; think about pulling the bar to the hips."],
    ["Band-assisted MU", "A band helps through the transition over the bar."],
    ["Strict MU", "No kip: pull, transition, and press in one controlled motion."],
  ]),
  ex("squat", "Squat", "legs", "strength", [
    ["Air squat", "Full-depth bodyweight squat, heels down."],
    ["Split squat", "Rear foot elevated; single-leg emphasis."],
    ["Shrimp squat", "Rear foot held in hand behind you; knee taps the floor."],
    ["Pistol squat", "Full single-leg squat, free leg extended forward."],
  ]),
  ex("nordic-curl", "Nordic Curl", "legs", "strength", [
    ["Band-assisted", "A band from above takes some load through the hardest range."],
    ["Negatives", "Lower as slowly as possible; push back up with hands."],
    ["Full nordic", "Full curl up from the floor using hamstrings only."],
  ], { repStyle: "cluster" }),
  ex("hip-thrust", "Glute Bridge / Hip Thrust", "legs", "strength", [
    ["Glute bridge", "Shoulders on the floor, drive the hips up and squeeze."],
    ["Single-leg bridge", "One leg extended; hips stay square."],
    ["Hip thrust", "Shoulders elevated on a bench for a longer range."],
    ["Weighted hip thrust", "Load across the hips; the strongest glute builder."],
  ]),
  ex("leg-raise", "Hanging Leg Raise", "both", "strength", [
    ["Knee raise", "Hanging, pull the knees to the chest without swinging."],
    ["L raise", "Straight legs to horizontal; compress hard."],
    ["Toes-to-bar", "Straight legs all the way to the bar, controlled down."],
  ]),

  // Conditioning work lives in the warm-up section (cardio is not an
  // attribute).
  ex("burpees", "Burpees", "both", "warmup", [
    ["Step-back", "Step (don't jump) in and out of the plank; low impact."],
    ["Standard", "Jump back, push-up, jump forward, jump up."],
    ["Chest-to-floor", "Full chest contact each rep; highest intensity."],
  ]),
  ex("jump-rope", "Jump Rope", "legs", "warmup", [
    ["Single unders", "Steady rhythm, soft knees, tall posture."],
    ["High pace", "Intervals: 40s fast / 20s easy."],
    ["Double unders", "Two rope passes per jump; wrists do the work."],
  ], { measurement: "time" }),

  // Prehabilitation -----------------------------------------------------
  ex("cuban-rotation", "Cuban Rotation", "pull", "prehabilitation", [
    ["Band", "Row, rotate up, press — all against light band tension."],
    ["Light dumbbell", "Same pattern with light dumbbells; strict and slow."],
  ]),
  ex("band-pullapart", "Band Pull-apart", "pull", "prehabilitation", [
    ["Standard", "Arms straight, pull the band to the chest, pinch the blades."],
    ["Overhead", "Pull the band apart overhead; keep the ribs down."],
  ]),
  ex("wrist-curls", "Wrist Curls", "both", "prehabilitation", [
    ["Bodyweight", "Kneeling wrist rocks and lifts in all directions."],
    ["Light load", "Wrist curls and extensions with a light dumbbell."],
    ["Rice bucket", "Grip, rotate and dig in a rice bucket for forearm health."],
  ]),
  ex("ext-rotation", "External Rotation", "both", "prehabilitation", [
    ["Band at side", "Elbow pinned to the ribs; rotate the forearm outward."],
    ["Band at 90°", "Upper arm horizontal; rotate up against the band."],
  ]),

  // Isolation -----------------------------------------------------------
  ex("ring-curl", "Ring Bicep Curl", "pull", "isolation", [
    ["High incline", "Body at a steep angle; curl the rings to the forehead."],
    ["Horizontal", "Body closer to horizontal for more load."],
    ["Feet elevated", "Feet up — maximum bodyweight through the biceps."],
  ]),
  ex("ring-extension", "Ring Tricep Extension", "push", "isolation", [
    ["High incline", "Bodyweight skull-crusher at an easy angle."],
    ["Horizontal", "Lower the ring height to increase the lever."],
    ["Feet elevated", "Hardest angle; keep the elbows tracking straight."],
  ]),
  ex("face-pull", "Face Pull", "pull", "isolation", [
    ["Band", "Pull the band to the face, elbows high, external rotation at the end."],
    ["Rings", "Bodyweight face pull leaning back under rings."],
  ]),

  // Flexibility -----------------------------------------------------------
  ex("pancake", "Pancake Stretch", "legs", "flexibility", [
    ["Supported", "Sit on a cushion, legs wide, fold with a flat back."],
    ["Full fold", "Chest toward the floor between wide legs."],
    ["Weighted", "Light plate held at the chest to deepen the fold."],
  ], { measurement: "time" }),
  ex("shoulder-ext", "Shoulder Extension Stretch", "both", "flexibility", [
    ["Floor", "Hands behind you on the floor, fingers back; slide the hips forward."],
    ["Elevated", "Hands on a bench behind you; sink the shoulders."],
    ["German hang", "Full hang behind the body on rings or bar; breathe."],
  ], { measurement: "time" }),
  ex("thoracic-bridge", "Thoracic Bridge", "both", "flexibility", [
    ["Table bridge", "Hips up, chest open, gaze back — gentle opener."],
    ["Full bridge", "Push to a full bridge; straighten the arms."],
    ["Elevated bridge", "Feet elevated to bias the upper back and shoulders."],
  ], { measurement: "time" }),

  // Cool-down -----------------------------------------------------------
  ex("hang-decompress", "Hanging Decompression", "both", "cooldown", [
    ["Feet supported", "Passive hang with feet lightly on the floor."],
    ["Full hang", "Relaxed dead hang; let the spine and shoulders lengthen."],
  ], { measurement: "time" }),
  ex("breathing", "Down-regulation Breathing", "both", "cooldown", [
    ["4-4-8 pattern", "Inhale 4s, hold 4s, exhale 8s — five rounds lying down."],
    ["Box breathing", "4s each: in, hold, out, hold."],
  ], { measurement: "time" }),
];

/** Template seed helper: one default workout-exercise entry. */
function tpl(
  exerciseId: string,
  reps: number[],
  restSeconds: number,
): DefaultTemplate["day"]["exercises"][number] {
  return {
    id: `default-${exerciseId}`,
    exerciseId,
    progressionId: `${exerciseId}-p0`,
    sets: reps.map((r) => ({ reps: r })),
    restSeconds,
    progressionMethod: "intra",
  };
}

/**
 * The admin-managed recommended defaults every new workout day starts from —
 * a full workout day, edited with the same UI as the program designer.
 * Athletes add their own skill/strength work from the library on top.
 */
const defaultTemplate: DefaultTemplate = {
  id: "default",
  day: {
    exercises: [
      tpl("wrist-prep", [10], 30),
      tpl("band-dislocates", [10], 30),
      tpl("scap-pulls", [8, 8], 60),
      tpl("front-lever", [5, 5, 5], 180),
      tpl("cuban-rotation", [12, 12], 60),
      tpl("ring-curl", [10, 10], 90),
      tpl("shoulder-ext", [5], 30),
      tpl("hang-decompress", [1], 0),
    ],
    groups: [],
  },
};

const profiles: Profile[] = [
  { id: "dev-athlete", email: "athlete@dev.local", name: "Dev Athlete", isAdmin: false },
  { id: "dev-admin", email: "admin@dev.local", name: "Dev Admin", isAdmin: true },
];

export function seedData(): DbData {
  return {
    exercises,
    defaultTemplate,
    profiles,
    programs: [],
    runs: [],
    sessions: [],
    exerciseNotes: [],
    customWorkouts: [],
  };
}
