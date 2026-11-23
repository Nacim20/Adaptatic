-- Suivi d'entraînement (v1) : l'utilisateur définit son propre split et ses propres
-- séries ; l'app ne propose aucun exercice ni aucune progression — on n'a pas de source
-- fiable pour ça (voir docs/algorithm.md). Même principe d'honnêteté que le reste de l'app.

-- Catalogue d'exercices personnel (juste un nom pour retrouver l'historique, pas de données
-- "scientifiques" dessus).
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- Split hebdomadaire : quel type de séance pour chaque jour de la semaine.
-- weekday suit extract(dow) de Postgres : 0 = dimanche ... 6 = samedi.
create table public.workout_split_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  label   text not null check (length(btrim(label)) between 1 and 40),
  primary key (user_id, weekday)
);

create table public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  performed_on date not null,
  label        text check (length(label) <= 40),
  created_at   timestamptz not null default now()
);

create index workout_sessions_user_date_idx on public.workout_sessions (user_id, performed_on desc);

-- Une copie du nom de l'exercice (même principe que meal_entries.food_name) : l'historique
-- reste lisible même si l'exercice est renommé ou supprimé. Pas de risque de triche à
-- protéger ici (contrairement aux calories) : le client fournit directement le poids et les
-- répétitions, il n'y a pas de "vraie" valeur à falsifier.
create table public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id   uuid references public.exercises (id) on delete set null,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 80),
  weight_kg     numeric(6,2) not null check (weight_kg >= 0 and weight_kg <= 500),
  reps          integer not null check (reps between 1 and 100),
  set_order     integer not null default 0,
  created_at    timestamptz not null default now()
);

create index workout_sets_session_idx on public.workout_sets (session_id);

-- --------------------------------------------------------------- Sécurité (RLS)
alter table public.exercises          enable row level security;
alter table public.workout_split_days enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.workout_sets       enable row level security;

create policy "exercises: lecture"     on public.exercises for select using (owner_id = auth.uid());
create policy "exercises: création"    on public.exercises for insert with check (owner_id = auth.uid());
create policy "exercises: suppression" on public.exercises for delete using (owner_id = auth.uid());

create policy "workout_split_days: lecture"     on public.workout_split_days for select using (user_id = auth.uid());
create policy "workout_split_days: création"    on public.workout_split_days for insert with check (user_id = auth.uid());
create policy "workout_split_days: modification" on public.workout_split_days for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_split_days: suppression" on public.workout_split_days for delete using (user_id = auth.uid());

create policy "workout_sessions: lecture"     on public.workout_sessions for select using (user_id = auth.uid());
create policy "workout_sessions: création"    on public.workout_sessions for insert with check (user_id = auth.uid());
create policy "workout_sessions: suppression" on public.workout_sessions for delete using (user_id = auth.uid());

-- workout_sets n'a pas de user_id direct : l'appartenance passe par la séance.
create policy "workout_sets: lecture" on public.workout_sets for select
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "workout_sets: création" on public.workout_sets for insert
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "workout_sets: suppression" on public.workout_sets for delete
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

revoke all on public.exercises, public.workout_split_days, public.workout_sessions, public.workout_sets from anon;
grant select, insert, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.workout_split_days to authenticated;
grant select, insert, delete on public.workout_sessions to authenticated;
grant select, insert, delete on public.workout_sets to authenticated;
