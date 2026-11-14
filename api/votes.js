// Win/lose prediction votes, stored in Upstash Redis (added from Vercel's Storage tab).
// GET  /api/votes                -> { ok, counts: { <fightId>: { a, b } } }
// POST /api/votes { fight, side, voter }  side = "a" | "b" | null (null = take the vote back)
// One vote per browser: `voter` is a random id the page keeps in localStorage.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FIGHT_RE = /^[a-z0-9-]{3,60}$/;
const VOTER_RE = /^[a-zA-Z0-9-]{16,64}$/;

async function redis(commands) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map(x => x.result);
}

async function readCounts() {
  const [flat] = await redis([["HGETALL", "vote:counts"]]);
  const counts = {};
  for (let i = 0; i + 1 < (flat || []).length; i += 2) {
    const [fight, side] = flat[i].split(":");
    counts[fight] = counts[fight] || { a: 0, b: 0 };
    counts[fight][side] = Math.max(0, Number(flat[i + 1]) || 0);
  }
  return counts;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(503).json({ ok: false, error: "storage_not_configured" });
  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, counts: await readCounts() });
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { fight, side, voter } = body;
    if (!FIGHT_RE.test(fight || "") || !VOTER_RE.test(voter || "") || !(side === "a" || side === "b" || side === null)) {
      return res.status(400).json({ ok: false, error: "bad_request" });
    }

    // light rate limit: 30 votes per minute per address
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    const [hits] = await redis([["INCR", `vote:rl:${ip}`], ["EXPIRE", `vote:rl:${ip}`, "60", "NX"]]);
    if (hits > 30) return res.status(429).json({ ok: false, error: "rate_limited" });

    const pickKey = `vote:pick:${fight}`;
    const [prev] = await redis([["HGET", pickKey, voter]]);
    const cmds = [];
    if (prev === side) return res.status(200).json({ ok: true, counts: await readCounts() });
    if (prev === "a" || prev === "b") cmds.push(["HINCRBY", "vote:counts", `${fight}:${prev}`, "-1"]);
    if (side) { cmds.push(["HSET", pickKey, voter, side]); cmds.push(["HINCRBY", "vote:counts", `${fight}:${side}`, "1"]); }
    else cmds.push(["HDEL", pickKey, voter]);
    await redis(cmds);
    return res.status(200).json({ ok: true, counts: await readCounts() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server" });
  }
};
