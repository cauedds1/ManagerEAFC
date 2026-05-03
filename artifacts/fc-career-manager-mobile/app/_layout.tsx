import { useEffect, useState } from 'react';
import { hydrateLocalCache } from '@/lib/localCache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, StyleSheet } from 'react-native';

import { queryClient, asyncStoragePersister } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { CareerProvider } from '@/contexts/CareerContext';
import { ClubThemeProvider } from '@/contexts/ClubThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
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
      <Stack.Screen
        name="transfers"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="injuries"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="financeiro"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="trophies"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="diretoria"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="rivais"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="sequencias"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="registrar-partida"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="nova-temporada"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="welcome"
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="configuracoes"
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

  const [cacheReady, setCacheReady] = useState(false);
  useEffect(() => {
    void hydrateLocalCache().finally(() => setCacheReady(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && cacheReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, cacheReady]);

  if ((!fontsLoaded && !fontError) || !cacheReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) =>
                query.state.status === 'success',
            },
          }}
        >
          <AuthProvider>
            <CareerProvider>
              <ClubThemeProvider>
                <KeyboardProvider>
                  <ErrorBoundary>
                    <View style={styles.root}>
                      <StatusBar style="light" />
                      <OfflineBanner />
                      <RootLayoutInner />
                    </View>
                  </ErrorBoundary>
                </KeyboardProvider>
              </ClubThemeProvider>
            </CareerProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
