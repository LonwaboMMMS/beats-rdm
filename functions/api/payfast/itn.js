const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const enc=value=>encodeURIComponent(String(value)).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
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
}
const safeEqual=(a,b)=>{if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;};
export async function onRequestPost({request,env}){
 if(!env.DB||!env.PAYFAST_MERCHANT_ID||!env.PAYFAST_PASSPHRASE)return new Response("Configuration error",{status:503});
 try{
  const raw=await request.text();const form=new URLSearchParams(raw);const data={};for(const [k,v] of form)data[k]=v;
  const supplied=data.signature||"";if(!supplied||!data.m_payment_id||!data.pf_payment_id)return new Response("Invalid notification",{status:400});
  const signed=Object.entries(data).filter(([k])=>k!=="signature").map(([k,v])=>k+"="+enc(v)).join("&")+"&passphrase="+enc(env.PAYFAST_PASSPHRASE.trim());
  const expected=md5Hex(signed);if(!safeEqual(supplied,expected))return new Response("Invalid signature",{status:400});
  if(String(data.merchant_id)!==String(env.PAYFAST_MERCHANT_ID))return new Response("Merchant mismatch",{status:400});
  if(data.payment_status!=="COMPLETE")return new Response("Payment not complete",{status:200});
  const order=await env.DB.prepare("SELECT id,amount_cents,status FROM beat_orders WHERE id=?").bind(data.m_payment_id).first();
  if(!order)return new Response("Unknown order",{status:404});
  if(Math.abs(Number(data.amount_gross)*100-Number(order.amount_cents))>0.5)return new Response("Amount mismatch",{status:400});
  const clientIp=request.headers.get("CF-Connecting-IP")||"";
  const dns=await fetch("https://cloudflare-dns.com/dns-query?name=sandbox.payfast.co.za&type=A",{headers:{accept:"application/dns-json"}});
  const dnsData=dns.ok?await dns.json():{};const allowedIps=(dnsData.Answer||[]).filter(x=>x.type===1).map(x=>x.data);
  if(!clientIp||!allowedIps.includes(clientIp))return new Response("Untrusted notification source",{status:403});
  const confirm=await fetch("https://sandbox.payfast.co.za/eng/query/validate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:signed});
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
