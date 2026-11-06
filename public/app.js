/* SMRITHI public site — renders all content from /api/site and polls for updates. */

const state = {
  data: null,
  section: "home",
  galleryGroup: "all",
  expanded: new Set(),
  defaultsApplied: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });

const teamName = (id, fallback = "—") => {
  if (!id) return fallback;
  const team = state.data?.teams.find((item) => item.id === id);
  return team ? team.name : fallback;
};

const statusLabel = (status) =>
  ({ live: "Live", finished: "Finished", upcoming: "Upcoming" })[status] || "Upcoming";

function lighten(hex, amount = 0.14) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  const lifted = channels.map((channel) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount)),
  );
  return `#${lifted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------- theme ------------------------------- */

function initTheme() {
  const stored = localStorage.getItem("torque-theme");
  if (stored === "light" || stored === "dark") {
    document.body.classList.toggle("light-theme", stored === "light");
    document.body.classList.toggle("dark-theme", stored === "dark");
  }
  $("#themeToggle")?.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    document.body.classList.toggle("dark-theme", !isLight);
    localStorage.setItem("torque-theme", isLight ? "light" : "dark");
  });
}

function applyThemeDefaults(settings) {
  if (localStorage.getItem("torque-theme") || state.defaultsApplied) return;
  state.defaultsApplied = true;
  const mode = settings.theme?.defaultMode === "light" ? "light" : "dark";
  document.body.classList.toggle("light-theme", mode === "light");
  document.body.classList.toggle("dark-theme", mode === "dark");
}

function applyAccent(settings) {
  const accent = settings.theme?.accent || "#D4A843";
  document.documentElement.style.setProperty("--accent-gold", accent);
  document.documentElement.style.setProperty("--accent-gold-hover", lighten(accent));
}

/* ---------------------------- navigation ----------------------------- */

function showSection(target, { updateHash = true } = {}) {
  const section = document.getElementById(target);
  if (!section) return;
  state.section = target;
  $$(".page-section").forEach((item) => item.classList.toggle("active", item === section));
  $$(".nav-item[data-target]").forEach((item) =>
    item.classList.toggle("active", item.dataset.target === target),
  );
  $("#sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (updateHash && window.location.hash !== `#${target}`) {
    history.replaceState(null, "", `#${target}`);
  }
}

function initNavigation() {
  $$(".nav-item[data-target]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      showSection(item.dataset.target);
    });
  });
  $$("[data-goto]").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.goto));
  });
  const hash = window.location.hash.replace("#", "");
  if (hash && document.getElementById(hash)) showSection(hash, { updateHash: false });
}

function initMobileMenu() {
  $("#hamburger")?.addEventListener("click", () => $("#sidebar")?.classList.add("open"));
  $("#closeMenu")?.addEventListener("click", () => $("#sidebar")?.classList.remove("open"));
}

/* ------------------------------ lightbox ----------------------------- */

function initLightbox() {
  const box = $("#imageLightbox");
  const img = $("#lightboxImg");
  const close = () => {
    box.style.display = "none";
    document.body.style.overflow = "";
  };
  $("#lightboxClose")?.addEventListener("click", close);
  box?.addEventListener("click", (event) => {
    if (event.target === box || event.target === img?.parentElement) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && box.style.display === "flex") close();
  });
  window.openLightbox = (src, caption = "") => {
    if (!src) return;
    img.src = src;
    img.alt = caption;
    box.style.display = "flex";
    document.body.style.overflow = "hidden";
  };
}

/* ------------------------------ rendering ---------------------------- */

function renderBrand(settings) {
  const name = settings.brand?.name || "SMRITHI";
  const version = settings.brand?.version || "";
  const logo = settings.brand?.logoUrl || "/smriti-logo.svg";
  const logoImg = $("#brandLogo");
  if (logoImg) logoImg.src = logo;
  $("#mobileBrandName").textContent = name;
  $("#mobileBrandVersion").textContent = version;
  $("#footerBrand").textContent = name;
  $("#footerBrandVersion").textContent = version;
  document.title = `${name}${version ? ` ${version}` : ""} | ${settings.hero?.title || "Sports Fest"}`;
  $("#aboutSectionTitle").textContent = `ABOUT ${`${name} ${version}`.trim().toUpperCase()}`;
  $("#footerTagline").textContent = settings.footer?.tagline || "";
  $("#footerCopyright").textContent = settings.footer?.copyright || "";
  $("#footerCredits").textContent = settings.footer?.credits || "";
}

function setVisible(node, visible) {
  if (!node) return;
  node.style.display = visible ? "" : "none";
}

function renderHero(settings) {
  const hero = settings.hero || {};
  $("#heroTitle").textContent = hero.title || "";
  $("#heroSubtitle").textContent = hero.subtitle || "";
  $("#heroLocation").textContent = hero.location || "";
  setVisible($("#heroLocation"), Boolean(hero.location));
  $("#heroPrimary").textContent = hero.primaryCtaLabel || "View Leaderboard";

  $("#heroDates").innerHTML = (hero.dates || [])
    .map(
      (date) =>
        `<div class="date-item"><span>${escapeHTML(date.day)}</span>${escapeHTML(date.month)}</div>`,
    )
    .join("");
  setVisible($("#heroDates"), (hero.dates || []).length > 0);

  const photoWrap = $("#heroImageContainer");
  const photo = $("#heroImage");
  if (hero.photoUrl) {
    photo.src = hero.photoUrl;
    photo.alt = `${settings.brand?.name || "Fest"} photo`;
    photo.onclick = () => window.openLightbox(hero.photoUrl, "Fest photo");
    photoWrap.style.display = "block";
  } else {
    photoWrap.style.display = "none";
  }

  const ruleBook = $("#heroRuleBook");
  const ruleBookUrl = settings.documents?.ruleBookUrl || hero.ruleBookUrl;
  if (ruleBookUrl) {
    ruleBook.href = ruleBookUrl;
    ruleBook.textContent = settings.documents?.ruleBookLabel || hero.ruleBookLabel || "Rule Book";
    ruleBook.style.display = "";
  } else {
    ruleBook.style.display = "none";
  }

  const brochure = $("#heroBrochure");
  if (brochure) {
    if (settings.documents?.brochureUrl) {
      brochure.href = settings.documents.brochureUrl;
      brochure.textContent = settings.documents.brochureLabel || "Brochure";
      brochure.style.display = "";
    } else {
      brochure.style.display = "none";
    }
  }
}

function renderMap(settings) {
  const map = settings.map || {};
  const directions = map.directions || [];
  const card = $("#mapCard");

  const frame = $("#mapFrame");
  const frameWrap = $("#mapFrameWrap");
  if (map.embedUrl) {
    frame.src = map.embedUrl;
    frame.style.display = "";
  } else {
    frame.removeAttribute("src");
    frame.style.display = "none";
  }
  setVisible(frameWrap, Boolean(map.embedUrl));

  const link = $("#mapLink");
  if (map.linkUrl) {
    link.href = map.linkUrl;
    link.textContent = map.linkLabel || "View on Google Maps";
    link.style.display = "";
  } else {
    link.style.display = "none";
  }

  const list = $("#directionsList");
  if (list) {
    list.innerHTML = directions
      .map(
        (route) => `<div class="direction-row"><strong>${escapeHTML(route.from)}</strong>${
          route.details ? `<span>${escapeHTML(route.details)}</span>` : ""
        }</div>`,
      )
      .join("");
    setVisible(list, directions.length > 0);
  }

  setVisible(card, Boolean(map.embedUrl) || directions.length > 0 || Boolean(map.linkUrl));
}

function renderBlueprint(settings) {
  const url = settings.blueprintUrl || "";
  for (const id of ["homeBlueprint", "venueBlueprint"]) {
    const img = document.getElementById(id);
    if (!img) continue;
    img.style.display = url ? "" : "none";
    if (url) {
      img.src = url;
      img.onclick = () => window.openLightbox(url, "Venue blueprint");
    }
  }
  setVisible($("#homeBlueprintCard"), Boolean(url));
  setVisible($("#venueBlueprintCard"), Boolean(url));
}

function dayLabelFor(fixture) {
  const day = state.data?.days.find((item) => item.id === fixture.day_id);
  return day?.label || "";
}

function renderTicker(settings) {
  const container = $("#liveBannerContainer");
  const track = $("#liveBannerTrack");
  if (!container || !track) return;

  if (settings.banner?.enabled === false) {
    container.style.display = "none";
    return;
  }

  const fixtures = (state.data?.fixtures || []).filter(
    (fixture) => fixture.team_one_name || fixture.team_two_name,
  );
  const live = fixtures.filter((fixture) => fixture.status === "live");
  const upcoming = fixtures
    .filter((fixture) => fixture.status === "upcoming")
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const items = [...live, ...upcoming].slice(0, 10);

  const parts = [];
  if (settings.ticker?.enabled && settings.ticker.text) {
    parts.push(
      `<div class="banner-item"><div class="banner-event-info"><span class="banner-day">NOTICE</span><span class="banner-title">${escapeHTML(
        settings.ticker.text,
      )}</span></div></div>`,
    );
  }
  for (const fixture of items) {
    const teams = [fixture.team_one_name, fixture.team_two_name].filter(Boolean).join(" vs ");
    parts.push(`<div class="banner-item" data-goto="schedule">
        <div class="banner-event-info">
          <span class="banner-day">${escapeHTML(dayLabelFor(fixture) || "FIXTURE")}</span>
          <span class="banner-title">${escapeHTML(fixture.event_name || "Match")}${
            fixture.status === "live" ? '<span class="banner-live-tag">LIVE</span>' : ""
          }</span>
          <span class="banner-teams">${escapeHTML(teams || "Teams to be announced")}</span>
        </div>
        <div class="banner-event-info">
          <span class="banner-time">${escapeHTML(fixture.time || "")}</span>
          <span class="banner-time">${escapeHTML(fixture.round || "")}</span>
        </div>
      </div>`);
  }

  if (!parts.length) {
    container.style.display = "none";
    return;
  }
  track.innerHTML = parts.join("");
  track.querySelectorAll("[data-goto]").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.goto));
  });
  const label = $("#liveBannerLabel");
  if (label) label.textContent = settings.banner?.label?.trim() || "LIVE NOW";
  container.style.display = "block";
}

function renderSponsors(settings) {
  const sponsors = state.data?.sponsors || [];
  const containers = ["homeSponsors", "boardSponsors"].map((id) => document.getElementById(id));
  const wall = $("#sponsorWall");
  if (wall) {
    wall.innerHTML = sponsors
      .map((sponsor) => {
        const img = `<img src="${escapeHTML(sponsor.logo_url)}" alt="${escapeHTML(
          sponsor.name || "Sponsor logo",
        )}" loading="lazy">`;
        return sponsor.link
          ? `<a class="sponsor-wall-item" href="${escapeHTML(sponsor.link)}" target="_blank" rel="noopener" title="${escapeHTML(sponsor.name || "Sponsor")}">${img}</a>`
          : `<div class="sponsor-wall-item" title="${escapeHTML(sponsor.name || "Sponsor")}">${img}</div>`;
      })
      .join("");
  }
  if (!sponsors.length) {
    containers.forEach((node) => node && (node.style.display = "none"));
    if (wall) wall.innerHTML = "";
    return;
  }

  const slides = sponsors
    .map((sponsor) => {
      const inner = `<img src="${escapeHTML(sponsor.logo_url)}" alt="${escapeHTML(
        sponsor.name || "Sponsor logo",
      )}" loading="lazy">`;
      return sponsor.link
        ? `<a class="carousel-slide" href="${escapeHTML(sponsor.link)}" target="_blank" rel="noopener">${inner}</a>`
        : `<div class="carousel-slide">${inner}</div>`;
    })
    .join("");

  for (const container of containers) {
    if (!container) continue;
    container.style.display = "";
    container.querySelector(".carousel-title").textContent =
      settings.sponsorsTitle || "OFFICIAL SPONSORS";
    const track = container.querySelector("[data-sponsor-track]");
    track.innerHTML = slides + slides;
  }
}

function renderLeaderboard(settings) {
  const body = $("#leaderboardBody");
  const rows = state.data?.leaderboard || [];
  $("#lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  if (!rows.length) {
    body.innerHTML =
      '<tr class="loading-row"><td colspan="3">Leaderboard will appear once teams are added.</td></tr>';
  } else {
    body.innerHTML = rows
      .map((row, index) => {
        const rank = index + 1;
        const hasPoints = row.points > 0;
        return `<tr class="${rank <= 3 && hasPoints ? `rank-${rank}` : ""}">
          <td><div class="rank-badge">${rank}</div></td>
          <td><div class="team-name">${escapeHTML(row.name)}</div></td>
          <td><div class="points">${row.points}</div></td>
        </tr>`;
      })
      .join("");
  }

  const points = settings.points || {};
  $("#pointsNote").textContent = `Points: 1st place ${points.first ?? 10} · 2nd place ${
    points.second ?? 5
  } · 3rd place ${points.third ?? 3}. Standings update automatically from published results.`;
}

function renderSchedule() {
  const grid = $("#scheduleGrid");
  const data = state.data;
  const days = data.days || [];
  const fixtures = data.fixtures || [];

  if (!days.length) {
    grid.innerHTML =
      '<div class="glass-panel placeholder-panel"><p>Events will be published day by day.</p></div>';
    return;
  }

  const byDay = new Map();
  for (const fixture of fixtures) {
    if (!byDay.has(fixture.day_id)) byDay.set(fixture.day_id, []);
    byDay.get(fixture.day_id).push(fixture);
  }

  if (!state.autoOpened) {
    state.autoOpened = true;
    const withLive = days.find((day) => (byDay.get(day.id) || []).some((f) => f.status === "live"));
    const withFixtures = days.find((day) => (byDay.get(day.id) || []).length);
    const first = withLive || withFixtures || days[0];
    if (first) state.expanded.add(`day-${first.id}`);
    const liveEvent = (byDay.get(withLive?.id) || []).find((f) => f.status === "live");
    if (liveEvent) state.expanded.add(`sport-${liveEvent.day_id}-${liveEvent.event_name}`);
  }

  grid.innerHTML = "";

  for (const day of days) {
    const dayItems = (byDay.get(day.id) || []).slice().sort((a, b) => {
      const rank = { live: 0, upcoming: 1, finished: 2 };
      return (
        (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
        (a.sort_order || 0) - (b.sort_order || 0)
      );
    });

    const groups = new Map();
    for (const item of dayItems) {
      const key = item.event_name || "Other events";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    const groupsHTML = groups.size
      ? [...groups.entries()]
          .map(([sport, items]) => {
            const sportId = `sport-${day.id}-${sport}`;
            const isOpen = state.expanded.has(sportId);
            const fixturesHTML = items
              .map((item) => {
                const teams = [item.team_one_name, item.team_two_name]
                  .filter(Boolean)
                  .join(" vs ");
                const roundsHTML =
                  item.score && item.score.includes("|")
                    ? ""
                    : "";
                return `<div class="schedule-fixture-card">
                    <div class="schedule-fixture-main">
                      <div class="schedule-fixture-teams">${escapeHTML(
                        teams || "Teams to be announced",
                      )}</div>
                      <div class="schedule-fixture-time">${escapeHTML(
                        [item.time, item.round].filter(Boolean).join(" • ") || "Time TBA",
                      )}</div>
                      ${
                        item.score
                          ? `<div class="live-score-display" style="${
                              item.status === "finished" ? "border-color: rgba(255,255,255,0.1);" : ""
                            }">
                              <div class="live-score-header">${
                                item.status === "live"
                                  ? '<span class="live-pulse"></span>LIVE SCORE'
                                  : "FINAL SCORE"
                              }</div>
                              <div class="score-simple-row">
                                <div class="score-value">${escapeHTML(item.score)}</div>
                                ${
                                  item.score_round
                                    ? `<div class="score-round-tag">${escapeHTML(item.score_round)}</div>`
                                    : ""
                                }
                              </div>
                              ${roundsHTML}
                            </div>`
                          : ""
                      }
                      ${
                        item.winner
                          ? `<div class="schedule-winner-note">Result: ${escapeHTML(item.winner)}</div>`
                          : ""
                      }
                      ${
                        item.live_link
                          ? `<a href="${escapeHTML(
                              item.live_link,
                            )}" target="_blank" rel="noopener" class="live-scorecard-btn"><span class="live-icon">↗</span>VIEW LIVE SCORECARD</a>`
                          : ""
                      }
                    </div>
                    <div class="schedule-fixture-status">
                      <span class="result-status-badge result-status-${escapeHTML(
                        item.status,
                      )}">${escapeHTML(statusLabel(item.status))}</span>
                    </div>
                  </div>`;
              })
              .join("");

            return `<div class="schedule-sport-group" style="${
              isOpen ? "border-color: rgba(212, 168, 67, 0.3);" : ""
            }">
                <button class="schedule-sport-header" type="button" data-sport="${escapeHTML(sportId)}">
                  <span>${escapeHTML(sport)}</span>
                  <span class="expand-icon" style="transform: rotate(${isOpen ? 180 : 0}deg)">&#9662;</span>
                </button>
                <div class="schedule-sport-body ${isOpen ? "open" : ""}" data-sport-body="${escapeHTML(sportId)}">
                  ${fixturesHTML}
                </div>
              </div>`;
          })
          .join("")
      : '<div class="schedule-empty-state">Fixtures will be updated soon.</div>';

    const dayId = `day-${day.id}`;
    const open = state.expanded.has(dayId);
    const card = document.createElement("div");
    card.className = "glass-panel schedule-day-card";
    card.style.borderColor = open ? "rgba(212, 168, 67, 0.35)" : "";
    card.innerHTML = `
      <button class="schedule-day-header" type="button" data-day="${escapeHTML(dayId)}">
        <div>
          <span class="schedule-day-badge">${escapeHTML(day.label)}</span>
          ${day.highlight ? `<p class="schedule-day-highlight">${escapeHTML(day.highlight)}</p>` : ""}
          <p>${dayItems.length} fixture${dayItems.length === 1 ? "" : "s"}</p>
        </div>
        <span class="expand-icon" style="transform: rotate(${open ? 180 : 0}deg)">&#9662;</span>
      </button>
      <div class="schedule-day-body ${open ? "open" : ""}">
        <div class="schedule-events-list">${groupsHTML}</div>
      </div>`;
    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-day]").forEach((header) => {
    header.addEventListener("click", () => {
      const dayId = header.dataset.day;
      const card = header.closest(".schedule-day-card");
      const body = header.nextElementSibling;
      const icon = header.querySelector(".expand-icon");
      const isOpen = body.classList.toggle("open");
      icon.style.transform = `rotate(${isOpen ? 180 : 0}deg)`;
      card.style.borderColor = isOpen ? "rgba(212, 168, 67, 0.35)" : "";
      if (isOpen) state.expanded.add(dayId);
      else state.expanded.delete(dayId);
    });
  });

  grid.querySelectorAll("[data-sport]").forEach((header) => {
    header.addEventListener("click", (event) => {
      event.stopPropagation();
      const sportId = header.dataset.sport;
      const body = header.nextElementSibling;
      const group = header.closest(".schedule-sport-group");
      const icon = header.querySelector(".expand-icon");
      const isOpen = body.classList.toggle("open");
      icon.style.transform = `rotate(${isOpen ? 180 : 0}deg)`;
      group.style.borderColor = isOpen ? "rgba(212, 168, 67, 0.3)" : "";
      if (isOpen) state.expanded.add(sportId);
      else state.expanded.delete(sportId);
    });
  });
}

function renderResults() {
  const grid = $("#resultsGrid");
  const results = (state.data?.results || []).slice().sort((a, b) => a.name.localeCompare(b.name));

  if (!results.length) {
    grid.innerHTML =
      '<div class="glass-panel placeholder-panel"><p>Results will be updated once events are completed.</p></div>';
    return;
  }

  grid.innerHTML = "";
  for (const result of results) {
    const podium = [
      { medal: "🥇", team: teamName(result.first_team_id), cls: "" },
      { medal: "🥈", team: teamName(result.second_team_id), cls: "result-medal-secondary" },
      { medal: "🥉", team: teamName(result.third_team_id), cls: "result-medal-secondary" },
    ].filter((row) => row.team !== "—");

    const card = document.createElement("div");
    card.className = "event-card glass-panel";
    card.innerHTML = `
      <div class="event-card-header">
        <div>
          <h3 class="event-title">${escapeHTML(result.name)}</h3>
          <small class="results-hint">Click to view standings</small>
        </div>
        <span class="expand-icon">&#9662;</span>
      </div>
      <div class="event-card-body">
        <div class="event-results-list">
          ${
            podium.length
              ? podium
                  .map(
                    (row) => `<div class="result-item">
                      <span class="result-medal ${row.cls}">${row.medal}</span>
                      <span class="result-team">${escapeHTML(row.team)}</span>
                    </div>`,
                  )
                  .join("")
              : '<div class="result-item"><span class="result-team">Winners will be published soon.</span></div>'
          }
          ${result.note ? `<p class="results-hint">${escapeHTML(result.note)}</p>` : ""}
        </div>
      </div>`;

    card.addEventListener("click", () => {
      const list = card.querySelector(".event-results-list");
      const icon = card.querySelector(".expand-icon");
      const isShowing = list.classList.toggle("show");
      icon.style.transform = `rotate(${isShowing ? 180 : 0}deg)`;
      card.style.borderColor = isShowing ? "var(--accent-gold)" : "";
    });

    grid.appendChild(card);
  }
}

function renderGallery() {
  const grid = $("#publicGalleryGrid");
  const filters = $("#galleryFilters");
  const photos = state.data?.gallery || [];

  if (!photos.length) {
    filters.innerHTML = "";
    grid.innerHTML =
      '<div class="empty-state"><strong>Gallery coming soon</strong>Photos from the fest will appear here as soon as the media team uploads them.</div>';
    return;
  }

  const groups = ["all", ...new Set(photos.map((photo) => photo.group_name).filter(Boolean))];
  if (!groups.includes(state.galleryGroup)) state.galleryGroup = "all";

  filters.innerHTML = groups
    .map(
      (group) =>
        `<button type="button" class="filter-chip ${
          state.galleryGroup === group ? "active" : ""
        }" data-group="${escapeHTML(group)}">${
          group === "all" ? "All photos" : escapeHTML(group)
        }</button>`,
    )
    .join("");

  filters.querySelectorAll("[data-group]").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.galleryGroup = chip.dataset.group;
      renderGallery();
    });
  });

  const visible =
    state.galleryGroup === "all"
      ? photos
      : photos.filter((photo) => photo.group_name === state.galleryGroup);

  grid.innerHTML = `<div class="gallery-grid">${visible
    .map(
      (photo) => `<figure class="gallery-item" data-src="${escapeHTML(photo.url)}">
        <img src="${escapeHTML(photo.url)}" alt="${escapeHTML(
          photo.caption || "Fest photo",
        )}" loading="lazy">
        ${photo.caption ? `<figcaption class="gallery-caption">${escapeHTML(photo.caption)}</figcaption>` : ""}
      </figure>`,
    )
    .join("")}</div>`;

  grid.querySelectorAll(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => window.openLightbox(item.dataset.src, "Fest photo"));
  });
}

function socialIcon(type) {
  const icons = {
    instagram:
      '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>',
    whatsapp:
      '<path d="M12.05 2a10 10 0 0 0-8.5 15.3L2 22l4.85-1.5A10 10 0 1 0 12.05 2Zm0 18a8 8 0 0 1-4.1-1.13l-.29-.17-2.9.85.87-2.83-.19-.29A8 8 0 1 1 12.05 20Zm4.4-5.8c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.52.57.22 1.02.35 1.37.45.57.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"',
    facebook:
      '<path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.88h-2.33v6.99A10 10 0 0 0 22 12Z"',
    youtube:
      '<path d="M23 12s0-3.44-.44-5.1a2.78 2.78 0 0 0-1.95-1.96C18.94 4.5 12 4.5 12 4.5s-6.94 0-8.61.44A2.78 2.78 0 0 0 1.44 6.9C1 8.56 1 12 1 12s0 3.44.44 5.1a2.78 2.78 0 0 0 1.95 1.96c1.67.44 8.61.44 8.61.44s6.94 0 8.61-.44a2.78 2.78 0 0 0 1.95-1.96C23 15.44 23 12 23 12Zm-13.5 3.27V8.73L15.5 12Z"',
    x: '<path d="M18.9 2H22l-6.77 7.74L23 22h-6.9l-4.83-6.32L5.7 22H2.6l7.24-8.28L1.5 2h7.06l4.3 5.7L18.9 2Zm-1.2 18h1.72L6.4 3.9H4.56L17.7 20Z"',
    website:
      '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14A8.2 8.2 0 0 1 4 12c0-.69.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26Zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A8.03 8.03 0 0 1 5.08 16Zm2.95-8H5.08a8.03 8.03 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8ZM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96ZM14.34 14H9.66A13 13 0 0 1 9.5 12c0-.68.06-1.35.16-2h4.68c.1.65.16 1.32.16 2 0 .68-.06 1.35-.16 2Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2 0 .69-.1 1.36-.26 2h-3.38Z"',
  };
  const fill = type === "instagram" ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ${fill}>${
    icons[type] || icons.website
  }</svg>`;
}

function renderContacts(settings) {
  const contacts = settings.contacts || [];
  setVisible($("#footerContacts")?.closest(".footer-contact"), contacts.length > 0);
  setVisible($("#socialLinks")?.closest(".social-links"), (settings.socials || []).some((s) => s.url));
  $("#footerContacts").innerHTML = contacts
    .map((contact) => {
      const digits = String(contact.phone || "").replace(/[^\d]/g, "");
      const links = digits
        ? `<div class="mini-links">
            <a href="https://wa.me/${digits}" target="_blank" rel="noopener" class="footer-icon-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.41 0 .004 5.41 0 12.05c0 2.12.55 4.2 1.6 6.01L0 24l6.14-1.61a11.74 11.74 0 0 0 5.91 1.6h.005c6.63 0 12.04-5.41 12.05-12.05a11.85 11.85 0 0 0-3.49-8.45"/></svg>
              WhatsApp
            </a>
            <a href="tel:${escapeHTML(contact.phone)}" class="footer-icon-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.11-.27 11.72 11.72 0 0 0 3.7.59 1 1 0 0 1 1 1v3.59a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.59a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.7 1 1 0 0 1-.27 1.11z"/></svg>
              Call
            </a>
          </div>`
        : "";
      return `<div class="footer-contact-item">
          <span>${escapeHTML(contact.name)}${
            contact.role ? ` (${escapeHTML(contact.role)})` : ""
          }</span>
          ${links}
        </div>`;
    })
    .join("");

  $("#socialLinks").innerHTML = (settings.socials || [])
    .filter((social) => social.url)
    .map(
      (social) =>
        `<a href="${escapeHTML(social.url)}" target="_blank" rel="noopener" class="social-icon" title="${escapeHTML(
          social.label || social.type || "Social",
        )}" aria-label="${escapeHTML(social.label || social.type || "Social")}">${socialIcon(
          social.type,
        )}</a>`,
    )
    .join("");
}

function renderAbout(settings) {
  const about = settings.about || {};
  $("#aboutKicker").textContent = about.kicker || "";
  $("#aboutHeading").textContent = about.heading || "";
  $("#aboutIntro").textContent = about.intro || "";
  $("#aboutStats").innerHTML = (about.stats || [])
    .map(
      (stat) =>
        `<div class="about-stat"><strong>${escapeHTML(stat.value)}</strong><span>${escapeHTML(
          stat.label,
        )}</span></div>`,
    )
    .join("");
  $("#aboutHostKicker").textContent = about.hostKicker || "";
  $("#aboutHostTitle").textContent = about.hostTitle || "";
  $("#aboutHostBody").innerHTML = (about.hostParagraphs || [])
    .map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`)
    .join("");
  $("#aboutHighlightsTitle").textContent = about.highlightsTitle || "";
  $("#aboutHighlights").innerHTML = (about.highlights || [])
    .map((item) => `<li>${escapeHTML(item)}</li>`)
    .join("");
  $("#aboutSectionSubtitle").textContent = settings.hero?.title || "Intercollegiate Sports Fest";

  // Footer admin shortcut
  if (!$(".footer-admin-link") && $("#footerTagline")) {
    const link = document.createElement("a");
    link.className = "footer-admin-link";
    link.href = "/admin";
    link.textContent = "Admin Panel";
    $("#footerTagline").after(link);
  }
}

function renderClubs(settings) {
  const strip = $("#clubStrip");
  if (!strip) return;
  const clubs = settings.clubs || [];
  strip.innerHTML = clubs
    .map(
      (club) => `<div class="club-item">${
        club.logoUrl
          ? `<img src="${escapeHTML(club.logoUrl)}" alt="${escapeHTML(club.name)}" loading="lazy">`
          : ""
      }<span>${escapeHTML(club.name)}</span></div>`,
    )
    .join("");
  setVisible(strip, clubs.length > 0);
}

function renderTribute(settings) {
  const card = $("#tributeCard");
  if (!card) return;
  const tribute = settings.tribute || {};
  const hasTribute = Boolean(tribute.title || tribute.text);
  $("#tributeTitle").textContent = tribute.title || "";
  $("#tributeText").innerHTML = String(tribute.text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHTML(line)}</p>`)
    .join("");
  setVisible(card, hasTribute);
}

function renderDocuments(settings) {
  const card = $("#documentsCard");
  const links = $("#documentLinks");
  if (!card || !links) return;
  const docs = settings.documents || {};
  const items = [];
  if (docs.ruleBookUrl) {
    items.push(
      `<a class="btn btn-secondary" href="${escapeHTML(docs.ruleBookUrl)}" target="_blank" rel="noopener">${escapeHTML(
        docs.ruleBookLabel || "Rule Book",
      )}</a>`,
    );
  }
  if (docs.brochureUrl) {
    items.push(
      `<a class="btn btn-secondary" href="${escapeHTML(docs.brochureUrl)}" target="_blank" rel="noopener">${escapeHTML(
        docs.brochureLabel || "Brochure",
      )}</a>`,
    );
  }
  links.innerHTML = items.join("");
  setVisible(card, items.length > 0);
}

function renderBracket() {
  const grid = $("#bracketGrid");
  if (!grid) return;
  const fixtures = (state.data?.fixtures || []).filter((fixture) => fixture.round);
  const byEvent = new Map();
  for (const fixture of fixtures) {
    const key = fixture.event_name || "Event";
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(fixture);
  }

  grid.innerHTML = [...byEvent.entries()]
    .map(([event, items]) => {
      const byRound = new Map();
      for (const fixture of items) {
        const key = fixture.round || "Round";
        if (!byRound.has(key)) byRound.set(key, []);
        byRound.get(key).push(fixture);
      }
      const rounds = [...byRound.entries()]
        .map(
          ([round, matches]) => `<div class="bracket-round">
            <span class="bracket-round-label">${escapeHTML(round)}</span>
            ${matches
              .map(
                (match) => `<div class="bracket-match">
                  <span class="bracket-team">${escapeHTML(
                    [match.team_one_name, match.team_two_name].filter(Boolean).join(" vs ") ||
                      "Teams to be announced",
                  )}</span>
                  ${
                    match.score
                      ? `<strong>${escapeHTML(match.score)}</strong>`
                      : `<em>${escapeHTML(match.time || "TBA")}</em>`
                  }
                </div>`,
              )
              .join("")}
          </div>`,
        )
        .join("");
      return `<div class="glass-panel bracket-card">
        <h3 class="event-title">${escapeHTML(event)}</h3>
        <div class="bracket-rounds">${rounds}</div>
      </div>`;
    })
    .join("");
  setVisible(document.getElementById("bracket"), fixtures.length > 0);
}

function renderRegistration(settings) {
  const grid = $("#registrationGrid");
  if (!grid) return;
  const games = settings.games || [];
  grid.innerHTML = games
    .map(
      (game) => `<div class="glass-panel reg-card">
        <h3 class="event-title">${escapeHTML(game.name)}</h3>
        <div class="reg-row"><span>Entry fee</span><strong>${escapeHTML(game.fee || "—")}</strong></div>
        <div class="reg-row"><span>Prize pool</span><strong>${escapeHTML(game.prize || "—")}</strong></div>
        ${
          game.link
            ? `<a class="btn btn-primary" href="${escapeHTML(game.link)}" target="_blank" rel="noopener">Register</a>`
            : ""
        }
      </div>`,
    )
    .join("");
  setVisible(document.getElementById("registration"), games.length > 0);
}

function renderCommittee(settings) {
  const grid = $("#committeeGrid");
  if (!grid) return;
  const contacts = settings.contacts || [];
  grid.innerHTML = contacts
    .map((contact) => {
      const digits = String(contact.phone || "").replace(/[^\d]/g, "");
      return `<div class="glass-panel committee-card">
        <span class="committee-role">${escapeHTML(contact.role || "Committee")}</span>
        <strong>${escapeHTML(contact.name)}</strong>
        ${contact.phone ? `<span class="committee-phone">${escapeHTML(contact.phone)}</span>` : ""}
        ${
          digits
            ? `<div class="mini-links">
                <a class="footer-icon-link" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a>
                <a class="footer-icon-link" href="tel:${escapeHTML(contact.phone)}">Call</a>
              </div>`
            : ""
        }
      </div>`;
    })
    .join("");
  setVisible(document.getElementById("committee"), contacts.length > 0);
}

function syncVisibility() {
  const data = state.data || {};
  const settings = data.settings || {};
  const about = settings.about || {};
  const hasAbout = Boolean(
    about.heading ||
      about.intro ||
      (about.stats || []).length ||
      about.hostTitle ||
      (about.hostParagraphs || []).length ||
      (about.highlights || []).length ||
      (settings.clubs || []).length ||
      settings.tribute?.title ||
      settings.tribute?.text ||
      settings.documents?.ruleBookUrl ||
      settings.documents?.brochureUrl,
  );

  const pages = {
    schedule: (data.days || []).length + (data.fixtures || []).length > 0,
    bracket: (data.fixtures || []).some((fixture) => fixture.round),
    teams: Boolean(settings.blueprintUrl),
    leaderboard: (data.teams || []).length > 0,
    results: (data.results || []).length > 0,
    gallery: (data.gallery || []).length > 0,
    about: hasAbout,
    sponsors: (data.sponsors || []).length > 0,
    registration: (settings.games || []).length > 0,
    committee: (settings.contacts || []).length > 0,
  };

  for (const [id, visible] of Object.entries(pages)) {
    const section = document.getElementById(id);
    if (section) section.style.display = visible ? "" : "none";
    $$(`.nav-item[data-target="${id}"]`).forEach((item) => {
      item.style.display = visible ? "" : "none";
    });
  }

  if (!pages[state.section] && state.section !== "home") showSection("home");
}

/* ------------------------------- loading ----------------------------- */

function renderAll() {
  const settings = state.data.settings;
  applyAccent(settings);
  applyThemeDefaults(settings);
  renderBrand(settings);
  renderHero(settings);
  renderMap(settings);
  renderBlueprint(settings);
  renderTicker(settings);
  renderSponsors(settings);
  renderLeaderboard(settings);
  renderSchedule();
  renderResults();
  renderGallery();
  renderAbout(settings);
  renderClubs(settings);
  renderTribute(settings);
  renderDocuments(settings);
  renderBracket();
  renderRegistration(settings);
  renderCommittee(settings);
  renderContacts(settings);
  syncVisibility();
  document.body.classList.add("site-ready");
}

async function loadSite({ quiet = false } = {}) {
  const spinner = $("#refreshSpinner");
  if (!quiet && spinner) spinner.style.display = "block";
  try {
    const response = await fetch("/api/site", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`API responded ${response.status}`);
    const data = await response.json();
    state.data = data;
    renderAll();
  } catch (error) {
    console.error("Could not load site content", error);
    if (!state.data) {
      $("#scheduleGrid").innerHTML =
        '<div class="glass-panel placeholder-panel"><p>Could not load content. Refresh to retry.</p></div>';
      $("#lastUpdated").textContent = "Offline";
    }
  } finally {
    if (spinner) spinner.style.display = "none";
  }
}

function init() {
  initTheme();
  initNavigation();
  initMobileMenu();
  initLightbox();
  loadSite();
  setInterval(() => {
    if (document.visibilityState === "visible") loadSite({ quiet: true });
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadSite({ quiet: true });
  });
}

document.addEventListener("DOMContentLoaded", init);
