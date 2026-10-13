"use client";

import { api } from "./client";

/** True inside a wallet app's built-in browser on a phone (Phantom, Solflare, Backpack). */
export function inWalletBrowser() {
  if (typeof window === "undefined") return false;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) return false;
  const w = window as unknown as Record<string, unknown>;
  const phantom = (w.phantom as { solana?: unknown } | undefined)?.solana ?? (w.solana as { isPhantom?: boolean } | undefined)?.isPhantom;
  return Boolean(phantom || w.solflare || w.backpack || w.glow);
}

export const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Mints a one-time link that carries the current session and opens it in the
 * system browser. On iOS the x-safari- scheme forces Safari out of a WKWebView.
 * Returns the plain https link so the caller can offer "copy" as a fallback.
 */
export async function openInSystemBrowser(): Promise<string> {
  const { url } = await api<{ url: string }>("/api/auth/handoff", { method: "POST" });
  const target = isIOS() ? url.replace(/^https:\/\//, "x-safari-https://") : url;
  window.location.href = target;
  return url;
}
