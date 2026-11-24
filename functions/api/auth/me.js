const COOKIE = "rb_session";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

const getCookie = (request) => {
  const part = (request.headers.get("Cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : "";
};

const digest = async (value) => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return json({ error: "Cloudflare D1 binding DB is not configured." }, 503);
  }

  try {
    const token = getCookie(request);
    if (!token) return json({ user: null });

    const user = await env.DB.prepare(
      "SELECT users.id, users.email, users.name, users.is_admin FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?"
    ).bind(await digest(token), Date.now()).first();

    if (
      user &&
      env.ADMIN_EMAIL &&
      user.email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase() &&
      user.is_admin !== 1
    ) {
      await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?")
        .bind(user.id)
        .run();
    }

    return json({
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin:
              user.is_admin === 1 ||
              (!!env.ADMIN_EMAIL &&
                user.email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase())
          }
        : null
    });
  } catch (error) {
    return json({ error: "Authentication service error. Check Cloudflare Pages Function logs." }, 500);
  }
}
