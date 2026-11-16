import { readImage } from "@/lib/store";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function GET(_req: Request, ctx: { params: Promise<{ product: string; file: string }> }) {
  const { product, file } = await ctx.params;
  const buf = readImage(product, file);
  if (!buf) return new Response("Not found", { status: 404 });
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "no-store" },
  });
}
