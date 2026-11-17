# Installation

## 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute **dans l'ordre** les fichiers de `supabase/migrations/` (`20261114000000_init.sql`, puis `20261114120000_profile_timezone.sql`, etc.).
3. Récupère dans **Project Settings → API Keys** : l'URL, la clé **publishable** (`sb_publishable_…`, publique) et la clé **secret** (`sb_secret_…`, **à ne jamais exposer**). Les anciens projets affichent encore `anon` / `service_role` : mêmes rôles.
4. Choisis un secret aléatoire (`openssl rand -hex 32`) et renseigne-le avec l'URL publique du service dans `private.app_config` : voir `supabase/config.example.sql` (à exécuter avec tes vraies valeurs, **sans le commiter**).
5. Pour tester sans e-mail de confirmation, désactive la confirmation dans **Authentication → Providers → Email** (à remettre en production).

## 2. Service de calcul

Il doit être joignable depuis Internet (Supabase l'appelle en HTTPS). Pendant le développement, un tunnel suffit (Cloudflare Tunnel, Tailscale Funnel, ngrok).

```bash
cd service
export SUPABASE_URL=https://<projet>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<clé secret (sb_secret_…)>   # le nom de variable est historique
export WEBHOOK_SECRET=<même secret que app_config>
mvn spring-boot:run
```

Ou avec Docker : `docker build -t adaptatic-service service` puis `docker run -p 8080:8080 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e WEBHOOK_SECRET=... -e SUPABASE_PUBLISHABLE_KEY=... adaptatic-service`.

**Scan de code-barres** : le service a besoin de `SUPABASE_PUBLISHABLE_KEY` (valider le jeton de l'utilisateur). Côté app, mets l'URL publique du service (ton tunnel) dans `EXPO_PUBLIC_SERVICE_URL` (`app/.env`). Le scan ne marche que si ton PC, Docker et le tunnel tournent.

Vérification : `curl http://localhost:8080/health` → `{"status":"ok"}`.

## 3. Application

```bash
cd app
cp .env.example .env     # URL + clé publishable (variable EXPO_PUBLIC_SUPABASE_ANON_KEY, nom historique)
npm install
npm run web              # ou : npm start, puis scanner le QR code avec Expo Go
```

## Sécurité

- Ne mets **jamais** la clé secret (ou `service_role`) dans l'app ni dans le dépôt.
- La clé publishable (ou `anon`) est publique par conception : c'est la RLS qui protège les données.
- Toute nouvelle table doit avoir la RLS activée et ses politiques dans la même migration.
