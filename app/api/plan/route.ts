import { plan } from "@/lib/scan";

export const dynamic = "force-dynamic";

/** GET /api/plan[?all=1] — which groups to read this run, budgets and stop markers. */
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  return Response.json(await plan({ all }));
}
