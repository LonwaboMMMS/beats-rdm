const COOKIE = "rb_session";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
  .map(byte => byte.toString(16).padStart(2, "0")).join("");
function sessionToken(request) {
  const part = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : "";
}
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not configured." }, 503);
  const token = sessionToken(request);
  if (!token) return json({ error: "Please log in." }, 401);
  const user = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(await sha256(token), Date.now()).first();
  if (!user) return json({ error: "Please log in." }, 401);
  const result = await env.DB.prepare(
    "SELECT id, beat_id AS beatId, beat_title AS title, producer, artwork_url AS artwork, licence, format, purchased_at AS purchasedAt FROM beat_purchases WHERE user_id = ? AND payment_status = 'paid' ORDER BY purchased_at DESC"
  ).bind(user.user_id).all();
  return json({ purchases: result.results || [] });
}