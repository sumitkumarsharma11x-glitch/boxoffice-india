const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=900",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  }
});

const corsOrigin = (request, env) => {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const origin = request.headers.get("origin") || "";
  return allowed === "*" || origin === allowed ? (allowed === "*" ? "*" : origin) : null;
};

const norm = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\\u0300-\\u036f]/g, "")
  .replace(/[^a-z0-9\\u0900-\\u097f]+/g, " ")
  .trim()
  .replace(/\\s+/g, " ");

const tmdb = async (path, env, params = {}) => {
  if (!env.TMDB_READ_TOKEN) throw new Error("TMDB_READ_TOKEN is not configured");
  const url = new URL("https://api.themoviedb.org/3" + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: "Bearer " + env.TMDB_READ_TOKEN
    }
  });
  if (!response.ok) throw new Error("TMDB request failed: " + response.status);
  return response.json();
};

const image = (path) => path ? "https://image.tmdb.org/t/p/w500" + path : "";

const normalizeMovie = (m, credits = null) => {
  const crew = credits?.crew || [];
  const cast = (credits?.cast || []).slice(0, 8).map(x => x.name).filter(Boolean);
  const directors = crew.filter(x => x.job === "Director").map(x => x.name);
  const year = m.release_date ? m.release_date.slice(0, 4) : "";
  return {
    id: String(m.id),
    title: m.title || m.original_title || "",
    originalTitle: m.original_title || "",
    year,
    release: m.release_date || "",
    lang: m.original_language || "",
    genre: Array.isArray(m.genres) ? m.genres.map(x => x.name).join(" · ") : "",
    overview: m.overview || "",
    poster: image(m.poster_path),
    backdrop: image(m.backdrop_path),
    rating: Number(m.vote_average || 0),
    votes: Number(m.vote_count || 0),
    director: directors.join(", "),
    cast,
    source: "TMDB",
    sourceUrl: "https://www.themoviedb.org/movie/" + m.id
  };
};

export default {
  async fetch(request, env) {
    const origin = corsOrigin(request, env);
    if (!origin) return json({ error: "Origin not allowed" }, 403, "*");
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });

    try {
      const url = new URL(request.url);
      const route = url.pathname.replace(/\\/+$/, "") || "/";
      if (route === "/health") return json({ ok: true, service: "BoxOffice India movie API" }, 200, origin);

      if (route === "/search") {
        const q = String(url.searchParams.get("q") || "").trim();
        if (q.length < 2 || q.length > 120) return json({ results: [] }, 200, origin);

        const data = await tmdb("/search/movie", env, {
          query: q,
          include_adult: "false",
          language: "en-US",
          region: "IN",
          page: "1"
        });

        const key = norm(q);
        const results = (data.results || [])
          .filter(x => x && (x.title || x.original_title))
          .map(x => normalizeMovie(x))
          .sort((a, b) => {
            const ae = norm(a.title) === key || norm(a.originalTitle) === key ? 1 : 0;
            const be = norm(b.title) === key || norm(b.originalTitle) === key ? 1 : 0;
            return be - ae || (b.votes - a.votes);
          })
          .slice(0, 8);

        return json({ results, query: q, source: "TMDB" }, 200, origin);
      }

      if (route === "/movie") {
        const id = url.searchParams.get("id");
        if (!/^\\d+$/.test(String(id || ""))) return json({ error: "Invalid movie id" }, 400, origin);

        const data = await tmdb("/movie/" + id, env, {
          language: "en-US",
          append_to_response: "credits"
        });
        return json({ movie: normalizeMovie(data, data.credits), source: "TMDB" }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (error) {
      return json({ error: error.message || "Movie service unavailable" }, 502, origin);
    }
  }
};
