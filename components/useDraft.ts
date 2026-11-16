"use client";

import { useState } from "react";
import type { SaveResult } from "@/app/actions";

/** Local draft of server data + dirty tracking; save() commits via a server action. */
export function useDraft<T>(initial: T, action: (v: T) => Promise<SaveResult>) {
  const [draft, setDraft] = useState<T>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== saved;
  const save = async () => {
    const r = await action(draft);
    if (r.ok) setSaved(JSON.stringify(draft));
    return r;
  };
  return { draft, setDraft, dirty, save };
}
