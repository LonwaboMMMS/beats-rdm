const COOKIE = "rb_session";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, "0")).join("");
const getToken = request => {
  const part = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : "";
};
async function adminUser(request, env) {
  const token = getToken(request);
  if (!token || !env.DB || !env.ADMIN_EMAIL) return null;
  const user = await env.DB.prepare("SELECT users.id, users.email, users.is_admin FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?")
    .bind(await sha256(token), Date.now()).first();
  if (!user) return null;
  const allowed = user.email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase() || user.is_admin === 1;
  if (allowed && user.is_admin !== 1) await env.DB.prepare("UPDATE users SET is_admin=1 WHERE id=?").bind(user.id).run();
  return allowed ? user : null;
}
const extFor = (file, kind) => {
  const name = String(file.name || "").toLowerCase();
  if (kind === "preview") return name.endsWith(".mp3") ? "mp3" : name.endsWith(".wav") ? "wav" : name.endsWith(".ogg") ? "ogg" : "";
  if (kind === "mp3") return name.endsWith(".mp3") ? "mp3" : "";
  if (kind === "wav") return name.endsWith(".wav") ? "wav" : "";
  if (kind === "artwork") return name.endsWith(".jpg") || name.endsWith(".jpeg") ? "jpg" : name.endsWith(".png") ? "png" : name.endsWith(".webp") ? "webp" : "";
  return "";
};
const mime = ext => ({mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",jpg:"image/jpeg",png:"image/png",webp:"image/webp"})[ext] || "application/octet-stream";
const readFile = (form, name) => { const value = form.get(name); return value instanceof File && value.size ? value : null; };
export async function onRequest({ request, env }) {
  if (!env.DB || !env.MEDIA) return json({ error: "D1 (DB) or R2 (MEDIA) binding is missing. Check the Pages production bindings." }, 503);
  if (!await adminUser(request, env)) return json({ error: "Administrator access required. Please sign in with the admin account." }, 403);
  try {
    if (request.method === "GET") {
      const result = await env.DB.prepare("SELECT id,title,producer,genre,bpm,musical_key AS key,description,price_mp3 AS lease,price_wav AS nonExclusive,price_exclusive AS exclusive,status,artwork_key,created_at,updated_at FROM beats ORDER BY created_at DESC").all();
      return json({ beats: (result.results || []).map(b => ({ ...b, artwork: b.artwork_key ? "/api/media/" + encodeURIComponent(b.id) + "/artwork" : "" })) });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const form = await request.formData();
    const id = String(form.get("id") || "").trim();
    const title = String(form.get("title") || "").trim();
    const producer = String(form.get("producer") || "").trim();
    const genre = String(form.get("genre") || "").trim();
    const bpmRaw = String(form.get("bpm") || "").trim();
    const bpm = bpmRaw ? Number(bpmRaw) : null;
    const key = String(form.get("key") || "").trim();
    const description = String(form.get("description") || "").trim();
    const lease = Number(form.get("lease"));
    const nonExclusive = Number(form.get("nonExclusive"));
    const exclusive = Number(form.get("exclusive"));
    const status = String(form.get("status") || "draft");
    if (title.length < 1 || title.length > 120 || producer.length < 1 || producer.length > 100 || genre.length < 1 || genre.length > 60 ||
        (bpm !== null && (!Number.isInteger(bpm) || bpm < 1 || bpm > 300)) ||
        ![lease, nonExclusive, exclusive].every(n => Number.isSafeInteger(n) && n >= 0) ||
        !["draft","live","sold"].includes(status) || description.length > 2000) {
      return json({ error: "Check the beat details and prices. Some fields are invalid." }, 400);
    }
    const existing = id ? await env.DB.prepare("SELECT id,artwork_key FROM beats WHERE id=?").bind(id).first() : null;
    if (id && !existing) return json({ error: "That beat could not be found." }, 404);
    const beatId = existing ? id : crypto.randomUUID();
    const uploads = [
      ["preview", readFile(form,"preview"), 25 * 1024 * 1024],
      ["mp3", readFile(form,"mp3"), 45 * 1024 * 1024],
      ["wav", readFile(form,"wav"), 45 * 1024 * 1024],
      ["artwork", readFile(form,"artwork"), 10 * 1024 * 1024]
    ];
    const total = uploads.reduce((sum, item) => sum + (item[1]?.size || 0), 0);
    if (total > 90 * 1024 * 1024) return json({ error: "The combined upload is too large. Keep all selected files under 90 MB." }, 413);
    for (const [kind, file, max] of uploads) {
      if (!file) continue;
      const ext = extFor(file, kind);
      if (!ext || file.size > max) return json({ error: "Invalid file or file too large: " + kind + "." }, 400);
      if (kind === "artwork" && !["image/jpeg","image/png","image/webp"].includes(file.type)) return json({ error: "Artwork must be JPG, PNG or WebP." }, 400);
      if (kind !== "artwork" && !file.type.startsWith("audio/")) return json({ error: "Audio uploads must be valid audio files." }, 400);
    }
    const now = Date.now();
    let artworkKey = existing?.artwork_key || "";
    const uploadedKeys = [];
    try {
      for (const [kind, file] of uploads) {
        if (!file) continue;
        const ext = extFor(file, kind);
        const objectKey = kind === "artwork" ? "artwork/" + beatId + "/" + crypto.randomUUID() + "." + ext : "audio/" + beatId + "/" + kind + "/" + crypto.randomUUID() + "." + ext;
        await env.MEDIA.put(objectKey, file.stream(), { httpMetadata: { contentType: mime(ext), cacheControl: kind === "artwork" || kind === "preview" ? "public, max-age=3600" : "private, no-store" }, customMetadata: { beatId, kind } });
        uploadedKeys.push(objectKey);
        if (kind === "artwork") artworkKey = objectKey;
        else await env.DB.prepare("INSERT INTO beat_files (beat_id,format,object_key) VALUES(?,?,?) ON CONFLICT(beat_id,format) DO UPDATE SET object_key=excluded.object_key").bind(beatId, kind, objectKey).run();
      }
      await env.DB.prepare(`INSERT INTO beats (id,title,producer,genre,bpm,musical_key,description,price_mp3,price_wav,price_exclusive,status,artwork_key,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,producer=excluded.producer,genre=excluded.genre,bpm=excluded.bpm,musical_key=excluded.musical_key,description=excluded.description,price_mp3=excluded.price_mp3,price_wav=excluded.price_wav,price_exclusive=excluded.price_exclusive,status=excluded.status,artwork_key=excluded.artwork_key,updated_at=excluded.updated_at`)
        .bind(beatId,title,producer,genre,bpm,key,description,lease,nonExclusive,exclusive,status,artworkKey,existing ? now : now,now).run();
    } catch (error) {
      await Promise.all(uploadedKeys.map(key => env.MEDIA.delete(key).catch(() => {})));
      throw error;
    }
    return json({ ok: true, id: beatId, message: existing ? "Beat updated." : "Beat saved to the catalogue." }, existing ? 200 : 201);
  } catch (error) {
    console.error("[admin/beats]", error?.message || error);
    return json({ error: "Could not save the beat. Check the Pages Function logs and confirm migration 0005 has been applied." }, 500);
  }
}
