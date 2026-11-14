-- À exécuter une seule fois dans le SQL Editor de Supabase, après la migration.
-- Remplacez les deux valeurs : l'adresse publique du service Java et un secret long et aléatoire
-- (le même secret que WEBHOOK_SECRET dans service/.env).
insert into private.app_config (key, value) values
  ('service_url',   'https://votre-service.example.com'),
  ('webhook_secret', 'remplacez-par-un-secret-long-et-aleatoire')
on conflict (key) do update set value = excluded.value;
