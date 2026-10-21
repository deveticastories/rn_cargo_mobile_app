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
  user?: { _id: string; email: string; role: string; name?: string };
}

export async function loginRequest(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const { data } = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { email, password }, { skipAuth: true });
  if (!data.token || !data.user) throw new ApiError(data.message || "Invalid email or password.", 401);
  return {
    token: data.token,
    user: { id: data.user._id, email: data.user.email, role: data.user.role, name: data.user.name },
  };
}
