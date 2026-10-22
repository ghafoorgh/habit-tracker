import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HabitsProvider } from '../lib/store';

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <HabitsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="habit/new" options={{ title: 'New habit', presentation: 'modal' }} />
            <Stack.Screen name="habit/[id]" options={{ title: 'Edit habit', presentation: 'modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </HabitsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
