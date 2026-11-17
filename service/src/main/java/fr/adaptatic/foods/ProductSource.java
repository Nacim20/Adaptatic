package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;

/** Source externe de produits par code-barres (Open Food Facts). */
public interface ProductSource {
    /** Le produit brut, ou vide s'il n'existe pas. Lève UpstreamException si la source est en panne. */
    Optional<JsonNode> fetchProduct(String barcode);
}
