import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, StyleSheet } from 'react-native';

import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { CareerProvider } from '@/contexts/CareerContext';
import { ClubThemeProvider } from '@/contexts/ClubThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="career-select" />
      <Stack.Screen
        name="career-create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="match-detail"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CareerProvider>
              <ClubThemeProvider>
                <KeyboardProvider>
                  <ErrorBoundary>
                    <View style={styles.root}>
                      <StatusBar style="light" />
                      <RootLayoutInner />
                    </View>
                  </ErrorBoundary>
                </KeyboardProvider>
              </ClubThemeProvider>
            </CareerProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
