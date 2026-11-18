// Shared by proxy.ts (edge-safe: Web Crypto only) and server code.
export const AUTH_COOKIE = "fb_auth";

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie value for a logged-in browser. Changes whenever APP_PASSWORD or AUTH_SECRET changes. */
export async function sessionToken() {
  const pw = process.env.APP_PASSWORD, secret = process.env.AUTH_SECRET;
  if (!pw || !secret) return null;
  return hmac(secret, `v1:${pw}`);
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const authConfigured = () => !!process.env.APP_PASSWORD && !!process.env.AUTH_SECRET;
