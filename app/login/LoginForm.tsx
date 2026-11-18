"use client";

import { useActionState, useEffect } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  useEffect(() => {
    if (state.go) window.location.assign(state.go); // full load so the new cookie is used everywhere
  }, [state.go]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="label">รหัสผ่าน</span>
        <input name="password" type="password" autoComplete="current-password" required autoFocus className="field" />
      </label>
      {state.error && <p role="alert" className="text-sm text-danger-text">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending || !!state.go}>{pending || state.go ? "กำลังเข้า..." : "เข้าสู่ระบบ"}</button>
    </form>
  );
}
