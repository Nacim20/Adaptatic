package fr.adaptatic.foods;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.adaptatic.foods.OffProductMapper.Result;
import org.junit.jupiter.api.Test;

class OffProductMapperTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String CODE = "3017620422003";

    private static JsonNode json(String s) {
        try {
            return JSON.readTree(s);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static FoodDraft ok(String product) {
        Result r = OffProductMapper.map(CODE, json(product));
        return assertInstanceOf(Result.Ok.class, r, "attendu : produit accepté, obtenu " + r).food();
    }

    private static String incomplete(String product) {
        return assertInstanceOf(Result.Incomplete.class, OffProductMapper.map(CODE, json(product))).reason();
    }

    @Test
    void mapsACompleteProduct() {
        FoodDraft f = ok("""
            {"product_name_fr":"Pâte à tartiner","product_name":"Spread","brands":"Marque A, Marque B",
             "nutriments":{"energy-kcal_100g":500,"proteins_100g":5.04,"carbohydrates_100g":60,"fat_100g":25.2},
             "serving_quantity":"15","serving_size":"15 g"}""");
        assertEquals("Pâte à tartiner", f.name());
        assertEquals("Marque A", f.brand());
        assertEquals(CODE, f.barcode());
        assertEquals(500.0, f.kcal100());
        assertEquals(5.0, f.protein100());
        assertEquals(60.0, f.carbs100());
        assertEquals(25.2, f.fat100());
        assertEquals(15.0, f.servingG());
        assertEquals("15 g", f.servingLabel());
    }

    @Test
    void fallsBackToTheGenericName() {
        FoodDraft f = ok("""
            {"product_name":"Spread","nutriments":{"energy-kcal_100g":100,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""");
        assertEquals("Spread", f.name());
        assertNull(f.brand());
        assertNull(f.servingG());
    }

    @Test
    void convertsKilojoulesWhenKcalIsMissing() {
        FoodDraft f = ok("""
            {"product_name":"X","nutriments":{"energy_100g":1000,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""");
        assertEquals(239.0, f.kcal100()); // 1000 kJ / 4,184
        FoodDraft g = ok("""
            {"product_name":"X","nutriments":{"energy-kj_100g":418.4,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""");
        assertEquals(100.0, g.kcal100());
    }

    @Test
    void kcalWinsOverKilojoules() {
        FoodDraft f = ok("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":120,"energy_100g":9999,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""");
        assertEquals(120.0, f.kcal100());
    }

    @Test
    void readsNumbersGivenAsStringsWithAComma() {
        FoodDraft f = ok("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":"250,5","proteins_100g":"12,5","carbohydrates_100g":"3","fat_100g":"1.2"}}""");
        assertEquals(250.5, f.kcal100());
        assertEquals(12.5, f.protein100());
        assertEquals(1.2, f.fat100());
    }

    @Test
    void refusesWhenAMacroIsMissingInsteadOfInventingZero() {
        assertEquals("valeurs nutritionnelles incomplètes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":100,"carbohydrates_100g":1,"fat_100g":1}}"""));
        assertEquals("valeurs nutritionnelles incomplètes", incomplete("""
            {"product_name":"X","nutriments":{}}"""));
        assertEquals("valeurs nutritionnelles incomplètes", incomplete("""
            {"product_name":"X"}"""));
    }

    @Test
    void refusesUnreadableNumbers() {
        assertEquals("valeurs nutritionnelles incomplètes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":"beaucoup","proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}"""));
        assertEquals("valeurs nutritionnelles incomplètes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":"NaN","proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}"""));
    }

    @Test
    void refusesAbsurdValues() {
        // plus de 100 g de macros pour 100 g de produit
        assertEquals("valeurs nutritionnelles incohérentes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":300,"proteins_100g":50,"carbohydrates_100g":50,"fat_100g":50}}"""));
        // plus de 900 kcal / 100 g (le maximum physique est ~900 pour une huile pure)
        assertEquals("valeurs nutritionnelles incohérentes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":1200,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}"""));
        // valeurs négatives
        assertEquals("valeurs nutritionnelles incohérentes", incomplete("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":100,"proteins_100g":-1,"carbohydrates_100g":1,"fat_100g":1}}"""));
    }

    @Test
    void acceptsRoundingToleranceOnLabels() {
        // 100,4 g de macros : arrondis d'étiquette, accepté
        ok("""
            {"product_name":"X","nutriments":{"energy-kcal_100g":400,"proteins_100g":0.4,"carbohydrates_100g":0,"fat_100g":100}}""");
    }

    @Test
    void refusesAProductWithoutName() {
        assertEquals("le produit n'a pas de nom", incomplete("""
            {"product_name":"  ","nutriments":{"energy-kcal_100g":100,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}"""));
    }

    @Test
    void ignoresAnInvalidServing() {
        FoodDraft f = ok("""
            {"product_name":"X","serving_quantity":0,"serving_size":"0 g",
             "nutriments":{"energy-kcal_100g":100,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""");
        assertNull(f.servingG());
        assertNull(f.servingLabel());
    }

    @Test
    void dropsAnOverlongServingLabelButKeepsTheQuantity() {
        FoodDraft f = ok("""
            {"product_name":"X","serving_quantity":30,"serving_size":"%s",
             "nutriments":{"energy-kcal_100g":100,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}""".formatted("a".repeat(41)));
        assertEquals(30.0, f.servingG());
        assertNull(f.servingLabel());
    }

    @Test
    void truncatesOverlongNameAndBrand() {
        FoodDraft f = ok("""
            {"product_name":"%s","brands":"%s",
             "nutriments":{"energy-kcal_100g":100,"proteins_100g":1,"carbohydrates_100g":1,"fat_100g":1}}"""
                .formatted("n".repeat(200), "b".repeat(200)));
        assertEquals(120, f.name().length());
        assertEquals(80, f.brand().length());
    }
}
