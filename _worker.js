const IMG=[[[0x25,0x50,0x44,0x46],0,"application/pdf"],[[0xff,0xd8,0xff],0,"image/jpeg"],[[0x89,0x50,0x4e,0x47],0,"image/png"]];
const AUD=[[[0x1a,0x45,0xdf,0xa3],0,"audio/webm"],[[0x4f,0x67,0x67,0x53],0,"audio/ogg"],[[0x66,0x74,0x79,0x70],4,"audio/mp4"],[[0x49,0x44,0x33],0,"audio/mpeg"],[[0xff,0xfb],0,"audio/mpeg"],[[0x52,0x49,0x46,0x46],0,"audio/wav"]];
const sniff=(b,T)=>T.find(([m,o])=>m.every((v,k)=>b[o+k]===v));
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const TTL=90*86400,STAT=["New","In progress","Awaiting client","Quoted","Delivered","Closed"];
const clean=(s,n)=>String(s||"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").trim().slice(0,n);
async function notify(env,r){
 const topic=env.NTFY_TOPIC||"dastawaiz-c93ac7ff3373";
 const body=`${r.id} · ${r.service||"General"}${r.voice?" · voice note":""}${r.terms?" · special terms":""}${r.files.length?" · "+r.files.length+" file(s)":""}`;
 try{await fetch(`https://ntfy.sh/${topic}`,{method:"POST",body,headers:{"Title":"New DASTAWAIZ client request","Tags":"bell","Priority":"high","Click":"https://dastawaiz.com/api/admin"}})}catch{}
 if(env.TG_TOKEN&&env.TG_CHAT){try{await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:env.TG_CHAT,text:"New DASTAWAIZ request "+body})})}catch{}}}
async function upload(request,env,ctx){
 if(!env.UPLOADS)return J({ok:false,error:"Storage not configured"},500);
 const len=+request.headers.get("content-length")||0;if(len>70*1048576)return J({ok:false,error:"Too large"},413);
 let fd;try{fd=await request.formData()}catch{return J({ok:false,error:"Bad request"},400)}
 if(fd.get("website"))return J({ok:true,id:"OK"});
 const name=clean(fd.get("name"),100),phone=clean(fd.get("phone"),20);
 if(!name||!/^[0-9+\-\s]{10,20}$/.test(phone))return J({ok:false,error:"Name and phone required"},400);
 const files=fd.getAll("files").filter(f=>typeof f==="object"&&f.size),vf=fd.get("voice"),voice=vf&&typeof vf==="object"&&vf.size?vf:null,terms=clean(fd.get("terms"),1500);
 if(files.length>10)return J({ok:false,error:"Max 10 files"},400);
 if(!files.length&&!voice&&!terms)return J({ok:false,error:"Add a file, special terms or a voice note"},400);
 const id=Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase(),list=[];let i=0,vm=null;
 for(const f of files){if(f.size>10*1048576)return J({ok:false,error:"File over 10 MB"},400);
  const b=new Uint8Array(await f.arrayBuffer()),t=sniff(b,IMG);if(!t)return J({ok:false,error:"Only PDF, JPG, PNG allowed"},400);
  const key=`f:${id}:${i++}`;await env.UPLOADS.put(key,b,{expirationTtl:TTL,metadata:{type:t[2]}});list.push({key,name:clean(f.name||"file",80).replace(/[^\w.\- ]/g,"_"),type:t[2],size:b.length})}
 if(voice){if(voice.size>6*1048576)return J({ok:false,error:"Voice note too long"},400);
  const b=new Uint8Array(await voice.arrayBuffer()),t=sniff(b,AUD);if(!t)return J({ok:false,error:"Unsupported voice format"},400);
  const key=`f:${id}:v`;await env.UPLOADS.put(key,b,{expirationTtl:TTL,metadata:{type:t[2]}});vm={key,type:t[2],size:b.length,secs:Math.min(600,+fd.get("voice_secs")||0)}}
 const rec={id,name,phone,service:clean(fd.get("service"),60),notes:clean(fd.get("notes"),1000),terms,voice:vm,time:new Date().toISOString(),files:list,status:"New",assignee:"",note:"",seen:false,hist:[{t:new Date().toISOString(),s:"Received"}]};
 await env.UPLOADS.put(`r:${id}`,JSON.stringify(rec),{expirationTtl:TTL});ctx.waitUntil(notify(env,rec));
 return J({ok:true,id});}

const auth=(request,env)=>{const u=new URL(request.url),k=request.headers.get("x-key")||u.searchParams.get("key")||"",a=env.ADMIN_KEY||"";if(!a||k.length!==a.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=k.charCodeAt(i)^a.charCodeAt(i);return d===0};
async function records(env){const out=[];let cursor;do{const ls=await env.UPLOADS.list({prefix:"r:",cursor,limit:1000});out.push(...await Promise.all(ls.keys.map(k=>env.UPLOADS.get(k.name,"json"))));cursor=ls.list_complete?null:ls.cursor}while(cursor);return out.filter(Boolean).sort((a,b)=>b.time.localeCompare(a.time))}
async function update(request,env){let b;try{b=await request.json()}catch{return J({ok:false},400)}
 if(!/^[A-Z0-9]+$/.test(b.id||""))return J({ok:false},400);const r=await env.UPLOADS.get(`r:${b.id}`,"json");if(!r)return J({ok:false,error:"Not found"},404);
 if(b.status&&STAT.includes(b.status)&&b.status!==r.status){r.status=b.status;(r.hist=r.hist||[]).push({t:new Date().toISOString(),s:b.status})}
 if("assignee" in b)r.assignee=clean(b.assignee,40);if("note" in b)r.note=clean(b.note,1000);if(b.seen)r.seen=true;
 await env.UPLOADS.put(`r:${r.id}`,JSON.stringify(r),{expirationTtl:TTL});return J({ok:true,rec:r})}
async function file(request,env){const u=new URL(request.url),k=u.searchParams.get("k")||"";if(!/^f:[A-Z0-9]+:(\d+|v)$/.test(k))return new Response("Bad",{status:400});
 const{value,metadata}=await env.UPLOADS.getWithMetadata(k,"arrayBuffer");if(!value)return new Response("Not found",{status:404});
 const n=(u.searchParams.get("n")||"file").replace(/[^\w.\- ]/g,"_"),inline=u.searchParams.get("play")==="1";
 return new Response(value,{headers:{"content-type":metadata?.type||"application/octet-stream","content-disposition":`${inline?"inline":"attachment"}; filename="${n}"`,"cache-control":"no-store","x-content-type-options":"nosniff"}});}
const PANEL=`<!doctype html><html lang=en><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>DASTAWAIZ Consultant Panel</title>
<style>:root{--bg:#f6f6fb;--fg:#1c1b2e;--c:#fff;--l:#dcdcec;--a:#2e1cff;--m:#5b5a73}@media(prefers-color-scheme:dark){:root{--bg:#14131f;--fg:#ececf6;--c:#1e1d30;--l:#2d2c44;--a:#8a7dff;--m:#a5a4bd}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:12px}main{max-width:900px;margin:auto}
h1{font-size:1.3rem;margin:4px 0}.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}.bar>*{min-width:0}input,select,textarea,button{font:inherit;padding:8px;border:1px solid var(--l);border-radius:8px;background:var(--c);color:var(--fg)}button{cursor:pointer}button.p{background:var(--a);color:#fff;border:0}
.card{background:var(--c);border:1px solid var(--l);border-left:5px solid var(--a);border-radius:12px;padding:12px;margin:10px 0}.card.n{border-left-color:#e8590c}.tag{display:inline-block;font-size:.75rem;padding:1px 8px;border-radius:12px;background:var(--a);color:#fff;margin-right:4px}.tag.u{background:#d33}
.terms{background:#fff8d6;color:#1c1b2e;border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}.m{color:var(--m);font-size:.85rem}audio{width:100%;margin:6px 0}a{color:var(--a)}
.row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.row>*{flex:1 1 140px;min-width:0}#bd{background:#d33;color:#fff;border-radius:12px;padding:0 9px;font-size:.85rem}</style>
<main><h1>DASTAWAIZ Consultant Panel <span id=bd hidden></span></h1>
<div class=bar><input id=q placeholder="Search name, phone, ID…" style="flex:1 1 200px"><select id=fs><option value="">All statuses</option></select><select id=fa><option value="">All consultants</option></select><button id=nt class=p>🔔 Enable alerts</button><button id=cs>⬇ CSV</button></div>
<div class=m id=st></div><div id=ls></div></main>
<script>
const K=new URLSearchParams(location.search).get("key")||"",H={"x-key":K},ST=${JSON.stringify(STAT)};let R=[],seen=new Set(),first=true;
const $=i=>document.getElementById(i),E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
for(const s of ST){$("fs").append(new Option(s,s))}
const beep=()=>{try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch{}};
$("nt").onclick=async()=>{if("Notification"in window){const p=await Notification.requestPermission();$("nt").textContent=p==="granted"?"🔔 Alerts on":"🔕 Alerts blocked"}};
async function api(p,o){const r=await fetch(p,{...o,headers:{...H,...(o&&o.headers)}});if(r.status===401){$("st").textContent="Unauthorized — open the panel link with your key.";throw 0}return r.json()}
async function load(){let d;try{d=await api("/api/records")}catch{return}R=d.records;const nw=R.filter(r=>!seen.has(r.id));
 if(!first&&nw.length){beep();if(Notification.permission==="granted")new Notification("New client submission",{body:nw.map(r=>r.name+" · "+r.service).join("\\n")})}
 R.forEach(r=>seen.add(r.id));first=false;const un=R.filter(r=>!r.seen).length;$("bd").hidden=!un;$("bd").textContent=un+" new";document.title=(un?"("+un+") ":"")+"DASTAWAIZ Consultant Panel";
 const as=[...new Set(R.map(r=>r.assignee).filter(Boolean))];const cur=$("fa").value;$("fa").length=1;as.forEach(a=>$("fa").append(new Option(a,a)));$("fa").value=cur;draw()}
function draw(){const q=$("q").value.toLowerCase(),fs=$("fs").value,fa=$("fa").value,L=$("ls");L.textContent="";
 const v=R.filter(r=>(!fs||r.status===fs)&&(!fa||r.assignee===fa)&&(!q||(r.name+r.phone+r.id).toLowerCase().includes(q)));$("st").textContent=v.length+" of "+R.length+" · auto-refreshes every 20 s";
 for(const r of v){const c=E("div","card"+(r.seen?"":" n")),h=E("div");if(!r.seen)h.append(E("span","tag u","NEW"));h.append(E("span","tag",r.status),E("b",0,r.id+" · "+r.name));c.append(h);
  c.append(E("div","m",new Date(r.time).toLocaleString()+" · "+r.service));
  const w=E("a",0,r.phone);w.href="https://wa.me/"+r.phone.replace(/\\D/g,"").replace(/^0/,"92")+"?text="+encodeURIComponent("Assalam o Alaikum "+r.name+", this is DASTAWAIZ regarding your request "+r.id+".");w.target="_blank";w.rel="noopener";const pd=E("div",0,"📱 ");pd.append(w);c.append(pd);
  if(r.notes)c.append(E("div","m",r.notes));
  if(r.terms){c.append(E("div","m","📝 Special terms & conditions from client:"),E("div","terms",r.terms))}
  if(r.voice){c.append(E("div","m","🎙 Voice note ("+(r.voice.secs||"?")+"s):"));const a=E("audio");a.controls=true;a.preload="none";fetch("/api/file?play=1&k="+encodeURIComponent(r.voice.key),{headers:H}).then(x=>x.blob()).then(b=>a.src=URL.createObjectURL(b));c.append(a)}
  for(const f of r.files){const b=E("a",0,"📎 "+f.name+" ("+Math.ceil(f.size/1024)+" KB)");b.href="#";b.onclick=async e=>{e.preventDefault();const x=await fetch("/api/file?k="+encodeURIComponent(f.key)+"&n="+encodeURIComponent(f.name),{headers:H}),bl=await x.blob(),u=URL.createObjectURL(bl),d=E("a");d.href=u;d.download=f.name;d.click()};c.append(E("div"),b)}
  const row=E("div","row"),s=E("select");ST.forEach(x=>s.append(new Option(x,x)));s.value=r.status;const as=E("input");as.placeholder="Assign to…";as.value=r.assignee||"";const nt=E("input");nt.placeholder="Internal note";nt.value=r.note||"";const sv=E("button","p","Save");
  sv.onclick=async()=>{sv.textContent="…";const d=await api("/api/update",{method:"POST",body:JSON.stringify({id:r.id,status:s.value,assignee:as.value,note:nt.value,seen:true})});if(d.ok){Object.assign(r,d.rec);sv.textContent="Saved ✓";setTimeout(load,600)}else sv.textContent="Error"};
  row.append(s,as,nt,sv);c.append(row);if(!r.seen){fetch("/api/update",{method:"POST",headers:H,body:JSON.stringify({id:r.id,seen:true})});r.seen=true}L.append(c)}}
$("q").oninput=$("fs").onchange=$("fa").onchange=draw;
$("cs").onclick=()=>{const q=s=>'"'+String(s||"").replace(/"/g,'""')+'"',t=["ID,Time,Name,Phone,Service,Status,Assignee,Terms"].concat(R.map(r=>[r.id,r.time,r.name,r.phone,r.service,r.status,r.assignee,r.terms].map(q).join(","))).join("\\n"),a=E("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));a.download="dastawaiz-clients.csv";a.click()};
load();setInterval(load,20000);
</script>`;
export default{async fetch(request,env,ctx){const u=new URL(request.url),p=u.pathname,M=request.method;
 if(p==="/api/upload"&&M==="POST")return upload(request,env,ctx);
 if(p==="/api/admin"&&M==="GET")return auth(request,env)?new Response(PANEL,{headers:{"content-type":"text/html;charset=utf8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"}}):new Response("Unauthorized",{status:401});
 if(p.startsWith("/api/")&&p!=="/api/upload"){if(!auth(request,env))return new Response("Unauthorized",{status:401});
  if(p==="/api/records"&&M==="GET")return J({ok:true,records:await records(env)});
  if(p==="/api/update"&&M==="POST")return update(request,env);
  if(p==="/api/file"&&M==="GET")return file(request,env);return new Response("Not found",{status:404})}
 return env.ASSETS.fetch(request)}}
