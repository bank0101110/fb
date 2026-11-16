#!/usr/bin/env python3
"""fbscan — bookkeeping for the Facebook group product search.

Claude does the browsing and judging; this script does everything deterministic:
  plan    -> which groups are due this run, post budget, stop markers
  ingest  -> merge a run's posts.jsonl into state/data, write new matches CSV
  report  -> market popularity summary from data/market_log.jsonl

Stdlib only. Root = parent folder of scripts/ (override with --root).
"""
import argparse, csv, json, os, statistics, sys
from datetime import datetime, timedelta, timezone

TZ = timezone(timedelta(hours=7))


def now():
    return datetime.now(TZ)


def parse_dt(s):
    if not s:
        return None
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=TZ)


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def read_jsonl(path):
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8-sig") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError as e:
                    sys.exit(f"{path}:{i}: bad JSON: {e}")
    return out


def append_jsonl(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def write_csv(path, header, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


class Ctx:
    def __init__(self, root):
        self.root = root
        p = lambda *a: os.path.join(root, *a)
        self.cfg = load_json(p("config.json"), {})
        self.groups = load_json(p("groups.json"), [])
        self.wanted = load_json(p("wanted.json"), [])
        self.market = load_json(p("market.json"), {"discover": True, "track": []})
        self.gstate_path = p("state", "groups_state.json")
        self.seen_path = p("state", "seen_posts.json")
        self.log_path = p("data", "market_log.jsonl")
        self.gstate = load_json(self.gstate_path, {})
        self.seen = load_json(self.seen_path, {})
        self.p = p


# ---------------------------------------------------------------- plan
def group_tier(cfg, st):
    if st.get("runs", 0) < cfg.get("new_group_free_runs", 3):
        return "A", 0, None
    hit = (st.get("matches", 0) + 1) / (st.get("posts_read", 0) + 20)  # smoothed
    for t in sorted(cfg["group_tiers"], key=lambda t: -t["min_hit_rate"]):
        if hit >= t["min_hit_rate"]:
            return t["tier"], t["interval_hours"], hit
    t = cfg["group_tiers"][-1]
    return t["tier"], t["interval_hours"], hit


def chrono_url(url):
    url = url.rstrip("/")
    return url + "/?sorting_setting=CHRONOLOGICAL"


def cmd_plan(ctx, args):
    cfg, t = ctx.cfg, now()
    active = [w for w in ctx.wanted if w.get("enabled", True)]
    due, skipped = [], []
    for g in ctx.groups:
        if not g.get("enabled", True):
            continue
        st = ctx.gstate.get(g["id"], {})
        tier, interval, hit = group_tier(cfg, st)
        last = parse_dt(st.get("last_read_at"))
        next_due = last + timedelta(hours=interval) if last else None
        prods = [w["id"] for w in active
                 if w.get("groups", "all") == "all" or g["id"] in w["groups"]]
        info = {"id": g["id"], "tier": tier, "hit_rate": round(hit, 4) if hit else None,
                "posts_per_day": st.get("posts_per_day")}
        if next_due and t < next_due and not args.all:
            skipped.append({**info, "next_due": next_due.isoformat(timespec="minutes")})
            continue
        weight = {"A": 3, "B": 2, "C": 1}.get(tier, 1)
        due.append({**info, "weight": weight, "url": g["url"],
                    "feed_url": chrono_url(g["url"]), "mode": g.get("mode", "feed"),
                    "products": prods,
                    "stop_at_post_ids": st.get("recent_post_ids", [])[:30],
                    "keywords": sorted({k for w in active if w["id"] in prods
                                        for k in w.get("keywords", [])})})
    # split budget by weight
    budget = cfg["run_post_budget"]
    wsum = sum(d["weight"] for d in due) or 1
    for d in due:
        n = round(budget * d["weight"] / wsum)
        d["max_posts"] = max(cfg["per_group_min_posts"], min(cfg["per_group_max_posts"], n))
        del d["weight"]
    max_age = cfg["max_post_age_days"]
    if active:
        max_age = max([w.get("max_post_age_days") or max_age for w in active] + [max_age])
    plan = {
        "run_id": t.strftime("%Y%m%d-%H%M"),
        "cutoff_posted_after": (t - timedelta(days=max_age)).isoformat(timespec="minutes"),
        "stop_after_consecutive_seen": cfg["stop_after_consecutive_seen"],
        "active_products": [w["id"] for w in active],
        "due_groups": due,
        "skipped_groups": skipped,
    }
    print(json.dumps(plan, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------- ingest
def cmd_ingest(ctx, args):
    cfg, t = ctx.cfg, now()
    posts = read_jsonl(args.posts)
    meta = load_json(args.meta, {}) if args.meta else {}
    run_id = args.run_id or os.path.basename(os.path.dirname(os.path.abspath(args.posts)))
    wanted = {w["id"]: w for w in ctx.wanted}
    min_fit, max_res = cfg["min_fit"], cfg["max_results_per_product"]

    new_log, cand, per_group = [], {}, {}
    for p in posts:
        pid = str(p["post_id"])
        g = p["group"]
        pg = per_group.setdefault(g, {"n": 0, "new": 0, "matched": 0, "ids": [], "newest": None})
        pg["n"] += 1
        pg["ids"].append(pid)
        pt = parse_dt(p.get("posted_at"))
        if pt and (pg["newest"] is None or pt > pg["newest"]):
            pg["newest"] = pt
        prev = ctx.seen.get(pid)
        if prev is None:
            pg["new"] += 1
            ctx.seen[pid] = {"group": g, "url": p.get("url"), "posted_at": p.get("posted_at"),
                             "first_seen": t.isoformat(timespec="minutes"),
                             "kind": p.get("kind"), "items": p.get("items", []),
                             "reported": [], "sold_at": None}
            new_log.append({**p, "post_id": pid, "seen_at": t.isoformat(timespec="minutes"),
                            "run_id": run_id})
        rec = ctx.seen[pid]
        if p.get("kind") == "sold" and not rec.get("sold_at"):
            rec["sold_at"] = t.isoformat(timespec="minutes")
            rec["kind_before_sold"] = rec.get("kind")
            rec["kind"] = "sold"

        if p.get("kind") not in ("sell", None):
            continue
        any_match = False
        for m in p.get("matches", []) or []:
            w = wanted.get(m.get("product"))
            if not w or not w.get("enabled", True) or m.get("fit", 0) < min_fit:
                continue
            any_match = True
            if w["id"] in rec["reported"]:
                continue
            age = w.get("max_post_age_days") or cfg["max_post_age_days"]
            if pt and pt < t - timedelta(days=age):
                continue
            price = p.get("price")
            pr = w.get("price", {})
            if price is None:
                if not cfg["include_no_price"]:
                    continue
            elif (pr.get("min") is not None and price < pr["min"]) or \
                 (pr.get("max") is not None and price > pr["max"]):
                continue
            flags = list(m.get("flags", []))
            text = p.get("text", "")
            flags += [f"คำเตือน:{ww}" for ww in cfg["warn_words"] if ww in text]
            vs = None
            if price is not None and pr.get("market"):
                vs = round((1 - price / pr["market"]) * 100)
                if price < pr["market"] * cfg["underpriced_ratio"]:
                    flags.append("ถูกผิดปกติ")
            cand.setdefault(w["id"], []).append((m, p, pid, vs, flags))
        if any_match:
            pg["matched"] += 1

    # results
    rows = []
    for prod, lst in cand.items():
        lst.sort(key=lambda x: (-x[0].get("fit", 0),
                                x[1].get("price") if x[1].get("price") is not None else 1e12))
        for rank, (m, p, pid, vs, flags) in enumerate(lst[:max_res], 1):
            ctx.seen[pid]["reported"].append(prod)
            rows.append([prod, rank, m.get("fit"), p.get("url"), p["group"], p.get("author"),
                         p.get("author_url"), p.get("price"), vs, p.get("posted_at"),
                         " | ".join(m.get("has", [])), " | ".join(m.get("missing", [])),
                         " | ".join(m.get("nice_found", [])), " | ".join(flags),
                         m.get("note", "")])
    out = ctx.p("results", f"{run_id}_matches.csv")
    write_csv(out, ["product", "rank", "fit", "post_url", "group", "author", "author_url",
                    "price", "cheaper_than_market_pct", "posted_at", "has", "missing",
                    "nice_found", "flags", "note"], rows)

    # group state
    for g, pg in per_group.items():
        st = ctx.gstate.setdefault(g, {"runs": 0, "posts_read": 0, "matches": 0,
                                       "recent_post_ids": []})
        last = parse_dt(st.get("last_read_at"))
        if last:
            days = max((t - last).total_seconds() / 86400, 1 / 24)
            rate = pg["new"] / days
            old = st.get("posts_per_day")
            st["posts_per_day"] = round(rate if old is None else 0.5 * old + 0.5 * rate, 1)
        st["runs"] += 1
        st["posts_read"] += pg["n"]
        st["matches"] += pg["matched"]
        st["last_read_at"] = t.isoformat(timespec="minutes")
        if pg["newest"]:
            st["newest_post_at"] = pg["newest"].isoformat(timespec="minutes")
        ids = pg["ids"] + [i for i in st["recent_post_ids"] if i not in pg["ids"]]
        st["recent_post_ids"] = ids[:60]
        if g in meta:
            st["last_stop_reason"] = meta[g]

    append_jsonl(ctx.log_path, new_log)
    save_json(ctx.seen_path, ctx.seen)
    save_json(ctx.gstate_path, ctx.gstate)
    print(json.dumps({"run_id": run_id, "posts_in": len(posts), "new_posts": len(new_log),
                      "new_matches": len(rows), "results_file": out,
                      "groups": {g: {k: v for k, v in pg.items() if k in ("n", "new", "matched")}
                                 for g, pg in per_group.items()}},
                     ensure_ascii=False, indent=2))


# ---------------------------------------------------------------- report
def cmd_report(ctx, args):
    t = now()
    days = args.days or ctx.cfg.get("market_report_days", 7)
    since = t - timedelta(days=days)
    mid = t - timedelta(days=days / 2)
    names = {i["key"]: i["name"] for i in ctx.market.get("track", [])}
    tracked_only = not ctx.market.get("discover", True)
    agg = {}
    for r in read_jsonl(ctx.log_path):
        pt = parse_dt(r.get("posted_at")) or parse_dt(r.get("seen_at"))
        if not pt or pt < since:
            continue
        for item in r.get("items", []) or []:
            if tracked_only and item not in names:
                continue
            a = agg.setdefault(item, {"sell": 0, "buy": 0, "sold": 0, "p_old": [], "p_new": [],
                                      "comments": [], "authors": set(), "groups": set(),
                                      "sold_hours": []})
            kind = r.get("kind")
            if kind == "buy":
                a["buy"] += 1
            elif kind in ("sell", "sold"):
                a["sell"] += 1
                if r.get("price") is not None:
                    (a["p_new"] if pt >= mid else a["p_old"]).append(r["price"])
            if r.get("comments") is not None:
                a["comments"].append(r["comments"])
            a["authors"].add(r.get("author"))
            a["groups"].add(r.get("group"))
            s = ctx.seen.get(str(r["post_id"]), {})
            if s.get("sold_at"):
                a["sold"] += 1
                if pt:
                    a["sold_hours"].append((parse_dt(s["sold_at"]) - pt).total_seconds() / 3600)
    rows = []
    for item, a in agg.items():
        prices = a["p_old"] + a["p_new"]
        med = statistics.median(prices) if prices else None
        trend = None
        if a["p_old"] and a["p_new"]:
            o, n = statistics.median(a["p_old"]), statistics.median(a["p_new"])
            trend = round((n - o) / o * 100) if o else None
        demand_ratio = round(a["buy"] / (a["sell"] + 1), 2)
        score = round(a["buy"] * 3 + a["sold"] * 2 + a["sell"] * 0.5 +
                      (statistics.mean(a["comments"]) if a["comments"] else 0) * 0.2, 1)
        rows.append([item, names.get(item, ""), score, a["buy"], a["sell"], a["sold"],
                     demand_ratio, med, min(prices) if prices else None, trend,
                     round(statistics.median(a["sold_hours"]), 1) if a["sold_hours"] else None,
                     len(a["authors"]), len(a["groups"])])
    rows.sort(key=lambda r: -r[2])
    out = ctx.p("results", f"market_{t:%Y%m%d}_{days}d.csv")
    write_csv(out, ["item", "name", "score", "buy_posts", "sell_posts", "sold", "demand_ratio",
                    "median_price", "min_price", "price_trend_pct", "median_hours_to_sold",
                    "unique_posters", "groups"], rows)
    print(json.dumps({"window_days": days, "items": len(rows), "file": out,
                      "top10": [{"item": r[0], "score": r[2], "buy": r[3], "sell": r[4],
                                 "sold": r[5], "median_price": r[7], "trend_pct": r[9]}
                                for r in rows[:10]]}, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan"); p.add_argument("--all", action="store_true",
                                               help="ignore tier intervals")
    p = sub.add_parser("ingest"); p.add_argument("posts"); p.add_argument("--meta")
    p.add_argument("--run-id")
    p = sub.add_parser("report"); p.add_argument("--days", type=int)
    a = ap.parse_args()
    ctx = Ctx(a.root)
    {"plan": cmd_plan, "ingest": cmd_ingest, "report": cmd_report}[a.cmd](ctx, a)


if __name__ == "__main__":
    main()
