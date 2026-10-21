/**
 * Runtime configuration. `EXPO_PUBLIC_*` variables are inlined by Expo at
 * build time (see `.env.example`). The fallback is the same cargo-backend
 * server the Next.js web app proxies to.
 *
 * The backend only speaks plain HTTP, which is why `app.json` enables
 * cleartext traffic on Android and an ATS exception on iOS.
 */
// export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://3.107.18.59/api";
export const API_BASE_URL = "http://3.107.18.59/api";

export const READ_TIMEOUT_MS = 25_000;
export const WRITE_TIMEOUT_MS = 30_000;
/** Back-off before each retry of a failed GET. Writes are never retried. */
export const RETRY_DELAYS_MS = [800, 2_000];
