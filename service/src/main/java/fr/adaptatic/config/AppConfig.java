package fr.adaptatic.config;

import fr.adaptatic.foods.RateLimiter;
import java.time.Clock;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** Au plus 20 recherches de code-barres par minute et par utilisateur (protège Open Food Facts et le service). */
    @Bean
    RateLimiter barcodeRateLimiter(Clock clock) {
        return new RateLimiter(20, Duration.ofMinutes(1), clock);
    }
}
