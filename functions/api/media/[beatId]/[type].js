const json = (data, status=404) => new Response(JSON.stringify(data), { status, headers: { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" } });
export async function onRequestGet({ params, env }) {
  if (!env.DB || !env.MEDIA) return json({ error:"Media storage is not configured." },503);
  const beatId = String(params.beatId || "");
  const type = String(params.type || "");
  if (!/^[a-f0-9-]{36}$/i.test(beatId) || !["preview","artwork"].includes(type)) return json({error:"Media not found."});
  let key = "";
  if (type === "artwork") {
    const beat = await env.DB.prepare("SELECT artwork_key FROM beats WHERE id=? AND status='live'").bind(beatId).first();
    key = beat?.artwork_key || "";
  } else {
    const beat = await env.DB.prepare("SELECT id FROM beats WHERE id=? AND status='live'").bind(beatId).first();
    if (!beat) return json({error:"Media not found."});
    const file = await env.DB.prepare("SELECT object_key FROM beat_files WHERE beat_id=? AND format='preview'").bind(beatId).first();
    key = file?.object_key || "";
  }
  if (!key) return json({error:"Media not found."});
  const object = await env.MEDIA.get(key);
  if (!object) return json({error:"Media not found."});
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control","public, max-age=3600");
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Access-Control-Allow-Origin","*");
  return new Response(object.body,{headers});
}
