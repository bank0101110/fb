export type Tier = { tier: string; min_hit_rate: number; interval_hours: number };

export type Config = {
  timezone_offset: string;
  max_post_age_days: number;
  run_post_budget: number;
  per_group_min_posts: number;
  per_group_max_posts: number;
  stop_after_consecutive_seen: number;
  max_results_per_product: number;
  min_fit: number;
  include_no_price: boolean;
  underpriced_ratio: number;
  view_images: "shortlist_only" | "none" | "all";
  max_images_per_post: number;
  warn_words: string[];
  group_tiers: Tier[];
  new_group_free_runs: number;
  market_report_days: number;
};

export type Group = {
  id: string;
  url: string;
  games: string[];
  mode: "feed" | "search";
  enabled: boolean;
};

export type Wanted = {
  id: string;
  enabled: boolean;
  game: string;
  name: string;
  keywords: string[];
  must: string[];
  nice: string[];
  exclude: string[];
  transfer: string[];
  price: { min: number | null; max: number | null; market: number | null };
  max_post_age_days: number | null;
  groups: "all" | string[];
  notes: string;
};

export type TrackItem = { key: string; game: string; name: string; aliases: string[] };
export type Market = { discover: boolean; track: TrackItem[] };

export type Match = {
  product: string;
  fit: number;
  has?: string[];
  missing?: string[];
  nice_found?: string[];
  flags?: string[];
  note?: string;
};

export type Post = {
  post_id: string;
  group: string;
  url?: string;
  author?: string;
  author_url?: string;
  posted_at?: string;
  posted_at_raw?: string;
  kind?: "sell" | "buy" | "sold" | "other";
  game?: string;
  items?: string[];
  attrs?: string[];
  price?: number | null;
  comments?: number | null;
  reactions?: number | null;
  text?: string;
  matches?: Match[];
  seen_at?: string;
  run_id?: string;
};

export type Seen = Record<
  string,
  {
    group: string;
    url?: string;
    posted_at?: string;
    first_seen: string;
    kind?: string;
    items?: string[];
    reported: string[];
    sold_at: string | null;
  }
>;

export type GroupState = Record<
  string,
  {
    runs: number;
    posts_read: number;
    matches: number;
    recent_post_ids: string[];
    last_read_at?: string;
    newest_post_at?: string;
    posts_per_day?: number;
    last_stop_reason?: string;
  }
>;

export type MatchRow = {
  product: string;
  rank: number;
  fit: number;
  post_url: string;
  group: string;
  author: string | null;
  author_url: string | null;
  price: number | null;
  cheaper_than_market_pct: number | null;
  posted_at: string | null;
  has: string[];
  missing: string[];
  nice_found: string[];
  flags: string[];
  note: string;
  run_id: string;
};
