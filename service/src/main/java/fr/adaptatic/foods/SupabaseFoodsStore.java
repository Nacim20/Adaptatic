package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;
import fr.adaptatic.config.AppProperties;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Écrit dans le catalogue partagé avec la clé secret (seul le service peut le faire : la RLS
 * l'interdit aux utilisateurs). Le code-barres vient d'une entrée validée (8 à 14 chiffres).
 */
@Component
public class SupabaseFoodsStore implements FoodsStore {

    private final RestClient http;

    public SupabaseFoodsStore(AppProperties props) {
        this.http = RestClient.builder()
                .baseUrl(props.supabaseUrl() + "/rest/v1")
                .defaultHeader("apikey", props.supabaseServiceKey())
                .defaultHeader("Authorization", "Bearer " + props.supabaseServiceKey())
                .build();
    }

    @Override
    public Optional<JsonNode> findSharedByBarcode(String barcode) {
        JsonNode rows = http.get()
                .uri("/foods?owner_id=is.null&barcode=eq." + barcode + "&select=*&limit=1")
                .accept(MediaType.APPLICATION_JSON).retrieve().body(JsonNode.class);
        return rows == null || rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    @Override
    public JsonNode insertShared(FoodDraft d) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", d.name());
        if (d.brand() != null) row.put("brand", d.brand());
        row.put("barcode", d.barcode());
        row.put("kcal_100", d.kcal100());
        row.put("protein_100", d.protein100());
        row.put("carbs_100", d.carbs100());
        row.put("fat_100", d.fat100());
        if (d.servingG() != null) row.put("serving_g", d.servingG());
        if (d.servingLabel() != null) row.put("serving_label", d.servingLabel());
        row.put("source", "openfoodfacts");
        try {
            JsonNode rows = http.post().uri("/foods")
                    .contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON)
                    .header("Prefer", "return=representation")
                    .body(row)
                    .retrieve().body(JsonNode.class);
            return rows.get(0);
        } catch (HttpClientErrorException.Conflict e) {
            throw new DuplicateFoodException();
        }
    }
}
