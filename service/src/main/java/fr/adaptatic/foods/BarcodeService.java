package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Code-barres → aliment : catalogue partagé d'abord (cache), Open Food Facts ensuite. */
@Service
public class BarcodeService {

    public sealed interface Outcome {
        record Found(JsonNode food, boolean cached) implements Outcome { }
        record NotFound() implements Outcome { }
        record Incomplete(String reason) implements Outcome { }
    }

    private final FoodsStore store;
    private final ProductSource source;

    public BarcodeService(FoodsStore store, ProductSource source) {
        this.store = store;
        this.source = source;
    }

    /** Lève UpstreamException si Open Food Facts est en panne (et que le produit n'était pas en cache). */
    public Outcome lookup(String barcode) {
        Optional<JsonNode> cached = store.findSharedByBarcode(barcode);
        if (cached.isPresent()) return new Outcome.Found(cached.get(), true);

        Optional<JsonNode> product = source.fetchProduct(barcode);
        if (product.isEmpty()) return new Outcome.NotFound();

        return switch (OffProductMapper.map(barcode, product.get())) {
            case OffProductMapper.Result.Incomplete i -> new Outcome.Incomplete(i.reason());
            case OffProductMapper.Result.Ok ok -> save(ok.food());
        };
    }

    private Outcome save(FoodDraft draft) {
        try {
            return new Outcome.Found(store.insertShared(draft), false);
        } catch (DuplicateFoodException e) {
            // Un autre utilisateur l'a enregistré entre-temps : on renvoie la version existante.
            return store.findSharedByBarcode(draft.barcode())
                    .<Outcome>map(f -> new Outcome.Found(f, true))
                    .orElseThrow(() -> e);
        }
    }
}
