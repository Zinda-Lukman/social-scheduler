import { BskyAgent, RichText } from "@atproto/api";
import fs from "fs";

const POSTS_FILE="posts.json";
const LOGS_FILE="logs.json";
const MAX_RETRIES=3;
const MAX_LOGS=500;

function readJson(file,fallback=[]){
  try{return JSON.parse(fs.readFileSync(file,"utf8"))}
  catch{return fallback}
}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n")}
function log(logs,level,event,message,post=null){
  logs.push({time:new Date().toISOString(),level,event,message,postId:post?.id||null,timezone:post?.timezone||"UTC"});
  if(logs.length>MAX_LOGS)logs.splice(0,logs.length-MAX_LOGS);
}
function addDays(date,n){const d=new Date(date);d.setUTCDate(d.getUTCDate()+n);return d}
function getLocalParts(date,tz){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  return Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
}
function zonedToUtc(localIso,tz){
  let guess=new Date(localIso+"Z");
  for(let i=0;i<4;i++){
    const p=getLocalParts(guess,tz);
    const asUtc=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    guess=new Date(guess.getTime()+(Date.parse(localIso+"Z")-asUtc));
  }
  return guess;
}
function nextOccurrence(post){
  const type=post.recurrence?.type;
  if(!type||type==="none")return null;
  const tz=post.timezone||"UTC";
  const p=getLocalParts(new Date(post.date),tz);
  let y=+p.year,m=+p.month-1,d=+p.day,h=p.hour,mi=p.minute,se=p.second;
  if(type==="daily") d+=1;
  if(type==="weekly") d+=7;
  if(type==="monthly") m+=1;
  const local=new Date(Date.UTC(y,m,d,+h,+mi,+se));
  const iso=local.toISOString().slice(0,19);
  return zonedToUtc(iso,tz);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function isDue(post,now){
  return post.status==="scheduled" && !post.posted && new Date(post.date)<=now;
}
async function uploadMedia(agent,post){
  if(!post.media?.path)return null;
  const data=fs.readFileSync(post.media.path);
  const mime=post.media.type||"image/jpeg";
  const r=await agent.uploadBlob(data,{encoding:mime});
  return r.data.blob;
}
async function publishSingle(agent,text,blob){
  const rt=new RichText({text});
  await rt.detectFacets(agent);
  const record={text:rt.text,facets:rt.facets};
  if(blob)record.embed={ $type:"app.bsky.embed.images", images:[{image:blob,alt:""}] };
  return agent.post(record);
}
async function publishThread(agent,texts,blob){
  let root=null,reply=null,first=true;
  for(const text of texts){
    const rt=new RichText({text});
    await rt.detectFacets(agent);
    const record={text:rt.text,facets:rt.facets};
    if(first&&blob)record.embed={$type:"app.bsky.embed.images",images:[{image:blob,alt:""}]};
    if(reply)record.reply={root:{uri:root.uri,cid:root.cid},parent:{uri:reply.uri,cid:reply.cid}};
    const result=await agent.post(record);
    if(!root)root=result;
    reply=result;
    first=false;
    await sleep(300);
  }
  return root;
}
async function publishPost(agent,post){
  let blob=null;
  if(post.media?.path)blob=await uploadMedia(agent,post);
  if(Array.isArray(post.thread)&&post.thread.length)return publishThread(agent,post.thread,blob);
  return publishSingle(agent,post.text,blob);
}

const posts=readJson(POSTS_FILE);
const logs=readJson(LOGS_FILE);
const now=new Date();
const due=posts.filter(p=>isDue(p,now));

if(!due.length){log(logs,"info","CHECK","No posts are due.");writeJson(LOGS_FILE,logs.slice(-MAX_LOGS));process.exit(0)}

const agent=new BskyAgent({service:"https://bsky.social"});
await agent.login({identifier:process.env.BLUESKY_HANDLE,password:process.env.BLUESKY_APP_PASSWORD});
log(logs,"info","LOGIN","Logged into Bluesky.");

for(const post of due){
  post.retryCount=post.retryCount||0;
  try{
    log(logs,"info","PUBLISH_START",`Publishing post ${post.id}.`,post);
    const result=await publishPost(agent,post);
    post.status="posted";
    post.posted=true;
    post.postedAt=new Date().toISOString();
    post.uri=result.uri;
    post.cid=result.cid;
    post.error=null;
    log(logs,"info","PUBLISHED",`Post ${post.id} published successfully.`,post);

    const next=nextOccurrence(post);
    if(next){
      const nextPost={...post,id:crypto.randomUUID(),date:next.toISOString(),status:"scheduled",posted:false,postedAt:null,uri:null,cid:null,error:null,retryCount:0,createdAt:new Date().toISOString()};
      posts.push(nextPost);
      log(logs,"info","RECURRENCE",`Created next ${post.recurrence.type} occurrence.`,nextPost);
    }
  }catch(err){
    post.retryCount=(post.retryCount||0)+1;
    post.error=String(err?.message||err);
    post.failedAt=new Date().toISOString();
    if(post.retryCount<MAX_RETRIES){
      post.status="retrying";
      log(logs,"error","RETRY",`Attempt ${post.retryCount}/${MAX_RETRIES} failed: ${post.error}`,post);
    }else{
      post.status="failed";
      log(logs,"error","FAILED",`Post permanently failed after ${MAX_RETRIES} attempts: ${post.error}`,post);
    }
  }
}

writeJson(POSTS_FILE,posts);
writeJson(LOGS_FILE,logs.slice(-MAX_LOGS));
console.log(`Processed ${due.length} due post(s).`);
