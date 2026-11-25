const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const enc=value=>encodeURIComponent(String(value)).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
const md5=async value=>[...new Uint8Array(await crypto.subtle.digest("MD5",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const safeEqual=(a,b)=>{if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;};
export async function onRequestPost({request,env}){
 if(!env.DB||!env.PAYFAST_MERCHANT_ID||!env.PAYFAST_PASSPHRASE)return new Response("Configuration error",{status:503});
 try{
  const raw=await request.text();const form=new URLSearchParams(raw);const data={};for(const [k,v] of form)data[k]=v;
  const supplied=data.signature||"";if(!supplied||!data.m_payment_id||!data.pf_payment_id)return new Response("Invalid notification",{status:400});
  const signed=Object.entries(data).filter(([k])=>k!=="signature").map(([k,v])=>k+"="+enc(v)).join("&")+"&passphrase="+enc(env.PAYFAST_PASSPHRASE.trim());
  const expected=await md5(signed);if(!safeEqual(supplied,expected))return new Response("Invalid signature",{status:400});
  if(String(data.merchant_id)!==String(env.PAYFAST_MERCHANT_ID))return new Response("Merchant mismatch",{status:400});
  if(data.payment_status!=="COMPLETE")return new Response("Payment not complete",{status:200});
  const order=await env.DB.prepare("SELECT id,amount_cents,status FROM beat_orders WHERE id=?").bind(data.m_payment_id).first();
  if(!order)return new Response("Unknown order",{status:404});
  if(Math.abs(Number(data.amount_gross)*100-Number(order.amount_cents))>0.5)return new Response("Amount mismatch",{status:400});
  const confirm=await fetch("https://sandbox.payfast.co.za/eng/query/validate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:raw});
  const confirmation=(await confirm.text()).trim();if(!confirm.ok||confirmation!=="VALID")return new Response("PayFast validation failed",{status:400});
  if(order.status==="paid")return new Response("OK",{status:200});
  const existing=await env.DB.prepare("SELECT id FROM beat_orders WHERE pf_payment_id=?").bind(String(data.pf_payment_id)).first();
  if(existing&&existing.id!==order.id)return new Response("Payment ID already used",{status:409});
  const items=await env.DB.prepare("SELECT beat_id,beat_title,producer,artwork_url,format,licence FROM beat_order_items WHERE order_id=?").bind(order.id).all();
  await env.DB.prepare("UPDATE beat_orders SET status='paid',pf_payment_id=?,paid_at=? WHERE id=? AND status='pending'").bind(String(data.pf_payment_id),Date.now(),order.id).run();
  for(const item of items.results||[]){
    await env.DB.prepare("INSERT INTO beat_purchases (user_id,beat_id,beat_title,producer,artwork_url,licence,payment_status,purchased_at,format,order_id) SELECT user_id,?,?,?,?,?,'paid',?,?,? FROM beat_orders WHERE id=? ON CONFLICT(user_id,beat_id,licence) DO UPDATE SET payment_status='paid',purchased_at=excluded.purchased_at,format=excluded.format,order_id=excluded.order_id")
      .bind(item.beat_id,item.beat_title,item.producer,item.artwork_url,item.licence,Date.now(),item.format,order.id,order.id).run();
  }
  return new Response("OK",{status:200});
 }catch(error){console.error("[payfast/itn]",error?.message||error);return new Response("Notification processing error",{status:500});}
}
