-- "Cardio" is not an attribute: conditioning work belongs to the warm-up
-- section. Remap existing rows and tighten the check constraint.

update public.exercises set attribute = 'warmup' where attribute = 'cardio';

alter table public.exercises
  drop constraint exercises_attribute_check;

alter table public.exercises
  add constraint exercises_attribute_check check (attribute in
    ('warmup', 'skill', 'strength', 'prehabilitation', 'isolation', 'flexibility', 'cooldown'));
