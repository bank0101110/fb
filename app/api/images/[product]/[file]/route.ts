import { readImage } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ product: string; file: string }> }) {
  const { product, file } = await ctx.params;
  const img = await readImage(product, file);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=3600" } });
}
