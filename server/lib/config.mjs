/* FPL Signals server - configuration from the environment.
   Keys only ever come from env; nothing here is logged. The *_BASE and
   *_MS overrides exist so the gate can point the server at a local stub
   and run the schedules fast. In production leave them unset. */

import { resolve } from "node:path";

const env = process.env;
const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

export const CONFIG = {
  PORT: int(env.PORT, 8090),
  STATE_DIR: resolve(env.STATE_DIR || "./state"),

  SEASON: "2026-2027",
  LAST: "2025-2026",

  ODDS_API_KEY: env.ODDS_API_KEY || "",
  FPL_LEAGUE_ID: env.FPL_LEAGUE_ID || "391690",
  FPL_TEAM_ID: env.FPL_TEAM_ID || "301830",

  /* upstreams (overridable for the gate's stub) */
  GITHUB_API_BASE: env.GITHUB_API_BASE || "https://api.github.com",
  RAW_BASE: env.RAW_BASE || "https://raw.githubusercontent.com",
  FPL_API_BASE: env.FPL_API_BASE || "https://fantasy.premierleague.com/api",
  ODDS_API_BASE: env.ODDS_API_BASE || "https://api.odds-api.io/v3",
  /* JSON array of [name, url] pairs; unset means the app's own feed list */
  NEWS_FEEDS: env.NEWS_FEEDS || "",
  REDDIT_JSON_URL: env.REDDIT_JSON_URL || "https://www.reddit.com/r/FantasyPL/hot.json?limit=50&raw_json=1",
  REDDIT_RSS_URL: env.REDDIT_RSS_URL || "https://www.reddit.com/r/FantasyPL/hot/.rss?limit=50",
  GOOGLE_NEWS_BASE: env.GOOGLE_NEWS_BASE || "https://news.google.com/rss/search",

  DATASET_REPO: "olbauday/FPL-Core-Insights",
  DATASET_PATH: "data",

  /* schedules, milliseconds */
  TICK_MS: int(env.SIGNALS_TICK_MS, 60000),
  JITTER_MS: int(env.SIGNALS_JITTER_MS, 5000),
  DATASET_POLL_MS: int(env.DATASET_POLL_MS, 15 * 60000),
  FPL_POLL_MS: int(env.FPL_POLL_MS, 15 * 60000),
  FPL_POLL_NEAR_MS: int(env.FPL_POLL_NEAR_MS, 5 * 60000),
  FPL_LIVE_MS: int(env.FPL_LIVE_MS, 2 * 60000),
  NEWS_POLL_MS: int(env.NEWS_POLL_MS, 15 * 60000),
  ODDS_POLL_MS: int(env.ODDS_POLL_MS, 4 * 3600000),
  /* 0 disables the feeds child process (the gate uses that: the build
     script's FPL API URL is hardcoded, so it cannot be pointed at a stub) */
  FEEDS_POLL_MS: int(env.FEEDS_POLL_MS, 15 * 60000)
};

export const UA = "fpl-signals/1.0 (self-hosted FPL dashboard)";
