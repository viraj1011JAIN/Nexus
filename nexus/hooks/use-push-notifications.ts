"use client";

/**
 * TASK-029 — usePushNotifications
 *
 * Registers SW, subscribes to Web Push, and exposes helpers for other components.
 *
 * Usage:
 *   const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
 */

import { useSyncExternalStore, useState, useEffect, useCallback } from "react";

// useSyncExternalStore is the React-canonical way to read browser-only globals
// with proper SSR safety (server snapshot returns false).
function getIsSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}
const noSubscribe = () => () => {};

export function usePushNotifications() {
  // isSupported is computed once on the client; server snapshot is always false.
  const isSupported = useSyncExternalStore(noSubscribe, getIsSupported, () => false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      setRegistration(reg);
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!registration) return;

    // Fetch server-side VAPID public key
    const res = await fetch("/api/push/send");
    if (!res.ok) { console.error("VAPID key unavailable"); return; }
    const { publicKey } = await res.json() as { publicKey: string };

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    setIsSubscribed(true);
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", { method: "DELETE" });
    }
    setIsSubscribed(false);
  }, [registration]);

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}

/** Convert a URL-safe base64 string to a Uint8Array (required by Web Push). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
