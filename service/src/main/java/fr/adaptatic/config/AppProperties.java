package fr.adaptatic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration lue depuis l'environnement (voir .env.example). Aucun secret dans le dépôt. */
@ConfigurationProperties(prefix = "adaptatic")
public record AppProperties(String supabaseUrl, String supabaseServiceKey, String webhookSecret) { }
