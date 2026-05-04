import { apiFetch } from "./client";
import type { AuthResponse, User } from "./types";

export const auth = {
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch<AuthResponse>("/auth/register", { method: "POST", json: data }),

  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/auth/login", { method: "POST", json: data }),

  me: () => apiFetch<User>("/auth/me"),
};
