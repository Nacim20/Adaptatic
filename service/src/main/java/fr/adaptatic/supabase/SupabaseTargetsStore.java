package fr.adaptatic.supabase;

import com.fasterxml.jackson.databind.JsonNode;
import fr.adaptatic.config.AppProperties;
import fr.adaptatic.engine.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Client PostgREST. Utilise la clé service_role : elle contourne la RLS, donc le userId
 * doit toujours venir d'un webhook authentifié, jamais d'une entrée utilisateur.
 */
@Component
public class SupabaseTargetsStore implements TargetsStore {

    private final RestClient http;

    public SupabaseTargetsStore(AppProperties props) {
        this.http = RestClient.builder()
                .baseUrl(props.supabaseUrl() + "/rest/v1")
                .defaultHeader("apikey", props.supabaseServiceKey())
                .defaultHeader("Authorization", "Bearer " + props.supabaseServiceKey())
                .build();
    }

    private JsonNode get(String path) {
        return http.get().uri(path).accept(MediaType.APPLICATION_JSON).retrieve().body(JsonNode.class);
    }

    @Override
    public Optional<Profile> findProfile(UUID userId) {
        JsonNode rows = get("/profiles?user_id=eq." + userId + "&select=*");
        if (rows == null || rows.isEmpty()) return Optional.empty();
        JsonNode r = rows.get(0);
        return Optional.of(new Profile(
                Sex.valueOf(r.get("sex").asText().toUpperCase()),
                LocalDate.parse(r.get("birth_date").asText()),
                r.get("height_cm").asDouble(),
                ActivityLevel.valueOf(r.get("activity_level").asText().toUpperCase()),
                Goal.valueOf(r.get("goal").asText().toUpperCase()),
                r.get("weekly_rate_pct").asDouble()));
    }

    @Override
    public List<WeightEntry> recentWeights(UUID userId) {
        LocalDate since = LocalDate.now().minusDays(60);
        JsonNode rows = get("/weight_logs?user_id=eq." + userId + "&logged_on=gte." + since
                + "&select=logged_on,weight_kg&order=logged_on.asc");
        List<WeightEntry> out = new ArrayList<>();
        if (rows != null) {
            for (JsonNode r : rows) {
                out.add(new WeightEntry(LocalDate.parse(r.get("logged_on").asText()), r.get("weight_kg").asDouble()));
            }
        }
        return out;
    }

    @Override
    public Optional<StoredState> findState(UUID userId) {
        JsonNode rows = get("/nutrition_targets?user_id=eq." + userId
                + "&select=adaptive_offset_kcal,last_adjusted_on,tracking_since,goal,weekly_rate_pct");
        if (rows == null || rows.isEmpty()) return Optional.empty();
        JsonNode r = rows.get(0);
        LocalDate last = r.get("last_adjusted_on") == null || r.get("last_adjusted_on").isNull()
                ? null : LocalDate.parse(r.get("last_adjusted_on").asText());
        return Optional.of(new StoredState(
                new AdaptiveState(r.get("adaptive_offset_kcal").asInt(), last,
                        LocalDate.parse(r.get("tracking_since").asText())),
                Goal.valueOf(r.get("goal").asText().toUpperCase()),
                r.get("weekly_rate_pct").asDouble()));
    }

    @Override
    public void saveTargets(UUID userId, Targets t, Goal goal, double weeklyRatePct) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("user_id", userId.toString());
        row.put("tdee_kcal", t.tdeeKcal());
        row.put("calories_kcal", t.caloriesKcal());
        row.put("protein_g", t.proteinG());
        row.put("carbs_g", t.carbsG());
        row.put("fat_g", t.fatG());
        row.put("adaptive_offset_kcal", t.state().offsetKcal());
        row.put("last_adjusted_on", t.state().lastAdjustedOn() == null ? null : t.state().lastAdjustedOn().toString());
        row.put("tracking_since", t.state().trackingSince().toString());
        row.put("goal", goal.name().toLowerCase());
        row.put("weekly_rate_pct", weeklyRatePct);
        row.put("weight_trend_kg", Math.round(t.trendWeightKg() * 100) / 100.0);
        row.put("weekly_rate_kg", t.observedWeeklyRateKg() == null ? null
                : Math.round(t.observedWeeklyRateKg() * 100) / 100.0);
        row.put("note", t.note());
        row.put("computed_at", java.time.Instant.now().toString());

        http.post().uri("/nutrition_targets?on_conflict=user_id")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Prefer", "resolution=merge-duplicates,return=minimal")
                .body(row)
                .retrieve().toBodilessEntity();
    }
}
