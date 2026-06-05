// Client de Web Push.
import { apiFetch } from "./client";

export interface PublicKeyOut {
  public_key: string;
}

export const push = {
  publicKey: () => apiFetch<PublicKeyOut>("/push/public-key"),
  subscribe: (sub: PushSubscriptionJSON) =>
    apiFetch<void>("/push/subscribe", { method: "POST", json: sub }),
  unsubscribe: (endpoint: string) =>
    apiFetch<void>("/push/unsubscribe", { method: "POST", json: { endpoint } }),
};
