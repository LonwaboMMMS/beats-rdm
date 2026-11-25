let beats=[],defaults={lease:350,nonExclusive:500,exclusive:2500},editing=null;
const $=s=>document.querySelector(s),money=n=>"R"+Number(n||0).toLocaleString("en-ZA");
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(msg){const el=$("#adminToast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2800);}
async function apiBeats(){const r=await fetch("/api/admin/beats",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load beats.");return d.beats||[];}
function render(){const live=beats.filter(b=>b.status==="live").length,draft=beats.filter(b=>b.status==="draft").length,sold=beats.filter(b=>b.status==="sold").length;$("#statLive").textContent=live;$("#statDrafts").textContent=draft;$("#statSold").textContent=sold;$("#statBids").textContent="0";
$("#beatRows").innerHTML=beats.map(b=>'<tr><td><div class="beat-cell">'+(b.artwork?'<img class="beat-thumb" src="'+escapeHtml(b.artwork)+'" alt="">':'<div class="beat-thumb" style="background:linear-gradient(135deg,#9b4d18,#211a24)">'+(b.symbol||"♫")+'</div>')+'<div><strong>'+escapeHtml(b.title)+'</strong><small>'+escapeHtml(b.producer)+'</small></div></div></td><td>'+escapeHtml(b.genre)+'<br><small>'+(b.bpm||"—")+' BPM · '+escapeHtml(b.key||"Key not set")+'</small></td><td><div class="price-stack"><span>Non-Exclusive (MP3) <b>'+money(b.lease)+'</b></span><span>Non-Exclusive (WAV) <b>'+money(b.nonExclusive)+'</b></span><span>Exclusive <b>'+money(b.exclusive)+'</b></span></div></td><td><span class="status-badge '+(b.status==="draft"?"draft":b.status==="sold"?"sold":"")+'">'+escapeHtml(b.status.toUpperCase())+'</span></td><td><div class="row-actions"><button data-edit="'+escapeHtml(b.id)+'">Edit</button>'+(b.status==="live"?'<button data-status="'+escapeHtml(b.id)+'" data-next="draft">Unpublish</button>':b.status==="draft"?'<button data-status="'+escapeHtml(b.id)+'" data-next="live">Publish</button>':"")+'</div></td></tr>').join("");
$("#noBeats").classList.toggle("hidden",beats.length>0);}
function showPanel(name){document.querySelectorAll(".admin-panel").forEach(p=>p.classList.toggle("hidden",p.id!=="panel-"+name));document.querySelectorAll(".admin-nav").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));$("#pageTitle").textContent=({overview:"Overview",beats:"Beat catalogue",bids:"Purchase bids",settings:"Store settings"})[name];}
document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>showPanel(b.dataset.panel)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPanel(b.dataset.go)));
function openModal(beat){editing=beat?.id??null;$("#beatForm").reset();$("#beatId").value=beat?.id??"";$("#modalTitle").textContent=beat?"Edit beat":"Add a beat";$("#beatTitle").value=beat?.title??"";$("#beatProducer").value=beat?.producer??"";$("#beatGenre").value=beat?.genre??"";$("#beatBpm").value=beat?.bpm??"";$("#beatKey").value=beat?.key??"";$("#beatLease").value=beat?.lease??defaults.lease;$("#beatNonExclusive").value=beat?.nonExclusive??defaults.nonExclusive;$("#beatExclusive").value=beat?.exclusive??defaults.exclusive;$("#beatDescription").value=beat?.description??"";$("#beatStatus").value=beat?.status??"draft";$("#beatModal").classList.remove("hidden");}
function closeModal(){$("#beatModal").classList.add("hidden");}
const uploadSlots=[["preview","beatPreview"],["mp3","beatMp3"],["wav","beatWav"],["artwork","beatArtwork"]];
function resetUploadProgress(){
 $("#uploadOverallStatus").textContent="Waiting for files";
 for(const [kind,inputId] of uploadSlots){const file=$("#"+inputId).files[0];$("#upload"+kind+"Name").textContent=file?file.name:"No file selected";$("#upload"+kind+"Percent").textContent="0%";$("#upload"+kind+"Bar").style.width="0%";$("#upload"+kind+"Speed").textContent=file?"Ready to upload":"—";}
}
function buildBeatForm(){
 const form=new FormData();
 for(const id of ["beatId","beatTitle","beatProducer","beatGenre","beatBpm","beatKey","beatLease","beatNonExclusive","beatExclusive","beatDescription","beatStatus"]){
  const el=$("#"+id),key=({beatId:"id",beatTitle:"title",beatProducer:"producer",beatGenre:"genre",beatBpm:"bpm",beatKey:"key",beatLease:"lease",beatNonExclusive:"nonExclusive",beatExclusive:"exclusive",beatDescription:"description",beatStatus:"status"})[id];form.set(key,el.value);
 }
 return form;
}
function uploadRequest(form,kind,file){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();let lastTime=performance.now(),lastLoaded=0;
  xhr.open("POST","/api/admin/beats");xhr.withCredentials=true;
  if(file)xhr.upload.addEventListener("progress",event=>{
   if(!event.lengthComputable)return;
   const percent=Math.min(99,Math.round(event.loaded/event.total*100)),now=performance.now(),seconds=(now-lastTime)/1000,speed=seconds>0?(event.loaded-lastLoaded)/seconds:0;
   $("#upload"+kind+"Percent").textContent=percent+"%";$("#upload"+kind+"Bar").style.width=percent+"%";
   $("#upload"+kind+"Speed").textContent=speed>=1048576?(speed/1048576).toFixed(2)+" MB/s":(speed/1024).toFixed(0)+" KB/s";
   lastTime=now;lastLoaded=event.loaded;
  });
  xhr.addEventListener("load",()=>{let data={};try{data=JSON.parse(xhr.responseText)}catch{}if(xhr.status<200||xhr.status>=300){reject(new Error(data.error||"Upload failed ("+xhr.status+")."));return;}if(file){$("#upload"+kind+"Percent").textContent="100%";$("#upload"+kind+"Bar").style.width="100%";$("#upload"+kind+"Speed").textContent="Complete";}resolve(data);});
  xhr.addEventListener("error",()=>reject(new Error("Network error while uploading "+(file?.name||"beat details")+".")));
  xhr.addEventListener("abort",()=>reject(new Error("Upload cancelled.")));
  xhr.send(form);
 });
}
$("#newBeat").addEventListener("click",()=>openModal());$("#closeModal").addEventListener("click",closeModal);$("#cancelModal").addEventListener("click",closeModal);$("#beatModal").addEventListener("click",e=>{if(e.target.id==="beatModal")closeModal();});
$("#beatRows").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]");if(edit){openModal(beats.find(b=>b.id===edit.dataset.edit));return;}const status=e.target.closest("[data-status]");if(status){const b=beats.find(x=>x.id===status.dataset.status);if(!b)return;const form=new FormData();Object.entries({id:b.id,title:b.title,producer:b.producer,genre:b.genre,bpm:b.bpm||"",key:b.key||"",description:b.description||"",lease:b.lease,nonExclusive:b.nonExclusive,exclusive:b.exclusive,status:status.dataset.next}).forEach(([k,v])=>form.set(k,v));status.disabled=true;try{const r=await fetch("/api/admin/beats",{method:"POST",body:form,credentials:"same-origin"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Could not update status.");beats=await apiBeats();render();toast(b.title+" is now "+status.dataset.next+".");}catch(err){toast(err.message);}finally{status.disabled=false;}}});
uploadSlots.forEach(([kind,inputId])=>$("#"+inputId).addEventListener("change",resetUploadProgress));
$("#beatForm").addEventListener("submit",async e=>{
 e.preventDefault();const submit=$("#beatForm button[type=submit]");submit.disabled=true;submit.textContent="Uploading…";resetUploadProgress();
 const files=uploadSlots.map(([kind,inputId])=>({kind,file:$("#"+inputId).files[0]})).filter(item=>item.file);
 try{
  const metadata=buildBeatForm();let result=await uploadRequest(metadata,null,null);const beatId=result.id||$("#beatId").value;
  $("#beatId").value=beatId;$("#uploadOverallStatus").textContent=files.length?"Uploading files…":"Saving beat details…";
  for(const item of files){const form=buildBeatForm();form.set("id",beatId);form.set(item.kind,item.file);await uploadRequest(form,item.kind,item.file);}
  beats=await apiBeats();render();$("#uploadOverallStatus").textContent="All uploads complete";closeModal();toast("Beat and files saved successfully.");
 }catch(err){$("#uploadOverallStatus").textContent="Upload incomplete";toast(err.message);}
 finally{submit.disabled=false;submit.textContent="Save beat";}
});
$("#priceSettings").addEventListener("submit",e=>{e.preventDefault();defaults={lease:Number($("#defaultLease").value),nonExclusive:Number($("#defaultNonExclusive").value),exclusive:Number($("#defaultExclusive").value)};localStorage.setItem("rdm_admin_preview_prices",JSON.stringify(defaults));toast("Default prices saved in this browser.");});
(async()=>{try{defaults={...defaults,...JSON.parse(localStorage.getItem("rdm_admin_preview_prices")||"{}")};$("#defaultLease").value=defaults.lease;$("#defaultNonExclusive").value=defaults.nonExclusive;$("#defaultExclusive").value=defaults.exclusive;beats=await apiBeats();render();}catch(err){toast(err.message);$("#beatRows").innerHTML='<tr><td colspan="5">'+escapeHtml(err.message)+'</td></tr>';}})();
