import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { checkInMessage } from './checkIn';
import { MealEntry, NutritionTargets } from './types';

/**
 * Deux points dans la journée, pas plus : "est-ce que mon programme du jour est respecté ?",
 * pas un rappel de pesée (le rythme de pesée reste au choix de l'utilisateur, réglé ailleurs).
 */
const CHECK_IN_HOURS = [13, 20];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Les rappels planifiés ne marchent pas sur web (pas de support natif de notifications différées). */
export const notificationsSupported = Platform.OS !== 'web';

async function hasPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Reprogramme les rappels restants du jour avec l'état actuel du journal. Le contenu reflète
 * la situation au moment où l'app a été ouverte, pas en temps réel : si rien n'est réouvert
 * avant l'heure du rappel, le message peut être dépassé (limite assumée, voir docs/algorithm.md).
 */
export async function scheduleTodayCheckIns(entries: MealEntry[], targets: NutritionTargets | null) {
  if (!notificationsSupported || !(await hasPermission())) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  for (const hour of CHECK_IN_HOURS) {
    const when = new Date(now);
    when.setHours(hour, 0, 0, 0);
    if (when <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: { title: 'Ton programme du jour', body: checkInMessage(entries, targets) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}
