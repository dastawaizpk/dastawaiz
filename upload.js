(()=>{const $=id=>document.getElementById(id),F=[],MAX=10*1048576;
const add=async(list)=>{$("e").textContent="";for(const f of list){if(F.length>=10){$("e").textContent="Maximum 10 files.";break}
let x=f;if(/^image\//.test(f.type)){try{x=await shrink(f)}catch(_){}}
if(!/^(application\/pdf|image\/jpeg|image\/png)$/.test(x.type)){$("e").textContent="Only PDF, JPG or PNG allowed.";continue}
if(x.size>MAX){$("e").textContent=f.name+" is over 10 MB.";continue}F.push(x)}draw()};
const shrink=async f=>{const b=await createImageBitmap(f),r=Math.min(1,2000/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=b.width*r;c.height=b.height*r;c.getContext("2d").drawImage(b,0,0,c.width,c.height);
const bl=await new Promise(o=>c.toBlob(o,"image/jpeg",.85));return new File([bl],(f.name||"photo").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"})};
const draw=()=>{const l=$("l");l.textContent="";F.forEach((f,i)=>{const li=document.createElement("li");if(f.type.startsWith("image/")){const im=document.createElement("img");im.src=URL.createObjectURL(f);im.alt="";li.append(im)}else li.append("📄");
const s=document.createElement("span");s.textContent=f.name+" ("+Math.ceil(f.size/1024)+" KB)";const b=document.createElement("button");b.type="button";b.textContent="✕";b.setAttribute("aria-label","Remove");b.onclick=()=>{F.splice(i,1);draw()};li.append(s,b);l.append(li)})};
$("b1").onclick=()=>$("i1").click();$("b2").onclick=()=>$("i2").click();
for(const i of["i1","i2"])$(i).onchange=e=>{add([...e.target.files]);e.target.value=""};
$("f").onsubmit=async e=>{e.preventDefault();const er=$("e");er.textContent="";
if(!$("n").value.trim()||!/^[0-9+\-\s]{10,20}$/.test($("p").value.trim())){er.textContent="Please enter your name and a valid phone number.";return}
if(!F.length){er.textContent="Please add at least one document.";return}
const fd=new FormData(e.target);F.forEach(f=>fd.append("files",f,f.name));const s=$("s");s.disabled=true;s.textContent="Uploading…";
try{const r=await fetch("/api/upload",{method:"POST",body:fd}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Upload failed");
$("f").hidden=true;$("done").hidden=false;$("ref").textContent=j.id;$("wl").href="https://wa.me/923454331133?text="+encodeURIComponent("Hi DASTAWAIZ, I uploaded documents. Reference: "+j.id);}
catch(x){er.textContent=(x.message||"Upload failed")+" — please try again or send on WhatsApp.";s.disabled=false;s.textContent="Send securely →"}}})();