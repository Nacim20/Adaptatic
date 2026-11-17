package fr.adaptatic.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class SupabaseUserAuthenticatorTest {

    private static final UUID USER = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final SupabaseUserAuthenticator auth =
            new SupabaseUserAuthenticator("https://proj.supabase.test", "sb_publishable_x", builder);

    @Test
    void validTokenReturnsTheUserId() {
        server.expect(requestTo("https://proj.supabase.test/auth/v1/user"))
                .andExpect(header("apikey", "sb_publishable_x"))
                .andExpect(header("Authorization", "Bearer abc.def.ghi"))
                .andRespond(withSuccess("{\"id\":\"" + USER + "\",\"email\":\"a@b.c\"}", MediaType.APPLICATION_JSON));
        assertEquals(Optional.of(USER), auth.authenticate("Bearer abc.def.ghi"));
        server.verify();
    }

    @Test
    void bearerKeywordIsCaseInsensitive() {
        server.expect(requestTo("https://proj.supabase.test/auth/v1/user"))
                .andRespond(withSuccess("{\"id\":\"" + USER + "\"}", MediaType.APPLICATION_JSON));
        assertEquals(Optional.of(USER), auth.authenticate("bearer tok"));
    }

    @Test
    void rejectedTokenReturnsEmpty() {
        server.expect(requestTo("https://proj.supabase.test/auth/v1/user"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"invalid JWT\"}"));
        assertTrue(auth.authenticate("Bearer expire").isEmpty());
    }

    @Test
    void missingOrMalformedHeaderNeverCallsSupabase() {
        assertTrue(auth.authenticate(null).isEmpty());
        assertTrue(auth.authenticate("").isEmpty());
        assertTrue(auth.authenticate("Basic dXNlcjpwYXNz").isEmpty());
        assertTrue(auth.authenticate("Bearer    ").isEmpty());
        assertTrue(auth.authenticate("Bearer " + "x".repeat(5000)).isEmpty());
        server.verify(); // aucune requête attendue ni reçue
    }

    @Test
    void responseWithoutValidIdIsRejected() {
        server.expect(requestTo("https://proj.supabase.test/auth/v1/user"))
                .andRespond(withSuccess("{\"id\":\"pas-un-uuid\"}", MediaType.APPLICATION_JSON));
        assertTrue(auth.authenticate("Bearer tok").isEmpty());
    }

    @Test
    void supabaseOutageIsReportedAsUnavailableNotAsUnauthorized() {
        server.expect(requestTo("https://proj.supabase.test/auth/v1/user")).andRespond(withServerError());
        assertThrows(AuthUnavailableException.class, () -> auth.authenticate("Bearer tok"));
    }

    @Test
    void missingPublishableKeyIsReportedAsUnavailable() {
        SupabaseUserAuthenticator notConfigured =
                new SupabaseUserAuthenticator("https://proj.supabase.test", "", RestClient.builder());
        assertThrows(AuthUnavailableException.class, () -> notConfigured.authenticate("Bearer tok"));
    }
}
