package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;

/** Catalogue partagé d'aliments (foods.owner_id IS NULL). */
public interface FoodsStore {
    Optional<JsonNode> findSharedByBarcode(String barcode);

    /** Insère et renvoie la ligne créée. Lève DuplicateFoodException si le code-barres existe déjà. */
    JsonNode insertShared(FoodDraft draft);
}
