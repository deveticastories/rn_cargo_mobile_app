/**
 * cargo-backend has a single auth endpoint, `POST /auth/login`, returning a
 * 1-day Bearer JWT and the user. There is no logout/refresh/me endpoint, so
 * logging out only clears the token locally.
 */
import { api, ApiError } from "@/api/client";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { AuthUser } from "@/types";

interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: { id?: string; _id?: string; email: string; role?: unknown; name?: string };
}

/** The role's name, whether it comes as "Fin", { name: "Fin" } or ["Fin"]. */
export function roleName(role: unknown): string {
  if (typeof role === "string") return role.trim();
  if (Array.isArray(role)) return role.map(roleName).find(Boolean) ?? "";
  if (role && typeof role === "object") {
    const r = role as Record<string, unknown>;
    return roleName(r.name ?? r.roleName ?? r.role ?? r.title ?? "");
  }
  return role == null ? "" : String(role);
}

export async function loginRequest(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const { data } = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { email, password }, { skipAuth: true });
  if (!data.token || !data.user) throw new ApiError(data.message || "Invalid email or password.", 401);
  return {
    token: data.token,
    user: { id: data.user.id ?? data.user._id ?? "", email: data.user.email, role: roleName(data.user.role), name: data.user.name },
  };
}
