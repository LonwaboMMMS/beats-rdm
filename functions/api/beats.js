const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequestGet({env}){
 if(!env.DB||!env.MEDIA)return json({error:"Catalogue is not configured."},503);
 try{
  const result=await env.DB.prepare("SELECT id,title,producer,genre,bpm,musical_key AS musicalKey,description,price_mp3 AS priceMp3,price_wav AS priceWav,price_exclusive AS priceExclusive,artwork_key AS artworkKey FROM beats WHERE status='live' ORDER BY created_at DESC").all();
  const beats=await Promise.all((result.results||[]).map(async b=>{
   const f=await env.DB.prepare("SELECT object_key FROM beat_files WHERE beat_id=? AND format='preview'").bind(b.id).first();
   return {id:b.id,title:b.title,producer:b.producer,genre:b.genre,bpm:b.bpm,key:b.musicalKey,description:b.description,price:Number(b.priceMp3||0),priceMp3:Number(b.priceMp3||0),priceWav:Number(b.priceWav||0),priceExclusive:Number(b.priceExclusive||0),symbol:String((b.title||"♫").slice(0,2)).toUpperCase(),type:"REVERB BEATS",artwork:b.artworkKey?"/api/media/"+encodeURIComponent(b.id)+"/artwork":"",audio:f?.object_key?"/api/media/"+encodeURIComponent(b.id)+"/preview":""};
  }));
  return json({beats});
 }catch(e){console.error("[api/beats]",e?.message||e);return json({error:"Could not load catalogue."},500);}
}