import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import { useCareer } from '@/contexts/CareerContext';
import { Colors } from '@/constants/colors';
import { getWelcomeSeenKey } from './welcome';

export const WELCOME_SEEN_KEY = 'fc_welcome_seen';

async function getWelcomeSeen(userId?: string | number): Promise<boolean> {
  try {
    const key = getWelcomeSeenKey(userId);
    if (Platform.OS === 'web') {
      return !!localStorage.getItem(key);
    }
    const val = await SecureStore.getItemAsync(key);
    return !!val;
  } catch {
    return true;
  }
}

export default function Index() {
  const { user, isLoading } = useAuth();
  const { activeCareer } = useCareer();
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState(true);

  useEffect(() => {
    if (!user) {
      setWelcomeChecked(true);
      return;
    }
    getWelcomeSeen(user.id).then((seen) => {
      setWelcomeSeen(seen);
      setWelcomeChecked(true);
    });
  }, [user]);

  if (isLoading || !welcomeChecked) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!welcomeSeen) {
    return <Redirect href="/welcome" />;
  }

  if (!activeCareer) {
    return <Redirect href="/career-select" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
