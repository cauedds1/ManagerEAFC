import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function scheduleMatchReminder(
  matchDate: string,
  opponent: string,
  tournament: string
): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const date = new Date(matchDate);
  date.setHours(date.getHours() - 2);

  if (date <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚽ Partida hoje!',
      body: `${tournament}: vs ${opponent} em 2 horas`,
      data: { type: 'match_reminder', opponent, tournament },
    },
    trigger: { date } as unknown as Notifications.SchedulableNotificationTriggerInput,
  });
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
