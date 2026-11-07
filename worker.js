import { SEED } from "./seed-data.js";

/* ------------------------------------------------------------------ *
 * SMRITHI site backend
 * Public API + password protected admin API.
 * Storage: Cloudflare D1 (data) and R2 (uploaded images).
 * ------------------------------------------------------------------ */

const JSON_CT = "application/json; charset=utf-8";
const SESSION_COOKIE = "torque_admin";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const MAX_UPLOAD = 8 * 1024 * 1024;
const DEFAULT_PASSWORD = "smrithi2026";
const PBKDF2_ITERATIONS = 20000;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const DEFAULT_SETTINGS = {
  brand: { name: "SMRITHI", version: "2026", logoUrl: "/smriti-logo.svg" },
  hero: {
    title: "INTERCOLLEGIATE SPORTS FEST",
    subtitle: "KOTTAYAM, KERALA",
    location: "Main Campus Ground, Kottayam",
    ruleBookUrl: "",
    ruleBookLabel: "Rule Book",
    primaryCtaLabel: "View Leaderboard",
    photoUrl: "",
    dates: [{ day: "20", month: "MAR" }],
  },
  ticker: { enabled: false, text: "" },
  banner: { enabled: true, label: "LIVE NOW" },
  sponsorsTitle: "OFFICIAL SPONSORS",
  map: {
    embedUrl: "",
    linkUrl: "",
    linkLabel: "View on Google Maps",
    directions: [
      {
        from: "Kottayam Railway Station",
        details: "About 3 km — auto or bus to the campus gate, 10 minutes. Example route: replace with your own.",
      },
      {
        from: "Kottayam KSRTC Bus Stand",
        details: "About 2.5 km — auto to the main gate, 8 minutes. Example route: replace with your own.",
      },
    ],
  },
  blueprintUrl: "",
  clubs: [
    { name: "Fuego Sports Club", logoUrl: "/photo-placeholder.svg" },
    { name: "Mithra Students Union", logoUrl: "/photo-placeholder.svg" },
  ],
  tribute: { title: "", text: "" },
  documents: {
    ruleBookUrl: "",
    ruleBookLabel: "Rule Book",
    brochureUrl: "",
    brochureLabel: "Brochure",
  },
  games: [
    {
      name: "Football",
      fee: "₹100 per player",
      prize: "₹10,000 for the winning team",
      link: "",
    },
  ],
  about: {
    kicker: "About the fest",
    heading: "One campus. Every sport. One day of it.",
    intro:
      "SMRITHI 2026 is an intercollegiate sports fest in Kottayam. This is example text — replace it, the numbers and the highlight list from the admin dashboard.",
    stats: [{ value: "1", label: "Day of sport" }],
    hostKicker: "About the host",
    hostTitle: "Kottayam, Kerala",
    hostParagraphs: [
      "One example paragraph about your college and the city — edit it from the admin dashboard.",
    ],
    highlightsTitle: "Campus Highlights",
    highlights: ["Main Ground"],
  },
  points: { first: 10, second: 5, third: 3 },
  theme: { accent: "#D4A843", defaultMode: "dark" },
  footer: {
    tagline: "Intercollegiate Sports Fest 2026",
    copyright: "© 2026 SMRITHI. All rights reserved.",
    credits: "",
  },
  contacts: [
    { name: "Event Coordinator", role: "Convenor", phone: "+919000000000" },
    { name: "Student Coordinator", role: "Co-convenor", phone: "+919000000001" },
  ],
  socials: [
    { label: "Instagram", type: "instagram", url: "https://www.instagram.com/smriti.kottayam/" },
    { label: "WhatsApp", type: "whatsapp", url: "https://wa.me/919000000000" },
  ],
};

const SETTINGS_SECTIONS = Object.keys(DEFAULT_SETTINGS);

const TABLES = {
  teams: {
    cols: ["name", "short_name", "logo_url"],
    required: ["name"],
    order: "name COLLATE NOCASE",
    slugFrom: "name",
  },
  events: { cols: ["name"], required: ["name"], order: "name COLLATE NOCASE", slugFrom: "name" },
  days: {
    cols: ["label", "date", "highlight", "sort_order"],
    required: ["label"],
    order: "sort_order ASC, label COLLATE NOCASE",
  },
  fixtures: {
    cols: [
      "day_id",
      "event_id",
      "event_name",
      "team_one_id",
      "team_one_name",
      "team_two_id",
      "team_two_name",
      "round",
      "time",
      "status",
      "winner",
      "score",
      "score_round",
      "live_link",
      "sort_order",
    ],
    required: [],
    order: "sort_order ASC, id ASC",
  },
  results: {
    cols: ["event_id", "name", "first_team_id", "second_team_id", "third_team_id", "note"],
    required: ["name"],
    order: "name COLLATE NOCASE",
  },
  sponsors: {
    cols: ["name", "logo_url", "link", "sort_order"],
    required: ["logo_url"],
    order: "sort_order ASC, id ASC",
  },
  gallery: {
    cols: ["url", "caption", "group_name", "sort_order"],
    required: ["url"],
    order: "sort_order ASC, created_at DESC",
  },
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT, logo_url TEXT, created_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS days (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, date TEXT, highlight TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS fixtures (
      id TEXT PRIMARY KEY, day_id TEXT, event_id TEXT, event_name TEXT,
      team_one_id TEXT, team_one_name TEXT, team_two_id TEXT, team_two_name TEXT,
      round TEXT, time TEXT, status TEXT NOT NULL DEFAULT 'upcoming', winner TEXT,
      score TEXT, score_round TEXT, live_link TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY, event_id TEXT, name TEXT NOT NULL,
      first_team_id TEXT, second_team_id TEXT, third_team_id TEXT, note TEXT,
      created_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS sponsors (
      id TEXT PRIMARY KEY, name TEXT, logo_url TEXT NOT NULL, link TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, caption TEXT, group_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, detail TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_fixtures_day ON fixtures (day_id)`,
  `CREATE INDEX IF NOT EXISTS idx_results_event ON results (event_id)`,
];

/* ----------------------------- helpers ----------------------------- */

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": JSON_CT, "cache-control": "no-store", ...headers },
  });

const bad = (message, status = 400) => json({ error: message }, status);

const now = () => Date.now();

const str = (value, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : value == null ? "" : String(value).slice(0, max);

function bytesToB64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

async function runBatch(db, statements, size = 40) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size));
  }
}

/* ----------------------------- database ---------------------------- */

let initPromise = null;

function ready(env) {
  if (!initPromise) {
    initPromise = initDatabase(env).catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function initDatabase(env) {
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  // Older installations predate these columns; add them once, ignore if present.
  for (const sql of ["ALTER TABLE days ADD COLUMN highlight TEXT"]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      /* column already exists */
    }
  }
  const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first();
  if (!existing || Number(existing.n) > 0) return;

  const statements = [
    env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(
      "site",
      JSON.stringify(DEFAULT_SETTINGS),
    ),
    env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(
      "admin.password",
      await hashPassword(env.ADMIN_PASSWORD || DEFAULT_PASSWORD),
    ),
    env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(
      "auth.secret",
      bytesToB64(crypto.getRandomValues(new Uint8Array(32))),
    ),
  ];

  for (const team of SEED.teams) {
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO teams (id, name, short_name, logo_url, created_at) VALUES (?, ?, '', '', ?)",
      ).bind(team.id, team.name, now()),
    );
  }
  for (const event of SEED.events) {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO events (id, name, created_at) VALUES (?, ?, ?)").bind(
        event.id,
        event.name,
        now(),
      ),
    );
  }
  for (const day of SEED.days) {
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO days (id, label, date, highlight, sort_order) VALUES (?, ?, '', ?, ?)",
      ).bind(day.id, day.label, day.highlight || "", day.sort_order),
    );
  }
  for (const fixture of SEED.fixtures) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO fixtures (
          id, day_id, event_id, event_name, team_one_id, team_one_name, team_two_id, team_two_name,
          round, time, status, winner, score, score_round, live_link, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        fixture.id,
        fixture.day_id,
        fixture.event_id,
        fixture.event_name,
        fixture.team_one_id,
        fixture.team_one_name,
        fixture.team_two_id,
        fixture.team_two_name,
        fixture.round,
        fixture.time,
        fixture.status,
        fixture.winner,
        fixture.score,
        fixture.score_round,
        fixture.live_link,
        fixture.sort_order,
        now(),
      ),
    );
  }
  for (const result of SEED.results) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO results (id, event_id, name, first_team_id, second_team_id, third_team_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, '', ?)`,
      ).bind(
        result.id,
        result.event_id,
        result.name,
        result.first_team_id,
        result.second_team_id,
        result.third_team_id,
        now(),
      ),
    );
  }

  for (const sponsor of SEED.sponsors) {
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO sponsors (id, name, logo_url, link, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(sponsor.id, sponsor.name, sponsor.logo_url, sponsor.link, sponsor.sort_order, now()),
    );
  }
  for (const item of SEED.gallery) {
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO gallery (id, url, caption, group_name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(item.id, item.url, item.caption, item.group_name, item.sort_order, now()),
    );
  }

  await runBatch(env.DB, statements);
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

async function putSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(key, JSON.stringify(value))
    .run();
}

function mergeSettings(base, patch) {
  const out = { ...base };
  for (const key of SETTINGS_SECTIONS) {
    if (!(key in patch)) continue;
    const incoming = patch[key];
    const current = out[key];
    if (Array.isArray(incoming)) {
      out[key] = incoming;
    } else if (incoming && typeof incoming === "object" && current && typeof current === "object") {
      out[key] = { ...current, ...incoming };
    } else if (incoming !== undefined) {
      out[key] = incoming;
    }
  }
  return out;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseSettings(settings) {
  const out = { ...settings };
  out.brand = {
    name: str(out.brand?.name, 40) || DEFAULT_SETTINGS.brand.name,
    version: str(out.brand?.version, 20),
    logoUrl: str(out.brand?.logoUrl, 500),
  };
  const accent = str(out.theme?.accent, 20);
  out.theme = {
    accent: /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_SETTINGS.theme.accent,
    defaultMode: out.theme?.defaultMode === "light" ? "light" : "dark",
  };
  out.points = {
    first: Math.max(0, asNumber(out.points?.first, 10)),
    second: Math.max(0, asNumber(out.points?.second, 5)),
    third: Math.max(0, asNumber(out.points?.third, 3)),
  };
  out.hero = {
    ...DEFAULT_SETTINGS.hero,
    ...(out.hero || {}),
    dates: Array.isArray(out.hero?.dates)
      ? out.hero.dates
          .slice(0, 14)
          .map((d) => ({ day: str(d?.day, 8), month: str(d?.month, 8).toUpperCase() }))
          .filter((d) => d.day || d.month)
      : [],
  };
  out.about = { ...DEFAULT_SETTINGS.about, ...(out.about || {}) };
  out.about.stats = Array.isArray(out.about.stats) ? out.about.stats.slice(0, 6) : [];
  out.about.highlights = Array.isArray(out.about.highlights) ? out.about.highlights.slice(0, 40) : [];
  out.about.hostParagraphs = Array.isArray(out.about.hostParagraphs)
    ? out.about.hostParagraphs.slice(0, 10)
    : [];
  out.contacts = Array.isArray(out.contacts) ? out.contacts.slice(0, 20) : [];
  out.socials = Array.isArray(out.socials) ? out.socials.slice(0, 10) : [];
  out.ticker = { ...DEFAULT_SETTINGS.ticker, ...(out.ticker || {}) };
  out.banner = {
    enabled: out.banner?.enabled !== false,
    label: str(out.banner?.label, 30) || DEFAULT_SETTINGS.banner.label,
  };
  out.map = {
    ...DEFAULT_SETTINGS.map,
    ...(out.map || {}),
    directions: Array.isArray(out.map?.directions)
      ? out.map.directions
          .slice(0, 10)
          .map((row) => ({ from: str(row?.from, 120), details: str(row?.details, 300) }))
          .filter((row) => row.from || row.details)
      : [],
  };
  out.clubs = Array.isArray(out.clubs)
    ? out.clubs
        .slice(0, 8)
        .map((club) => ({ name: str(club?.name, 80), logoUrl: str(club?.logoUrl, 500) }))
        .filter((club) => club.name)
    : [];
  out.games = Array.isArray(out.games)
    ? out.games
        .slice(0, 40)
        .map((game) => ({
          name: str(game?.name, 80),
          fee: str(game?.fee, 160),
          prize: str(game?.prize, 200),
          link: str(game?.link, 500),
        }))
        .filter((game) => game.name)
    : [];
  out.tribute = { title: str(out.tribute?.title, 140), text: str(out.tribute?.text, 1600) };
  out.documents = {
    ruleBookUrl: str(out.documents?.ruleBookUrl, 500),
    ruleBookLabel: str(out.documents?.ruleBookLabel, 40),
    brochureUrl: str(out.documents?.brochureUrl, 500),
    brochureLabel: str(out.documents?.brochureLabel, 40),
  };
  out.footer = { ...DEFAULT_SETTINGS.footer, ...(out.footer || {}) };
  return out;
}

/* ------------------------------ auth ------------------------------- */

async function hashPassword(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

async function verifyPassword(env, password) {
  if (env.ADMIN_PASSWORD) return safeEqual(password, env.ADMIN_PASSWORD);
  const stored = await getSetting(env, "admin.password");
  if (typeof stored !== "string") return false;
  const [algo, iterations, salt] = stored.split("$");
  if (algo !== "pbkdf2") return false;
  const candidate = await hashPassword(password, salt, Number(iterations) || PBKDF2_ITERATIONS);
  return safeEqual(candidate, stored);
}

async function signSession(env, exp) {
  const secret = await getSetting(env, "auth.secret");
  const payload = `v1.${exp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToB64(new Uint8Array(signature)).replace(/=+$/, "")}`;
}

async function hasValidSession(env, request) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < now() / 1000) return false;
  const expected = await signSession(env, parts[1]);
  return safeEqual(expected, token);
}

function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function requireAdmin(env, request) {
  if (!originAllowed(request)) return bad("Cross-origin request blocked", 403);
  if (!(await hasValidSession(env, request))) return bad("Not authenticated", 401);
  if (request.method !== "GET" && request.headers.get("x-requested-with") !== "torque-admin") {
    return bad("Missing request header", 400);
  }
  return null;
}

/* ----------------------------- activity ---------------------------- */

async function logActivity(env, action, detail) {
  await env.DB.prepare("INSERT INTO activity (action, detail, created_at) VALUES (?, ?, ?)")
    .bind(action, str(detail, 300), now())
    .run();
  await env.DB.prepare(
    "DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 120)",
  )
    .run();
}

/* --------------------------- public payload ------------------------ */

async function buildSite(env) {
  const [settingsRow, teamsRes, eventsRes, daysRes, fixturesRes, resultsRes, sponsorsRes, galleryRes] =
    await Promise.all([
      getSetting(env, "site"),
      env.DB.prepare("SELECT * FROM teams ORDER BY name COLLATE NOCASE").all(),
      env.DB.prepare("SELECT * FROM events ORDER BY name COLLATE NOCASE").all(),
      env.DB.prepare("SELECT * FROM days ORDER BY sort_order ASC, label COLLATE NOCASE").all(),
      env.DB.prepare("SELECT * FROM fixtures ORDER BY sort_order ASC, id ASC").all(),
      env.DB.prepare("SELECT * FROM results ORDER BY name COLLATE NOCASE").all(),
      env.DB.prepare("SELECT * FROM sponsors ORDER BY sort_order ASC, id ASC").all(),
      env.DB.prepare("SELECT * FROM gallery ORDER BY sort_order ASC, created_at DESC").all(),
    ]);

  const settings = normaliseSettings(mergeSettings(DEFAULT_SETTINGS, settingsRow || {}));
  const teams = teamsRes.results || [];
  const results = resultsRes.results || [];

  const points = settings.points;
  const table = new Map();
  for (const team of teams) {
    table.set(team.id, { teamId: team.id, name: team.name, first: 0, second: 0, third: 0, points: 0 });
  }
  for (const result of results) {
    for (const [field, weight] of [
      ["first_team_id", points.first],
      ["second_team_id", points.second],
      ["third_team_id", points.third],
    ]) {
      const entry = table.get(result[field]);
      if (!entry) continue;
      entry[field.replace("_team_id", "")] += 1;
      entry.points += weight;
    }
  }
  const leaderboard = [...table.values()].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  );

  return {
    settings,
    teams,
    events: eventsRes.results || [],
    days: daysRes.results || [],
    fixtures: fixturesRes.results || [],
    results,
    sponsors: sponsorsRes.results || [],
    gallery: galleryRes.results || [],
    leaderboard,
    generatedAt: now(),
  };
}

/* ----------------------------- routing ----------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith("/api/")) {
        await ready(env);
        return await handleApi(request, env, url);
      }
      if (path.startsWith("/media/")) {
        return await serveMedia(request, env, url);
      }
      // /admin is resolved to admin.html by the assets layer (HTML handling),
      // so it must not be redirected here or the two rules fight each other.
      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, path);
    } catch (error) {
      console.error("Request failed", path, error);
      return json({ error: "Something went wrong. Please retry." }, 500);
    }
  },
};

function withSecurityHeaders(response, path) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (path.endsWith(".html") || path === "/") {
    headers.set("x-frame-options", "SAMEORIGIN");
  }
  return new Response(response.body, { status: response.status, headers });
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/site" && method === "GET") {
    return json(await buildSite(env));
  }

  if (path === "/api/admin/login" && method === "POST") {
    return handleLogin(request, env);
  }

  if (!path.startsWith("/api/admin/")) {
    return bad("Not found", 404);
  }

  if (path === "/api/admin/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, "", 0) });
  }

  const denied = await requireAdmin(env, request);
  if (denied) return denied;

  if (path === "/api/admin/session" && method === "GET") {
    return json({
      authenticated: true,
      passwordManagedBySecret: Boolean(env.ADMIN_PASSWORD),
      usingDefaultPassword: !env.ADMIN_PASSWORD && (await verifyPassword(env, DEFAULT_PASSWORD)),
    });
  }

  if (path === "/api/admin/data" && method === "GET") {
    const data = await buildSite(env);
    const activity = await env.DB.prepare(
      "SELECT id, action, detail, created_at FROM activity ORDER BY id DESC LIMIT 25",
    ).all();
    return json({
      ...data,
      activity: activity.results || [],
      passwordManagedBySecret: Boolean(env.ADMIN_PASSWORD),
      usingDefaultPassword: !env.ADMIN_PASSWORD && (await verifyPassword(env, DEFAULT_PASSWORD)),
    });
  }

  if (path === "/api/admin/settings" && method === "PUT") {
    const body = await readJson(request);
    if (!body || typeof body !== "object") return bad("Invalid payload");
    const current = mergeSettings(DEFAULT_SETTINGS, (await getSetting(env, "site")) || {});
    const merged = normaliseSettings(mergeSettings(current, body));
    await putSetting(env, "site", merged);
    await logActivity(env, "settings.update", "Site content updated");
    return json({ ok: true, settings: merged });
  }

  if (path === "/api/admin/password" && method === "POST") {
    return handlePasswordChange(request, env);
  }

  if (path === "/api/admin/upload" && method === "POST") {
    return handleUpload(request, env);
  }

  if (path === "/api/admin/backup" && method === "GET") {
    const site = await buildSite(env);
    return json({
      format: "torque-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      content: {
        settings: site.settings,
        teams: site.teams,
        events: site.events,
        days: site.days,
        fixtures: site.fixtures,
        results: site.results,
        sponsors: site.sponsors,
        gallery: site.gallery,
      },
    });
  }

  if (path === "/api/admin/backup" && method === "POST") {
    return handleImport(request, env);
  }

  const match = path.match(/^\/api\/admin\/([a-z]+)(?:\/([A-Za-z0-9_-]+))?$/);
  if (!match) return bad("Not found", 404);
  const [, table, id] = match;
  const config = TABLES[table];
  if (!config) return bad("Not found", 404);

  if (method === "POST" && !id) return createRow(request, env, table, config);
  if (method === "PUT" && id) return updateRow(request, env, table, config, id);
  if (method === "PATCH" && id) return updateRow(request, env, table, config, id);
  if (method === "DELETE" && id) return deleteRow(env, table, id);
  return bad("Method not allowed", 405);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* ------------------------------ login ------------------------------ */

async function handleLogin(request, env) {
  if (!originAllowed(request)) return bad("Cross-origin request blocked", 403);
  const guard = (await getSetting(env, "auth.guard")) || { fails: 0, until: 0 };
  if (guard.until && guard.until > now()) {
    return bad("Too many attempts. Try again in a few minutes.", 429);
  }

  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return bad("Password required");

  const ok = await verifyPassword(env, password);
  if (!ok) {
    const fails = (guard.fails || 0) + 1;
    const locked = fails >= 5;
    await putSetting(env, "auth.guard", {
      fails: locked ? 0 : fails,
      until: locked ? now() + 10 * 60 * 1000 : 0,
    });
    return bad(locked ? "Too many attempts. Locked for 10 minutes." : "Incorrect password", 401);
  }

  await putSetting(env, "auth.guard", { fails: 0, until: 0 });
  const exp = Math.floor(now() / 1000) + SESSION_TTL;
  const token = await signSession(env, exp);
  await logActivity(env, "admin.login", "Admin signed in");
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, token, SESSION_TTL) });
}

async function handlePasswordChange(request, env) {
  if (env.ADMIN_PASSWORD) {
    return bad(
      "The password is set by the ADMIN_PASSWORD secret. Change that secret to update it.",
      409,
    );
  }
  const body = await readJson(request);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (next.length < 8) return bad("New password must be at least 8 characters");
  if (!(await verifyPassword(env, current))) return bad("Current password is incorrect", 401);
  await putSetting(env, "admin.password", await hashPassword(next));
  await putSetting(env, "auth.guard", { fails: 0, until: 0 });
  await logActivity(env, "admin.password", "Admin password changed");
  return json({ ok: true });
}

/* ------------------------------ media ------------------------------ */

async function handleUpload(request, env) {
  if (!env.FILES) return bad("File storage is not configured", 503);
  let form;
  try {
    form = await request.formData();
  } catch {
    return bad("Invalid upload");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return bad("No file received");
  if (file.size > MAX_UPLOAD) return bad("Image is larger than 8 MB", 413);
  const type = (file.type || "").toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) return bad("Use a JPG, PNG, WebP, GIF or AVIF image", 415);

  const key = `m/${now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return json({ ok: true, url: `/media/${key}`, key });
}

async function serveMedia(request, env, url) {
  if (!env.FILES) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const key = decodeURIComponent(url.pathname.replace("/media/", ""));
  if (!key.startsWith("m/") || key.includes("..")) return new Response("Not found", { status: 404 });
  const object = await env.FILES.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

async function deleteMedia(env, url) {
  if (!env.FILES || typeof url !== "string") return;
  const match = url.match(/^\/media\/(m\/[A-Za-z0-9._-]+)$/);
  if (!match) return;
  await env.FILES.delete(match[1]);
}

/* ------------------------------- CRUD ------------------------------ */

function pickColumns(config, body) {
  const values = {};
  for (const col of config.cols) {
    if (!(col in body)) continue;
    const key = col;
    if (key === "sort_order") values[key] = Math.trunc(asNumber(body[key], 0));
    else if (key === "status") values[key] = ["upcoming", "live", "finished"].includes(body[key])
      ? body[key]
      : "upcoming";
    else values[key] = str(body[key], 1200);
  }
  return values;
}

async function generateId(env, table, config, body) {
  const base = config.slugFrom ? slugify(body?.[config.slugFrom] || "") : "";
  if (base) {
    let candidate = base;
    let suffix = 2;
    while (
      await env.DB.prepare(`SELECT 1 AS hit FROM ${table} WHERE id = ?`).bind(candidate).first()
    ) {
      candidate = `${base}_${suffix++}`;
      if (suffix > 40) {
        candidate = `${base}_${Math.random().toString(36).slice(2, 7)}`;
        break;
      }
    }
    return candidate;
  }
  return crypto.randomUUID();
}

async function createRow(request, env, table, config) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return bad("Invalid payload");
  for (const field of config.required) {
    if (!str(body[field])) return bad(`${field.replace(/_/g, " ")} is required`);
  }
  const values = pickColumns(config, body);
  const id = str(body.id, 64) || (await generateId(env, table, config, body));
  values.id = id;
  if (table === "fixtures") values.updated_at = now();
  if (table === "teams" || table === "events" || table === "results" || table === "gallery") {
    values.created_at = now();
  }
  const columns = Object.keys(values);
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  await env.DB.prepare(sql)
    .bind(...columns.map((c) => values[c]))
    .run();
  await logActivity(env, `${table}.create`, `Added ${values.name || values.label || values.url || id}`);
  return json({ ok: true, id });
}

async function updateRow(request, env, table, config, id) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return bad("Invalid payload");
  for (const field of config.required) {
    if (field in body && !str(body[field])) return bad(`${field.replace(/_/g, " ")} is required`);
  }
  const values = pickColumns(config, body);
  if (table === "fixtures") values.updated_at = now();
  const columns = Object.keys(values);
  if (!columns.length) return bad("Nothing to update");
  const sql = `UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`;
  const result = await env.DB.prepare(sql)
    .bind(...columns.map((c) => values[c]), id)
    .run();
  if (!result.meta || result.meta.changes === 0) return bad("Record not found", 404);
  await logActivity(env, `${table}.update`, `Updated ${id}`);
  return json({ ok: true, id });
}

async function deleteRow(env, table, id) {
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return bad("Record not found", 404);

  if (table === "gallery") await deleteMedia(env, row.url);
  if (table === "sponsors") await deleteMedia(env, row.logo_url);
  if (table === "teams") await deleteMedia(env, row.logo_url);
  if (table === "events") {
    await env.DB.prepare("DELETE FROM results WHERE event_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM fixtures WHERE event_id = ?").bind(id).run();
  }
  if (table === "days") {
    await env.DB.prepare("DELETE FROM fixtures WHERE day_id = ?").bind(id).run();
  }

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  await logActivity(env, `${table}.delete`, `Deleted ${row.name || row.label || id}`);
  return json({ ok: true });
}

async function handleImport(request, env) {
  const body = await readJson(request);
  const content = body?.content;
  if (!content || typeof content !== "object") return bad("Invalid backup file");

  const settings = normaliseSettings(mergeSettings(DEFAULT_SETTINGS, content.settings || {}));
  await putSetting(env, "site", settings);

  const statements = [];
  for (const table of ["fixtures", "results", "gallery", "sponsors", "days", "events", "teams"]) {
    statements.push(env.DB.prepare(`DELETE FROM ${table}`));
  }
  await runBatch(env.DB, statements);

  const inserts = [];
  for (const team of content.teams || []) {
    if (!team?.id || !team?.name) continue;
    inserts.push(
      env.DB.prepare(
        "INSERT INTO teams (id, name, short_name, logo_url, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(team.id, str(team.name), str(team.short_name), str(team.logo_url, 500), now()),
    );
  }
  for (const event of content.events || []) {
    if (!event?.id || !event?.name) continue;
    inserts.push(
      env.DB.prepare("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)").bind(
        event.id,
        str(event.name),
        now(),
      ),
    );
  }
  for (const day of content.days || []) {
    if (!day?.id || !day?.label) continue;
    inserts.push(
      env.DB.prepare(
        "INSERT INTO days (id, label, date, highlight, sort_order) VALUES (?, ?, ?, ?, ?)",
      ).bind(
        day.id,
        str(day.label),
        str(day.date, 40),
        str(day.highlight, 200),
        Math.trunc(asNumber(day.sort_order, 0)),
      ),
    );
  }
  for (const fixture of content.fixtures || []) {
    if (!fixture?.id) continue;
    inserts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO fixtures (
          id, day_id, event_id, event_name, team_one_id, team_one_name, team_two_id, team_two_name,
          round, time, status, winner, score, score_round, live_link, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        str(fixture.id, 64),
        str(fixture.day_id, 64),
        str(fixture.event_id, 64),
        str(fixture.event_name),
        str(fixture.team_one_id, 64),
        str(fixture.team_one_name),
        str(fixture.team_two_id, 64),
        str(fixture.team_two_name),
        str(fixture.round),
        str(fixture.time, 40),
        ["upcoming", "live", "finished"].includes(fixture.status) ? fixture.status : "upcoming",
        str(fixture.winner),
        str(fixture.score),
        str(fixture.score_round),
        str(fixture.live_link, 500),
        Math.trunc(asNumber(fixture.sort_order, 0)),
        now(),
      ),
    );
  }
  for (const result of content.results || []) {
    if (!result?.id) continue;
    inserts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO results (id, event_id, name, first_team_id, second_team_id, third_team_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        str(result.id, 64),
        str(result.event_id, 64),
        str(result.name) || "Event",
        str(result.first_team_id, 64),
        str(result.second_team_id, 64),
        str(result.third_team_id, 64),
        str(result.note),
        now(),
      ),
    );
  }
  for (const sponsor of content.sponsors || []) {
    if (!sponsor?.id || !sponsor?.logo_url) continue;
    inserts.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO sponsors (id, name, logo_url, link, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        str(sponsor.id, 64),
        str(sponsor.name),
        str(sponsor.logo_url, 500),
        str(sponsor.link, 500),
        Math.trunc(asNumber(sponsor.sort_order, 0)),
        now(),
      ),
    );
  }
  for (const photo of content.gallery || []) {
    if (!photo?.id || !photo?.url) continue;
    inserts.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO gallery (id, url, caption, group_name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        str(photo.id, 64),
        str(photo.url, 500),
        str(photo.caption),
        str(photo.group_name, 60),
        Math.trunc(asNumber(photo.sort_order, 0)),
        now(),
      ),
    );
  }
  await runBatch(env.DB, inserts);
  await logActivity(env, "backup.import", `Restored ${inserts.length} records`);
  return json({ ok: true, imported: inserts.length });
}
