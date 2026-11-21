const beats = [
 {id:1,title:"Midnight In Jozi",producer:"RDM Sounds",genre:"Amapiano",bpm: 112,key:"F# Min",price:350,symbol:"01",type:"PRIVATE HOURS",cover:"linear-gradient(135deg,#9b4d18,#211a24)",audio:""},
 {id:2,title:"No Pressure",producer:"Lwazi Beats",genre:"Hip-Hop",bpm:94,key:"C Min",price:300,symbol:"02",type:"AFTER HOURS",cover:"linear-gradient(135deg,#344b5a,#151b27)",audio:""},
 {id:3,title:"Sthandwa",producer:"Reverb Daily",genre:"Afrobeats",bpm:102,key:"A Min",price:400,symbol:"03",type:"LOVE NOTES",cover:"linear-gradient(135deg,#a94c49,#42222d)",audio:""},
 {id:4,title:"Sunday Service",producer:"FortyHz",genre:"R&B",bpm:78,key:"D Maj",price:350,symbol:"04",type:"SLOW MOTION",cover:"linear-gradient(135deg,#8b7950,#29241b)",audio:""},
 {id:5,title:"iNumber",producer:"RDM Sounds",genre:"3-Step",bpm:118,key:"G Min",price:450,symbol:"05",type:"NEW FREQUENCY",cover:"linear-gradient(135deg,#356d67,#142b2c)",audio:""},
 {id:6,title:"Big Energy",producer:"Mass Made",genre:"Amapiano",bpm: 110,key:"B Min",price:350,symbol:"06",type:"MAIN CHARACTER",cover:"linear-gradient(135deg,#8b3d12,#301b14)",audio:""},
 {id:7,title:"Blue Lights",producer:"Lwazi Beats",genre:"Hip-Hop",bpm:88,key:"E Min",price:300,symbol:"07",type:"CITY STORIES",cover:"linear-gradient(135deg,#435e8d,#171f36)",audio:""},
 {id:8,title:"Summer Again",producer:"Reverb Daily",genre:"Afrobeats",bpm:108,key:"D Min",price:400,symbol:"08",type:"GOLDEN HOUR",cover:"linear-gradient(135deg,#bd7c36,#54301b)",audio:""}
];
const readStore=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const writeStore=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const state={genre:"All",query:"",cart:readStore("rdm_cart"),liked:readStore("rdm_liked"),wishlist:readStore("rdm_wishlist"),purchased:readStore("rdm_purchased"),current:null};
const $=s=>document.querySelector(s);
const money=n=>"R"+n.toFixed(2);
function renderBeats(){
 const filtered=beats.filter(b=>(state.genre==="All"||b.genre===state.genre)&&((b.title+" "+b.producer+" "+b.genre).toLowerCase().includes(state.query)));
 $("#beatGrid").innerHTML=filtered.map(b=>`<article class="beat-card"><div class="cover" style="--cover:${b.cover}"><span class="cover-symbol">${b.symbol}</span><span class="cover-type">${b.type}</span><button class="wishlist-button ${state.wishlist.includes(b.id)?"saved":""}" data-wishlist="${b.id}" aria-label="Save ${b.title} to wishlist">${state.wishlist.includes(b.id)?"♥":"♡"}</button><button class="cover-play" data-play="${b.id}" aria-label="Preview ${b.title}">▶</button></div><h3 class="beat-title">${b.title}</h3><p class="beat-producer">${b.producer} · ${b.genre} · ${b.bpm} BPM</p><div class="beat-bottom"><span class="beat-price">${money(b.price)}</span><button class="add-button" data-add="${b.id}">+ Add beat</button></div></article>`).join("");
 $("#resultCount").textContent=filtered.length+" beats";
 $("#emptyState").classList.toggle("hidden",filtered.length>0);
}
function renderCart(){
 writeStore("rdm_cart",state.cart);
 $("#cartCount").textContent=state.cart.length;$("#drawerCount").textContent="("+state.cart.length+")";
 $("#cartTotal").textContent=money(state.cart.reduce((sum,id)=>sum+beats.find(b=>b.id===id).price,0));
 $("#cartItems").innerHTML=state.cart.length?state.cart.map(id=>{const b=beats.find(x=>x.id===id);return `<div class="cart-line"><div class="cart-line-art">${b.symbol}</div><div class="cart-line-info"><strong>${b.title}</strong><span>${b.producer} · ${b.genre}</span></div><span class="cart-line-price">${money(b.price)}</span><button class="remove-item" data-remove="${id}" aria-label="Remove ${b.title}">×</button></div>`}).join(""):'<p class="cart-empty">Your cart is waiting for a beat.</p>';
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2200)}
function playBeat(id){
 const b=beats.find(x=>x.id===id);if(!b)return;state.current=id;
 $("#nowTitle").textContent=b.title;$("#nowProducer").textContent=b.producer;$("#nowArt").textContent=b.symbol;
 $("#likeNow").classList.toggle("liked",state.liked.includes(id));$("#likeNow").textContent=state.liked.includes(id)?"♥":"♡";
 const audio=$("#audioPlayer");if(b.audio){audio.src=b.audio;audio.play().then(()=>$("#mainPlay").textContent="Ⅱ").catch(()=>toast("Could not play this preview."));}
 else{$("#mainPlay").textContent="▶";toast("Add a preview audio file for this beat to enable playback.");}
}
function openCart(){$("#cartOverlay").classList.remove("hidden");}
document.addEventListener("click",e=>{
 const play=e.target.closest("[data-play]");if(play)playBeat(Number(play.dataset.play));
 const add=e.target.closest("[data-add]");if(add){const id=Number(add.dataset.add);if(!state.cart.includes(id)){state.cart.push(id);renderCart();toast("Beat added to your cart.");}else toast("This beat is already in your cart.");}
 const remove=e.target.closest("[data-remove]");if(remove){state.cart=state.cart.filter(id=>id!==Number(remove.dataset.remove));renderCart();}
 const wish=e.target.closest("[data-wishlist]");if(wish){const id=Number(wish.dataset.wishlist);state.wishlist=state.wishlist.includes(id)?state.wishlist.filter(x=>x!==id):[...state.wishlist,id];writeStore("rdm_wishlist",state.wishlist);wish.classList.toggle("saved",state.wishlist.includes(id));wish.textContent=state.wishlist.includes(id)?"♥":"♡";toast(state.wishlist.includes(id)?"Saved to your want-to-buy list.":"Removed from your list.");}
 const genre=e.target.closest("[data-genre]");if(genre){state.genre=genre.dataset.genre;document.querySelectorAll(".genre-chip").forEach(x=>x.classList.toggle("active",x===genre));renderBeats();}
 const nav=e.target.closest("[data-view]");if(nav){document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===nav.dataset.view));if(nav.dataset.view==="favorites"){state.genre="All";state.query="";$("#searchInput").value="";$("#beatHeading").textContent="Your liked beats";$("#beatGrid").innerHTML=beats.filter(b=>state.liked.includes(b.id)).map(b=>`<article class="beat-card"><div class="cover" style="--cover:${b.cover}"><span class="cover-symbol">${b.symbol}</span><button class="cover-play" data-play="${b.id}">▶</button></div><h3 class="beat-title">${b.title}</h3><p class="beat-producer">${b.producer} · ${b.genre}</p><div class="beat-bottom"><span class="beat-price">${money(b.price)}</span><button class="add-button" data-add="${b.id}">+ Add beat</button></div></article>`).join("");$("#emptyState").classList.toggle("hidden",state.liked.length>0);$("#resultCount").textContent=state.liked.length+" beats";}else{$("#beatHeading").textContent=nav.dataset.view==="library"?"Your library":"Made for the moment";renderBeats();}$("#beatsSection").scrollIntoView({behavior:"smooth"});}
});
$("#searchInput").addEventListener("input",e=>{state.query=e.target.value.toLowerCase().trim();$("#beatHeading").textContent=state.query?"Search results":"Made for the moment";renderBeats();});
$("#cartOpen").addEventListener("click",openCart);$("#mobileCart").addEventListener("click",openCart);$("#queueOpen").addEventListener("click",openCart);$("#cartClose").addEventListener("click",()=>$("#cartOverlay").classList.add("hidden"));$("#cartOverlay").addEventListener("click",e=>{if(e.target.id==="cartOverlay")$("#cartOverlay").classList.add("hidden");});
$("#seeAll").addEventListener("click",()=>$("#beatsSection").scrollIntoView({behavior:"smooth"}));$("#featuredExplore").addEventListener("click",()=>$("#beatsSection").scrollIntoView({behavior:"smooth"}));
$("#likeNow").addEventListener("click",()=>{if(!state.current){toast("Play a beat first.");return;}const id=state.current;state.liked=state.liked.includes(id)?state.liked.filter(x=>x!==id):[...state.liked,id];writeStore("rdm_liked",state.liked);$("#likeNow").classList.toggle("liked",state.liked.includes(id));$("#likeNow").textContent=state.liked.includes(id)?"♥":"♡";toast(state.liked.includes(id)?"Added to liked beats.":"Removed from liked beats.");});
$("#mainPlay").addEventListener("click",()=>{const a=$("#audioPlayer");if(!state.current){playBeat(beats[0].id);return;}if(!a.src){toast("This beat has no preview audio yet.");return;}if(a.paused){a.play();$("#mainPlay").textContent="Ⅱ";}else{a.pause();$("#mainPlay").textContent="▶";}});
$("#audioPlayer").addEventListener("timeupdate",()=>{const a=$("#audioPlayer");$("#progress").value=a.duration?(a.currentTime/a.duration)*100:0;$("#currentTime").textContent=clock(a.currentTime);$("#duration").textContent=clock(a.duration||0);});
$("#progress").addEventListener("input",e=>{const a=$("#audioPlayer");if(a.duration)a.currentTime=(e.target.value/100)*a.duration;});$("#volume").addEventListener("input",e=>$("#audioPlayer").volume=e.target.value);
$("#audioPlayer").addEventListener("ended",()=>$("#mainPlay").textContent="▶");
function clock(s){return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")}
$("#prevTrack").addEventListener("click",()=>{const i=beats.findIndex(b=>b.id===state.current);playBeat(beats[(i-1+beats.length)%beats.length].id);});$("#nextTrack").addEventListener("click",()=>{const i=beats.findIndex(b=>b.id===state.current);playBeat(beats[(i+1)%beats.length].id);});
$("#checkoutButton").addEventListener("click",()=>toast("Checkout is not connected yet. Next: integrate PayFast."));
document.addEventListener("keydown",e=>{if(e.key==="/"&&document.activeElement.tagName!=="INPUT"){e.preventDefault();$("#searchInput").focus();}if(e.key==="Escape")$("#cartOverlay").classList.add("hidden");});
renderBeats();renderCart();