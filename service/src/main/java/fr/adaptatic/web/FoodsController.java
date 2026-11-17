package fr.adaptatic.web;

import fr.adaptatic.auth.AuthUnavailableException;
import fr.adaptatic.auth.UserAuthenticator;
import fr.adaptatic.foods.BarcodeService;
import fr.adaptatic.foods.RateLimiter;
import fr.adaptatic.foods.UpstreamException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** API appelée par l'app (jeton Supabase de l'utilisateur) : aliment par code-barres. */
@Slf4j
@RestController
public class FoodsController {

    private static final Pattern BARCODE = Pattern.compile("^[0-9]{8,14}$");

    private final UserAuthenticator authenticator;
    private final BarcodeService barcodes;
    private final RateLimiter limiter;

    public FoodsController(UserAuthenticator authenticator, BarcodeService barcodes, RateLimiter limiter) {
        this.authenticator = authenticator;
        this.barcodes = barcodes;
        this.limiter = limiter;
    }

    @GetMapping("/api/foods/barcode/{code}")
    public ResponseEntity<Map<String, Object>> byBarcode(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String code) {

        UUID user;
        try {
            Optional<UUID> id = authenticator.authenticate(authorization);
            if (id.isEmpty()) return error(HttpStatus.UNAUTHORIZED, "unauthorized", "Session invalide : reconnecte-toi.");
            user = id.get();
        } catch (AuthUnavailableException e) {
            log.error("Vérification du jeton impossible : {}", e.getMessage());
            return error(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "Le service ne peut pas vérifier ta session.");
        }

        if (!BARCODE.matcher(code).matches()) {
            return error(HttpStatus.BAD_REQUEST, "invalid_barcode", "Un code-barres compte 8 à 14 chiffres.");
        }
        if (!limiter.tryAcquire(user)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "Trop de recherches, réessaie dans une minute.");
        }

        try {
            return switch (barcodes.lookup(code)) {
                case BarcodeService.Outcome.Found f ->
                        ResponseEntity.ok(Map.of("food", f.food(), "cached", f.cached()));
                case BarcodeService.Outcome.NotFound n ->
                        error(HttpStatus.NOT_FOUND, "not_found", "Produit absent d'Open Food Facts.");
                case BarcodeService.Outcome.Incomplete i ->
                        error(HttpStatus.UNPROCESSABLE_ENTITY, "incomplete", "Données Open Food Facts inutilisables : " + i.reason() + ".");
            };
        } catch (UpstreamException e) {
            log.warn("Open Food Facts indisponible : {}", e.getMessage());
            return error(HttpStatus.BAD_GATEWAY, "upstream", "Open Food Facts ne répond pas.");
        }
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", code, "message", message));
    }
}
