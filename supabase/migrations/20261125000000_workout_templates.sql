-- Modèles de séance : l'utilisateur crée une liste d'exercices à l'avance (son propre
-- programme), puis la sélectionne le jour où il s'entraîne plutôt que de tout ressaisir.
-- Toujours aucune suggestion automatique d'exercices ni de séries/répétitions.

create table public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Juste la liste des exercices et leur ordre (pas d'objectif séries/répétitions en v1).
-- exercise_name copié pour les mêmes raisons que workout_sets.exercise_name.
create table public.workout_template_exercises (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id   uuid references public.exercises (id) on delete set null,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 80),
  position      integer not null default 0
);

create index workout_template_exercises_template_idx on public.workout_template_exercises (template_id);

alter table public.workout_sessions
  add column template_id uuid references public.workout_templates (id) on delete set null;

-- Le split pointe maintenant vers un modèle concret à lancer plutôt qu'un simple libellé
-- libre qui ne correspondait à rien d'exécutable.
alter table public.workout_split_days drop column label;
alter table public.workout_split_days
  add column template_id uuid references public.workout_templates (id) on delete set null;

-- --------------------------------------------------------------- Sécurité (RLS)
alter table public.workout_templates          enable row level security;
alter table public.workout_template_exercises enable row level security;

create policy "workout_templates: lecture"     on public.workout_templates for select using (owner_id = auth.uid());
create policy "workout_templates: création"    on public.workout_templates for insert with check (owner_id = auth.uid());
create policy "workout_templates: suppression" on public.workout_templates for delete using (owner_id = auth.uid());

create policy "workout_template_exercises: lecture" on public.workout_template_exercises for select
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = auth.uid()));
create policy "workout_template_exercises: création" on public.workout_template_exercises for insert
  with check (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = auth.uid()));
create policy "workout_template_exercises: suppression" on public.workout_template_exercises for delete
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner_id = auth.uid()));

revoke all on public.workout_templates, public.workout_template_exercises from anon;
grant select, insert, delete on public.workout_templates to authenticated;
grant select, insert, delete on public.workout_template_exercises to authenticated;
