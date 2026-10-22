# Habit Tracker

A simple, offline habit tracker for iPhone and Android, built with [Expo](https://expo.dev) (SDK 58) and Expo Router.

## Features

- **Today view**: check off each habit for today, with a progress bar showing how many are done.
- **Last 7 days**: tap any dot to fill in or undo a past day.
- **Streaks**: current streak on every habit. A streak isn't broken until the day ends.
- **Stats**: current and best streak, 30-day completion rate, and a 15-week calendar heatmap for each habit.
- **Customise**: give each habit a name, emoji and color. Tap a habit to edit or delete it.
- Light and dark mode, haptic feedback, and everything is saved on the device (no account needed).

## Run it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. On your computer (Node 20+):
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app, or from inside Expo Go on Android.

## Build a standalone app

Use [EAS Build](https://docs.expo.dev/build/introduction/). You don't need Xcode or Android Studio:

```bash
npx eas-cli@latest build --platform ios      # or: --platform android / all
```

The bundle identifier and package name are set to `com.ghafoorgh.habittracker` in `app.json`. Change them before publishing if you like.

## Development

```bash
npm run typecheck   # TypeScript
npm test            # streak / date logic tests (Node's built-in test runner)
```

### Project layout

```
src/
  app/                 Expo Router screens
    _layout.tsx        root stack + data provider
    (tabs)/index.tsx   Today
    (tabs)/stats.tsx   Stats
    habit/new.tsx      add habit (modal)
    habit/[id].tsx     edit / delete habit (modal)
  components/          HabitRow, HabitForm, Heatmap, tab icons
  lib/
    dates.ts           local-date helpers
    habits.ts          streak & completion logic (pure, unit-tested)
    store.tsx          habits state + AsyncStorage persistence
    theme.ts           colors, habit palette, emoji list
```
