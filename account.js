const catalog=[
{id:1,title:"Midnight In Jozi",producer:"RDM Sounds",genre:"Amapiano",price:350,symbol:"01",cover:"linear-gradient(135deg,#9b4d18,#211a24)"},
{id:2,title:"No Pressure",producer:"Lwazi Beats",genre:"Hip-Hop",price:300,symbol:"02",cover:"linear-gradient(135deg,#344b5a,#151b27)"},
{id:3,title:"Sthandwa",producer:"Reverb Daily",genre:"Afrobeats",price:400,symbol:"03",cover:"linear-gradient(135deg,#a94c49,#42222d)"},
{id:4,title:"Sunday Service",producer:"FortyHz",genre:"R&B",price:350,symbol:"04",cover:"linear-gradient(135deg,#8b7950,#29241b)"},
{id:5,title:"iNumber",producer:"RDM Sounds",genre:"3-Step",price:450,symbol:"05",cover:"linear-gradient(135deg,#356d67,#142b2c)"},
{id:6,title:"Big Energy",producer:"Mass Made",genre:"Amapiano",price:350,symbol:"06",cover:"linear-gradient(135deg,#8b3d12,#301b14)"},
{id:7,title:"Blue Lights",producer:"Lwazi Beats",genre:"Hip-Hop",price:300,symbol:"07",cover:"linear-gradient(135deg,#435e8d,#171f36)"},
{id:8,title:"Summer Again",producer:"Reverb Daily",genre:"Afrobeats",price:400,symbol:"08",cover:"linear-gradient(135deg,#bd7c36,#54301b)"}];
const read=(k)=>{try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]}};
const money=n=>"R"+Number(n).toFixed(2);
function renderSection(key,gridId,emptyId,labelId){const ids=read("rdm_"+key);const items=catalog.filter(b=>ids.includes(b.id));document.getElementById(labelId).textContent=items.length+" items";document.getElementById(emptyId).style.display=items.length?"none":"block";document.getElementById(gridId).innerHTML=items.map(b=>'<article class="account-card"><div class="account-card-art" style="--cover:'+b.cover+'">'+b.symbol+'</div><h3>'+b.title+'</h3><p>'+b.producer+' · '+b.genre+'</p><div class="account-card-bottom"><strong>'+money(b.price)+'</strong>'+(key==="purchased"?'<button type="button" disabled>Purchased</button>':'<button type="button" data-remove="'+key+'" data-id="'+b.id+'">Remove</button>')+'</div></article>').join("");document.getElementById(key+"Count").textContent=items.length;}
function render(){renderSection("purchased","purchasedGrid","purchasedEmpty","purchasedLabel");renderSection("liked","likedGrid","likedEmpty","likedLabel");renderSection("wishlist","wishlistGrid","wishlistEmpty","wishlistLabel");}
document.addEventListener("click",e=>{const btn=e.target.closest("[data-remove]");if(!btn)return;const key="rdm_"+btn.dataset.remove;const ids=read(btn.dataset.remove).filter(id=>id!==Number(btn.dataset.id));localStorage.setItem(key,JSON.stringify(ids));render();const t=document.getElementById("toast");t.textContent="Removed from your "+(btn.dataset.remove==="liked"?"liked beats":"want-to-buy list")+".";
t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800);});
render();