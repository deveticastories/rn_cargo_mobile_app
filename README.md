# Cargo Admin — React Native (Expo)

Mobile port of the `next_js_cargo_admin_web_app` admin console. Talks to the same
**cargo-backend** API (`http://3.107.18.59/api`) and follows the light/dark mobile designs
(Sign in · Dashboard · Bookings · Booking detail · New booking · Containers · Finance · More).

**Stack:** Expo SDK 54 · TypeScript · React Navigation 7 (native stack + bottom tabs) ·
Redux Toolkit · Axios · AsyncStorage · lucide icons · Space Grotesk / JetBrains Mono.

## Run it

```bash
npm install
npx expo install --fix     # aligns native package versions with the installed Expo SDK
npx expo start             # press a (Android) / i (iOS), or scan with Expo Go
```

To point at another backend, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`
(use your computer's LAN IP, not `localhost`, when testing on a phone). Restart Expo after changing it.

The backend is plain HTTP, so `app.json` enables cleartext traffic on Android
(`expo-build-properties`) and an ATS exception on iOS. These apply to development/production
builds (`npx expo run:android`, EAS); Expo Go already allows HTTP.

## Project layout

```
App.tsx                      Providers: Redux → SafeArea → Theme; loads fonts, restores session
src/
  config/env.ts              API base URL, timeouts, retry delays
  api/
    client.ts                Axios instance: Bearer token, expiry short-circuit, session-error
                             detection, GET retries, ApiError normalisation
    endpoints.ts             Every cargo-backend path (ported from ApiConstants.ts)
  storage/authStorage.ts     AsyncStorage: token, user, last email, theme preference
  services/                  API calls + backend→app mapping (bookings, containers, finance,
                             auth, generic masters)
  store/
    index.ts                 configureStore; wipes data slices on logout/session expiry
    slices/                  auth · ui · bookings · containers · finance · masters
    selectors.ts             Booking stages, pipeline counts, container phases, invoice status
  navigation/                Root stack, bottom tabs with centre “+” button, More stack, types
  features/masters/config.ts Declarative config for Team, Customers, Stores, Country, Delivery,
                             Pickup, Pricing, Product, Fabric, Pickup assign, Pre-booking
  screens/                   auth · dashboard · bookings · containers · finance · more · masters
  components/                Txt, Card, Badge, Chip, Button, TextField, Segmented, SelectSheet…
  theme/                     Light/dark palettes, fonts, ThemeProvider
```

## How auth works

- `POST /auth/login` returns a 1-day JWT. It's kept in Redux, in the Axios client, and — when
  **Keep me signed in** is ticked — in AsyncStorage together with the user.
- On launch the stored session is restored if the token hasn't expired.
- A 401 (or cargo-backend's 400/403 "token expired" messages), or the token's `exp` passing while
  the app is open, signs the user out and shows *“Your session expired”* on the sign-in screen.
- Signing out clears AsyncStorage and every cached list in the store.

## What maps to what

| Web console                         | Mobile                                                  |
|-------------------------------------|---------------------------------------------------------|
| Dashboard                           | Home tab                                                |
| Booking, Ready to ship, Repacking   | Bookings tab (filters) + Booking detail actions         |
| Ready to stuff / Stuffing           | Booking detail → “Go to stuffing” → “Load into container” |
| Containers                          | Containers tab (At sea / Loading / Stuffed)             |
| Invoicing, Receipt entry, Expenses, Credit note | Finance (More → Finance)                    |
| Masters & Pickup assign / Pre-booking | More → grid / Operations (generic list + form)       |

Not ported (better on the web console): packing-list editing, invoice generation, PDF exports,
reports, creating containers.

## Notes

- Bookings require a Pickup Assign; like the web form, a new booking links to the newest pickup
  assign (for the chosen pickup partner, if one is picked).
- The Containers “Loading window” bar shows time elapsed toward the cut-off date (14-day window),
  since the backend doesn't track container capacity.
