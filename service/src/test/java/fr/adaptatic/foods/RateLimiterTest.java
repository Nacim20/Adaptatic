package fr.adaptatic.foods;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-17T10:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final RateLimiter limiter = new RateLimiter(3, Duration.ofMinutes(1), clock);

    @Test
    void blocksAfterTheLimitWithinTheWindow() {
        UUID u = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(u));
        assertTrue(limiter.tryAcquire(u));
        assertTrue(limiter.tryAcquire(u));
        assertFalse(limiter.tryAcquire(u));
    }

    @Test
    void allowsAgainOnceTheWindowHasPassed() {
        UUID u = UUID.randomUUID();
        for (int i = 0; i < 3; i++) assertTrue(limiter.tryAcquire(u));
        assertFalse(limiter.tryAcquire(u));
        clock.now = clock.now.plusSeconds(61);
        assertTrue(limiter.tryAcquire(u));
    }

    @Test
    void usersAreIndependent() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        for (int i = 0; i < 3; i++) assertTrue(limiter.tryAcquire(a));
        assertFalse(limiter.tryAcquire(a));
        assertTrue(limiter.tryAcquire(b));
    }
}
