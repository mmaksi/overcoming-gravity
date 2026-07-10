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
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
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
  ATTRIBUTE_LABELS,
  GROUP_TYPE_LABELS,
  GroupType,
  GROUP_TYPES,
  Weekday,
  WEEKDAY_LABELS,
} from "@/lib/domain/types";
import { Exercise, WorkoutDay, WorkoutExercise } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return `${we.sets.length} sets · ${values}${unit}${weight}${cluster} · rest ${we.restSeconds}s`;
}

const GROUP_COLORS = [
  "border-l-violet-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-rose-500",
];

export function DayCard({
  weekday,
  day,
  periodized,
  exercisesById,
  onToggleIntensity,
  onCopyDay,
  onAddExercise,
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
  onAddExercise: () => void;
  onEditExercise: (workoutExerciseId: string) => void;
  onRemoveExercise: (workoutExerciseId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onGroup: (ids: string[], type: GroupType) => void;
  onUngroup: (groupId: string) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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

  const groupIndex = new Map(
    (day.groups ?? []).map((g, i) => [g.id, i] as const),
  );

  return (
    <Card
      className={cn(
        "gap-3 py-4",
        periodized &&
          (day.intensity === "high"
            ? "border-orange-400/70 bg-orange-500/5"
            : "border-sky-400/70 bg-sky-500/5"),
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {WEEKDAY_LABELS[weekday]}
            {periodized && (
              <button
                type="button"
                onClick={onToggleIntensity}
                title="Toggle high/low volume"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                  day.intensity === "high"
                    ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                )}
              >
                {day.intensity === "high" ? "High volume" : "Low volume"}
              </button>
            )}
          </span>
          <span className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            >
              {selecting ? <X className="size-4" /> : <ListChecks className="size-4" />}
              {selecting ? "Cancel" : "Select"}
            </Button>
            {onCopyDay && !selecting && (
              <Button variant="ghost" size="sm" onClick={onCopyDay}>
                <Copy className="size-4" /> Copy
              </Button>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <DndContext
          id={`day-dnd-${weekday}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={day.exercises.map((we) => we.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {day.exercises.map((we, i) => {
                const ex = exercisesById.get(we.exerciseId);
                if (!ex) return null;
                const prev = day.exercises[i - 1];
                const group = we.groupId
                  ? (day.groups ?? []).find((g) => g.id === we.groupId)
                  : undefined;
                const isGroupStart =
                  group && (!prev || prev.groupId !== we.groupId);
                return (
                  <div key={we.id}>
                    {isGroupStart && group && (
                      <div className="mb-1 flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {GROUP_TYPE_LABELS[group.type]}
                        </Badge>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          title="Ungroup"
                          onClick={() => onUngroup(group.id)}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    )}
                    <SortableExerciseRow
                      we={we}
                      exercise={ex}
                      groupColor={
                        we.groupId !== undefined &&
                        groupIndex.has(we.groupId)
                          ? GROUP_COLORS[
                              groupIndex.get(we.groupId)! % GROUP_COLORS.length
                            ]
                          : undefined
                      }
                      selecting={selecting}
                      selected={selected.includes(we.id)}
                      onToggleSelected={() =>
                        setSelected((s) =>
                          s.includes(we.id)
                            ? s.filter((id) => id !== we.id)
                            : [...s, we.id],
                        )
                      }
                      onEdit={() => onEditExercise(we.id)}
                      onRemove={() => onRemoveExercise(we.id)}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {selecting && selected.length >= 2 && (
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-2">
            <span className="mr-1 text-xs text-muted-foreground">
              Group {selected.length} as:
            </span>
            {GROUP_TYPES.map((type) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                onClick={() => {
                  onGroup(selected, type);
                  setSelecting(false);
                  setSelected([]);
                }}
              >
                {GROUP_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        )}

        {!selecting && (
          <Button variant="outline" size="sm" className="w-full" onClick={onAddExercise}>
            <Plus className="size-4" /> Add exercise
          </Button>
        )}
      </CardContent>
    </Card>
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
      <div className="absolute inset-0 flex items-center justify-end rounded-lg bg-destructive pr-4">
        <Trash2 className="size-4 text-white" />
      </div>
      <div
        className={cn(
          "relative flex items-center gap-1 rounded-lg border bg-background p-2 transition-transform",
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
              "flex size-5 shrink-0 items-center justify-center rounded border",
              selected && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {selected && "✓"}
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={selecting ? onToggleSelected : onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{exercise.title}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {ATTRIBUTE_LABELS[exercise.attribute]}
            </Badge>
            {we.progressionMethod === "inter" && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                inter
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {progression?.name} · {setsSummary(we, exercise)}
          </p>
        </button>
      </div>
    </div>
  );
}
