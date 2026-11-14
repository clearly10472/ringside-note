// Win/lose prediction votes on Cloudflare Pages Functions, stored in D1 (binding name: DB).
// GET  /api/votes                -> { ok, counts: { <fightId>: { a, b } } }
// POST /api/votes { fight, side, voter }  side = "a" | "b" | null (null = take the vote back)
// One vote per browser: `voter` is a random id the page keeps in localStorage.

const FIGHT_RE = /^[a-z0-9-]{3,60}$/;
const VOTER_RE = /^[a-zA-Z0-9-]{16,64}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function ensureTable(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS picks (fight TEXT NOT NULL, voter TEXT NOT NULL, side TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (fight, voter))").run();
}

async function readCounts(db) {
  const { results } = await db.prepare("SELECT fight, side, COUNT(*) AS n FROM picks GROUP BY fight, side").all();
  const counts = {};
  for (const r of results || []) {
    counts[r.fight] = counts[r.fight] || { a: 0, b: 0 };
    if (r.side === "a" || r.side === "b") counts[r.fight][r.side] = r.n;
  }
  return counts;
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false, error: "storage_not_configured" }, 503);
  try {
    await ensureTable(env.DB);
    return json({ ok: true, counts: await readCounts(env.DB) });
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "storage_not_configured" }, 503);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad_request" }, 400); }
  const { fight, side, voter } = body || {};
  if (!FIGHT_RE.test(fight || "") || !VOTER_RE.test(voter || "") || !(side === "a" || side === "b" || side === null)) {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  try {
    await ensureTable(env.DB);
    if (side) {
      await env.DB.prepare("INSERT INTO picks (fight, voter, side, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(fight, voter) DO UPDATE SET side = excluded.side, at = excluded.at")
        .bind(fight, voter, side, Date.now()).run();
    } else {
      await env.DB.prepare("DELETE FROM picks WHERE fight = ?1 AND voter = ?2").bind(fight, voter).run();
    }
    return json({ ok: true, counts: await readCounts(env.DB) });
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
