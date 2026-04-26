import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClubTheme } from '@/contexts/ClubThemeContext';
import { Colors } from '@/constants/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

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
            <TabIcon name="home" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="football" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Partidas',
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Elenco',
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="newspaper" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Notícias',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="menu" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Mais',
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Perfil',
        }}
      />
    </Tabs>
  );
}
