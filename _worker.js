const OK=[[[0x25,0x50,0x44,0x46],"application/pdf","pdf"],[[0xff,0xd8,0xff],"image/jpeg","jpg"],[[0x89,0x50,0x4e,0x47],"image/png","png"]];
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function upload(request,env){
 if(!env.UPLOADS)return J({ok:false,error:"Storage not configured"},500);
 const len=+request.headers.get("content-length")||0;if(len>60*1048576)return J({ok:false,error:"Too large"},413);
 let fd;try{fd=await request.formData()}catch{return J({ok:false,error:"Bad request"},400)}
 if(fd.get("website"))return J({ok:true,id:"OK"});
 const name=String(fd.get("name")||"").trim().slice(0,100),phone=String(fd.get("phone")||"").trim();
 if(!name||!/^[0-9+\-\s]{10,20}$/.test(phone))return J({ok:false,error:"Name and phone required"},400);
 const files=fd.getAll("files").filter(f=>typeof f==="object"&&f.size);if(!files.length||files.length>10)return J({ok:false,error:"1-10 files required"},400);
 const id=Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase(),TTL=90*86400,list=[];
 let i=0;for(const f of files){if(f.size>10*1048576)return J({ok:false,error:"File over 10 MB"},400);
  const b=new Uint8Array(await f.arrayBuffer()),t=OK.find(([m])=>m.every((v,k)=>b[k]===v));if(!t)return J({ok:false,error:"Only PDF, JPG, PNG allowed"},400);
  const key=`f:${id}:${i++}`,fname=String(f.name||"file").replace(/[^\w.\- ]/g,"_").slice(0,80);
  await env.UPLOADS.put(key,b,{expirationTtl:TTL,metadata:{type:t[1]}});list.push({key,name:fname,type:t[1],size:b.length})}
 await env.UPLOADS.put(`r:${id}`,JSON.stringify({id,name,phone,service:String(fd.get("service")||"").slice(0,60),notes:String(fd.get("notes")||"").slice(0,1000),time:new Date().toISOString(),files:list}),{expirationTtl:TTL});
 return J({ok:true,id});}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const auth=(u,env)=>{const k=u.searchParams.get("key")||"",a=env.ADMIN_KEY||"";if(!a||k.length!==a.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=k.charCodeAt(i)^a.charCodeAt(i);return d===0};
async function admin(request,env){const u=new URL(request.url);
 const H={"content-type":"text/html;charset=utf8","cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"};
 if(!auth(u,env))return new Response("Unauthorized",{status:401,headers:H});
 const ls=await env.UPLOADS.list({prefix:"r:",limit:200}),recs=(await Promise.all(ls.keys.map(k=>env.UPLOADS.get(k.name,"json")))).filter(Boolean).sort((a,b)=>b.time.localeCompare(a.time));
 const k=encodeURIComponent(u.searchParams.get("key"));
 const rows=recs.map(r=>`<div style="border:1px solid #ccc;border-radius:10px;padding:12px;margin:10px 0"><b>${esc(r.id)}</b> · ${esc(r.time.slice(0,16).replace("T"," "))} UTC<br>${esc(r.name)} · <a href="https://wa.me/${esc(r.phone.replace(/\D/g,"").replace(/^0/,"92"))}">${esc(r.phone)}</a> · ${esc(r.service)}<br><i>${esc(r.notes)}</i><br>${r.files.map(f=>`<a href="/api/file?key=${k}&k=${encodeURIComponent(f.key)}&n=${encodeURIComponent(f.name)}">📎 ${esc(f.name)}</a> (${Math.ceil(f.size/1024)} KB)`).join("<br>")}</div>`).join("");
 return new Response(`<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>Uploads</title><body style="font-family:system-ui;max-width:800px;margin:auto;padding:16px"><h1>DASTAWAIZ uploads (${recs.length})</h1>${rows||"<p>No uploads yet.</p>"}`,{headers:H});}

async function file(request,env){const u=new URL(request.url);if(!auth(u,env))return new Response("Unauthorized",{status:401});
 const k=u.searchParams.get("k")||"";if(!/^f:[A-Z0-9]+:\d+$/.test(k))return new Response("Bad",{status:400});
 const{value,metadata}=await env.UPLOADS.getWithMetadata(k,"arrayBuffer");if(!value)return new Response("Not found",{status:404});
 const n=(u.searchParams.get("n")||"file").replace(/[^\w.\- ]/g,"_");
 return new Response(value,{headers:{"content-type":metadata?.type||"application/octet-stream","content-disposition":`attachment; filename="${n}"`,"cache-control":"no-store","x-content-type-options":"nosniff"}});}

export default{async fetch(request,env){const u=new URL(request.url),p=u.pathname;
 if(p==="/api/upload"&&request.method==="POST")return upload(request,env);
 if(p==="/api/admin"&&request.method==="GET")return admin(request,env);
 if(p==="/api/file"&&request.method==="GET")return file(request,env);
 if(p.startsWith("/api/"))return new Response("Not found",{status:404});
 return env.ASSETS.fetch(request)}}
