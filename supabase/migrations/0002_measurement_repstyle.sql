-- Exercises gain a measurement (reps vs seconds of hold) and a rep style
-- (standard vs cluster reps for eccentric work).

alter table public.exercises
  add column measurement text not null default 'reps'
    check (measurement in ('reps', 'time')),
  add column rep_style text not null default 'standard'
    check (rep_style in ('standard', 'cluster'));

-- Flag the seeded isometric holds and eccentric work.
update public.exercises set measurement = 'time' where id in
  ('front-lever', 'back-lever', 'handstand', 'l-sit', 'planche', 'jump-rope',
   'pancake', 'shoulder-ext', 'thoracic-bridge', 'hang-decompress', 'breathing');
update public.exercises set rep_style = 'cluster' where id = 'nordic-curl';
