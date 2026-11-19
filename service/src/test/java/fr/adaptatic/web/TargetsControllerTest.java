package fr.adaptatic.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fr.adaptatic.RecomputeService;
import fr.adaptatic.auth.AuthUnavailableException;
import fr.adaptatic.auth.UserAuthenticator;
import fr.adaptatic.config.CorsConfig;
import fr.adaptatic.engine.AdaptiveState;
import fr.adaptatic.engine.Targets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TargetsController.class)
@Import(CorsConfig.class)
class TargetsControllerTest {

    private static final String URL = "/api/targets/forecast";
    private static final UUID USER = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired MockMvc mvc;
    @MockitoBean UserAuthenticator auth;
    @MockitoBean RecomputeService recompute;

    @BeforeEach
    void loggedInByDefault() {
        when(auth.authenticate("Bearer good")).thenReturn(Optional.of(USER));
    }

    private static Targets day(int kcal) {
        return new Targets(2000, kcal, 150, 200, 60, 80.0, null, AdaptiveState.fresh(LocalDate.of(2026, 11, 19)), 0, "note");
    }

    @Test
    void rejectsRequestsWithoutValidSession() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("unauthorized"));
        verifyNoInteractions(recompute);
    }

    @Test
    void reportsUnavailableWhenSessionCannotBeChecked() throws Exception {
        when(auth.authenticate("Bearer down")).thenThrow(new AuthUnavailableException("panne", null));
        mvc.perform(get(URL).header("Authorization", "Bearer down"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("unavailable"));
        verifyNoInteractions(recompute);
    }

    @Test
    void missingProfileOrWeightIs422() throws Exception {
        when(recompute.forecast(eq(USER), anyInt())).thenReturn(Optional.empty());
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("no_data"));
    }

    @Test
    void returnsSevenDaysByDefault() throws Exception {
        when(recompute.forecast(USER, 7)).thenReturn(Optional.of(List.of(
                new RecomputeService.ForecastDay(LocalDate.of(2026, 11, 19), day(2000)),
                new RecomputeService.ForecastDay(LocalDate.of(2026, 11, 20), day(1700)))));
        mvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days[0].date").value("2026-11-19"))
                .andExpect(jsonPath("$.days[0].caloriesKcal").value(2000))
                .andExpect(jsonPath("$.days[1].caloriesKcal").value(1700));
    }

    @Test
    void clampsDaysToASaneRange() throws Exception {
        when(recompute.forecast(USER, 14)).thenReturn(Optional.of(List.of()));
        mvc.perform(get(URL).header("Authorization", "Bearer good").param("days", "999"))
                .andExpect(status().isOk());
        verify(recompute).forecast(USER, 14);

        when(recompute.forecast(USER, 1)).thenReturn(Optional.of(List.of()));
        mvc.perform(get(URL).header("Authorization", "Bearer good").param("days", "-5"))
                .andExpect(status().isOk());
        verify(recompute).forecast(USER, 1);
    }

    @Test
    void answersCorsPreflightForTheWebApp() throws Exception {
        mvc.perform(options(URL)
                        .header("Origin", "http://localhost:8081")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
        verify(recompute, never()).forecast(any(), anyInt());
    }
}
