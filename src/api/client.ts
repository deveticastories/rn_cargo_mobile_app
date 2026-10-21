/**
 * Axios instance for cargo-backend, with the same behaviour as the web app's
 * `httpClient.ts`:
 *  - attaches `Authorization: Bearer <jwt>` (token held in memory, persisted by authStorage)
 *  - short-circuits requests when the token has already expired
 *  - detects cargo-backend's session errors (401, or 400/403 with its token messages)
 *    and notifies the store so the user is sent back to sign in
 *  - retries GETs on network errors / 408 / 429 / 5xx gateway errors
 *  - turns every failure into an `ApiError` with a human message
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, READ_TIMEOUT_MS, RETRY_DELAYS_MS, WRITE_TIMEOUT_MS } from "@/config/env";
import { isTokenValid } from "@/utils/jwt";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Set for the login call — no token to attach, and its 401 must not end a session. */
    skipAuth?: boolean;
    /** Internal retry counter for GETs. */
    retryCount?: number;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const NETWORK_ERROR_STATUS = 0;
const RETRYABLE_STATUSES = new Set([NETWORK_ERROR_STATUS, 408, 429, 502, 503, 504]);
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const SESSION_ERROR_MESSAGES = new Set([
  "Unauthorized. Please login",
  "Invalid token. Please login again",
  "Token has expired. Please login again",
]);

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Wired up once by the store (see `src/store/index.ts`) — avoids an import cycle. */
export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

function notifySessionExpired() {
  if (!accessToken) return;
  accessToken = null;
  sessionExpiredHandler?.();
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: READ_TIMEOUT_MS,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get") config.timeout = WRITE_TIMEOUT_MS;
  if (!config.skipAuth) {
    if (!isTokenValid(accessToken)) {
      notifySessionExpired();
      return Promise.reject(new ApiError(SESSION_EXPIRED_MESSAGE, 401));
    }
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isSessionError(status: number, message: string): boolean {
  if (status === 401) return true;
  return (status === 400 || status === 403) && SESSION_ERROR_MESSAGES.has(message);
}

function toApiError(error: AxiosError<{ message?: string }>): ApiError {
  if (!error.response) {
    const timedOut = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return new ApiError(
      timedOut
        ? "The server is taking too long to respond. Please try again."
        : "Couldn't reach the server. Check your connection and try again.",
      NETWORK_ERROR_STATUS
    );
  }
  const { status, data } = error.response;
  if (data?.message) return new ApiError(data.message, status);
  if (status >= 500) return new ApiError("The server ran into a problem. Please try again in a moment.", status);
  return new ApiError(`Request failed (${status}).`, status);
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (error instanceof ApiError) throw error;
    if (!axios.isAxiosError(error)) throw new ApiError("Something went wrong. Please try again.", NETWORK_ERROR_STATUS);

    const apiError = toApiError(error as AxiosError<{ message?: string }>);
    const config = error.config;

    if (config && !config.skipAuth && isSessionError(apiError.status, apiError.message)) {
      notifySessionExpired();
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
    }

    const isRead = (config?.method ?? "get").toLowerCase() === "get";
    const attempt = config?.retryCount ?? 0;
    if (config && isRead && RETRYABLE_STATUSES.has(apiError.status) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      config.retryCount = attempt + 1;
      return api.request(config);
    }
    throw apiError;
  }
);

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}
