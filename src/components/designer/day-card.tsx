"use client";

import { useRef, useState } from "react";
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
  Trash2,
  X,
} from "lucide-react";
import {
  Attribute,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_ORDER,
  GROUP_TYPE_COLORS,
  GROUP_TYPE_LABELS,
  GroupType,
  GROUP_TYPES,
  Weekday,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import { Exercise, WorkoutDay, WorkoutExercise } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function setsSummary(we: WorkoutExercise, exercise: Exercise): string {
  const unit = exercise.measurement === "time" ? "s hold" : " reps";
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
}) {
  // Selection mode is scoped to one section: exercises can only be grouped
  // (and reordered) inside their own section.
  const [selecting, setSelecting] = useState<Attribute | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const attributeOf = (we: WorkoutExercise): Attribute =>
    exercisesById.get(we.exerciseId)?.attribute ?? "strength";

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
              title="Toggle high/low volume"
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                day.intensity === "high"
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
              )}
            >
              {day.intensity === "high" ? "High volume" : "Low volume"}
            </button>
          )}
        </span>
        {onCopyDay && (
          <Button variant="ghost" size="sm" onClick={onCopyDay}>
            <Copy className="size-4" /> Copy day
          </Button>
        )}
      </div>

      {ATTRIBUTE_ORDER.map((attribute) => {
        const section = day.exercises.filter(
          (we) => attributeOf(we) === attribute,
        );
        return (
          <DaySection
            key={attribute}
            weekday={weekday}
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
            onGroup={(type) => {
              onGroup(selected, type);
              setSelecting(null);
              setSelected([]);
            }}
            onUngroup={onUngroup}
            onAddExercise={() => onAddExercise(attribute)}
            onRemoveSection={() => onRemoveSection(attribute)}
            onEditExercise={onEditExercise}
            onRemoveExercise={onRemoveExercise}
            onReorder={onReorder}
          />
        );
      })}
    </section>
  );
}

function DaySection({
  weekday,
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
  onAddExercise,
  onRemoveSection,
  onEditExercise,
  onRemoveExercise,
  onReorder,
}: {
  weekday: Weekday;
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

      <DndContext
        id={`day-dnd-${weekday}-${attribute}`}
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

      {selecting && selected.length >= 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted-foreground">
            Mode for {selected.length}:
          </span>
          {GROUP_TYPES.filter(
            (type) => type !== "superset" || selected.length >= 2,
          ).map((type) => (
            <Button
              key={type}
              size="sm"
              variant="outline"
              onClick={() => onGroup(type)}
            >
              {GROUP_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>
      )}

      {!selecting && (
        <button
          type="button"
          onClick={onAddExercise}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-4" /> Add {ATTRIBUTE_LABELS[attribute].toLowerCase()} exercise
        </button>
      )}
    </div>
  );
}

/**
 * One exercise row: draggable by its grip handle, tap to edit, swipe left to
 * delete, checkbox in selection mode.
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
  const [swipeX, setSwipeX] = useState(0);
  const touch = useRef<{ x: number; y: number; swiping: boolean } | null>(null);

  const progression = exercise.progressions.find(
    (p) => p.id === we.progressionId,
  );

  function onTouchStart(e: React.TouchEvent) {
    if (selecting) return;
    touch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      swiping: false,
    };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touch.current) return;
    const dx = e.touches[0].clientX - touch.current.x;
    const dy = e.touches[0].clientY - touch.current.y;
    if (!touch.current.swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      touch.current.swiping = true;
    }
    if (touch.current.swiping) {
      setSwipeX(Math.min(0, Math.max(-112, dx)));
    }
  }
  function onTouchEnd() {
    if (swipeX < -80) {
      onRemove();
    }
    setSwipeX(0);
    touch.current = null;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("relative", isDragging && "z-10 opacity-90")}
    >
      {/* swipe reveal */}
      <div className="absolute inset-0 flex items-center justify-end rounded-xl bg-destructive pr-4">
        <Trash2 className="size-4 text-white" />
      </div>
      <div
        className={cn(
          // Opaque: the swipe-to-delete red layer sits right behind this row.
          "relative flex items-center gap-2 rounded-xl bg-muted p-3 transition-transform",
          groupColor && `border-l-4 ${groupColor}`,
          selected && "ring-2 ring-primary",
        )}
        style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
      </div>
    </div>
  );
}
