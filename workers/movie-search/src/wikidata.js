// Wikidata movie provider for BoxOffice India
const API="https://www.wikidata.org/w/api.php";
const FILM_CLASSES=new Set(["Q11424","Q24869","Q202866","Q20650540","Q24862","Q93204"]);
async function wd(params,env){
  const u=new URL(API);
  for(const[k,v]of Object.entries({format:"json",formatversion:"2",...params}))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{
    "User-Agent":"BoxOfficeIndia/1.2 ("+(env.CONTACT_URL||"https://sumitkumarsharma11x-glitch.github.io/boxoffice-india/")+")",
    "Accept":"application/json"
  }});
  if(!r.ok)throw Error("wikidata_"+r.status);
  return r.json();
}
async function wikiSummary(title){
  try{
    const slug=encodeURIComponent(String(title).trim().replace(/ /g,"_"));
    const r=await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/"+slug,{headers:{"Accept":"application/json"}});
    if(!r.ok)return null;
    const d=await r.json();
    return {poster:d.thumbnail?.source||d.originalimage?.source||"",overview:d.extract||"",sourceUrl:d.content_urls?.desktop?.page||""};
  }catch{return null}
}
const ids=(e,p)=>(e.claims?.[p]||[]).map(c=>c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const val=(e,p)=>(e.claims?.[p]||[])[0]?.mainsnak?.datavalue?.value;
const label=e=>e?.labels?.en?.value||e?.labels?.hi?.value||Object.values(e?.labels||{})[0]?.value||"";
const year=e=>{
  const a=(e.claims?.P577||[]).map(c=>c.mainsnak?.datavalue?.value?.time).filter(Boolean)
    .map(t=>parseInt(t.slice(1,5),10)).filter(Number.isFinite);
  return a.length?Math.min(...a):null;
};
const chunks=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;};
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\u0900-\u097f]+/g," ").trim().replace(/\s+/g," ");

export async function searchWikidata(query,env){
  const langs=(env.SEARCH_LANGS||"en,hi").split(",").map(x=>x.trim()).filter(Boolean);
  const sr=await Promise.all(langs.map(l=>wd({
    action:"wbsearchentities",search:query,language:l,uselang:l,type:"item",limit:"20"
  },env).then(x=>x.search||[]).catch(()=>[])));
  const qids=[];
  for(const list of sr) for(const x of list) if(!qids.includes(x.id)) qids.push(x.id);
  if(!qids.length)return[];

  const es=await Promise.all(chunks(qids.slice(0,40),50).map(c=>wd({
    action:"wbgetentities",ids:c.join("|"),props:"claims|labels|descriptions|aliases",languages:"en|hi"
  },env)));
  const all=Object.assign({},...es.map(x=>x.entities||{}));
  const key=norm(query);
  const films=qids.map(id=>all[id]).filter(Boolean).filter(e=>{
    const title=norm(label(e));
    return title===key || ids(e,"P31").some(x=>FILM_CLASSES.has(x)) || (e.claims?.P577||[]).length>0 || Boolean(val(e,"P345"));
  }).sort((a,b)=>(norm(label(b))===key)-(norm(label(a))===key)).slice(0,10);
  if(!films.length)return[];

  const refs=new Set();
  for(const f of films){
    ids(f,"P57").slice(0,2).forEach(x=>refs.add(x));
    ids(f,"P161").slice(0,8).forEach(x=>refs.add(x));
    ids(f,"P364").slice(0,1).forEach(x=>refs.add(x));
    ids(f,"P136").slice(0,4).forEach(x=>refs.add(x));
  }
  const rs=await Promise.all(chunks([...refs],50).map(c=>wd({
    action:"wbgetentities",ids:c.join("|"),props:"labels",languages:"en|hi"
  },env).catch(()=>({entities:{}}))));
  const labels=Object.assign({},...rs.map(x=>x.entities||{}));
  const name=id=>label(labels[id]);

  return Promise.all(films.map(async f=>{
    const title=label(f);
    const wiki=await wikiSummary(title);
    const imageFile=val(f,"P18");
    const wikidataPoster=imageFile?"https://commons.wikimedia.org/wiki/Special:Redirect/file/"+encodeURIComponent(imageFile):"";
    return {
      id:"wd:"+f.id,
      title,
      originalTitle:val(f,"P1476")?.text||"",
      year:year(f),
      release:(f.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time||"").slice(1,11),
      lang:name(ids(f,"P364")[0])||"",
      genre:ids(f,"P136").slice(0,4).map(name).filter(Boolean).join(" · "),
      overview:wiki?.overview||f.descriptions?.en?.value||f.descriptions?.hi?.value||"",
      poster:wikidataPoster||wiki?.poster||"",
      backdrop:"",
      rating:0,
      votes:0,
      director:ids(f,"P57").slice(0,2).map(name).filter(Boolean).join(", "),
      cast:ids(f,"P161").slice(0,8).map(name).filter(Boolean),
      imdbId:val(f,"P345")||"",
      source:"Wikidata",
      sourceUrl:"https://www.wikidata.org/wiki/"+f.id
    };
  }));
}
