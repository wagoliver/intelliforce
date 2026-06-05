"use client";

import { push } from "@/lib/api/push";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Pede permissão e inscreve o dispositivo no Web Push.
 * Deve ser chamado a partir de um gesto do usuário (iOS exige).
 * Lança Error("denied") se a permissão for negada.
 */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("unsupported");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");

  const reg = await navigator.serviceWorker.ready;
  const { public_key } = await push.publicKey();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    }));

  await push.subscribe(sub.toJSON());
}
