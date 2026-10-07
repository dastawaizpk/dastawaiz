(()=>{const $=id=>document.getElementById(id),F=[],MAX=10*1048576,N=10;
const HINT={"Review / check my document":["The document itself (all pages, clear photo or PDF)","Any emails/messages about it (optional)"],
"Create a new agreement":["CNIC copy (front & back) of each party","Any draft or notes with amounts, dates, duration"],
"Women Entrepreneur Pack":["Your CNIC copy (front & back)","Business name / idea (type it in the notes)","Any existing papers, if you have them"],
"Startup Legal Pack":["CNIC copies of all founders","Business name, NTN/SECP papers if you have them","Any existing drafts"],
"Freelancer & IT Pack":["Your CNIC copy","Client contract or draft, if any","Platform profile link (type it in the notes)"],
"Other":["Anything related — we will guide you"]};
const sv=()=>document.querySelector('input[name=service]:checked').value;
const hint=()=>{const r=$("rd");r.textContent="";const b=document.createElement("b");b.textContent="Have these ready:";const u=document.createElement("ul");(HINT[sv()]||[]).forEach(x=>{const li=document.createElement("li");li.textContent=x;u.append(li)});r.append(b,u)};
for(const r of document.querySelectorAll('input[name=service]'))r.onchange=hint;
const q=new URLSearchParams(location.search).get("service");if(q){const m=[...document.querySelectorAll('input[name=service]')].find(x=>x.value.toLowerCase().startsWith(q.toLowerCase()));if(m)m.checked=true}hint();
const err=t=>{$("e").textContent=t||""};
const shrink=async f=>{const b=await createImageBitmap(f),r=Math.min(1,2000/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=b.width*r;c.height=b.height*r;c.getContext("2d").drawImage(b,0,0,c.width,c.height);const bl=await new Promise(o=>c.toBlob(o,"image/jpeg",.85));return new File([bl],(f.name||"photo").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"})};
const add=async list=>{err();for(const f of list){if(F.length>=N){err("Maximum "+N+" files.");break}let x=f;if(/^image\//.test(f.type)){try{x=await shrink(f)}catch(_){}}
if(!/^(application\/pdf|image\/jpeg|image\/png)$/.test(x.type)){err(f.name+": only PDF, JPG or PNG allowed.");continue}if(x.size>MAX){err(f.name+" is over 10 MB.");continue}F.push(x)}draw()};
const draw=()=>{const l=$("l");l.textContent="";let tot=0;F.forEach((f,i)=>{tot+=f.size;const li=document.createElement("li");if(f.type.startsWith("image/")){const im=document.createElement("img");im.src=URL.createObjectURL(f);im.alt="";li.append(im)}else li.append("📄");const s=document.createElement("span");s.textContent=f.name+" ("+Math.ceil(f.size/1024)+" KB)";const b=document.createElement("button");b.type="button";b.textContent="✕";b.setAttribute("aria-label","Remove "+f.name);b.onclick=()=>{F.splice(i,1);draw()};li.append(s,b);l.append(li)});
$("cn").textContent=F.length;$("tt").textContent=F.length?F.length+" of "+N+" files · "+(tot/1048576).toFixed(1)+" MB":""};
$("b1").onclick=()=>$("i1").click();$("b2").onclick=()=>$("i2").click();
for(const i of["i1","i2"])$(i).onchange=e=>{add([...e.target.files]);e.target.value=""};
const dz=$("dz");for(const ev of["dragenter","dragover"])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("over")});for(const ev of["dragleave","drop"])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("over")});dz.addEventListener("drop",e=>add([...e.dataTransfer.files]));

let VB=null,VS=0,MR=null,CH=[],TM=null;const vr=$("vr"),vt=$("vt");
const stopRec=()=>{if(MR&&MR.state!=="inactive")MR.stop()};
vr.onclick=async()=>{if(MR&&MR.state==="recording"){stopRec();return}
 if(!navigator.mediaDevices||!window.MediaRecorder){err("Voice recording is not supported on this browser — please type your terms or send a voice note on WhatsApp.");return}
 try{const st=await navigator.mediaDevices.getUserMedia({audio:true});CH=[];MR=new MediaRecorder(st);const t0=Date.now();
 MR.ondataavailable=e=>e.data.size&&CH.push(e.data);
 MR.onstop=()=>{clearInterval(TM);st.getTracks().forEach(t=>t.stop());VS=Math.round((Date.now()-t0)/1000);VB=new Blob(CH,{type:MR.mimeType||"audio/webm"});$("va").src=URL.createObjectURL(VB);$("vp").hidden=false;vr.textContent="🎙 Record again";vt.textContent=VS+"s recorded"};
 MR.start();vr.textContent="⏹ Stop recording";TM=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);vt.textContent="Recording… "+s+"s";if(s>=120)stopRec()},500)}
 catch(_){err("Microphone permission was blocked. Allow it in your browser, or type your terms.")}};
$("vd").onclick=()=>{VB=null;VS=0;$("vp").hidden=true;vr.textContent="🎙 Record voice note";vt.textContent=""};
let nofiles=false;$("nof").onclick=e=>{e.preventDefault();nofiles=true;$("f").requestSubmit()};
const send=(fd,pr)=>new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open("POST","/api/upload");x.upload.onprogress=e=>{if(e.lengthComputable)pr(e.loaded/e.total)};x.onload=()=>{try{const j=JSON.parse(x.responseText);x.status<300&&j.ok?res(j):rej(new Error(j.error||"Upload failed"))}catch(_){rej(new Error("Upload failed"))}};x.onerror=()=>rej(new Error("Network error"));x.send(fd)});
$("f").onsubmit=async e=>{e.preventDefault();err();const wantNo=nofiles;nofiles=false;
if(!$("n").value.trim()){err("Please enter your name.");$("n").focus();return}
if(!/^[0-9+\-\s]{10,20}$/.test($("p").value.trim())){err("Please enter a valid WhatsApp number, e.g. 0345 4331133.");$("p").focus();return}
if(!F.length&&!wantNo&&!VB&&!$("tc").value.trim()){err("Please add a file, your special terms or a voice note — or tap “send without files”.");return}
if(!$("ok").checked){err("Please tick the agreement box.");return}
const s=$("s");s.disabled=true;s.textContent="Sending…";
const extra="[Lang: "+$("lg").value+"] [Speed: "+$("ur2").value+"] [Contact: "+$("bt").value+"]"+(F.length?"":" [No documents attached]")+"\n"+$("m").value.trim();
try{let id;
if(F.length||VB||$("tc").value.trim()){const fd=new FormData();fd.append("terms",$("tc").value.trim());if(VB){fd.append("voice",VB,"voice."+(VB.type.includes("mp4")?"m4a":VB.type.includes("ogg")?"ogg":"webm"));fd.append("voice_secs",VS)}fd.append("website",e.target.website.value);fd.append("name",$("n").value.trim());fd.append("phone",$("p").value.trim());fd.append("service",sv());fd.append("notes",extra.slice(0,1000));F.forEach(f=>fd.append("files",f,f.name));$("pb").hidden=false;const j=await send(fd,p=>{$("pi").style.width=Math.round(p*100)+"%";s.textContent="Sending… "+Math.round(p*100)+"%"});id=j.id}
$("f").hidden=true;$("done").hidden=false;$("ref").textContent=id||"(no files)";
const msg=id?"Hi DASTAWAIZ, I uploaded documents. Reference: "+id+". Service: "+sv():"Hi DASTAWAIZ, I need: "+sv()+". My name: "+$("n").value.trim()+". I will send files here.";
$("wl").href="https://wa.me/923454331133?text="+encodeURIComponent(msg);window.scrollTo(0,0)}
catch(x){err((x.message||"Upload failed")+" — please try again or send on WhatsApp.");s.disabled=false;s.textContent="Send securely →";$("pb").hidden=true}};
$("cp").onclick=()=>{const t=$("ref").textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>$("cp").textContent="Copied ✓").catch(()=>{})};
$("more").onclick=()=>location.reload();})();