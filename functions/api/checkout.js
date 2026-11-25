const COOKIE = "rb_session";
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2,"0")).join("");
const tokenFrom = request => { const part=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"=")); return part?part.slice(COOKIE.length+1):""; };
const enc = value => encodeURIComponent(String(value)).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
function md5Hex(input){
 const bytes=[...new TextEncoder().encode(input)];const bitLength=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
 const low=bitLength>>>0,high=Math.floor(bitLength/4294967296);for(let i=0;i<4;i++)bytes.push((low>>>(8*i))&255);for(let i=0;i<4;i++)bytes.push((high>>>(8*i))&255);
 const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];const K=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 const rot=(x,n)=>(x<<n)|(x>>>(32-n));
 for(let offset=0;offset<bytes.length;offset+=64){const M=[];for(let j=0;j<16;j++){const p=offset+j*4;M[j]=(bytes[p]|(bytes[p+1]<<8)|(bytes[p+2]<<16)|(bytes[p+3]<<24))>>>0;}
 let A=a0,B=b0,C=c0,D=d0;
 for(let i=0;i<64;i++){let F,g,s;if(i<16){F=(B&C)|(~B&D);g=i;s=shifts[i%4];}else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)%16;s=shifts[4+i%4];}else if(i<48){F=B^C^D;g=(3*i+5)%16;s=shifts[8+i%4];}else{F=C^(B|~D);g=(7*i)%16;s=shifts[12+i%4];}
 const next=D;D=C;C=B;B=(B+rot((A+F+K[i]+M[g])|0,s))|0;A=next;
 }
 a0=(a0+A)|0;b0=(b0+B)|0;c0=(c0+C)|0;d0=(d0+D)|0;
 }
 return [a0,b0,c0,d0].map(n=>[0,8,16,24].map(s=>((n>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
}\nconst signature = async (data, passphrase) => {
  const pairs=Object.entries(data).filter(([,v])=>v!==""&&v!==null&&v!==undefined).map(([k,v])=>k+"="+enc(String(v).trim()));
  if(passphrase) pairs.push("passphrase="+enc(passphrase.trim()));
  const digest=await crypto.subtle.digest("MD5",new TextEncoder().encode(pairs.join("&")));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
};
export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:"Store database is unavailable."},503);
  if(!env.PAYFAST_MERCHANT_ID||!env.PAYFAST_MERCHANT_KEY||!env.PAYFAST_PASSPHRASE)return json({error:"PayFast Sandbox secrets are missing. Check the Cloudflare Pages Production secrets."},503);
  const token=tokenFrom(request); if(!token)return json({error:"Please sign in before checkout."},401);
  const user=await env.DB.prepare("SELECT users.id,users.email,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?").bind(await sha256(token),Date.now()).first();
  if(!user)return json({error:"Your session has expired. Please sign in again."},401);
  let body;try{body=await request.json()}catch{return json({error:"Invalid checkout request."},400)}
  if(!Array.isArray(body.items)||body.items.length<1||body.items.length>20)return json({error:"Your cart is empty or contains too many items."},400);
  const seen=new Set(), items=[]; let totalCents=0;
  for(const raw of body.items){
    const beatId=String(raw?.id||"");const format=String(raw?.format||"").toLowerCase();
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(beatId)||!["mp3","wav"].includes(format)||seen.has(beatId))return json({error:"Your cart contains an invalid or duplicate item."},400);
    seen.add(beatId);
    const beat=await env.DB.prepare("SELECT id,title,producer,artwork_key,price_mp3,price_wav,status FROM beats WHERE id=?").bind(beatId).first();
    if(!beat||beat.status!=="live")return json({error:"One of the beats in your cart is no longer available."},409);
    const file=await env.DB.prepare("SELECT object_key FROM beat_files WHERE beat_id=? AND format=?").bind(beatId,format).first();
    if(!file)return json({error:format.toUpperCase()+" download is not available for "+beat.title+"."},409);
    const price=Number(format==="wav"?beat.price_wav:beat.price_mp3);
    if(!Number.isSafeInteger(price)||price<=0)return json({error:"A valid price has not been set for "+beat.title+" ("+format.toUpperCase()+")."},409);
    const cents=price*100;if(!Number.isSafeInteger(cents))return json({error:"Invalid price."},400);
    totalCents+=cents;items.push({beatId,title:beat.title,producer:beat.producer,artwork:beat.artwork_key?"/api/media/"+encodeURIComponent(beat.id)+"/artwork":"",format,priceCents:cents,licence:format.toUpperCase()+" Lease"});
  }
  if(totalCents<500||totalCents>100000000)return json({error:"The checkout total must be at least R5.00 and within the supported limit."},400);
  const orderId=crypto.randomUUID();const now=Date.now();
  await env.DB.prepare("INSERT INTO beat_orders (id,user_id,amount_cents,currency,status,created_at) VALUES(?,?,?,'ZAR','pending',?)").bind(orderId,user.id,totalCents,now).run();
  for(const item of items) await env.DB.prepare("INSERT INTO beat_order_items (order_id,beat_id,beat_title,producer,artwork_url,format,licence,unit_price_cents) VALUES(?,?,?,?,?,?,?,?)").bind(orderId,item.beatId,item.title,item.producer,item.artwork,item.format,item.licence,item.priceCents).run();
  const name=String(user.name||"").trim().split(/\s+/);const base=new URL(request.url).origin;
  const params={
    merchant_id:env.PAYFAST_MERCHANT_ID,
    merchant_key:env.PAYFAST_MERCHANT_KEY,
    return_url:base+"/payment-return.html?order="+encodeURIComponent(orderId),
    cancel_url:base+"/payment-cancelled.html?order="+encodeURIComponent(orderId),
    notify_url:base+"/api/payfast/itn",
    name_first:name[0]||"Customer",
    name_last:name.slice(1).join(" ")||"Customer",
    email_address:user.email,
    m_payment_id:orderId,
    amount:(totalCents/100).toFixed(2),
    item_name:"Reverb Beats order "+orderId.slice(0,8),
    item_description:items.length+" beat licence"+(items.length===1?"":"s"),
    custom_str1:"reverb_beats"
  };
  const sig=await signature(params,env.PAYFAST_PASSPHRASE);params.signature=sig;
  return json({ok:true,action:"https://sandbox.payfast.co.za/eng/process",fields:params,orderId});
}
