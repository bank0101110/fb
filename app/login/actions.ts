"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string; go?: string }, form: FormData): Promise<{ error?: string; go?: string }> {
  const pw = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { error: "ยังไม่ได้ตั้ง APP_PASSWORD" };
  if (!safeEqual(pw, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  const token = await sessionToken();
  (await cookies()).set(AUTH_COOKIE, token!, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60,
  });
  return { go: next.startsWith("/") && !next.startsWith("//") ? next : "/" };
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
