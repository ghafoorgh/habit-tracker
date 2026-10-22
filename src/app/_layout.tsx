import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/vazirmatn';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fontFor } from '../components/Text';
import { HabitsProvider } from '../lib/store';

// The app is Persian-only, so lay everything out right-to-left. app.json's
// expo-localization plugin forces this natively; this covers Expo Go too
// (it applies from the next launch).
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

function withPersianFonts(theme: Theme): Theme {
  return {
    ...theme,
    fonts: {
      regular: { fontFamily: fontFor('400'), fontWeight: 'normal' },
      medium: { fontFamily: fontFor('500'), fontWeight: 'normal' },
      bold: { fontFamily: fontFor('700'), fontWeight: 'normal' },
      heavy: { fontFamily: fontFor('800'), fontWeight: 'normal' },
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
    Vazirmatn_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={withPersianFonts(scheme === 'dark' ? DarkTheme : DefaultTheme)}>
        <HabitsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="habit/new" options={{ title: 'عادت جدید', presentation: 'modal' }} />
            <Stack.Screen name="habit/[id]" options={{ title: 'ویرایش عادت', presentation: 'modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </HabitsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
