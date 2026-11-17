package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Convertit un produit Open Food Facts en aliment du catalogue. Fonction pure.
 * Les données OFF sont collaboratives, donc incomplètes ou fausses par moments : on REFUSE
 * un produit douteux plutôt que d'enregistrer des valeurs inventées ou absurdes.
 */
public final class OffProductMapper {

    /** 1 kcal = 4,184 kJ (définition de la calorie thermochimique). */
    static final double KJ_PER_KCAL = 4.184;

    public sealed interface Result {
        record Ok(FoodDraft food) implements Result { }
        record Incomplete(String reason) implements Result { }
    }

    private OffProductMapper() { }

    public static Result map(String barcode, JsonNode product) {
        String name = firstText(product, "product_name_fr", "product_name");
        if (name == null) return new Result.Incomplete("le produit n'a pas de nom");

        JsonNode n = product.path("nutriments");
        Double kcal = number(n, "energy-kcal_100g");
        if (kcal == null) {
            Double kj = number(n, "energy-kj_100g");
            if (kj == null) kj = number(n, "energy_100g"); // OFF : énergie en kJ
            if (kj != null) kcal = kj / KJ_PER_KCAL;
        }
        Double protein = number(n, "proteins_100g");
        Double carbs = number(n, "carbohydrates_100g");
        Double fat = number(n, "fat_100g");
        if (kcal == null || protein == null || carbs == null || fat == null) {
            return new Result.Incomplete("valeurs nutritionnelles incomplètes");
        }

        kcal = round1(kcal);
        protein = round1(protein);
        carbs = round1(carbs);
        fat = round1(fat);
        // Mêmes bornes que la base (voir migration food_journal) ; au-delà, la donnée OFF est fausse.
        if (kcal < 0 || kcal > 900 || outside(protein) || outside(carbs) || outside(fat)
                || protein + carbs + fat > 101) {
            return new Result.Incomplete("valeurs nutritionnelles incohérentes");
        }

        Double servingG = null;
        String servingLabel = null;
        Double sq = number(product, "serving_quantity");
        if (sq != null && sq > 0 && sq <= 5000) {
            servingG = round1(sq);
            String label = firstText(product, "serving_size");
            if (label != null && label.length() <= 40) servingLabel = label;
        }

        return new Result.Ok(new FoodDraft(truncate(name, 120), brand(product.path("brands").asText("")),
                barcode, kcal, protein, carbs, fat, servingG, servingLabel));
    }

    private static boolean outside(double macro) {
        return macro < 0 || macro > 100;
    }

    private static double round1(double x) {
        return Math.round(x * 10) / 10.0;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max).trim();
    }

    /** Première marque de la liste « Marque A, Marque B ». */
    private static String brand(String brands) {
        String first = brands.split(",")[0].trim();
        return first.isEmpty() ? null : truncate(first, 80);
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String f : fields) {
            JsonNode v = node.path(f);
            if (v.isTextual() && !v.asText().isBlank()) return v.asText().trim();
        }
        return null;
    }

    /** OFF donne tantôt un nombre, tantôt une chaîne ("30", "0,5"). null si absent ou illisible. */
    private static Double number(JsonNode parent, String field) {
        JsonNode v = parent.path(field);
        Double d = null;
        if (v.isNumber()) {
            d = v.asDouble();
        } else if (v.isTextual()) {
            try {
                d = Double.valueOf(v.asText().trim().replace(',', '.'));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return d != null && Double.isFinite(d) ? d : null;
    }
}
