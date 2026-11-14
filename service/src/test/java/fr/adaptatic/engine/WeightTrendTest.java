package fr.adaptatic.engine;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class WeightTrendTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 14);

    @Test
    void emaSmoothsOutASingleSpike() {
        List<WeightEntry> l = new ArrayList<>();
        for (int i = 10; i >= 1; i--) l.add(new WeightEntry(TODAY.minusDays(i), 80));
        l.add(new WeightEntry(TODAY, 82)); // pic d'eau
        double ema = WeightTrend.ema(l);
        assertTrue(ema > 80 && ema < 80.8, "ema=" + ema);
    }

    @Test
    void regressionRecoversKnownSlope() {
        List<WeightEntry> l = new ArrayList<>();
        for (int i = 13; i >= 0; i--) l.add(new WeightEntry(TODAY.minusDays(i), 80 - 0.1 * (13 - i)));
        assertEquals(-0.7, WeightTrend.weeklyRateKg(l, TODAY).orElseThrow(), 1e-9);
    }

    @Test
    void notEnoughPointsGivesNoSlope() {
        List<WeightEntry> l = List.of(new WeightEntry(TODAY, 80), new WeightEntry(TODAY.minusDays(10), 81));
        assertTrue(WeightTrend.weeklyRateKg(l, TODAY).isEmpty());
    }

    @Test
    void pointsTooCloseTogetherGiveNoSlope() {
        List<WeightEntry> l = new ArrayList<>();
        for (int i = 0; i < 6; i++) l.add(new WeightEntry(TODAY.minusDays(i), 80));
        assertTrue(WeightTrend.weeklyRateKg(l, TODAY).isEmpty()); // étendue < 7 jours
    }
}
