const qs = new URLSearchParams(location.search);
const id = qs.get("id");
const live = qs.get("live") === "1";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

const tb = document.getElementById("themeBtn");
if (tb) {
  tb.onclick = () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "light" ? "" : "light";
    localStorage.setItem("boi-theme", document.documentElement.dataset.theme);
  };
}
if (localStorage.getItem("boi-theme") === "light") {
  document.documentElement.dataset.theme = "light";
}

const w = document.getElementById("movie");

async function getLiveBoxOffice(movieId) {
  try {
    const r = await fetch("data/live-boxoffice.json", { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.movies || []).find(m => m.id === movieId) || null;
  } catch (e) {
    return null;
  }
}

function slugify(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderBoxOffice(b) {
  if (!b) {
    return `
      <div class="pending-box">
        <strong>Data Pending</strong>
        <span>Box-office collection abhi available nahi hai.</span>
        <small>Missing figures ko fake number se replace nahi kiya jayega.</small>
      </div>`;
  }

  const days = b.dayWise || [];
  const rows = days.map(x => `
    <tr>
      <td>Day ${esc(x.day)}</td>
      <td>₹${Number(x.indiaGross || 0).toFixed(2)} Cr</td>
      <td>${esc(x.status || b.status || "Estimated")}</td>
    </tr>`).join("");

  return `
    <div class="boxoffice-live">
      <div class="bo-total">
        <small>INDIA GROSS</small>
        <strong>₹${Number(b.indiaGross || 0).toFixed(2)} Cr</strong>
        <span class="status-pill">${esc(b.status || "Estimated")}</span>
      </div>
      ${rows ? `
        <div class="table-wrap">
          <table class="table">
            <tr><th>Day</th><th>Collection</th><th>Status</th></tr>
            ${rows}
          </table>
        </div>` : ""}
      <div class="note">
        Source: ${esc(b.source || "BoxOffice India data feed")} ·
        Updated: ${esc(b.updated || "Today")}<br>
        ${esc(b.note || "Third-party estimate; not presented as official.")}
      </div>
      ${b.sourceUrl ? `<a class="source-btn" href="${esc(b.sourceUrl)}" target="_blank" rel="noopener">Open collection source ↗</a>` : ""}
    </div>`;
}

async function renderLivePage() {
  const m = {
    title: qs.get("title") || "Movie",
    year: qs.get("year") || "",
    lang: qs.get("lang") || "Indian film",
    genre: qs.get("genre") || "Movie",
    release: qs.get("release") || "—",
    director: qs.get("director") || "—",
    cast: qs.get("cast") || "",
    poster: qs.get("poster") || "",
    source: qs.get("source") || "Live movie metadata",
    sourceUrl: qs.get("sourceUrl") || ""
  };

  document.title = m.title + " — BoxOffice India";

  const cast = m.cast.split(",").map(x => x.trim()).filter(Boolean);
  const boxId = slugify(m.title);
  const boxOffice = await getLiveBoxOffice(boxId);

  w.innerHTML = `
    <section class="cinema-hero">
      ${m.poster
        ? `<img class="hero-poster" src="${esc(m.poster)}" alt="${esc(m.title)} poster" loading="eager">`
        : `<div class="hero-poster placeholder-poster">🎬</div>`}
      <div class="hero-copy">
        <a class="back" href="index.html">← Back to movies</a>
        <div class="meta">${esc(m.lang)} · ${esc(m.genre)}</div>
        <h1>${esc(m.title)}</h1>
        <div class="hero-meta">
          <span>📅 ${esc(m.release)}</span>
          <span>🎬 ${esc(m.director)}</span>
          <span>● ${esc(m.year || "—")}</span>
        </div>
        <p>Movie metadata found through live search. Box-office figures are maintained separately by BoxOffice India.</p>
      </div>
    </section>

    <section class="detail-grid">
      <div>
        <div class="section-card">
          <div class="section-title">
            <span>💰</span>
            <div><small>INDIA BOX OFFICE</small><h2>Collection Tracker</h2></div>
          </div>
          ${renderBoxOffice(boxOffice)}
        </div>

        <div class="section-card">
          <div class="section-title">
            <span>🎭</span>
            <div><small>MOVIE INFORMATION</small><h2>Details</h2></div>
          </div>
          <div class="info-grid">
            <div><small>Language</small><b>${esc(m.lang)}</b></div>
            <div><small>Release</small><b>${esc(m.release)}</b></div>
            <div><small>Director</small><b>${esc(m.director)}</b></div>
            <div><small>Year</small><b>${esc(m.year || "—")}</b></div>
            <div><small>Genre</small><b>${esc(m.genre || "—")}</b></div>
          </div>
        </div>
      </div>

      <aside>
        <div class="section-card cast-card">
          <div class="section-title">
            <span>⭐</span>
            <div><small>CAST</small><h2>Artists</h2></div>
          </div>
          <div class="cast-list">
            ${cast.length
              ? cast.map(x => `<span>${esc(x)}</span>`).join("")
              : "<span>Cast details unavailable</span>"}
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span>🔎</span>
            <div><small>DATA SOURCE</small><h2>Transparency</h2></div>
          </div>
          <p class="muted">Movie metadata source: <b>${esc(m.source)}</b></p>
          ${m.sourceUrl
            ? `<a class="source-btn" href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">Open source ↗</a>`
            : ""}
          <p class="muted">Collection figures are displayed with their source and status.</p>
        </div>
      </aside>
    </section>`;
}

async function renderLocalPage() {
  try {
    const r = await fetch("data/movies.json");
    if (!r.ok) throw new Error("movies.json unavailable");
    const movies = await r.json();
    const m = movies.find(x => x.id === id);

    if (!m) {
      w.innerHTML = `
        <div class="info">
          <h2>Movie not found</h2>
          <p>Is movie ka record abhi BoxOffice India database mein nahi hai.</p>
          <a class="back" href="index.html">← Back to movies</a>
        </div>`;
      return;
    }

    const days = m.days || [];
    const lo = days.reduce((a,x) => a + Number(x.lo || 0), 0);
    const hi = days.reduce((a,x) => a + Number(x.hi || 0), 0);
    const src = Array.isArray(m.sources) ? m.sources : [];

    document.title = m.title + " — BoxOffice India";

    w.innerHTML = `
      <div class="detail-hero">
        <div class="detail">
          <a class="back" href="index.html">← Back to movies</a>
          <div class="movie-top">
            <div>
              <div class="meta">${esc(m.lang)} · Release ${esc(m.release)}</div>
              <h1>${esc(m.title)}</h1>
              <div class="meta">Budget ${esc(m.budget || "—")}</div>
            </div>
            <span class="movie-badge">${esc(m.verdict || "Unrated")}</span>
          </div>

          <div class="stats">
            <div class="stat"><small>TRACKED INDIA TOTAL</small><strong>₹${lo.toFixed(1)}–₹${hi.toFixed(1)} Cr</strong></div>
            <div class="stat"><small>DATA STATUS</small><strong>${esc(m.label || "Estimated")}</strong></div>
            <div class="stat"><small>UPDATED</small><strong>${esc(m.updated || "—")}</strong></div>
            <div class="stat"><small>DAYS TRACKED</small><strong>${days.length}</strong></div>
          </div>
        </div>
      </div>

      <div class="detail">
        <div class="table-wrap">
          <table class="table">
            <tr><th>Day</th><th>Collection</th><th>Status</th></tr>
            ${days.map(x => `
              <tr>
                <td>${esc(x.d)}</td>
                <td>₹${Number(x.lo || 0).toFixed(1)}–₹${Number(x.hi || 0).toFixed(1)} Cr</td>
                <td>${esc(x.status || m.label || "Estimated")}</td>
              </tr>`).join("")}
          </table>
        </div>

        <div class="analysis">
          <h2>Analysis</h2>
          <p>${esc(m.analysis || "No analysis added yet.")}</p>
        </div>

        <div class="note">
          Sources: ${esc(src.length ? src.join(" · ") : "Source not listed")}<br>
          Figures are approximate trade estimates unless explicitly marked Official.
        </div>
      </div>`;
  } catch (e) {
    w.innerHTML = `
      <div class="info">
        <h2>Movie page temporarily unavailable</h2>
        <p>Movie data load nahi ho pa raha. Please refresh once.</p>
        <a class="back" href="index.html">← Back to movies</a>
      </div>`;
  }
}

if (live) {
  renderLivePage().catch(() => {
    w.innerHTML = '<div class="info"><h2>Movie page temporarily unavailable</h2><p>Live movie data load nahi ho pa raha.</p><a class="back" href="index.html">← Back to movies</a></div>';
  });
} else {
  renderLocalPage();
}
