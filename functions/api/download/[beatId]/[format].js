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
export async function onRequestGet({ request, env, params }) {
  if (!env.DB || !env.MEDIA) return json({ error: "Download storage is not configured yet." }, 503);
  const beatId = String(params.beatId || "");
  const format = String(params.format || "").toLowerCase();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(beatId) || !["mp3", "wav"].includes(format)) {
    return json({ error: "Invalid download request." }, 400);
  }
  const token = sessionToken(request);
  if (!token) return json({ error: "Please log in to access your purchases." }, 401);
  const user = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(await sha256(token), Date.now()).first();
  if (!user) return json({ error: "Your session has expired. Please log in again." }, 401);

  const entitlement = await env.DB.prepare(
    "SELECT id FROM beat_purchases WHERE user_id = ? AND beat_id = ? AND format = ? AND payment_status = 'paid' LIMIT 1"
  ).bind(user.user_id, beatId, format).first();
  if (!entitlement) return json({ error: "This beat is not in your paid purchases." }, 403);

  const file = await env.DB.prepare(
    "SELECT object_key FROM beat_files WHERE beat_id = ? AND format = ?"
  ).bind(beatId, format).first();
  if (!file) return json({ error: format.toUpperCase() + " file is not available for this beat." }, 404);

  const object = await env.MEDIA.get(file.object_key);
  if (!object) return json({ error: "The purchased file could not be found. Please contact support." }, 404);
  const beat = await env.DB.prepare("SELECT title FROM beats WHERE id = ? LIMIT 1").bind(beatId).first();
  const rawTitle = String(beat?.title || beatId)
    .replace(/[\\/\\\\\\u0000-\\u001f\\u007f]/g, " ")
    .replace(/[<>:"|?*]/g, "")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120) || beatId;
  const unicodeFilename = rawTitle + "." + format;
  const asciiName = rawTitle.normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120) || beatId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const encodedFilename = encodeURIComponent(unicodeFilename)
    .replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase());
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", format === "mp3" ? "audio/mpeg" : "audio/wav");
  headers.set("Content-Disposition", 'attachment; filename="' + asciiName + "." + format + '"; filename*=UTF-8\'\'' + encodedFilename);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}