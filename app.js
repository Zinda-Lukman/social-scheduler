const API_BASE="https://api.github.com";
let posts=[], logs=[], editingPostId=null, calendarDate=new Date(), postsFileSha=null, logsFileSha=null;

const pages={dashboard:["Dashboard","Manage your scheduled posts."],posts:["Posts","Manage your scheduled publications."],calendar:["Calendar","See your publishing schedule."],drafts:["Drafts","Posts waiting to be scheduled."],history:["History","Published and failed posts."],logs:["Posting Logs","Scheduler activity and errors."],settings:["Settings","Configure your scheduler."]};

function settings(){return{owner:localStorage.getItem("githubOwner")||"",repo:localStorage.getItem("githubRepo")||"",branch:localStorage.getItem("githubBranch")||"main",token:localStorage.getItem("githubToken")||""}}
function saveSettings(s){for(const[k,v]of Object.entries(s))localStorage.setItem("github"+k[0].toUpperCase()+k.slice(1),v)}
function headers(){return{"Accept":"application/vnd.github+json","Authorization":`Bearer ${settings().token}`,"X-GitHub-Api-Version":"2022-11-28"}}
async function gh(url,opt={}){const r=await fetch(API_BASE+url,{...opt,headers:{...headers(),...(opt.headers||{})}});if(!r.ok)throw new Error(`GitHub ${r.status}: ${await r.text()}`);return r.json()}
function enc(s){const b=new TextEncoder().encode(s);let x="";for(const v of b)x+=String.fromCharCode(v);return btoa(x)}
function dec(s){const b=atob(s.replace(/\n/g,""));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)))}

async function readFile(name){const s=settings();const d=await gh(`/repos/${s.owner}/${s.repo}/contents/${name}?ref=${encodeURIComponent(s.branch)}`);return{data:JSON.parse(dec(d.content)),sha:d.sha}}
async function writeFile(name,data,sha,message){const s=settings();const body={message,content:enc(JSON.stringify(data,null,2)+"\n"),branch:s.branch};if(sha)body.sha=sha;return gh(`/repos/${s.owner}/${s.repo}/contents/${name}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})}

async function loadData(){
 const s=settings(); if(!s.owner||!s.repo||!s.token){posts=[];logs=[];renderAll();return}
 try{const p=await readFile("posts.json");posts=p.data;postsFileSha=p.sha}catch(e){console.error(e);showToast("Could not load posts.json")}
 try{const l=await readFile("logs.json");logs=l.data;logsFileSha=l.sha}catch(e){logs=[];logsFileSha=null}
 renderAll()
}
async function savePosts(message){const r=await writeFile("posts.json",posts,postsFileSha,message);postsFileSha=r.content.sha}
async function saveLogs(){const r=await writeFile("logs.json",logs.slice(-500),logsFileSha,"Update scheduler logs");logsFileSha=r.content.sha}

function showPage(page){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));document.getElementById(page+"Page").classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));document.getElementById("pageTitle").textContent=pages[page][0];document.getElementById("pageSubtitle").textContent=pages[page][1];if(page==="calendar")renderCalendar();if(page==="logs")renderLogs()}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-page-button]").forEach(b=>b.onclick=()=>showPage(b.dataset.pageButton));

const modal=document.getElementById("postModal");
function populateTimezones(){const sel=document.getElementById("timezone"),zones=["UTC","Africa/Kampala","Africa/Nairobi","Africa/Cairo","Europe/Paris","Europe/London","America/New_York","America/Los_Angeles","America/Toronto","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney"];const local=Intl.DateTimeFormat().resolvedOptions().timeZone;if(!zones.includes(local))zones.unshift(local);sel.innerHTML=[...new Set(zones)].map(z=>`<option value="${z}">${z}</option>`).join("");}
function openCreate(){editingPostId=null;document.getElementById("modalTitle").textContent="Create Post";document.getElementById("postForm").reset();document.getElementById("postId").value="";document.getElementById("postType").value="single";document.getElementById("recurrence").value="none";document.getElementById("timezone").value=Intl.DateTimeFormat().resolvedOptions().timeZone;const d=new Date(Date.now()+3600000);document.getElementById("postDate").value=d.toISOString().slice(0,10);document.getElementById("postTime").value=d.toTimeString().slice(0,5);document.getElementById("existingMedia").innerHTML="";document.getElementById("threadContainer").innerHTML="";document.getElementById("threadContainer").classList.add("hidden");document.getElementById("addThread").classList.add("hidden");document.getElementById("postText").classList.remove("hidden");updateCount();modal.classList.remove("hidden")}
function openEdit(id){const p=posts.find(x=>String(x.id)===String(id));if(!p)return;editingPostId=id;document.getElementById("modalTitle").textContent="Edit Post";document.getElementById("postId").value=p.id;document.getElementById("postType").value=p.thread?"thread":"single";document.getElementById("postText").value=p.text||"";document.getElementById("timezone").value=p.timezone||"UTC";document.getElementById("recurrence").value=p.recurrence?.type||"none";const d=new Date(p.date);document.getElementById("postDate").value=d.toISOString().slice(0,10);document.getElementById("postTime").value=d.toTimeString().slice(0,5);document.getElementById("saveAsDraft").checked=p.status==="draft";document.getElementById("existingMedia").innerHTML=p.media?.path?`<img src="media/${escapeHtml(p.media.path.split("/").pop())}">`:"";setupThreadUI();if(p.thread){p.thread.forEach(t=>addThreadItem(t.text));}updateCount();modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden");editingPostId=null}
document.getElementById("createPostButton").onclick=openCreate;document.getElementById("createPostButton2").onclick=openCreate;document.getElementById("closeModal").onclick=closeModal;document.getElementById("cancelPost").onclick=closeModal;

function setupThreadUI(){const thread=document.getElementById("postType").value==="thread";document.getElementById("threadContainer").classList.toggle("hidden",!thread);document.getElementById("addThread").classList.toggle("hidden",!thread);document.getElementById("postText").classList.toggle("hidden",thread)}
document.getElementById("postType").onchange=setupThreadUI;
document.getElementById("addThread").onclick=()=>addThreadItem("");
function addThreadItem(text){const c=document.getElementById("threadContainer"),wrap=document.createElement("div");wrap.className="thread-item";wrap.innerHTML=`<textarea maxlength="300" placeholder="Thread post...">${escapeHtml(text)}</textarea><button type="button" class="small-button delete-button">×</button>`;wrap.querySelector("button").onclick=()=>wrap.remove();c.appendChild(wrap)}
document.getElementById("postText").oninput=updateCount;
function updateCount(){document.getElementById("characterCount").textContent=document.getElementById("postText").value.length}
function getThread(){return [...document.querySelectorAll("#threadContainer textarea")].map(x=>x.value.trim()).filter(Boolean)}

async function uploadMedia(file){
 if(!file)return null;
 if(file.size>8*1024*1024)throw new Error("Image is larger than 8 MB.");
 const s=settings(),safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=`media/${Date.now()}-${safe}`;
 const buf=await file.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode(...bytes.subarray(i,i+chunk));
 const r=await gh(`/repos/${s.owner}/${s.repo}/contents/${path}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`Add media ${safe}`,content:btoa(bin),branch:s.branch})});
 return{path,sha:r.content.sha,name:safe,type:file.type,size:file.size}
}

document.getElementById("postForm").onsubmit=async e=>{
 e.preventDefault();
 const type=document.getElementById("postType").value,text=document.getElementById("postText").value.trim(),thread=getThread(),draft=document.getElementById("saveAsDraft").checked;
 if(type==="single"&&!text)return showToast("Write something first.");
 if(type==="thread"&&!thread.length)return showToast("Add at least one thread post.");
 const allText=type==="thread"?thread:[text];if(allText.some(x=>x.length>300))return showToast("Each Bluesky post must be 300 characters or less.");
 const file=document.getElementById("postImage").files[0];
 try{
  let media=null;if(file)media=await uploadMedia(file);
  const date=document.getElementById("postDate").value,time=document.getElementById("postTime").value,tz=document.getElementById("timezone").value,localIso=`${date}T${time}:00`;
  const dateUTC=new Date(new Intl.DateTimeFormat("en-US",{timeZone:tz,dateStyle:"short",timeStyle:"long"}).format(new Date(localIso))).toISOString();
  // Browser timezone conversion above is not reliable across all runtimes; use the selected zone with offset discovery below.
  const instant=toUtc(localIso,tz);
  const base={platform:"bluesky",date:instant,timezone:tz,recurrence:{type:document.getElementById("recurrence").value},status:draft?"draft":"scheduled",posted:false,retryCount:0,error:null};
  if(editingPostId){const p=posts.find(x=>String(x.id)===String(editingPostId));Object.assign(p,base);p.text=type==="single"?text:thread[0];p.thread=type==="thread"?thread:null;if(media)p.media=media}
  else posts.push({id:crypto.randomUUID(),...base,text:type==="single"?text:thread[0],thread:type==="thread"?thread:null,media,createdAt:new Date().toISOString()});
  await savePosts(editingPostId?"Edit scheduled post":"Create scheduled post");closeModal();renderAll();showToast("Post saved.");
 }catch(err){console.error(err);showToast(err.message)}
};

function toUtc(localIso,tz){
 let guess=new Date(localIso+"Z");
 for(let i=0;i<3;i++){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(guess);
  const m=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  const asUTC=Date.UTC(+m.year,+m.month-1,+m.day,+m.hour,+m.minute,+m.second);
  guess=new Date(guess.getTime()+(Date.parse(localIso+"Z")-asUTC));
 }
 return guess.toISOString();
}

async function deletePost(id){if(!confirm("Delete this post?"))return;posts=posts.filter(p=>String(p.id)!==String(id));try{await savePosts("Delete scheduled post");renderAll();showToast("Deleted.")}catch(e){showToast(e.message)}}

function status(p){return p.status||"scheduled"}
function formatDate(d,tz){try{return new Date(d).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:tz||undefined})}catch{return new Date(d).toLocaleString()}}
function postCard(p){
 const st=status(p), recurring=p.recurrence?.type&&p.recurrence.type!=="none"?` · ↻ ${p.recurrence.type}`:"", thread=p.thread?.length?` · 🧵 ${p.thread.length}`:"", media=p.media?" · 🖼️ image":"";
 return `<div class="post-card"><div class="post-top"><div><div class="platform">🦋 Bluesky ${thread}${media}${recurring}</div><div class="post-text">${escapeHtml(p.text||"")}</div>${p.thread?.slice(1).map((x,i)=>`<div class="post-text muted">Thread ${i+2}: ${escapeHtml(x)}</div>`).join("")||""}<div class="post-meta"><span>${st==="posted"?"Published "+formatDate(p.postedAt,p.timezone):st==="draft"?"Draft":"Scheduled "+formatDate(p.date,p.timezone)}</span><span class="status status-${st}">${st}</span>${p.retryCount?`<span>Retries: ${p.retryCount}</span>`:""}${p.error?`<span class="status status-failed">${escapeHtml(p.error.slice(0,70))}</span>`:""}</div></div><div class="post-actions">${st!=="posted"?`<button class="small-button" onclick="openEdit('${p.id}')">Edit</button>`:""}<button class="small-button delete-button" onclick="deletePost('${p.id}')">Delete</button></div></div></div>`
}
function renderList(id,arr){const el=document.getElementById(id);el.innerHTML=arr.length?arr.map(postCard).join(""):`<div class="empty">Nothing here yet.</div>`}
function renderPosts(){const sorted=[...posts].sort((a,b)=>new Date(a.date)-new Date(b.date));renderList("upcomingPosts",sorted.filter(p=>status(p)==="scheduled").slice(0,5));renderList("allPosts",sorted.filter(p=>status(p)==="scheduled"));renderList("draftPosts",sorted.filter(p=>status(p)==="draft"));renderList("historyPosts",sorted.filter(p=>["posted","failed","retrying"].includes(status(p))).reverse())}
function renderStats(){for(const [id,filter] of [["scheduledCount","scheduled"],["postedCount","posted"],["draftCount","draft"],["failedCount","failed"]])document.getElementById(id).textContent=posts.filter(p=>status(p)===filter).length}
function renderLogs(){const el=document.getElementById("logsList"),arr=[...logs].reverse();el.innerHTML=arr.length?arr.map(l=>`<div class="log-item log-${l.level||"info"}"><b>${escapeHtml(l.event||"event")}</b><div>${escapeHtml(l.message||"")}</div><div class="log-time">${formatDate(l.time,l.timezone)}</div></div>`).join(""):`<div class="empty">No logs yet.</div>`;document.getElementById("recentLogs").innerHTML=arr.slice(0,5).map(l=>`<div class="log-item log-${l.level||"info"}"><b>${escapeHtml(l.event||"event")}</b> — ${escapeHtml(l.message||"")}</div>`).join("")||`<div class="empty">No activity yet.</div>`}
function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth();document.getElementById("calendarMonth").textContent=calendarDate.toLocaleString(undefined,{month:"long",year:"numeric"});const g=document.getElementById("calendarGrid");g.innerHTML="";const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();for(let i=0;i<first;i++)g.innerHTML+=`<div class="calendar-day"></div>`;for(let d=1;d<=days;d++){const c=document.createElement("div");c.className="calendar-day";c.innerHTML=`<div class="calendar-day-number">${d}</div>`;posts.filter(p=>status(p)!=="draft").forEach(p=>{const x=new Date(p.date);if(x.getFullYear()===y&&x.getMonth()===m&&x.getDate()===d){const q=document.createElement("div");q.className="calendar-post";q.textContent=p.text||"Thread";c.appendChild(q)}});g.appendChild(c)}}
document.getElementById("previousMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};document.getElementById("nextMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};document.getElementById("refreshLogs").onclick=loadData;

function escapeHtml(x){const d=document.createElement("div");d.textContent=x??"";return d.innerHTML}
window.openEdit=openEdit;

function loadSettingsUI(){const s=settings();document.getElementById("githubOwner").value=s.owner;document.getElementById("githubRepo").value=s.repo;document.getElementById("githubBranch").value=s.branch;document.getElementById("githubToken").value=s.token;document.getElementById("timezoneDisplay").textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;updateConnection()}
function updateConnection(){const s=settings(),ok=s.owner&&s.repo&&s.token;document.getElementById("statusDot").classList.toggle("connected",!!ok);document.getElementById("connectionText").textContent=ok?`${s.owner}/${s.repo}`:"Not connected"}
document.getElementById("saveSettings").onclick=async()=>{const s={owner:document.getElementById("githubOwner").value.trim(),repo:document.getElementById("githubRepo").value.trim(),branch:document.getElementById("githubBranch").value.trim()||"main",token:document.getElementById("githubToken").value.trim()};saveSettings(s);try{await loadData();document.getElementById("settingsMessage").textContent="Connected successfully.";showToast("Settings saved.")}catch(e){document.getElementById("settingsMessage").textContent=e.message}};
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function renderAll(){renderStats();renderPosts();renderCalendar();renderLogs();updateConnection()}
populateTimezones();loadSettingsUI();loadData();
