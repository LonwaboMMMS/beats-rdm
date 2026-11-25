const catalog=[
{id:1,title:"Midnight In Jozi",producer:"RDM Sounds",genre:"Amapiano",price:350,symbol:"01",cover:"linear-gradient(135deg,#9b4d18,#211a24)"},
{id:2,title:"No Pressure",producer:"Lwazi Beats",genre:"Hip-Hop",price:300,symbol:"02",cover:"linear-gradient(135deg,#344b5a,#151b27)"},
{id:3,title:"Sthandwa",producer:"Reverb Daily",genre:"Afrobeats",price:400,symbol:"03",cover:"linear-gradient(135deg,#a94c49,#42222d)"},
{id:4,title:"Sunday Service",producer:"FortyHz",genre:"R&B",price:350,symbol:"04",cover:"linear-gradient(135deg,#8b7950,#29241b)"},
{id:5,title:"iNumber",producer:"RDM Sounds",genre:"3-Step",price:450,symbol:"05",cover:"linear-gradient(135deg,#356d67,#142b2c)"},
{id:6,title:"Big Energy",producer:"Mass Made",genre:"Amapiano",price:350,symbol:"06",cover:"linear-gradient(135deg,#8b3d12,#301b14)"},
{id:7,title:"Blue Lights",producer:"Lwazi Beats",genre:"Hip-Hop",price:300,symbol:"07",cover:"linear-gradient(135deg,#435e8d,#171f36)"},
{id:8,title:"Summer Again",producer:"Reverb Daily",genre:"Afrobeats",price:400,symbol:"08",cover:"linear-gradient(135deg,#bd7c36,#54301b)"}];
const read=k=>{try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]}};
const money=n=>"R"+Number(n).toFixed(2);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let purchases=[];
function renderPurchases(){
 const grid=document.getElementById("purchasedGrid"),empty=document.getElementById("purchasedEmpty");
 document.getElementById("purchasedLabel").textContent=purchases.length+" items";
 document.getElementById("purchasedCount").textContent=purchases.length;
 empty.style.display=purchases.length?"none":"block";
 grid.innerHTML=purchases.map(item=>{
  const artwork=item.artwork?'<img src="'+escapeHtml(item.artwork)+'" alt="" loading="lazy">':'<span>♫</span>';
  const id=encodeURIComponent(item.beatId);const format=item.format==="wav"?"wav":"mp3";
  const filename=String(item.title||"beat").replace(/[\\/\\\\\\u0000-\\u001f\\u007f<>:"|?*]/g," ").replace(/\\s+/g," ").trim().replace(/[. ]+$/g,"").slice(0,120)||"beat";
  return '<article class="account-card"><div class="account-card-art">'+artwork+'</div><h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.producer)+' · '+escapeHtml(item.licence)+'</p><div class="account-card-bottom"><a class="download-button" data-download-name="'+escapeHtml(filename+'.'+format)+'" href="/api/download/'+id+'/'+format+'">'+format.toUpperCase()+' ↓</a></div></article>';
 }).join("");
}
function renderLiked(){
 const items=catalog.filter(b=>read("rdm_wishlist").includes(b.id));
 document.getElementById("likedLabel").textContent=items.length+" items";
 document.getElementById("likedCount").textContent=items.length;
 document.getElementById("likedEmpty").style.display=items.length?"none":"block";
 document.getElementById("likedGrid").innerHTML=items.map(b=>'<article class="account-card"><div class="account-card-art" style="--cover:'+b.cover+'">'+b.symbol+'</div><h3>'+escapeHtml(b.title)+'</h3><p>'+escapeHtml(b.producer)+' · '+escapeHtml(b.genre)+'</p><div class="account-card-bottom"><strong>'+money(b.price)+'</strong><button type="button" data-remove="wishlist" data-id="'+b.id+'">Remove</button></div></article>').join("");
}
async function loadPurchases(){
 try{
  const response=await fetch("/api/account/purchases",{credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw new Error("Could not load purchases.");
  const data=await response.json();
  purchases=Array.isArray(data.purchases)?data.purchases:[];
  renderPurchases();
 }catch(error){
  purchases=[];
  renderPurchases();
  const empty=document.getElementById("purchasedEmpty");
  empty.querySelector("p").textContent="Your paid purchases will appear here. Download access becomes available once your account and purchase records are connected.";
 }
}
document.addEventListener("click",async event=>{
 const download=event.target.closest("a[data-download-name]");
 if(download){
  event.preventDefault();
  if(download.dataset.downloading==="1")return;
  download.dataset.downloading="1";
  const original=download.textContent;
  download.textContent="Preparing…";
  try{
   const response=await fetch(download.href,{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw new Error("Download failed ("+response.status+"). Please sign in again or contact support.");
   const blob=await response.blob();
   const objectUrl=URL.createObjectURL(blob);
   const temporary=document.createElement("a");
   temporary.href=objectUrl;
   temporary.download=download.dataset.downloadName||"beat.mp3";
   document.body.appendChild(temporary);
   temporary.click();
   temporary.remove();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  }catch(error){
   alert(error.message||"Could not download this beat. Please try again.");
  }finally{
   download.textContent=original;
   delete download.dataset.downloading;
  }
  return;
 }
 const button=event.target.closest("[data-remove]");
 if(!button)return;
 localStorage.setItem("rdm_wishlist",JSON.stringify(read("rdm_wishlist").filter(id=>id!==Number(button.dataset.id))));
 renderLiked();
 const toast=document.getElementById("toast");
 toast.textContent="Removed from your liked beats.";
 toast.classList.add("show");
 setTimeout(()=>toast.classList.remove("show"),1800);
});
renderLiked();
loadPurchases();