package fr.adaptatic.web;

import com.fasterxml.jackson.databind.JsonNode;
import fr.adaptatic.RecomputeService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Reçoit les webhooks pg_net émis par les triggers Supabase (voir migration init). */
@Slf4j
@RestController
public class WebhookController {

    private static final Set<String> TABLES = Set.of("weight_logs", "profiles");

    private final RecomputeService recompute;
    private final String expectedSecret;

    public WebhookController(RecomputeService recompute,
                             @Value("${adaptatic.webhook-secret:}") String expectedSecret) {
        this.recompute = recompute;
        this.expectedSecret = expectedSecret;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/webhooks/supabase")
    public ResponseEntity<Map<String, Object>> supabase(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @RequestBody JsonNode payload) {

        if (!secretMatches(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String table = payload.path("table").asText("");
        String userRaw = payload.path("record").path("user_id").asText("");
        if (!TABLES.contains(table)) {
            return ResponseEntity.badRequest().body(Map.of("error", "table inconnue"));
        }
        UUID userId;
        try {
            userId = UUID.fromString(userRaw);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "user_id invalide"));
        }
        boolean updated = recompute.recompute(userId);
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    /** Comparaison en temps constant pour ne pas fuiter le secret par le temps de réponse. */
    boolean secretMatches(String provided) {
        String expected = expectedSecret;
        if (provided == null || expected == null || expected.isBlank()) return false;
        return MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }
}
