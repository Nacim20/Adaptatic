-- Fuseau horaire de l'utilisateur : "aujourd'hui" doit être sa date locale, pas la date UTC.
-- Défaut 'UTC' = comportement actuel pour les profils existants ; l'app écrase la valeur
-- avec le fuseau de l'appareil dès l'ouverture suivante.
alter table public.profiles
  add column timezone text not null default 'UTC'
  check (length(timezone) between 1 and 64);
