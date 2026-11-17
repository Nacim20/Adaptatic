package fr.adaptatic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration lue depuis l'environnement (voir .env.example). Aucun secret dans le dépôt. */
@ConfigurationProperties(prefix = "adaptatic")
public record AppProperties(
        String supabaseUrl,
        String supabaseServiceKey,
        String webhookSecret,
        /** Clé publishable : sert uniquement à demander à Supabase Auth « ce jeton est-il valide ? ». */
        String supabasePublishableKey,
        String offBaseUrl,
        /** Open Food Facts exige un User-Agent qui identifie l'application. */
        String offUserAgent) { }
