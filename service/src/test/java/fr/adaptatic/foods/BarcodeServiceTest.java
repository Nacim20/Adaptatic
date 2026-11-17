package fr.adaptatic.foods;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.adaptatic.foods.BarcodeService.Outcome;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class BarcodeServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String CODE = "3017620422003";
    private static final String GOOD_PRODUCT = """
        {"product_name":"Riz","nutriments":{"energy-kcal_100g":130,"proteins_100g":2.7,"carbohydrates_100g":28,"fat_100g":0.3}}""";

    static JsonNode json(String s) {
        try {
            return JSON.readTree(s);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static class FakeStore implements FoodsStore {
        Optional<JsonNode> existing = Optional.empty();
        boolean duplicateOnInsert;
        final List<FoodDraft> inserted = new ArrayList<>();

        @Override public Optional<JsonNode> findSharedByBarcode(String barcode) { return existing; }

        @Override public JsonNode insertShared(FoodDraft d) {
            if (duplicateOnInsert) {
                existing = Optional.of(json("{\"id\":\"autre\",\"name\":\"" + d.name() + "\"}"));
                throw new DuplicateFoodException();
            }
            inserted.add(d);
            return json("{\"id\":\"nouveau\",\"name\":\"" + d.name() + "\"}");
        }
    }

    static class FakeSource implements ProductSource {
        Optional<JsonNode> product = Optional.empty();
        boolean down;
        int calls;

        @Override public Optional<JsonNode> fetchProduct(String barcode) {
            calls++;
            if (down) throw new UpstreamException("panne", null);
            return product;
        }
    }

    private final FakeStore store = new FakeStore();
    private final FakeSource source = new FakeSource();
    private final BarcodeService service = new BarcodeService(store, source);

    @Test
    void sharedCatalogHitNeverCallsOpenFoodFacts() {
        store.existing = Optional.of(json("{\"id\":\"deja\",\"name\":\"Riz\"}"));
        Outcome o = service.lookup(CODE);
        Outcome.Found f = assertInstanceOf(Outcome.Found.class, o);
        assertTrue(f.cached());
        assertEquals("deja", f.food().get("id").asText());
        assertEquals(0, source.calls);
    }

    @Test
    void unknownLocallyIsFetchedStoredAndReturned() {
        source.product = Optional.of(json(GOOD_PRODUCT));
        Outcome.Found f = assertInstanceOf(Outcome.Found.class, service.lookup(CODE));
        assertFalse(f.cached());
        assertEquals("nouveau", f.food().get("id").asText());
        assertEquals(1, store.inserted.size());
        assertEquals(CODE, store.inserted.get(0).barcode());
        assertEquals(130.0, store.inserted.get(0).kcal100());
    }

    @Test
    void productAbsentFromOpenFoodFacts() {
        assertInstanceOf(Outcome.NotFound.class, service.lookup(CODE));
        assertTrue(store.inserted.isEmpty());
    }

    @Test
    void unusableProductIsNeverStored() {
        source.product = Optional.of(json("{\"product_name\":\"Mystère\",\"nutriments\":{}}"));
        Outcome.Incomplete i = assertInstanceOf(Outcome.Incomplete.class, service.lookup(CODE));
        assertFalse(i.reason().isBlank());
        assertTrue(store.inserted.isEmpty());
    }

    @Test
    void concurrentInsertReturnsTheExistingRow() {
        source.product = Optional.of(json(GOOD_PRODUCT));
        store.duplicateOnInsert = true;
        Outcome.Found f = assertInstanceOf(Outcome.Found.class, service.lookup(CODE));
        assertTrue(f.cached());
        assertEquals("autre", f.food().get("id").asText());
    }

    @Test
    void upstreamFailurePropagatesWhenNotCached() {
        source.down = true;
        assertThrows(UpstreamException.class, () -> service.lookup(CODE));
    }

    @Test
    void upstreamFailureDoesNotMatterWhenCached() {
        source.down = true;
        store.existing = Optional.of(json("{\"id\":\"deja\"}"));
        assertInstanceOf(Outcome.Found.class, service.lookup(CODE));
    }
}
