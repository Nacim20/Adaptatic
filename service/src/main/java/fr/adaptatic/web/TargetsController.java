package fr.adaptatic.web;

import fr.adaptatic.RecomputeService;
import fr.adaptatic.auth.AuthUnavailableException;
import fr.adaptatic.auth.UserAuthenticator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** API appelée par l'app (jeton Supabase de l'utilisateur) : plan des prochains jours ("Programme"). */
@Slf4j
@RestController
public class TargetsController {

    private static final int DEFAULT_DAYS = 7;
    private static final int MAX_DAYS = 14;

    private final UserAuthenticator authenticator;
    private final RecomputeService recompute;

    public TargetsController(UserAuthenticator authenticator, RecomputeService recompute) {
        this.authenticator = authenticator;
        this.recompute = recompute;
    }

    @GetMapping("/api/targets/forecast")
    public ResponseEntity<Map<String, Object>> forecast(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "" + DEFAULT_DAYS) int days) {

        UUID user;
        try {
            Optional<UUID> id = authenticator.authenticate(authorization);
            if (id.isEmpty()) return error(HttpStatus.UNAUTHORIZED, "unauthorized", "Session invalide : reconnecte-toi.");
            user = id.get();
        } catch (AuthUnavailableException e) {
            log.error("Vérification du jeton impossible : {}", e.getMessage());
            return error(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "Le service ne peut pas vérifier ta session.");
        }

        int bounded = Math.max(1, Math.min(days, MAX_DAYS));
        Optional<List<RecomputeService.ForecastDay>> forecast = recompute.forecast(user, bounded);
        if (forecast.isEmpty()) {
            return error(HttpStatus.UNPROCESSABLE_ENTITY, "no_data", "Profil ou pesée manquants : rien à projeter.");
        }

        List<Map<String, Object>> forecastDays = forecast.get().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", d.date().toString());
            m.put("caloriesKcal", d.targets().caloriesKcal());
            m.put("proteinG", d.targets().proteinG());
            m.put("carbsG", d.targets().carbsG());
            m.put("fatG", d.targets().fatG());
            m.put("eventOffsetKcal", d.targets().eventOffsetKcal());
            m.put("note", d.targets().note());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("days", forecastDays));
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", code, "message", message));
    }
}
