package fr.adaptatic.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.adaptatic.auth.AuthUnavailableException;
import fr.adaptatic.auth.UserAuthenticator;
import fr.adaptatic.config.CorsConfig;
import fr.adaptatic.foods.BarcodeService;
import fr.adaptatic.foods.BarcodeService.Outcome;
import fr.adaptatic.foods.RateLimiter;
import fr.adaptatic.foods.UpstreamException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FoodsController.class)
@Import(CorsConfig.class)
class FoodsControllerTest {

    private static final String URL = "/api/foods/barcode/3017620422003";
    private static final UUID USER = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired MockMvc mvc;
    @MockitoBean UserAuthenticator auth;
    @MockitoBean BarcodeService barcodes;
    @MockitoBean RateLimiter limiter;

    @BeforeEach
    void loggedInByDefault() {
        when(auth.authenticate("Bearer good")).thenReturn(Optional.of(USER));
        when(limiter.tryAcquire(USER)).thenReturn(true);
    }

    @Test
    void rejectsRequestsWithoutValidSession() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("unauthorized"));
        mvc.perform(get(URL).header("Authorization", "Bearer bad")).andExpect(status().isUnauthorized());
        verifyNoInteractions(barcodes, limiter);
    }

    @Test
    void reportsUnavailableWhenSessionCannotBeChecked() throws Exception {
        when(auth.authenticate("Bearer down")).thenThrow(new AuthUnavailableException("panne", null));
        mvc.perform(get(URL).header("Authorization", "Bearer down"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("unavailable"));
        verifyNoInteractions(barcodes);
    }

    @Test
    void rejectsMalformedBarcodes() throws Exception {
        for (String bad : new String[] {"123", "abcdefghij", "123456789012345", "30176204220x3"}) {
            mvc.perform(get("/api/foods/barcode/" + bad).header("Authorization", "Bearer good"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("invalid_barcode"));
        }
        verifyNoInteractions(barcodes);
    }

    @Test
    void throttlesTooManyLookups() throws Exception {
        when(limiter.tryAcquire(USER)).thenReturn(false);
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("rate_limited"));
        verifyNoInteractions(barcodes);
    }

    @Test
    void returnsTheFood() throws Exception {
        when(barcodes.lookup("3017620422003")).thenReturn(
                new Outcome.Found(new ObjectMapper().readTree("{\"id\":\"f1\",\"name\":\"Riz\",\"kcal_100\":130}"), false));
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.food.name").value("Riz"))
                .andExpect(jsonPath("$.food.kcal_100").value(130))
                .andExpect(jsonPath("$.cached").value(false));
    }

    @Test
    void unknownProductIs404() throws Exception {
        when(barcodes.lookup(anyString())).thenReturn(new Outcome.NotFound());
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    @Test
    void unusableProductIs422() throws Exception {
        when(barcodes.lookup(anyString())).thenReturn(new Outcome.Incomplete("valeurs nutritionnelles incomplètes"));
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("incomplete"));
    }

    @Test
    void openFoodFactsOutageIs502() throws Exception {
        when(barcodes.lookup(anyString())).thenThrow(new UpstreamException("panne", null));
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("upstream"));
    }

    @Test
    void answersCorsPreflightForTheWebApp() throws Exception {
        mvc.perform(options(URL)
                        .header("Origin", "http://localhost:8081")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
        verify(barcodes, never()).lookup(any());
    }
}
