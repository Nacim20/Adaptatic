package fr.adaptatic.foods;

import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenFoodFactsClientTest {

    private static final String UA = "Adaptatic-Test/1.0 (https://example.test)";
    private static final String CODE = "3017620422003";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final OpenFoodFactsClient client = new OpenFoodFactsClient("https://off.test", UA, builder);

    @Test
    void fetchesAProductAndIdentifiesTheApp() {
        server.expect(requestTo(startsWith("https://off.test/api/v2/product/" + CODE)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("User-Agent", UA))
                .andRespond(withSuccess("{\"code\":\"" + CODE + "\",\"status\":1,\"product\":{\"product_name\":\"Riz\"}}",
                        MediaType.APPLICATION_JSON));

        Optional<JsonNode> p = client.fetchProduct(CODE);

        assertTrue(p.isPresent());
        assertEquals("Riz", p.get().path("product_name").asText());
        server.verify();
    }

    @Test
    void asksOnlyForTheFieldsItNeeds() {
        server.expect(requestTo(startsWith("https://off.test/api/v2/product/" + CODE + "?fields=")))
                .andRespond(withSuccess("{\"status\":0}", MediaType.APPLICATION_JSON));
        client.fetchProduct(CODE);
        server.verify();
    }

    @Test
    void unknownProductWithStatusZero() {
        server.expect(requestTo(startsWith("https://off.test/")))
                .andRespond(withSuccess("{\"code\":\"" + CODE + "\",\"status\":0,\"status_verbose\":\"product not found\"}",
                        MediaType.APPLICATION_JSON));
        assertTrue(client.fetchProduct(CODE).isEmpty());
    }

    @Test
    void unknownProductWithHttp404() {
        server.expect(requestTo(startsWith("https://off.test/")))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"status\":0}"));
        assertTrue(client.fetchProduct(CODE).isEmpty());
    }

    @Test
    void serverErrorBecomesUpstreamException() {
        server.expect(requestTo(startsWith("https://off.test/"))).andRespond(withServerError());
        assertThrows(UpstreamException.class, () -> client.fetchProduct(CODE));
    }

    @Test
    void rateLimitingByOpenFoodFactsBecomesUpstreamException() {
        server.expect(requestTo(startsWith("https://off.test/")))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertThrows(UpstreamException.class, () -> client.fetchProduct(CODE));
    }
}
