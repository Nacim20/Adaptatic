# Installation

## 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute `supabase/migrations/20261114000000_init.sql`.
3. Récupère dans **Project Settings → API** : l'URL, la clé `anon` (publique) et la clé `service_role` (**secrète**).
4. Choisis un secret aléatoire (`openssl rand -hex 32`) et renseigne-le avec l'URL publique du service dans `private.app_config` : voir `supabase/config.example.sql` (à exécuter avec tes vraies valeurs, **sans le commiter**).
5. Pour tester sans e-mail de confirmation, désactive la confirmation dans **Authentication → Providers → Email** (à remettre en production).

## 2. Service de calcul

Il doit être joignable depuis Internet (Supabase l'appelle en HTTPS). Pendant le développement, un tunnel suffit (Cloudflare Tunnel, Tailscale Funnel, ngrok).

```bash
cd service
export SUPABASE_URL=https://<projet>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role>
export WEBHOOK_SECRET=<même secret que app_config>
mvn spring-boot:run
```

Ou avec Docker : `docker build -t adaptatic-service service` puis `docker run -p 8080:8080 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e WEBHOOK_SECRET=... adaptatic-service`.

Vérification : `curl http://localhost:8080/health` → `{"status":"ok"}`.

## 3. Application

```bash
cd app
cp .env.example .env     # URL + clé anon
npm install
npm run web              # ou : npm start, puis scanner le QR code avec Expo Go
```

## Sécurité

- Ne mets **jamais** la clé `service_role` dans l'app ni dans le dépôt.
- La clé `anon` est publique par conception : c'est la RLS qui protège les données.
