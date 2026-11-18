import { revalidatePath } from "next/cache";
import { ingest, type IngestInput } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/ingest — body { run_id?, posts: Post[], meta? }. Accepts JSON or JSON Lines (one post per line). */
export async function POST(req: Request) {
  const raw = await req.text();
  let body: IngestInput;
  try {
    const t = raw.trim();
    body = t.startsWith("{") && !t.includes("\n{") ? JSON.parse(t) : { posts: t.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) };
    if (!Array.isArray(body.posts)) throw new Error("posts must be an array");
  } catch (e) {
    return Response.json({ error: `bad body: ${(e as Error).message}` }, { status: 400 });
  }
  const out = await ingest(body);
  revalidatePath("/", "layout");
  return Response.json(out);
}
