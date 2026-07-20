"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  ListChecks,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_ORDER,
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  GROUP_TYPE_RULES,
  GroupType,
  GROUP_TYPES,
  INTENSITY_LABELS,
  Weekday,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import {
  Exercise,
  ExerciseGroup,
  groupConfigSummary,
  measurementOf,
  sectionOf,
  WorkoutDay,
  WorkoutExercise,
} from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import {
  ModeSettings,
  ModeSettingsDialog,
  seedModeSettings,
} from "@/components/workout/mode-settings-dialog";
import { cn } from "@/lib/utils";

function setsSummary(we: WorkoutExercise, exercise: Exercise): string {
  const m = measurementOf(exercise, we.progressionId, we.measurement);
  const unit =
    m === "reps" ? " reps" : m === "minutes" ? " min hold" : "s hold";
  const values = we.sets.map((s) => s.reps).join("/");
  const weights = we.sets.filter((s) => s.weight !== undefined);
  const weight =
    weights.length > 0 ? ` @ ${weights.map((s) => s.weight).join("/")}kg` : "";
  const cluster =
    exercise.repStyle === "cluster"
      ? ` · cluster (${we.clusterRestSeconds ?? 15}s between reps)`
      : "";
  const tempo = we.tempo ? ` · tempo ${we.tempo}` : "";
  return `${we.sets.length} sets · ${values}${unit}${weight}${cluster}${tempo} · rest ${we.restSeconds}s`;
}

export function DayCard({
  weekday,
  day,
  periodized,
  exercisesById,
  onToggleIntensity,
  onCopyDay,
  onAddExercise,
  onRemoveSection,
  onEditExercise,
  onRemoveExercise,
  onReorder,
  onGroup,
  onUngroup,
  onConfigureGroup,
}: {
  weekday: Weekday;
  day: WorkoutDay;
  periodized: boolean;
  exercisesById: Map<string, Exercise>;
  onToggleIntensity: () => void;
  onCopyDay?: () => void;
  /** Open the picker scoped to one section. */
  onAddExercise: (attribute: Attribute) => void;
  /** Clear a whole section (its title and placeholder remain). */
  onRemoveSection: (attribute: Attribute) => void;
  onEditExercise: (workoutExerciseId: string) => void;
  onRemoveExercise: (workoutExerciseId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onGroup: (ids: string[], type: GroupType) => void;
  onUngroup: (groupId: string) => void;
  /** Persist a group's mode settings (circuit rounds/stations) to the plan. */
  onConfigureGroup: (groupId: string, patch: Partial<ExerciseGroup>) => void;
}) {
  return (
    <section
      className={cn(
        "space-y-5",
        // Periodized days get a soft tint so high/low reads at a glance.
        periodized && "-mx-2 rounded-2xl p-2",
        periodized &&
          (day.intensity === "high" ? "bg-orange-500/[0.06]" : "bg-sky-500/[0.06]"),
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{WEEKDAY_LABELS[weekday]}</h3>
          {periodized && (
            <button
              type="button"
              onClick={onToggleIntensity}
              title="Toggle light/heavy day"
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                day.intensity === "high"
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
              )}
            >
              {INTENSITY_LABELS[day.intensity === "high" ? "high" : "low"]}
            </button>
          )}
        </span>
        {onCopyDay && (
          <Button variant="ghost" size="sm" onClick={onCopyDay}>
            <Copy className="size-4" /> Copy day
          </Button>
        )}
      </div>

      <DaySections
        dndIdPrefix={weekday}
        day={day}
        exercisesById={exercisesById}
        onAddExercise={onAddExercise}
        onRemoveSection={onRemoveSection}
        onEditExercise={onEditExercise}
        onRemoveExercise={onRemoveExercise}
        onReorder={onReorder}
        onGroup={onGroup}
        onUngroup={onUngroup}
        onConfigureGroup={onConfigureGroup}
      />
    </section>
  );
}

/**
 * The attribute sections of one workout day (warm-up → cool-down), each with
 * its own reorder DnD, mode selection and add-exercise placeholder. Shared
 * by the program designer (per weekday) and the admin defaults page.
 */
export function DaySections({
  dndIdPrefix,
  day,
  exercisesById,
  onAddExercise,
  onRemoveSection,
  onEditExercise,
  onRemoveExercise,
  onReorder,
  onGroup,
  onUngroup,
  onConfigureGroup,
}: {
  /** Keeps DnD context ids unique when several days render at once. */
  dndIdPrefix: string;
  day: WorkoutDay;
  exercisesById: Map<string, Exercise>;
  onAddExercise: (attribute: Attribute) => void;
  onRemoveSection: (attribute: Attribute) => void;
  onEditExercise: (workoutExerciseId: string) => void;
  onRemoveExercise: (workoutExerciseId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onGroup: (ids: string[], type: GroupType) => void;
  onUngroup: (groupId: string) => void;
  /** Persist a group's mode settings (circuit rounds/stations) to the plan. */
  onConfigureGroup: (groupId: string, patch: Partial<ExerciseGroup>) => void;
}) {
  // Selection mode is scoped to one section: exercises can only be grouped
  // (and reordered) inside their own section.
  const [selecting, setSelecting] = useState<Attribute | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function finishGrouping(type: GroupType) {
    onGroup(selected, type);
    setSelecting(null);
    setSelected([]);
  }

  return (
    <>
      {ATTRIBUTE_ORDER.map((attribute) => {
        const section = day.exercises.filter(
          (we) => sectionOf(we, exercisesById) === attribute,
        );
        return (
          <DaySection
            key={attribute}
            dndIdPrefix={dndIdPrefix}
            attribute={attribute}
            exercises={section}
            day={day}
            exercisesById={exercisesById}
            selecting={selecting === attribute}
            selected={selected}
            onStartSelecting={() => {
              setSelecting(selecting === attribute ? null : attribute);
              setSelected([]);
            }}
            onToggleSelected={(id) =>
              setSelected((s) =>
                s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
              )
            }
            // Designing only picks the mode; its settings (rest, rounds,
            // steps…) are chosen at workout time in the logger.
            onGroup={finishGrouping}
            onUngroup={onUngroup}
            onConfigureGroup={onConfigureGroup}
            onAddExercise={() => onAddExercise(attribute)}
            onRemoveSection={() => onRemoveSection(attribute)}
            onEditExercise={onEditExercise}
            onRemoveExercise={onRemoveExercise}
            onReorder={onReorder}
          />
        );
      })}
    </>
  );
}

function DaySection({
  dndIdPrefix,
  attribute,
  exercises,
  day,
  exercisesById,
  selecting,
  selected,
  onStartSelecting,
  onToggleSelected,
  onGroup,
  onUngroup,
  onConfigureGroup,
  onAddExercise,
  onRemoveSection,
  onEditExercise,
  onRemoveExercise,
  onReorder,
}: {
  dndIdPrefix: string;
  attribute: Attribute;
  exercises: WorkoutExercise[];
  day: WorkoutDay;
  exercisesById: Map<string, Exercise>;
  selecting: boolean;
  selected: string[];
  onStartSelecting: () => void;
  onToggleSelected: (id: string) => void;
  onGroup: (type: GroupType) => void;
  onUngroup: (groupId: string) => void;
  onConfigureGroup: (groupId: string, patch: Partial<ExerciseGroup>) => void;
  onAddExercise: () => void;
  onRemoveSection: () => void;
  onEditExercise: (workoutExerciseId: string) => void;
  onRemoveExercise: (workoutExerciseId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Which group's circuit settings dialog is open (design-time config).
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const settingsGroup = settingsFor
    ? (day.groups ?? []).find((g) => g.id === settingsFor)
    : undefined;
  /** A group's exercises in planned order — one circuit station each. */
  function groupExerciseTitles(groupId: string): string[] {
    return exercises
      .filter((we) => we.groupId === groupId)
      .map((we) => exercisesById.get(we.exerciseId)?.title ?? "Exercise");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ATTRIBUTE_LABELS[attribute]}
        </h4>
        {exercises.length > 0 && (
          <span className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={selecting}
              onClick={onStartSelecting}
            >
              {selecting ? <X className="size-4" /> : <ListChecks className="size-4" />}
              {selecting ? "Cancel" : "Mode"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              aria-label={`Remove ${ATTRIBUTE_LABELS[attribute]} section`}
              onClick={onRemoveSection}
            >
              <Trash2 className="size-4" />
            </Button>
          </span>
        )}
      </div>

      {/* The mode palette sits right under the section name. Every mode is
          always visible in its own colour; ones that don't fit the current
          selection count are dimmed with their requirement as the tooltip. */}
      {selecting && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted-foreground">
            {selected.length} selected ·
          </span>
          {GROUP_TYPES.map((type) => {
            const rule = GROUP_TYPE_RULES[type];
            const enabled = rule.accepts(selected.length);
            return (
              <button
                key={type}
                type="button"
                disabled={!enabled}
                title={enabled ? undefined : `Needs ${rule.requirement}`}
                onClick={() => onGroup(type)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity",
                  GROUP_TYPE_COLORS[type].badge,
                  !enabled && "opacity-35",
                )}
              >
                {GROUP_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      )}

      <DndContext
        id={`day-dnd-${dndIdPrefix}-${attribute}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={exercises.map((we) => we.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {exercises.map((we, i) => {
              const ex = exercisesById.get(we.exerciseId);
              if (!ex) return null;
              const prev = exercises[i - 1];
              const group = we.groupId
                ? (day.groups ?? []).find((g) => g.id === we.groupId)
                : undefined;
              const isGroupStart =
                group && (!prev || prev.groupId !== we.groupId);
              return (
                <div key={we.id}>
                  {isGroupStart && group && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          GROUP_TYPE_COLORS[group.type].badge,
                        )}
                      >
                        {GROUP_TYPE_LABELS[group.type]}
                      </span>
                      {groupConfigSummary(group) && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {groupConfigSummary(group)}
                        </span>
                      )}
                      {group.type === "circuit" && (
                        <button
                          type="button"
                          aria-label="Circuit settings"
                          className="text-muted-foreground hover:text-foreground"
                          title="Circuit settings"
                          onClick={() => setSettingsFor(group.id)}
                        >
                          <Settings2 className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        title="Remove mode"
                        onClick={() => onUngroup(group.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <SortableExerciseRow
                    we={we}
                    exercise={ex}
                    groupColor={group && GROUP_TYPE_COLORS[group.type].border}
                    selecting={selecting}
                    selected={selected.includes(we.id)}
                    onToggleSelected={() => onToggleSelected(we.id)}
                    onEdit={() => onEditExercise(we.id)}
                    onRemove={() => onRemoveExercise(we.id)}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!selecting && (
        <button
          type="button"
          onClick={onAddExercise}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-4" /> Add {ATTRIBUTE_LABELS[attribute].toLowerCase()} exercise
        </button>
      )}

      {/* Design-time circuit config. Keyed per opening so the fields start
          from the group's saved rounds/stations; saving persists them to the
          plan (the logger still seeds from — and overrides — these). */}
      <ModeSettingsDialog
        key={settingsFor ?? "closed"}
        type={settingsGroup?.type ?? null}
        value={settingsGroup ? seedModeSettings(settingsGroup) : {}}
        exerciseTitles={settingsFor ? groupExerciseTitles(settingsFor) : []}
        onOpenChange={(open) => !open && setSettingsFor(null)}
        onSave={(s: ModeSettings) => {
          if (settingsFor) {
            onConfigureGroup(settingsFor, {
              rounds: s.rounds,
              stations: s.stations,
            });
          }
        }}
      />
    </div>
  );
}

/**
 * One exercise row: draggable by its grip handle, tap to edit, red trash
 * button to delete, checkbox in selection mode. (No swipe gesture here —
 * horizontal swipes page through the days of the week.)
 */
function SortableExerciseRow({
  we,
  exercise,
  groupColor,
  selecting,
  selected,
  onToggleSelected,
  onEdit,
  onRemove,
}: {
  we: WorkoutExercise;
  exercise: Exercise;
  groupColor?: string;
  selecting: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: we.id, disabled: selecting });

  const progression = exercise.progressions.find(
    (p) => p.id === we.progressionId,
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("relative", isDragging && "z-10 opacity-90")}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl bg-muted p-3",
          groupColor && `border-l-4 ${groupColor}`,
          selected && "ring-2 ring-primary",
        )}
      >
        {selecting ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={onToggleSelected}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded border",
              selected && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {selected && "✓"}
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none p-1 text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={selecting ? onToggleSelected : onEdit}
          className="min-w-0 flex-1 py-0.5 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{exercise.title}</span>
            {we.progressionMethod === "inter" && (
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                inter
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {progression?.name} · {setsSummary(we, exercise)}
          </p>
        </button>
        {!selecting && (
          <button
            type="button"
            aria-label={`Remove ${exercise.title}`}
            onClick={onRemove}
            className="shrink-0 rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
