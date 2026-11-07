/* SMRITHI admin dashboard — talks to the protected /api/admin/* API. */

const state = {
  data: null,
  tab: "overview",
  selectedDay: null,
  galleryGroup: "",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });

const fmtTime = (value) => {
  const date = new Date(Number(value) || Date.now());
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ------------------------------ plumbing ---------------------------- */

async function api(path, { method = "GET", body, form } = {}) {
  const headers = { accept: "application/json" };
  if (method !== "GET") headers["x-requested-with"] = "torque-admin";
  if (body) headers["content-type"] = "application/json";

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    showLogin();
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

let toastTimer;
function toast(message, type = "success") {
  const node = $("#toast");
  node.textContent = message;
  node.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.className = "toast"), 3200);
}

async function uploadImage(file) {
  if (!file) throw new Error("No file selected");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB");
  const form = new FormData();
  form.append("file", file);
  const result = await api("/api/admin/upload", { method: "POST", form });
  return result.url;
}

/* ------------------------------- auth ------------------------------- */

function showLogin() {
  $("#adminApp").hidden = true;
  $("#loginOverlay").style.display = "flex";
  $("#adminPassword").focus();
}

function showApp() {
  $("#loginOverlay").style.display = "none";
  $("#adminApp").hidden = false;
}

async function boot() {
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) return showLogin();
    showApp();
    await loadData();
  } catch {
    showLogin();
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#loginButton");
  const error = $("#loginError");
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Checking...";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: { password: $("#adminPassword").value },
    });
    $("#adminPassword").value = "";
    showApp();
    await loadData();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = "Access dashboard";
  }
});

async function logout() {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  location.reload();
}

/* ------------------------------- data ------------------------------- */

async function loadData() {
  try {
    state.data = await api("/api/admin/data");
    if (!state.selectedDay) state.selectedDay = state.data.days[0]?.id || null;
    renderAll();
    $("#lastSaved").textContent = `Synced ${new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch (error) {
    toast(error.message, "error");
  }
}

function teamName(id, fallback = "—") {
  return state.data?.teams.find((team) => team.id === id)?.name || fallback;
}

function renderAll() {
  const data = state.data;
  if (!data) return;

  $("#adminBrandName").textContent = data.settings.brand?.name || "SMRITHI";
  $("#adminBrandVersion").textContent = data.settings.brand?.version || "";
  if (data.settings.brand?.logoUrl) $("#adminLogo").src = data.settings.brand.logoUrl;

  const counts = {
    teams: data.teams.length,
    fixtures: data.fixtures.length,
    results: data.results.length,
    sponsors: data.sponsors.length,
    gallery: data.gallery.length,
    games: (data.settings.games || []).length,
  };
  for (const [key, value] of Object.entries(counts)) {
    $$(`[data-count="${key}"]`).forEach((node) => (node.textContent = value));
  }

  const banner = $("#securityBanner");
  if (data.usingDefaultPassword) {
    banner.hidden = false;
    banner.innerHTML =
      "⚠ You are still using the default password. Open <strong>Security &amp; backup</strong> and set your own before sharing this site widely.";
  } else if (data.passwordManagedBySecret) {
    banner.hidden = false;
    banner.innerHTML =
      "The admin password is managed by the <strong>ADMIN_PASSWORD</strong> secret for this deployment. Update that secret to change it.";
  } else {
    banner.hidden = true;
  }

  renderOverview();
  renderTeams();
  renderScheduleAdmin();
  renderResults();
  renderSponsors();
  renderGallery();
  renderRegistrationAdmin();
  renderContent();
  renderSecurity();
}

/* ------------------------------ overview ---------------------------- */

function renderOverview() {
  const data = state.data;
  const leader = data.leaderboard[0];
  const stats = [
    { label: "Teams", value: data.teams.length, hint: "Colleges competing" },
    { label: "Fixtures", value: data.fixtures.length, hint: `${data.days.length} fest days` },
    { label: "Results", value: data.results.length, hint: "Published events" },
    { label: "Gallery", value: data.gallery.length, hint: "Live photos" },
    { label: "Leader", value: leader ? leader.points : 0, hint: leader ? leader.name : "No points yet" },
  ];

  $("#statGrid").innerHTML = stats
    .map(
      (stat) => `<div class="stat-card">
        <span>${esc(stat.label)}</span>
        <strong>${esc(stat.value)}</strong>
        <small>${esc(stat.hint)}</small>
      </div>`,
    )
    .join("");

  $("#overviewLeaderboard").innerHTML = data.leaderboard.length
    ? data.leaderboard
        .slice(0, 8)
        .map(
          (row, index) => `<tr>
            <td>${index + 1}</td>
            <td>${esc(row.name)}</td>
            <td>${row.first}</td>
            <td>${row.second}</td>
            <td>${row.third}</td>
            <td><strong>${row.points}</strong></td>
          </tr>`,
        )
        .join("")
    : '<tr class="empty-row"><td colspan="6">Add teams and results to build the leaderboard.</td></tr>';

  $("#activityList").innerHTML = (data.activity || []).length
    ? data.activity
        .map(
          (entry) => `<li>
            <div><strong>${esc(entry.action)}</strong> · ${esc(entry.detail || "")}<time>${fmtTime(
              entry.created_at,
            )}</time></div>
          </li>`,
        )
        .join("")
    : "<li>No changes yet. Everything you edit is logged here.</li>";

  const upcoming = data.fixtures
    .filter((fixture) => fixture.status !== "finished")
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0))
    .slice(0, 8);

  $("#overviewFixtures").innerHTML = upcoming.length
    ? upcoming
        .map((fixture) => {
          const day = data.days.find((item) => item.id === fixture.day_id);
          return `<tr>
            <td>${esc(day?.label || "—")}</td>
            <td>${esc(fixture.event_name || "—")}</td>
            <td>${esc([fixture.team_one_name, fixture.team_two_name].filter(Boolean).join(" vs ") || "TBA")}</td>
            <td>${esc(fixture.time || "—")}</td>
            <td><span class="pill ${esc(fixture.status)}">${esc(fixture.status)}</span></td>
          </tr>`;
        })
        .join("")
    : '<tr class="empty-row"><td colspan="5">No fixtures scheduled yet.</td></tr>';
}

/* ------------------------------- teams ------------------------------ */

function renderTeams() {
  const teams = state.data.teams;
  $("#teamsBody").innerHTML = teams.length
    ? teams
        .map(
          (team) => `<tr>
            <td>${
              team.logo_url
                ? `<img class="thumb" src="${esc(team.logo_url)}" alt="">`
                : '<span class="thumb empty">—</span>'
            }</td>
            <td><strong>${esc(team.name)}</strong></td>
            <td>${esc(team.short_name || "—")}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" data-edit-team="${esc(team.id)}">Edit</button>
                <button type="button" class="icon-btn danger" data-delete-team="${esc(team.id)}">Delete</button>
              </div>
            </td>
          </tr>`,
        )
        .join("")
    : '<tr class="empty-row"><td colspan="4">No teams yet. Add the participating colleges.</td></tr>';

  $$("[data-edit-team]").forEach((button) =>
    button.addEventListener("click", () => editTeam(button.dataset.editTeam)),
  );
  $$("[data-delete-team]").forEach((button) =>
    button.addEventListener("click", () => removeRecord("teams", button.dataset.deleteTeam, "team")),
  );
}

function editTeam(id) {
  const team = state.data.teams.find((item) => item.id === id);
  openForm({
    title: team ? "Edit team" : "Add team",
    subtitle: "Teams appear in fixtures, results and the leaderboard.",
    values: team || {},
    fields: [
      { name: "name", label: "College / team name", required: true, full: true },
      { name: "short_name", label: "Short name", placeholder: "e.g. TMC" },
      { name: "sort_order", label: "Display order", type: "number" },
      { name: "logo_url", label: "Team logo", type: "image", full: true },
    ],
    submitLabel: team ? "Save team" : "Add team",
    onSubmit: async (values) => {
      if (team) await api(`/api/admin/teams/${encodeURIComponent(team.id)}`, { method: "PUT", body: values });
      else await api("/api/admin/teams", { method: "POST", body: values });
    },
  });
}

/* ----------------------------- schedule ---------------------------- */

function renderScheduleAdmin() {
  const { days, fixtures } = state.data;

  $("#dayList").innerHTML = days.length
    ? days
        .map((day) => {
          const count = fixtures.filter((fixture) => fixture.day_id === day.id).length;
          return `<li class="day-row ${
            state.selectedDay === day.id ? "active" : ""
          }" data-day-select="${esc(day.id)}">
            <strong>${esc(day.label)}</strong>
            <small>${count} fixture${count === 1 ? "" : "s"}</small>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-edit-day="${esc(day.id)}">Edit</button>
              <button type="button" class="icon-btn danger" data-delete-day="${esc(day.id)}">Delete</button>
            </div>
          </li>`;
        })
        .join("")
    : '<li class="empty-row">No days yet. Add the fest days first.</li>';

  $$("[data-day-select]").forEach((row) =>
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.selectedDay = row.dataset.daySelect;
      renderScheduleAdmin();
    }),
  );
  $$("[data-edit-day]").forEach((button) =>
    button.addEventListener("click", () => editDay(button.dataset.editDay)),
  );
  $$("[data-delete-day]").forEach((button) =>
    button.addEventListener("click", async () => {
      const ok = await confirmDialog(
        "Delete this day?",
        "Every fixture scheduled on this day will be removed as well.",
      );
      if (!ok) return;
      await run(() => api(`/api/admin/days/${encodeURIComponent(button.dataset.deleteDay)}`, { method: "DELETE" }));
      if (state.selectedDay === button.dataset.deleteDay) state.selectedDay = state.data.days[0]?.id || null;
      renderScheduleAdmin();
    }),
  );

  const selected = days.find((day) => day.id === state.selectedDay);
  $("#fixturePanelTitle").textContent = selected ? `Fixtures — ${selected.label}` : "Fixtures";
  $("#fixturePanelHint").textContent = selected
    ? `${fixtures.filter((fixture) => fixture.day_id === selected.id).length} fixtures on this day`
    : "Select a day to manage its fixtures.";

  const list = selected ? fixtures.filter((fixture) => fixture.day_id === selected.id) : [];
  $("#fixturesBody").innerHTML = list.length
    ? list
        .map(
          (fixture) => `<tr>
            <td>${esc(fixture.event_name || "—")}</td>
            <td>${esc(
              [fixture.team_one_name, fixture.team_two_name].filter(Boolean).join(" vs ") || "TBA",
            )}<br><small class="muted">${esc(fixture.round || "")}</small></td>
            <td>${esc(fixture.time || "—")}</td>
            <td><span class="pill ${esc(fixture.status)}">${esc(fixture.status)}</span></td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" data-edit-fixture="${esc(fixture.id)}">Edit</button>
                <button type="button" class="icon-btn danger" data-delete-fixture="${esc(fixture.id)}">Delete</button>
              </div>
            </td>
          </tr>`,
        )
        .join("")
    : '<tr class="empty-row"><td colspan="5">No fixtures on this day yet.</td></tr>';

  $$("[data-edit-fixture]").forEach((button) =>
    button.addEventListener("click", () => editFixture(button.dataset.editFixture)),
  );
  $$("[data-delete-fixture]").forEach((button) =>
    button.addEventListener("click", () => removeRecord("fixtures", button.dataset.deleteFixture, "fixture")),
  );
}

/* --------------------------- registration --------------------------- */

function renderRegistrationAdmin() {
  const games = state.data.settings.games || [];
  const body = $("#gamesBody");
  if (!body) return;

  body.innerHTML = games.length
    ? games
        .map(
          (game, index) => `<tr>
            <td><strong>${esc(game.name || "Untitled game")}</strong></td>
            <td>${game.fee ? esc(game.fee) : '<span class="muted">hidden</span>'}</td>
            <td>${game.prize ? esc(game.prize) : '<span class="muted">hidden</span>'}</td>
            <td>${
              game.link
                ? `<a class="link" href="${esc(game.link)}" target="_blank" rel="noopener">Open form ↗</a>`
                : '<span class="muted">—</span>'
            }</td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" data-edit-game="${index}">Edit</button>
                <button type="button" class="icon-btn danger" data-delete-game="${index}">Delete</button>
              </div>
            </td>
          </tr>`,
        )
        .join("")
    : '<tr class="empty-row"><td colspan="5">No registration entries yet. Add a game to start collecting fees.</td></tr>';

  $$("[data-edit-game]").forEach((button) =>
    button.addEventListener("click", () => editGame(Number(button.dataset.editGame))),
  );
  $$("[data-delete-game]").forEach((button) =>
    button.addEventListener("click", () => removeGame(Number(button.dataset.deleteGame))),
  );
}

function saveGames(games) {
  return api("/api/admin/settings", { method: "PUT", body: { games } });
}

function editGame(index) {
  const games = (state.data.settings.games || []).map((game) => ({ ...game }));
  const game = Number.isInteger(index) && index >= 0 ? games[index] : null;
  openForm({
    title: game ? "Edit registration entry" : "Add registration entry",
    subtitle: "Each entry becomes a card in the public Registration section.",
    values: game || {},
    fields: [
      { name: "name", label: "Game / sport", placeholder: "Football", required: true, full: true },
      { name: "fee", label: "Entry fee", placeholder: "₹100 per player" },
      { name: "prize", label: "Prize pool", placeholder: "₹10,000 for the winners" },
      { name: "link", label: "Registration form link", placeholder: "https://forms.gle/...", full: true },
    ],
    submitLabel: game ? "Save entry" : "Add entry",
    onSubmit: async (values) => {
      if (game) games[index] = { ...game, ...values };
      else games.push(values);
      await saveGames(games);
    },
  });
}

async function removeGame(index) {
  const games = (state.data.settings.games || []).map((game) => ({ ...game }));
  const ok = await confirmDialog(
    `Delete ${games[index]?.name || "this entry"}?`,
    "It will be removed from the public registration page.",
  );
  if (!ok) return;
  games.splice(index, 1);
  await run(() => saveGames(games), "Registration entry deleted");
}

/* ------------------------------ schedule ---------------------------- */

function editDay(id) {
  const day = state.data.days.find((item) => item.id === id);
  openForm({
    title: day ? "Edit day" : "Add fest day",
    values: day || { sort_order: (state.data.days.length || 0) + 1 },
    fields: [
      { name: "label", label: "Day label", required: true, placeholder: "Day 1 — 27 Apr", full: true },
      { name: "date", label: "Date (optional)", placeholder: "27 April 2026" },
      { name: "highlight", label: "Highlight of the day", placeholder: "Opening ceremony + football final", full: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
    submitLabel: day ? "Save day" : "Add day",
    onSubmit: async (values) => {
      if (day) await api(`/api/admin/days/${encodeURIComponent(day.id)}`, { method: "PUT", body: values });
      else {
        const created = await api("/api/admin/days", { method: "POST", body: values });
        state.selectedDay = created.id;
      }
    },
  });
}

function editFixture(id) {
  const fixture = state.data.fixtures.find((item) => item.id === id);
  const teams = state.data.teams;
  const events = state.data.events;
  openForm({
    wide: true,
    title: fixture ? "Edit fixture" : "Add fixture",
    subtitle: "Fixtures drive the live ticker and the events page.",
    values: fixture || {
      day_id: state.selectedDay || "",
      sort_order: state.data.fixtures.filter((item) => item.day_id === state.selectedDay).length + 1,
      status: "upcoming",
    },
    fields: [
      {
        name: "day_id",
        label: "Fest day",
        type: "select",
        options: state.data.days.map((day) => ({ value: day.id, label: day.label })),
        required: true,
      },
      {
        name: "event_id",
        label: "Event / sport",
        type: "select",
        options: events.map((event) => ({ value: event.id, label: event.name })),
        required: true,
      },
      {
        name: "team_one_id",
        label: "Team one",
        type: "select",
        options: [{ value: "", label: "— Custom / TBD —" }, ...teams.map((team) => ({ value: team.id, label: team.name }))],
      },
      {
        name: "team_two_id",
        label: "Team two",
        type: "select",
        options: [{ value: "", label: "— Custom / TBD —" }, ...teams.map((team) => ({ value: team.id, label: team.name }))],
      },
      { name: "team_one_name", label: "Custom name (team one)", placeholder: "e.g. TMC A" },
      { name: "team_two_name", label: "Custom name (team two)", placeholder: "e.g. TMC B" },
      { name: "round", label: "Round", placeholder: "Quarter final" },
      { name: "time", label: "Time", placeholder: "7:30 PM" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "upcoming", label: "Upcoming" },
          { value: "live", label: "Live" },
          { value: "finished", label: "Finished" },
        ],
      },
      { name: "score", label: "Score", placeholder: "TMC A: 67/4 | Karakonam: 66/7", full: true },
      { name: "score_round", label: "Score note", placeholder: "Full time / 2nd set" },
      { name: "winner", label: "Winner note", placeholder: "TMC A won" },
      { name: "live_link", label: "Live scorecard link", placeholder: "https://...", full: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
    submitLabel: fixture ? "Save fixture" : "Add fixture",
    onSubmit: async (values) => {
      const resolve = (idKey, nameKey) => {
        const idValue = values[idKey] || "";
        const team = teams.find((item) => item.id === idValue);
        values[idKey] = idValue;
        if (team) values[nameKey] = team.name;
        else if (!values[nameKey]) values[nameKey] = "";
      };
      resolve("team_one_id", "team_one_name");
      resolve("team_two_id", "team_two_name");
      const event = events.find((item) => item.id === values.event_id);
      values.event_name = event ? event.name : "";

      if (fixture) await api(`/api/admin/fixtures/${encodeURIComponent(fixture.id)}`, { method: "PUT", body: values });
      else await api("/api/admin/fixtures", { method: "POST", body: values });
    },
  });
}

/* ------------------------------- results ---------------------------- */

function renderResults() {
  const teams = state.data.teams;
  const results = state.data.results;
  const points = state.data.settings.points;

  $("#resultsBody").innerHTML = results.length
    ? results
        .map(
          (result) => `<tr>
            <td><strong>${esc(result.name)}</strong>${result.note ? `<br><small class="muted">${esc(result.note)}</small>` : ""}</td>
            <td>${esc(teamName(result.first_team_id))}</td>
            <td>${esc(teamName(result.second_team_id))}</td>
            <td>${esc(teamName(result.third_team_id))}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" data-edit-result="${esc(result.id)}">Edit</button>
                <button type="button" class="icon-btn danger" data-delete-result="${esc(result.id)}">Delete</button>
              </div>
            </td>
          </tr>`,
        )
        .join("")
    : '<tr class="empty-row"><td colspan="5">No results published yet.</td></tr>';

  $$("[data-edit-result]").forEach((button) =>
    button.addEventListener("click", () => editResult(button.dataset.editResult)),
  );
  $$("[data-delete-result]").forEach((button) =>
    button.addEventListener("click", () => removeRecord("results", button.dataset.deleteResult, "result")),
  );

  $("#pointsSummary").textContent = `Leaderboard weights — 1st: ${points.first} points, 2nd: ${points.second}, 3rd: ${points.third}. Change these in Site content → Scoring. ${teams.length} teams are ranked.`;
}

function editResult(id) {
  const result = state.data.results.find((item) => item.id === id);
  const teams = state.data.teams;
  const teamOptions = (current) => [
    { value: "", label: "— None —" },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];
  openForm({
    title: result ? "Edit result" : "Publish result",
    subtitle: "Podium teams earn leaderboard points based on your scoring rule.",
    values: result || {},
    fields: [
      {
        name: "event_id",
        label: "Linked event",
        type: "select",
        options: [
          { value: "", label: "— Optional —" },
          ...state.data.events.map((event) => ({ value: event.id, label: event.name })),
        ],
      },
      { name: "name", label: "Result title", required: true, placeholder: "Badminton M" },
      { name: "first_team_id", label: "1st place", type: "select", options: teamOptions() },
      { name: "second_team_id", label: "2nd place", type: "select", options: teamOptions() },
      { name: "third_team_id", label: "3rd place", type: "select", options: teamOptions() },
      { name: "note", label: "Note (optional)", type: "textarea", full: true },
    ],
    submitLabel: result ? "Save result" : "Publish result",
    onSubmit: async (values) => {
      if (result) await api(`/api/admin/results/${encodeURIComponent(result.id)}`, { method: "PUT", body: values });
      else await api("/api/admin/results", { method: "POST", body: values });
    },
  });
}

/* ------------------------------ sponsors ---------------------------- */

function renderSponsors() {
  const sponsors = state.data.sponsors;
  $("#sponsorGrid").innerHTML = sponsors.length
    ? sponsors
        .map(
          (sponsor) => `<div class="sponsor-card">
            <img src="${esc(sponsor.logo_url)}" alt="${esc(sponsor.name || "Sponsor")}">
            <strong>${esc(sponsor.name || "Untitled sponsor")}</strong>
            ${sponsor.link ? `<small>${esc(sponsor.link)}</small>` : ""}
            <div class="row-actions">
              <button type="button" class="icon-btn" data-edit-sponsor="${esc(sponsor.id)}">Edit</button>
              <button type="button" class="icon-btn danger" data-delete-sponsor="${esc(sponsor.id)}">Delete</button>
            </div>
          </div>`,
        )
        .join("")
    : '<div class="empty-row" style="grid-column:1/-1">No sponsor logos yet. Upload the first one.</div>';

  $$("[data-edit-sponsor]").forEach((button) =>
    button.addEventListener("click", () => editSponsor(button.dataset.editSponsor)),
  );
  $$("[data-delete-sponsor]").forEach((button) =>
    button.addEventListener("click", () => removeRecord("sponsors", button.dataset.deleteSponsor, "sponsor")),
  );
}

function editSponsor(id) {
  const sponsor = state.data.sponsors.find((item) => item.id === id);
  openForm({
    title: sponsor ? "Edit sponsor" : "Add sponsor",
    values: sponsor || {},
    fields: [
      { name: "logo_url", label: "Logo", type: "image", required: true, full: true },
      { name: "name", label: "Sponsor name" },
      { name: "link", label: "Website link", placeholder: "https://..." },
      { name: "sort_order", label: "Order", type: "number" },
    ],
    submitLabel: sponsor ? "Save sponsor" : "Add sponsor",
    onSubmit: async (values) => {
      if (sponsor) await api(`/api/admin/sponsors/${encodeURIComponent(sponsor.id)}`, { method: "PUT", body: values });
      else await api("/api/admin/sponsors", { method: "POST", body: values });
    },
  });
}

/* ------------------------------ gallery ----------------------------- */

function renderGallery() {
  const photos = state.data.gallery;
  $("#adminGalleryGrid").innerHTML = photos.length
    ? photos
        .map(
          (photo) => `<figure class="admin-photo">
            <img src="${esc(photo.url)}" alt="${esc(photo.caption || "Fest photo")}" loading="lazy">
            <div class="photo-actions">
              <button type="button" class="icon-btn" data-edit-photo="${esc(photo.id)}">✎</button>
              <button type="button" class="icon-btn danger" data-delete-photo="${esc(photo.id)}">✕</button>
            </div>
            <figcaption class="photo-meta">
              ${photo.group_name ? `<em>${esc(photo.group_name)}</em>` : ""}
              <span>${esc(photo.caption || "Untitled")}</span>
            </figcaption>
          </figure>`,
        )
        .join("")
    : '<div class="empty-row" style="grid-column:1/-1">No photos yet. Upload a few from the fest.</div>';

  $$("[data-edit-photo]").forEach((button) =>
    button.addEventListener("click", () => editPhoto(button.dataset.editPhoto)),
  );
  $$("[data-delete-photo]").forEach((button) =>
    button.addEventListener("click", () => removeRecord("gallery", button.dataset.deletePhoto, "photo")),
  );
}

function editPhoto(id) {
  const photo = state.data.gallery.find((item) => item.id === id);
  openForm({
    title: "Edit photo",
    values: photo || {},
    fields: [
      { name: "url", label: "Photo", type: "image", required: true, full: true },
      { name: "caption", label: "Caption", full: true },
      { name: "group_name", label: "Album / group", placeholder: "Day 1" },
      { name: "sort_order", label: "Order", type: "number" },
    ],
    submitLabel: "Save photo",
    onSubmit: async (values) => {
      await api(`/api/admin/gallery/${encodeURIComponent(photo.id)}`, { method: "PUT", body: values });
    },
  });
}

async function uploadGalleryFiles(files) {
  if (!files?.length) return;
  const group = $("#galleryGroupInput").value.trim();
  const items = [...files];
  let done = 0;
  for (const file of items) {
    try {
      const url = await uploadImage(file);
      await api("/api/admin/gallery", {
        method: "POST",
        body: {
          url,
          caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          group_name: group,
          sort_order: 0,
        },
      });
      done += 1;
    } catch (error) {
      toast(`${file.name}: ${error.message}`, "error");
    }
  }
  if (done) toast(`${done} photo${done === 1 ? "" : "s"} uploaded`);
  await loadData();
}

/* --------------------------- site content --------------------------- */

function renderContent() {
  const settings = state.data.settings;
  const grid = $("#contentGrid");
  grid.innerHTML = "";
  grid.append(
    contentCard("brand", "Brand & theme", "Name, logo and accent colour used across the site.", `
      ${textField("brand.name", "Fest name", settings.brand.name)}
      ${textField("brand.version", "Version / year", settings.brand.version)}
      ${imageFieldHTML("brand.logoUrl", "Logo", settings.brand.logoUrl)}
      <div class="grid-2">
        <label class="field"><span>Accent colour</span><input type="color" data-path="theme.accent" value="${esc(settings.theme.accent)}"></label>
        <label class="field"><span>Default theme</span>
          <select data-path="theme.defaultMode">
            <option value="dark" ${settings.theme.defaultMode === "dark" ? "selected" : ""}>Dark</option>
            <option value="light" ${settings.theme.defaultMode === "light" ? "selected" : ""}>Light</option>
          </select>
        </label>
      </div>`, collectBrand),

    contentCard("hero", "Home hero", "The first thing visitors see on the home page.", `
      ${textField("hero.title", "Headline", settings.hero.title)}
      ${textField("hero.subtitle", "Sub headline", settings.hero.subtitle)}
      ${textField("hero.location", "Location line", settings.hero.location)}
      ${textField("hero.primaryCtaLabel", "Primary button label", settings.hero.primaryCtaLabel)}
      ${textField("hero.ruleBookLabel", "Rule book button label", settings.hero.ruleBookLabel)}
      ${textField("hero.ruleBookUrl", "Rule book link", settings.hero.ruleBookUrl)}
      ${imageFieldHTML("hero.photoUrl", "Hero photo", settings.hero.photoUrl)}
      ${repeatHTML("hero.dates", settings.hero.dates, [
        { name: "day", placeholder: "27" },
        { name: "month", placeholder: "APR" },
      ], "Add date")}`, collectHero),

    contentCard("ticker", "Live banner", "The scrolling strip above the hero. Live and upcoming fixtures appear in it automatically; hide the strip here if you do not want it.", `
      <label class="checkbox-row"><input type="checkbox" data-path="banner.enabled" ${settings.banner?.enabled !== false ? "checked" : ""}> Show the live banner</label>
      ${textField("banner.label", "Banner label", settings.banner?.label || "LIVE NOW")}
      <label class="checkbox-row"><input type="checkbox" data-path="ticker.enabled" ${settings.ticker.enabled ? "checked" : ""}> Show a notice in the banner</label>
      ${textField("ticker.text", "Notice text", settings.ticker.text)}`, collectTicker),

    contentCard("map", "Map & venue", "Location embed and the venue blueprint image.", `
      ${textareaField("map.embedUrl", "Google Maps embed URL", settings.map.embedUrl)}
      ${textField("map.linkUrl", "Directions link", settings.map.linkUrl)}
      ${textField("map.linkLabel", "Directions label", settings.map.linkLabel)}
      ${repeatHTML("map.directions", settings.map.directions, [
        { name: "from", placeholder: "Kottayam Railway Station" },
        { name: "details", placeholder: "3 km — auto to campus gate, 10 minutes", wide: true },
      ], "Add route")}
      ${imageFieldHTML("blueprintUrl", "Venue blueprint", settings.blueprintUrl)}`, collectMap),

    contentCard("scoring", "Scoring & sponsors", "Points awarded for each podium finish.", `
      <div class="grid-3">
        ${numberField("points.first", "1st place", settings.points.first)}
        ${numberField("points.second", "2nd place", settings.points.second)}
        ${numberField("points.third", "3rd place", settings.points.third)}
      </div>
      ${textField("sponsorsTitle", "Sponsor section title", settings.sponsorsTitle)}`, collectScoring),

    contentCard("about", "About section", "Story, statistics and campus highlights.", `
      ${textField("about.kicker", "Kicker", settings.about.kicker)}
      ${textField("about.heading", "Heading", settings.about.heading)}
      ${textareaField("about.intro", "Intro paragraph", settings.about.intro)}
      ${repeatHTML("about.stats", settings.about.stats, [
        { name: "value", placeholder: "20+" },
        { name: "label", placeholder: "Medical colleges" },
      ], "Add statistic")}
      ${textField("about.hostKicker", "Host kicker", settings.about.hostKicker)}
      ${textField("about.hostTitle", "Host title", settings.about.hostTitle)}
      ${repeatHTML("about.hostParagraphs", settings.about.hostParagraphs.map((text) => ({ text })), [
        { name: "text", placeholder: "Paragraph", wide: true },
      ], "Add paragraph")}
      ${textField("about.highlightsTitle", "Highlights title", settings.about.highlightsTitle)}
      ${repeatHTML("about.highlights", settings.about.highlights.map((text) => ({ text })), [
        { name: "text", placeholder: "Campus highlight", wide: true },
      ], "Add highlight")}`, collectAbout),

    contentCard("clubs", "Organising clubs", "Shown as a logo strip on the home page and in the about section. Leave empty to hide it.", `
      ${repeatHTML("clubs", settings.clubs, [
        { name: "name", placeholder: "Fuego Sports Club" },
        { name: "logoUrl", placeholder: "/media/... or https://..." },
      ], "Add club")}`, collectClubs),

    contentCard("tribute", "Tribute / briefing", "A dedication or briefing block, for example “In loving memory of …”. Leave empty to hide it.", `
      ${textField("tribute.title", "Title", settings.tribute?.title)}
      ${textareaField("tribute.text", "Tribute text", settings.tribute?.text)}`, collectTribute),

    contentCard("documents", "Rule book & brochure", "Paste a link to the PDF (Google Drive, college site or any public URL). Empty links hide the buttons.", `
      ${textField("documents.ruleBookLabel", "Rule book button label", settings.documents?.ruleBookLabel)}
      ${textField("documents.ruleBookUrl", "Rule book URL", settings.documents?.ruleBookUrl)}
      ${textField("documents.brochureLabel", "Brochure button label", settings.documents?.brochureLabel)}
      ${textField("documents.brochureUrl", "Brochure URL", settings.documents?.brochureUrl)}`, collectDocuments),

    contentCard("games", "Registration & prize pool", "One row per game, shown in the registration section. Leave empty to hide it.", `
      ${repeatHTML("games", settings.games, [
        { name: "name", placeholder: "Football" },
        { name: "fee", placeholder: "₹100 per player" },
        { name: "prize", placeholder: "₹10,000 for the winners" },
        { name: "link", placeholder: "Registration form link (optional)", wide: true },
      ], "Add game")}`, collectGames),

    contentCard("footer", "Footer", "Tagline, copyright and credits.", `
      ${textField("footer.tagline", "Tagline", settings.footer.tagline)}
      ${textField("footer.copyright", "Copyright line", settings.footer.copyright)}
      ${textField("footer.credits", "Credits line", settings.footer.credits)}`, collectFooter),

    contentCard("contacts", "Contact people", "Shown in the footer with WhatsApp and call links.", `
      ${repeatHTML("contacts", settings.contacts, [
        { name: "name", placeholder: "Name" },
        { name: "role", placeholder: "Role" },
        { name: "phone", placeholder: "+919876543210" },
      ], "Add contact")}`, collectContacts),

    contentCard("socials", "Social links", "Icons in the footer.", `
      ${repeatHTML("socials", settings.socials, [
        { name: "label", placeholder: "Instagram" },
        { name: "url", placeholder: "https://instagram.com/..." },
        { name: "type", placeholder: "instagram", options: ["instagram", "whatsapp", "facebook", "youtube", "x", "website"] },
      ], "Add social link")}`, collectSocials),
  );

  wireContentCard(grid);
}

function textField(path, label, value, options = {}) {
  return `<label class="field"><span>${esc(label)}</span>
    <input type="text" data-path="${esc(path)}" value="${esc(value ?? "")}" placeholder="${esc(
      options.placeholder || "",
    )}" ${options.required ? "required" : ""}>
  </label>`;
}

function numberField(path, label, value) {
  return `<label class="field"><span>${esc(label)}</span>
    <input type="number" min="0" step="1" data-path="${esc(path)}" value="${esc(value ?? 0)}">
  </label>`;
}

function textareaField(path, label, value) {
  return `<label class="field"><span>${esc(label)}</span>
    <textarea data-path="${esc(path)}">${esc(value ?? "")}</textarea>
  </label>`;
}

function imageFieldHTML(path, label, value) {
  return `<div class="field" style="text-transform:none;">
      <span style="text-transform:uppercase;font-size:12px;letter-spacing:.4px;">${esc(label)}</span>
      <div class="image-field" data-image-field data-path="${esc(path)}" data-url="${esc(value || "")}">
        <img class="image-preview" src="${esc(value || "")}" alt="" style="${value ? "" : "opacity:.35;"}">
        <div class="image-controls">
          <button type="button" class="icon-btn" data-upload>Upload image</button>
          <button type="button" class="icon-btn danger" data-clear>Remove</button>
          <small>JPG, PNG, WebP — max 8 MB</small>
        </div>
        <input type="file" accept="image/*" hidden>
      </div>
    </div>`;
}

function repeatHTML(path, rows, fields, addLabel) {
  const rowsHTML = (rows || [])
    .map((row) => repeatRowHTML(fields, row))
    .join("");
  return `<div class="field" style="text-transform:none;">
      <span style="text-transform:uppercase;font-size:12px;letter-spacing:.4px;">${esc(addLabel.replace(
        /^Add /,
        "",
      ))}</span>
      <div class="repeatable" data-repeat="${esc(path)}" data-fields="${esc(
        JSON.stringify(fields.map((field) => ({ name: field.name, options: field.options || null }))),
      )}">
        ${rowsHTML}
      </div>
      <button type="button" class="icon-btn repeat-add" data-add-row>+ ${esc(addLabel)}</button>
    </div>`;
}

function repeatRowHTML(fields, row = {}) {
  const gridClass = fields.length >= 3 ? "three" : fields.length === 2 ? "two" : "";
  const inputs = fields
    .map((field) => {
      if (field.options) {
        return `<select data-row-field="${esc(field.name)}">
          ${field.options
            .map(
              (option) =>
                `<option value="${esc(option)}" ${
                  row[field.name] === option ? "selected" : ""
                }>${esc(option)}</option>`,
            )
            .join("")}
        </select>`;
      }
      if (field.wide) {
        return `<textarea data-row-field="${esc(field.name)}" placeholder="${esc(
          field.placeholder || "",
        )}" style="min-height:64px;">${esc(row[field.name] || "")}</textarea>`;
      }
      return `<input type="text" data-row-field="${esc(field.name)}" placeholder="${esc(
        field.placeholder || field.name,
      )}" value="${esc(row[field.name] || "")}">`;
    })
    .join("");
  return `<div class="repeat-row">
      <div class="repeat-fields ${gridClass}">${inputs}</div>
      <button type="button" class="icon-btn danger" data-remove-row>✕</button>
    </div>`;
}

function contentCard(id, title, hint, bodyHTML, collect) {
  const card = document.createElement("div");
  card.className = "content-card";
  card.dataset.card = id;
  card.innerHTML = `
    <h3>${esc(title)}</h3>
    <p class="card-hint">${esc(hint)}</p>
    ${bodyHTML}
    <button type="button" class="btn btn-primary admin-btn-sm card-save" data-save-card>Save changes</button>`;
  card._collect = collect;
  return card;
}

function wireContentCard(root) {
  root.querySelectorAll("[data-image-field]").forEach((field) => {
    const input = field.querySelector('input[type="file"]');
    const preview = field.querySelector(".image-preview");
    field.querySelector("[data-upload]").addEventListener("click", () => input.click());
    field.querySelector("[data-clear]").addEventListener("click", () => {
      field.dataset.url = "";
      preview.src = "";
      preview.style.opacity = "0.35";
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        field.dataset.url = url;
        preview.src = url;
        preview.style.opacity = "1";
        toast("Image uploaded — remember to save this card");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        input.value = "";
      }
    });
  });

  root.querySelectorAll("[data-repeat]").forEach((list) => {
    const fields = JSON.parse(list.dataset.fields);
    const fullFields = fields.map((field) => ({
      ...field,
      options: field.options,
      wide: list.dataset.repeat === "about.hostParagraphs" || list.dataset.repeat === "about.highlights",
    }));
    list.parentElement.querySelector("[data-add-row]").addEventListener("click", () => {
      list.insertAdjacentHTML("beforeend", repeatRowHTML(fullFields, {}));
      wireRemoveRows(list);
    });
    wireRemoveRows(list);
  });

  root.querySelectorAll("[data-save-card]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".content-card");
      try {
        const payload = card._collect(card);
        await api("/api/admin/settings", { method: "PUT", body: payload });
        toast("Content saved");
        await loadData();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function wireRemoveRows(list) {
  list.querySelectorAll("[data-remove-row]").forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = "1";
    button.addEventListener("click", () => button.closest(".repeat-row")?.remove());
  });
}

/* ----------------------------- collectors --------------------------- */

function readPath(root, path) {
  const input = root.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!input) return "";
  if (input.type === "checkbox") return input.checked;
  return input.value.trim();
}

function readImage(root, path) {
  const field = root.querySelector(`[data-image-field][data-path="${CSS.escape(path)}"]`);
  return field ? field.dataset.url || "" : "";
}

function readRepeat(root, path, fields) {
  const list = root.querySelector(`[data-repeat="${CSS.escape(path)}"]`);
  if (!list) return [];
  return $$(".repeat-row", list)
    .map((row) => {
      const item = {};
      for (const field of fields) {
        const input = row.querySelector(`[data-row-field="${CSS.escape(field)}"]`);
        item[field] = input ? input.value.trim() : "";
      }
      return item;
    })
    .filter((item) => Object.values(item).some(Boolean));
}

function collectBrand(card) {
  return {
    brand: {
      name: readPath(card, "brand.name"),
      version: readPath(card, "brand.version"),
      logoUrl: readImage(card, "brand.logoUrl"),
    },
    theme: {
      accent: readPath(card, "theme.accent"),
      defaultMode: readPath(card, "theme.defaultMode"),
    },
  };
}

function collectHero(card) {
  return {
    hero: {
      title: readPath(card, "hero.title"),
      subtitle: readPath(card, "hero.subtitle"),
      location: readPath(card, "hero.location"),
      primaryCtaLabel: readPath(card, "hero.primaryCtaLabel"),
      ruleBookLabel: readPath(card, "hero.ruleBookLabel"),
      ruleBookUrl: readPath(card, "hero.ruleBookUrl"),
      photoUrl: readImage(card, "hero.photoUrl"),
      dates: readRepeat(card, "hero.dates", ["day", "month"]),
    },
  };
}

function collectTicker(card) {
  return {
    banner: {
      enabled: readPath(card, "banner.enabled"),
      label: readPath(card, "banner.label"),
    },
    ticker: { enabled: readPath(card, "ticker.enabled"), text: readPath(card, "ticker.text") },
  };
}

function collectMap(card) {
  return {
    map: {
      embedUrl: readPath(card, "map.embedUrl"),
      linkUrl: readPath(card, "map.linkUrl"),
      linkLabel: readPath(card, "map.linkLabel"),
      directions: readRepeat(card, "map.directions", ["from", "details"]),
    },
    blueprintUrl: readImage(card, "blueprintUrl"),
  };
}

function collectClubs(card) {
  return { clubs: readRepeat(card, "clubs", ["name", "logoUrl"]) };
}

function collectTribute(card) {
  return {
    tribute: {
      title: readPath(card, "tribute.title"),
      text: readPath(card, "tribute.text"),
    },
  };
}

function collectDocuments(card) {
  return {
    documents: {
      ruleBookUrl: readPath(card, "documents.ruleBookUrl"),
      ruleBookLabel: readPath(card, "documents.ruleBookLabel"),
      brochureUrl: readPath(card, "documents.brochureUrl"),
      brochureLabel: readPath(card, "documents.brochureLabel"),
    },
  };
}

function collectGames(card) {
  return { games: readRepeat(card, "games", ["name", "fee", "prize", "link"]) };
}

function collectScoring(card) {
  return {
    points: {
      first: Number(readPath(card, "points.first")) || 0,
      second: Number(readPath(card, "points.second")) || 0,
      third: Number(readPath(card, "points.third")) || 0,
    },
    sponsorsTitle: readPath(card, "sponsorsTitle"),
  };
}

function collectAbout(card) {
  return {
    about: {
      kicker: readPath(card, "about.kicker"),
      heading: readPath(card, "about.heading"),
      intro: readPath(card, "about.intro"),
      stats: readRepeat(card, "about.stats", ["value", "label"]),
      hostKicker: readPath(card, "about.hostKicker"),
      hostTitle: readPath(card, "about.hostTitle"),
      hostParagraphs: readRepeat(card, "about.hostParagraphs", ["text"]).map((row) => row.text),
      highlightsTitle: readPath(card, "about.highlightsTitle"),
      highlights: readRepeat(card, "about.highlights", ["text"]).map((row) => row.text),
    },
  };
}

function collectFooter(card) {
  return {
    footer: {
      tagline: readPath(card, "footer.tagline"),
      copyright: readPath(card, "footer.copyright"),
      credits: readPath(card, "footer.credits"),
    },
  };
}

function collectContacts(card) {
  return { contacts: readRepeat(card, "contacts", ["name", "role", "phone"]) };
}

function collectSocials(card) {
  return { socials: readRepeat(card, "socials", ["label", "url", "type"]) };
}

/* ------------------------------ security ---------------------------- */

function renderSecurity() {
  const data = state.data;
  const note = $("#passwordNote");
  if (data.passwordManagedBySecret) {
    note.textContent =
      "This deployment verifies the ADMIN_PASSWORD secret, so the password form is disabled here. Rotate the secret to change it.";
    $("#passwordForm").querySelectorAll("input, button").forEach((node) => (node.disabled = true));
  } else {
    note.textContent = data.usingDefaultPassword
      ? "You are using the default password (smrithi2026). Change it now."
      : "Password updated. Use at least 8 characters and share it only with the core team.";
    $("#passwordForm").querySelectorAll("input, button").forEach((node) => (node.disabled = false));
  }
}

$("#passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const current = $("#currentPassword").value;
  const next = $("#newPassword").value;
  const confirm = $("#confirmPassword").value;
  if (next !== confirm) return toast("New passwords do not match", "error");
  try {
    await api("/api/admin/password", {
      method: "POST",
      body: { currentPassword: current, newPassword: next },
    });
    event.target.reset();
    toast("Password updated");
    await loadData();
  } catch (error) {
    toast(error.message, "error");
  }
});

async function exportBackup() {
  try {
    const response = await fetch("/api/admin/backup", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not build backup");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `smrithi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Backup downloaded");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function importBackup(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const content = parsed.content || parsed;
    const ok = await confirmDialog(
      "Restore this backup?",
      "Teams, fixtures, results, sponsors, gallery and content will be replaced by the backup.",
    );
    if (!ok) return;
    const result = await api("/api/admin/backup", { method: "POST", body: { content } });
    toast(`Restored ${result.imported} records`);
    await loadData();
  } catch (error) {
    toast(error.message, "error");
  }
}

/* ------------------------- modal form factory ----------------------- */

let activeModal = null;

function closeModal() {
  $("#modalRoot").classList.remove("open");
  $("#modalRoot").innerHTML = "";
  activeModal = null;
}

function openForm({ title, subtitle, fields, values = {}, submitLabel = "Save", wide, onSubmit }) {
  const body = fields
    .map((field) => {
      const value = values[field.name] ?? field.default ?? "";
      const required = field.required ? "required" : "";
      if (field.type === "select") {
        return `<label class="field"><span>${esc(field.label)}</span>
          <select data-field="${esc(field.name)}" ${required}>
            ${field.options
              .map(
                (option) =>
                  `<option value="${esc(option.value)}" ${
                    String(value) === String(option.value) ? "selected" : ""
                  }>${esc(option.label)}</option>`,
              )
              .join("")}
          </select>
        </label>`;
      }
      if (field.type === "textarea") {
        return `<label class="field"><span>${esc(field.label)}</span>
          <textarea data-field="${esc(field.name)}" placeholder="${esc(
            field.placeholder || "",
          )}" ${required}>${esc(value)}</textarea>
        </label>`;
      }
      if (field.type === "number") {
        return `<label class="field"><span>${esc(field.label)}</span>
          <input type="number" data-field="${esc(field.name)}" value="${esc(value)}" ${required}>
        </label>`;
      }
      if (field.type === "image") {
        return `<div class="field" style="text-transform:none;">
            <span style="text-transform:uppercase;font-size:12px;letter-spacing:.4px;">${esc(field.label)}</span>
            <div class="image-field" data-image-field data-field="${esc(field.name)}" data-url="${esc(value)}">
              <img class="image-preview" src="${esc(value)}" alt="" style="${value ? "" : "opacity:.35;"}">
              <div class="image-controls">
                <button type="button" class="icon-btn" data-upload>Upload image</button>
                <button type="button" class="icon-btn danger" data-clear>Remove</button>
                <small>JPG, PNG, WebP — max 8 MB</small>
              </div>
              <input type="file" accept="image/*" hidden>
            </div>
          </div>`;
      }
      return `<label class="field"><span>${esc(field.label)}</span>
        <input type="text" data-field="${esc(field.name)}" value="${esc(value)}" placeholder="${esc(
          field.placeholder || "",
        )}" ${required}>
      </label>`;
    })
    .join("");

  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <button type="button" class="modal-close" data-close>✕</button>
      </div>
      <form class="modal-body" id="modalForm">${body}<p class="modal-error" id="modalError"></p></form>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost admin-btn-sm" data-close>Cancel</button>
        <button type="submit" form="modalForm" class="btn btn-primary admin-btn-sm">${esc(submitLabel)}</button>
      </div>
    </div>`;
  root.classList.add("open");

  root.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  root.addEventListener("click", (event) => {
    if (event.target === root) closeModal();
  });

  root.querySelectorAll("[data-image-field]").forEach((field) => {
    const input = field.querySelector('input[type="file"]');
    const preview = field.querySelector(".image-preview");
    field.querySelector("[data-upload]").addEventListener("click", () => input.click());
    field.querySelector("[data-clear]").addEventListener("click", () => {
      field.dataset.url = "";
      preview.src = "";
      preview.style.opacity = "0.35";
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        field.dataset.url = url;
        preview.src = url;
        preview.style.opacity = "1";
        toast("Image uploaded");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        input.value = "";
      }
    });
  });

  activeModal = { fields, onSubmit };

  $("#modalForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = $("#modalError");
    error.textContent = "";
    const values = {};
    for (const field of fields) {
      if (field.type === "image") {
        const node = root.querySelector(`[data-image-field][data-field="${CSS.escape(field.name)}"]`);
        values[field.name] = node?.dataset.url || "";
      } else {
        const node = root.querySelector(`[data-field="${CSS.escape(field.name)}"]`);
        values[field.name] = node ? node.value.trim() : "";
      }
      if (field.required && !values[field.name]) {
        error.textContent = `${field.label} is required`;
        return;
      }
    }
    const submit = root.querySelector('.modal-foot button[type="submit"]');
    submit.disabled = true;
    try {
      await onSubmit(values);
      closeModal();
      toast("Saved");
      await loadData();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", onKey);
    }
  });
}

function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const root = $("#modalRoot");
    root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="max-width:460px;">
        <div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(message)}</p></div></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost admin-btn-sm" data-no>Cancel</button>
          <button type="button" class="btn btn-danger admin-btn-sm" data-yes>Delete</button>
        </div>
      </div>`;
    root.classList.add("open");
    const finish = (value) => {
      root.classList.remove("open");
      root.innerHTML = "";
      resolve(value);
    };
    root.querySelector("[data-yes]").addEventListener("click", () => finish(true));
    root.querySelector("[data-no]").addEventListener("click", () => finish(false));
    root.addEventListener("click", (event) => {
      if (event.target === root) finish(false);
    });
  });
}

async function removeRecord(table, id, label) {
  const ok = await confirmDialog(`Delete this ${label}?`, "This action cannot be undone.");
  if (!ok) return;
  await run(() => api(`/api/admin/${table}/${encodeURIComponent(id)}`, { method: "DELETE" }), `${label} deleted`);
}

async function run(action, message = "Saved") {
  try {
    await action();
    toast(message);
    await loadData();
  } catch (error) {
    toast(error.message, "error");
  }
}

/* ------------------------------ wiring ------------------------------ */

function setTab(tab) {
  state.tab = tab;
  $$(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  $$(".admin-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
  const titles = {
    overview: ["Overview", "Everything on the public site is controlled from here."],
    teams: ["Teams", "Participating colleges, short names and logos."],
    schedule: ["Schedule", "Fest days and the fixtures played on each day."],
    results: ["Results", "Publish podiums and keep the leaderboard accurate."],
    sponsors: ["Sponsors", "Logo carousel shown on the public site."],
    gallery: ["Gallery", "Upload and curate live fest photos."],
    registration: ["Registration", "Entry fees, prize pools and registration links per game."],
    content: ["Site content", "Every headline, paragraph, contact and colour on the site."],
    security: ["Security & backup", "Password and full content backups."],
  };
  const [title, subtitle] = titles[tab] || ["Dashboard", ""];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = subtitle;
  $("#adminSidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".admin-nav-item").forEach((item) =>
  item.addEventListener("click", () => setTab(item.dataset.tab)),
);
$$("[data-goto-tab]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setTab(link.dataset.gotoTab);
  }),
);

$("#adminMenuToggle").addEventListener("click", () => $("#adminSidebar").classList.toggle("open"));
$("#refreshButton").addEventListener("click", loadData);
$("#logoutButton").addEventListener("click", logout);
$("#logoutButtonBottom").addEventListener("click", logout);

$("[data-action='add-team']").addEventListener("click", () => editTeam());
$("[data-action='add-day']").addEventListener("click", () => editDay());
$("[data-action='add-fixture']").addEventListener("click", () => {
  if (!state.data.days.length) return toast("Add a fest day first", "error");
  editFixture();
});
$("[data-action='add-result']").addEventListener("click", () => editResult());
$("[data-action='add-sponsor']").addEventListener("click", () => editSponsor());
$("[data-action='add-game']").addEventListener("click", () => editGame(-1));

$("[data-action='upload-gallery']").addEventListener("click", () => $("#galleryUpload").click());
$("#galleryUpload").addEventListener("change", async (event) => {
  await uploadGalleryFiles(event.target.files);
  event.target.value = "";
});

$("[data-action='export-backup']").addEventListener("click", exportBackup);
$("[data-action='import-backup']").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (file) await importBackup(file);
  event.target.value = "";
});

document.addEventListener("DOMContentLoaded", boot);
