package fr.adaptatic.engine;

import static org.junit.jupiter.api.Assertions.*;

import fr.adaptatic.engine.EventSpread.CalorieEvent;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class EventSpreadTest {

    private static final LocalDate EVENT_DAY = LocalDate.of(2026, 11, 14);

    @Test
    void spreadDaysIsAtLeastMinimumEvenForTinyExcess() {
        assertEquals(EventSpread.MIN_SPREAD_DAYS, EventSpread.spreadDays(10));
    }

    @Test
    void spreadDaysIsAtMostMaximumEvenForHugeExcess() {
        assertEquals(EventSpread.MAX_SPREAD_DAYS, EventSpread.spreadDays(100_000));
    }

    @Test
    void spreadDaysGrowsWithExcess() {
        assertEquals(3, EventSpread.spreadDays(900));  // ceil(900/300) = 3
        assertEquals(4, EventSpread.spreadDays(901));  // ceil(901/300) = 4
    }

    @Test
    void noOffsetBeforeOrOnEventDay() {
        List<CalorieEvent> events = List.of(new CalorieEvent(EVENT_DAY, 900));
        assertEquals(0, EventSpread.offsetForDate(events, EVENT_DAY.minusDays(1)));
        assertEquals(0, EventSpread.offsetForDate(events, EVENT_DAY));
    }

    @Test
    void offsetAppliesTheDayAfterUntilWindowEnds() {
        List<CalorieEvent> events = List.of(new CalorieEvent(EVENT_DAY, 900)); // 3 jours -> 300/j
        assertEquals(-300, EventSpread.offsetForDate(events, EVENT_DAY.plusDays(1)));
        assertEquals(-300, EventSpread.offsetForDate(events, EVENT_DAY.plusDays(3)));
        assertEquals(0, EventSpread.offsetForDate(events, EVENT_DAY.plusDays(4)));
    }

    @Test
    void multipleEventsStackButStayCapped() {
        List<CalorieEvent> events = List.of(
                new CalorieEvent(EVENT_DAY, 900),
                new CalorieEvent(EVENT_DAY, 900));
        assertEquals(-EventSpread.MAX_DAILY_KCAL, EventSpread.offsetForDate(events, EVENT_DAY.plusDays(1)));
    }

    @Test
    void emptyEventListGivesNoOffset() {
        assertEquals(0, EventSpread.offsetForDate(List.of(), EVENT_DAY));
    }
}
