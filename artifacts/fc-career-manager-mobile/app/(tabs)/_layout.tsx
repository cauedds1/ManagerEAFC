import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { Colors } from '@/constants/colors';

export default function TabsLayout() {
  const theme = useClubTheme();
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.OS === 'web' ? 84 : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabBarHeight ?? (50 + insets.bottom),
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: Colors.mutedForeground,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size ?? 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football" size={size ?? 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Partidas',
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size ?? 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Elenco',
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size ?? 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Notícias',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size ?? 24} color={color} />
          ),
          tabBarAccessibilityLabel: 'Mais',
        }}
      />
    </Tabs>
  );
}
