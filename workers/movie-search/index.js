export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://sumitkumarsharma11x-glitch.github.io";
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": allowed,
      "access-control-allow-methods": "GET,OPTIONS",
      "cache-control": "public, max-age=300"
    };
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (origin && origin !== allowed) return new Response(JSON.stringify({error:"Origin not allowed"}),{status:403,headers});
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") return new Response(JSON.stringify({ok:true,service:"BoxOffice India movie API"}),{headers});
    if (path !== "/search") return new Response(JSON.stringify({error:"Not found"}),{status:404,headers});
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) return new Response(JSON.stringify({results:[]}),{headers});
    if (!env.TMDB_READ_TOKEN) return new Response(JSON.stringify({error:"TMDB_READ_TOKEN is not configured"}),{status:503,headers});
    const api = new URL("https://api.themoviedb.org/3/search/movie");
    api.searchParams.set("query",q);
    api.searchParams.set("include_adult","false");
    api.searchParams.set("language","en-US");
    api.searchParams.set("region","IN");
    const r = await fetch(api,{headers:{accept:"application/json",authorization:"Bearer "+env.TMDB_READ_TOKEN}});
    if (!r.ok) return new Response(JSON.stringify({error:"Movie provider request failed"}),{status:502,headers});
    const d = await r.json();
    const results=(d.results||[]).slice(0,8).map(m=>({
      id:String(m.id),
      title:m.title||m.original_title||"",
      originalTitle:m.original_title||"",
      year:m.release_date?m.release_date.slice(0,4):"",
      release:m.release_date||"",
      lang:m.original_language||"",
      overview:m.overview||"",
      poster:m.poster_path?"https://image.tmdb.org/t/p/w500"+m.poster_path:"",
      rating:Number(m.vote_average||0),
      votes:Number(m.vote_count||0),
      source:"TMDB",
      sourceUrl:"https://www.themoviedb.org/movie/"+m.id
    }));
    return new Response(JSON.stringify({query:q,results,source:"TMDB"}),{headers});
  }
};