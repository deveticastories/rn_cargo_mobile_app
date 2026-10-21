/**
 * Decodes (never verifies — the app has no secret) a JWT payload so the app
 * can tell when the 1-day cargo-backend token has expired without a round trip.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Decode(input: string): string {
  const str = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const ch of str) {
    const value = B64.indexOf(ch);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  // Payloads may contain UTF-8 (e.g. names); turn the byte string back into text.
  try {
    return decodeURIComponent(
      output
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return output;
  }
}

export interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(base64Decode(part)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  // A token without `exp` can't be judged locally — let the server decide.
  if (!payload) return false;
  if (!payload.exp) return true;
  return payload.exp * 1000 > Date.now();
}

export function msUntilExpiry(token: string | null | undefined): number {
  if (!token) return 0;
  const exp = decodeJwtPayload(token)?.exp;
  if (!exp) return Number.POSITIVE_INFINITY;
  return Math.max(0, exp * 1000 - Date.now());
}
