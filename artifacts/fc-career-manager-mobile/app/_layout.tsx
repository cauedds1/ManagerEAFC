import { useEffect, useRef, useState } from 'react';
import { hydrateLocalCache } from '@/lib/localCache';
import { loadPersistedLang } from '@/lib/i18n';
import { loadSoundPreference } from '@/lib/notificationSound';
import { ToastProvider } from '@/components/Toast';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/contexts/AuthContext';
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

/**
 * Maps an inbound URL (custom scheme `fccareer://...` or universal link
 * https://fccareer.app/...) to an in-app route. Returns null when the URL
 * does not match any known route.
 *
 * Supported routes:
 *   /                       -> /(tabs)
 *   /career-select          -> /career-select
 *   /community              -> /(tabs)/news
 *   /post/<id>              -> /(tabs)/news (we surface news; post detail TBD)
 *   /profile/<id>           -> /(tabs)/perfil
 *   /season/<id>/summary    -> /(tabs)/index
 *   /checkout/(success|cancel|billing) -> /checkout/<sub>
 */
/**
 * Returns whether a route requires an authenticated user.
 */
function routeRequiresAuth(route: string): boolean {
  if (route.startsWith('/(auth)')) return false;
  if (route === '/welcome') return false;
  return true;
}

function urlToRoute(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // For custom-scheme URLs like `fccareer://checkout/success`, Expo parses
    // hostname='checkout' and path='success'. For universal links like
    // `https://fccareer.app/checkout/success`, hostname is the domain and
    // path is `checkout/success`. Normalize by combining when the hostname
    // is not a known web domain.
    const host = parsed.hostname ?? '';
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    const isWebHost = host === 'fccareer.app' || host === 'www.fccareer.app';
    const combined = (!isWebHost && host ? `${host}/${path}` : path).replace(/\/+$/g, '');
    if (!combined) return '/(tabs)';
    const segs = combined.split('/').filter(Boolean);
    const [a, b, c] = segs;
    if (a === 'career-select') return '/career-select';
    if (a === 'welcome') return '/welcome';
    if (a === 'community' || a === 'feed') return '/(tabs)/news';
    if (a === 'post' && b) return '/(tabs)/news';
    if (a === 'profile' && b) return '/(tabs)/perfil';
    if (a === 'season' && b && c === 'summary') return '/(tabs)';
    if (a === 'checkout' && b) {
      if (b === 'success' || b === 'cancel' || b === 'billing') return `/checkout/${b}`;
    }
    return '/(tabs)';
  } catch {
    return null;
  }
}

function DeepLinkRouter() {
  const { user, isLoading: loading } = useAuth();
  const pendingUrlRef = useRef<string | null>(null);
  const initialResolvedRef = useRef(false);
  const initialDrainedRef = useRef(false);

  // Resolve initial URL once. We do not gate on `loading` here, so a slow
  // `getInitialURL()` cannot be lost by the auth gate completing first.
  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      if (url) pendingUrlRef.current = url;
      initialResolvedRef.current = true;
    }).catch(() => {
      initialResolvedRef.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // Warm-start URLs (app already running). Auth-aware: queue if loading.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (loading || !initialDrainedRef.current) {
        pendingUrlRef.current = url;
        return;
      }
      const route = urlToRoute(url);
      if (!route) return;
      if (routeRequiresAuth(route) && !user) {
        pendingUrlRef.current = url; // re-queue until login
        return;
      }
      router.push(route as never);
    });
    return () => sub.remove();
  }, [loading, user]);

  // Drain pending URL once both: auth state is ready AND initial URL fetch is done.
  useEffect(() => {
    if (loading || !initialResolvedRef.current) return;
    const url = pendingUrlRef.current;
    if (!url) { initialDrainedRef.current = true; return; }
    const route = urlToRoute(url);
    if (!route) { initialDrainedRef.current = true; pendingUrlRef.current = null; return; }
    if (routeRequiresAuth(route) && !user) {
      // Keep pending; will be drained on login (when `user` becomes truthy).
      return;
    }
    const t = setTimeout(() => router.push(route as never), 0);
    initialDrainedRef.current = true;
    pendingUrlRef.current = null;
    return () => clearTimeout(t);
  }, [loading, user]);

  return null;
}

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
      <Stack.Screen
        name="bug-report"
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
    void Promise.all([
      hydrateLocalCache(),
      loadPersistedLang(),
      loadSoundPreference(),
    ]).finally(() => setCacheReady(true));
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
                <ToastProvider>
                  <KeyboardProvider>
                    <ErrorBoundary>
                      <View style={styles.root}>
                        <StatusBar style="light" />
                        <OfflineBanner />
                        <DeepLinkRouter />
                        <RootLayoutInner />
                      </View>
                    </ErrorBoundary>
                  </KeyboardProvider>
                </ToastProvider>
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
