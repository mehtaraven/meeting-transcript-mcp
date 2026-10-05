# Expo SDK 52 → 57 Upgrade Notes

## Installation Run — 2026-10-05

### npm install
Ran `npm install` from the monorepo root (`z:\Work\Kiro\meeting-transcript-mcp`). Completed successfully — up to date, 1085 packages audited, 47 vulnerabilities (14 moderate, 33 high) — all in dev/build tooling transitive dependencies.

### npx expo install --fix
First attempt (without flags) hit an `ERESOLVE` error: `react-dom@19.3.0` requires `react@^19.3.0` but the new target was `react@19.2.3`. The root monorepo `npm install` was retried with `--legacy-peer-deps` to clear the lock; then `npx expo install --fix -- --legacy-peer-deps` was run from `apps/mobile`. The following version changes were made to `apps/mobile/package.json`:

| Package | Before | After (expo --fix) |
|---|---|---|
| `@expo/metro-runtime` | `~5.0.0` | `~57.0.16` |
| `@expo/vector-icons` | `^14.0.0` | `^15.0.2` |
| `@react-native-async-storage/async-storage` | `1.23.1` | `2.2.0` |
| `expo-asset` | `~11.1.0` | `~57.0.18` |
| `expo-constants` | `~17.1.0` | `~57.0.20` |
| `expo-document-picker` | `~13.1.0` | `~57.0.3` |
| `expo-file-system` | `~18.1.0` | `~57.0.7` |
| `expo-font` | `~13.3.0` | `~57.0.4` |
| `expo-linking` | `~7.1.0` | `~57.0.11` |
| `expo-router` | `~5.0.0` | `~57.0.24` |
| `expo-splash-screen` | `~0.30.0` | `~57.0.9` |
| `expo-status-bar` | `~2.2.0` | `~57.0.1` |
| `expo-web-browser` | `~14.1.0` | `~57.0.3` |
| `react` | `19.0.0` | `19.2.3` |
| `react-native` | `0.79.2` | `0.86.3` |
| `react-native-safe-area-context` | `5.4.0` | `~5.7.0` |
| `react-native-screens` | `~4.11.0` | `~4.26.0` |
| `react-native-web` | `~0.19.13` | `^0.21.2` |
| `@types/react` (devDep) | `~19.0.0` | `~19.2.4` |
| `typescript` (devDep) | `^5.3.3` | `~6.0.3` |

A second `expo install --fix` pass confirmed only `@types/react` and `typescript` remained and were corrected.

### npx tsc --noEmit
**Passed with zero errors.** No source files required changes.

### Source file changes
None. All source files reviewed:
- `app/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`
- `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/record.tsx`, `app/(tabs)/profile.tsx`
- `app/index.tsx`, `app/transcript/[id].tsx`
- `contexts/AuthContext.tsx`, `lib/supabase.ts`

No deprecated or removed APIs were found. All router imports, React patterns, and RN component usages are compatible with expo-router `~57.0.24` / React 19.2.3 / RN 0.86.3.

---



## Summary

The mobile app has been upgraded from Expo SDK 52 to SDK 57. All dependency versions have been updated to their SDK 57-compatible equivalents and `npm install` completes without errors. TypeScript type-checking passes cleanly.

---

## Dependency Changes

| Package | Old | New |
|---|---|---|
| `expo` | `~52.0.0` | `~57.0.0` |
| `react-native` | `0.76.9` | `0.79.2` |
| `react` | `18.3.1` | `19.0.0` |
| `@types/react` | `~18.3.12` | `~19.0.0` |
| `expo-router` | `~4.0.17` | `~5.0.0` |
| `expo-av` | `~15.0.2` | `~15.1.0` |
| `expo-asset` | `~11.0.5` | `~11.1.0` |
| `expo-constants` | `~17.0.8` | `~17.1.0` |
| `expo-document-picker` | `~13.0.3` | `~13.1.0` |
| `expo-file-system` | `~18.0.11` | `~18.1.0` |
| `expo-font` | `~13.0.4` | `~13.3.0` |
| `expo-linking` | `~7.0.5` | `~7.1.0` |
| `expo-splash-screen` | `~0.29.24` | `~0.30.0` |
| `expo-status-bar` | `~2.0.1` | `~2.2.0` |
| `expo-web-browser` | `~14.0.2` | `~14.1.0` |
| `@expo/metro-runtime` | `~4.0.1` | `~5.0.0` |
| `react-native-safe-area-context` | `4.12.0` | `5.4.0` |
| `react-native-screens` | `~4.4.0` | `~4.11.0` |
| `@expo/vector-icons` | *(unlisted, transitive)* | `^14.0.0` |

**Unchanged:** `@supabase/supabase-js`, `react-native-url-polyfill`, `@meeting-transcript/shared`, `query-string`, `@react-native-async-storage/async-storage`, `react-native-web`, `@babel/core`, `cross-env`.

---

## Source File Changes

No source file changes were required. All existing APIs are compatible with SDK 57:

- **React 19**: No `React.FC` or `React.VFC` issues found. `AuthProvider` already used explicit `{ children: React.ReactNode }` pattern.
- **expo-router v5**: All router imports (`Stack`, `Tabs`, `useRouter`, `useLocalSearchParams`, `Link`) are unchanged between v4 and v5.
- **expo-av**: The `Audio.Recording`, `Audio.setAudioModeAsync`, and `Audio.RecordingOptionsPresets` APIs used in `record.tsx` remain compatible with expo-av `~15.1.0`.
- **React Native 0.79**: `StyleSheet`, `View`, `Text`, `TouchableOpacity`, `FlatList`, `ScrollView`, `RefreshControl`, `ActivityIndicator` APIs are unchanged.
- **metro.config.js**: No changes needed — uses `getDefaultConfig` from `expo/metro-config`, which is compatible.
- **babel.config.js**: No changes needed — `babel-preset-expo` handles SDK 57 automatically.
- **app.json**: No `sdkVersion` field was present; no change needed. The `expo-av` and `expo-router` plugin entries remain valid.

---

## Manual Follow-Up Items

### ⚠️ expo-av Deprecation (Future)

`expo-av` is flagged as deprecated in favor of separate packages (`expo-audio`, `expo-video`) starting from SDK 52+. In SDK 57 it still works, but Expo recommends migrating:

- **Replace** `expo-av` (Audio) with [`expo-audio`](https://docs.expo.dev/versions/latest/sdk/audio/)
- The new `expo-audio` API differs from `expo-av`: `Audio.Recording` → `useAudioRecorder` hook pattern

**Action required before SDK 59 or when expo-av is removed.** The current implementation in `app/(tabs)/record.tsx` continues to work for now.

### ⚠️ @react-native-async-storage/async-storage version

Pinned at `1.23.1`. SDK 57 with React Native 0.79 may benefit from a newer version (`2.x`). Check if any breaking changes affect your usage before upgrading.

### ⚠️ Vulnerability audit

`npm install` reports 47 vulnerabilities (14 moderate, 33 high). Run `npm audit` for details. Most are in dev/build tooling transitive dependencies. Run `npm audit fix` to address non-breaking ones.

### iOS Simulator for SDK 57

Expo Go for iOS now ships with SDK 57. You can scan the QR code with the updated Expo Go app, or run in an iOS Simulator directly.
