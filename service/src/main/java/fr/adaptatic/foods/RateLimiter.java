package fr.adaptatic.foods;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Fenêtre glissante par utilisateur, en mémoire (suffisant pour un seul service). */
public class RateLimiter {

    private final int max;
    private final Duration window;
    private final Clock clock;
    private final Map<UUID, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public RateLimiter(int max, Duration window, Clock clock) {
        this.max = max;
        this.window = window;
        this.clock = clock;
    }

    /** true si la requête est autorisée (et comptée). */
    public boolean tryAcquire(UUID user) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(window);
        Deque<Instant> q = hits.computeIfAbsent(user, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && !q.peekFirst().isAfter(cutoff)) q.pollFirst();
            if (q.size() >= max) return false;
            q.addLast(now);
            return true;
        }
    }
}
