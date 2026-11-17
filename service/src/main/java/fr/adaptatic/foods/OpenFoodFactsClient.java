package fr.adaptatic.foods;

import com.fasterxml.jackson.databind.JsonNode;
import fr.adaptatic.config.AppProperties;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Client Open Food Facts (API v2). Envoie un User-Agent d'application, ne demande que les champs
 * utiles. Licence des données : ODbL, attribution affichée dans l'app.
 */
@Component
public class OpenFoodFactsClient implements ProductSource {

    private static final String FIELDS =
            "code,product_name,product_name_fr,brands,nutriments,serving_quantity,serving_size";

    private final RestClient http;

    @Autowired
    public OpenFoodFactsClient(AppProperties props) {
        this(props.offBaseUrl(), props.offUserAgent(), RestClient.builder()
                .requestFactory(timeouts()));
    }

    OpenFoodFactsClient(String baseUrl, String userAgent, RestClient.Builder builder) {
        this.http = builder.baseUrl(baseUrl).defaultHeader(HttpHeaders.USER_AGENT, userAgent).build();
    }

    private static SimpleClientHttpRequestFactory timeouts() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5_000);
        f.setReadTimeout(8_000);
        return f;
    }

    @Override
    public Optional<JsonNode> fetchProduct(String barcode) {
        try {
            JsonNode body = http.get()
                    .uri("/api/v2/product/{code}?fields=" + FIELDS, barcode)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(JsonNode.class);
            if (body == null || body.path("status").asInt(0) != 1 || !body.path("product").isObject()) {
                return Optional.empty();
            }
            return Optional.of(body.path("product"));
        } catch (HttpClientErrorException.NotFound e) {
            return Optional.empty();
        } catch (RestClientException e) {
            throw new UpstreamException("Open Food Facts indisponible", e);
        }
    }
}
