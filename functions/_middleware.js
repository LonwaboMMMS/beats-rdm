const COOKIE="rb_session";
const sha256=async value=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
function getCookie(request){const part=(request.headers.get("Cookie")||"").split(";").map(value=>value.trim()).find(value=>value.startsWith(COOKIE+"="));return part?part.slice(COOKIE.length+1):"";}
const json=(data,status)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequest({request,env,next}){
 const url=new URL(request.url),protectedPath=url.pathname==="/admin.html"||url.pathname.startsWith("/api/admin/");
 if(!protectedPath)return next();
 if(!env.DB||!env.ADMIN_EMAIL)return json({error:"Admin access is not configured. Set the ADMIN_EMAIL variable and D1 binding in Cloudflare Pages."},503);
 const token=getCookie(request);
 if(!token)return Response.redirect(new URL("/auth.html?next=%2Fadmin.html",url),302);
 const user=await env.DB.prepare("SELECT users.id,users.email,users.is_admin FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?").bind(await sha256(token),Date.now()).first();
 if(!user)return Response.redirect(new URL("/auth.html?next=%2Fadmin.html",url),302);
 const configuredAdmin=user.email.toLowerCase()===env.ADMIN_EMAIL.trim().toLowerCase();
 if(configuredAdmin&&user.is_admin!==1)await env.DB.prepare("UPDATE users SET is_admin=1 WHERE id=?").bind(user.id).run();
 if(user.is_admin!==1&&!configuredAdmin)return json({error:"You do not have permission to access this page."},403);
 const response=await next(),headers=new Headers(response.headers);headers.set("Cache-Control","private, no-store");return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
