package fr.adaptatic.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fr.adaptatic.RecomputeService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(value = WebhookController.class, properties = "adaptatic.webhook-secret=s3cret")
class WebhookControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean RecomputeService recompute;

    private static String body(String table, String userId) {
        return "{\"type\":\"INSERT\",\"table\":\"" + table + "\",\"record\":{\"user_id\":\"" + userId + "\"}}";
    }

    @Test
    void rejectsMissingSecret() throws Exception {
        mvc.perform(post("/webhooks/supabase").contentType(MediaType.APPLICATION_JSON)
                .content(body("weight_logs", UUID.randomUUID().toString())))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(recompute);
    }

    @Test
    void rejectsWrongSecret() throws Exception {
        mvc.perform(post("/webhooks/supabase").header("X-Webhook-Secret", "nope")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("weight_logs", UUID.randomUUID().toString())))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(recompute);
    }

    @Test
    void recomputesForValidWebhook() throws Exception {
        UUID id = UUID.randomUUID();
        when(recompute.recompute(id)).thenReturn(true);
        mvc.perform(post("/webhooks/supabase").header("X-Webhook-Secret", "s3cret")
                .contentType(MediaType.APPLICATION_JSON).content(body("weight_logs", id.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(true));
        verify(recompute).recompute(id);
    }

    @Test
    void rejectsUnknownTable() throws Exception {
        mvc.perform(post("/webhooks/supabase").header("X-Webhook-Secret", "s3cret")
                .contentType(MediaType.APPLICATION_JSON).content(body("secrets", UUID.randomUUID().toString())))
                .andExpect(status().isBadRequest());
        verify(recompute, never()).recompute(any());
    }

    @Test
    void rejectsInvalidUserId() throws Exception {
        mvc.perform(post("/webhooks/supabase").header("X-Webhook-Secret", "s3cret")
                .contentType(MediaType.APPLICATION_JSON).content(body("profiles", "pas-un-uuid")))
                .andExpect(status().isBadRequest());
    }
}
