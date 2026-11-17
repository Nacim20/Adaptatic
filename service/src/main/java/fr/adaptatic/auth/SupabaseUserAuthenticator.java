package fr.adaptatic.auth;

import com.fasterxml.jackson.databind.JsonNode;
import fr.adaptatic.config.AppProperties;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Demande à Supabase Auth (GET /auth/v1/user) si le jeton de l'utilisateur est valide : même appel
 * que supabase-js (clé publishable + jeton de l'utilisateur). Aucune clé de signature à gérer ici.
 */
@Component
public class SupabaseUserAuthenticator implements UserAuthenticator {

    private static final int MAX_TOKEN_LENGTH = 4096;

    private final RestClient http;
    private final boolean configured;

    @Autowired
    public SupabaseUserAuthenticator(AppProperties props) {
        this(props.supabaseUrl(), props.supabasePublishableKey(), RestClient.builder());
    }

    SupabaseUserAuthenticator(String supabaseUrl, String publishableKey, RestClient.Builder builder) {
        this.configured = publishableKey != null && !publishableKey.isBlank();
        this.http = builder.baseUrl(supabaseUrl + "/auth/v1")
                .defaultHeader("apikey", configured ? publishableKey : "")
                .build();
    }

    @Override
    public Optional<UUID> authenticate(String header) {
        if (!configured) {
            throw new AuthUnavailableException("SUPABASE_PUBLISHABLE_KEY n'est pas configurée", null);
        }
        if (header == null || header.length() < 8 || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return Optional.empty();
        }
        String token = header.substring(7).trim();
        if (token.isEmpty() || token.length() > MAX_TOKEN_LENGTH) return Optional.empty();

        try {
            JsonNode user = http.get().uri("/user")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(JsonNode.class);
            return parseId(user);
        } catch (HttpClientErrorException e) {
            return Optional.empty(); // 401/403 : jeton invalide ou expiré
        } catch (RestClientException e) {
            throw new AuthUnavailableException("Supabase Auth injoignable", e);
        }
    }

    private static Optional<UUID> parseId(JsonNode user) {
        if (user == null) return Optional.empty();
        try {
            return Optional.of(UUID.fromString(user.path("id").asText("")));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
