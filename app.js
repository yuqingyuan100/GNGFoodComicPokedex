const DATA = window.GNG_POKEDEX_DATA || [];
const state = { map: "全部地图", q: "", current: null };
const $ = (s) => document.querySelector(s);
const grid = $("#grid");
const detail = $("#detail");
const home = $("#home");
const count = $("#count");
const mapFilter = $("#mapFilter");
const search = $("#search");
const homeBack = $("#homeBack");
let revealTimer = 0;
let imageLoadToken = 0;

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[c]));
}

function maps() {
  return ["全部地图", ...Array.from(new Set(DATA.map((x) => x.map).filter(Boolean)))];
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  return DATA.filter((x) => (
    state.map === "全部地图" || x.map === state.map
  ) && (
    !q || [x.name, x.foodId, x.map, ...x.monsters.map((m) => m.name)].join(" ").toLowerCase().includes(q)
  ));
}

function renderHome() {
  const rows = filtered();
  count.textContent = `${rows.length}/${DATA.length}`;
  grid.innerHTML = rows.map((x) => `
    <article class="card">
      <button type="button" onclick="openItem('${esc(x.foodId)}')">
        <div class="thumb"><img src="${esc(x.foodIcon || x.comic)}" alt="${esc(x.name)}"></div>
        <div class="card-body">
          <div class="dex"><span>No.${String(x.index).padStart(3, "0")}</span><span>${esc(x.foodId)}</span></div>
          <div class="name">${esc(x.name)}</div>
          <span class="map">${esc(x.map)}</span>
        </div>
      </button>
    </article>
  `).join("");
}

function setHomeVisible(visible) {
  home.style.display = visible ? "block" : "none";
  detail.classList.toggle("active", !visible);
  homeBack.classList.toggle("hidden", visible);
}

function resetComicPanel() {
  imageLoadToken += 1;
  window.clearTimeout(revealTimer);
  detail.classList.remove("comic-loading", "comic-error", "revealing");
  $("#comic").removeAttribute("src");
}

function loadComic(item) {
  const token = ++imageLoadToken;
  const comic = $("#comic");
  window.clearTimeout(revealTimer);
  detail.classList.remove("comic-error", "revealing");
  detail.classList.add("comic-loading");
  comic.removeAttribute("src");
  comic.alt = item.name;

  const preload = new Image();
  preload.onload = () => {
    if (token !== imageLoadToken || state.current !== item.foodId) return;
    detail.classList.remove("comic-loading");
    comic.src = item.comic;
    comic.alt = item.name;
    triggerReveal();
  };
  preload.onerror = () => {
    if (token !== imageLoadToken || state.current !== item.foodId) return;
    detail.classList.remove("comic-loading");
    detail.classList.add("comic-error");
    comic.removeAttribute("src");
  };
  preload.src = item.comic;
}

function triggerReveal() {
  detail.classList.remove("revealing");
  window.clearTimeout(revealTimer);
  // Force a reflow so repeat opens and quick page switches replay the reveal.
  void detail.offsetWidth;
  detail.classList.add("revealing");
  revealTimer = window.setTimeout(() => detail.classList.remove("revealing"), 520);
}

function openItem(id, push = true) {
  const item = DATA.find((x) => x.foodId === id);
  if (!item) return;
  state.current = id;
  setHomeVisible(false);
  loadComic(item);
  $("#title").textContent = item.name;
  $("#meta").innerHTML = `
    <b>食材ID</b><span>${esc(item.foodId)}</span>
    <b>地图</b><span>${esc(item.map)}</span>
    <b>来源关系</b><span>${esc(item.relationship || "")}</span>
    <b>选择版本</b><span>#${String(item.variant).padStart(2, "0")}</span>
  `;
  $("#desc").textContent = item.description || "Wiki 当前源未填写描述。";
  $("#monsters").innerHTML = item.monsters.map((m) => `
    <div class="monster">
      ${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.name)}">` : "<div></div>"}
      <div><div class="mname">${esc(m.name)}</div><div class="mrel">${esc(m.difficulty || "")} ${esc(m.relationship || "")}</div></div>
    </div>
  `).join("");
  $("#promptText").textContent = item.prompt || "未找到该候选图的生成提示词。";
  updateNav();
  if (push) {
    history.pushState(null, "", `#item-${encodeURIComponent(id)}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome(push = true) {
  state.current = null;
  resetComicPanel();
  setHomeVisible(true);
  closeZoom();
  renderHome();
  if (push && location.hash) {
    history.pushState(null, "", location.pathname);
  }
}

function openZoom() {
  if (detail.classList.contains("comic-loading") || detail.classList.contains("comic-error")) return;
  const item = DATA.find((x) => x.foodId === state.current);
  if (!item) return;
  $("#zoomImg").src = item.comic;
  $("#zoomImg").alt = item.name;
  $("#lightbox").classList.add("active");
}

function closeZoom() {
  $("#lightbox").classList.remove("active");
  $("#zoomImg").removeAttribute("src");
}

function updateNav() {
  const rows = filtered();
  const disabled = rows.length < 2;
  $("#prevItem").disabled = disabled;
  $("#nextItem").disabled = disabled;
}

function goSibling(delta) {
  if (!state.current) return;
  const rows = filtered();
  if (rows.length < 2) return;
  const currentIndex = rows.findIndex((x) => x.foodId === state.current);
  const base = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (base + delta + rows.length) % rows.length;
  openItem(rows[nextIndex].foodId);
}

function syncRoute() {
  const hash = decodeURIComponent(location.hash || "");
  if (hash.startsWith("#item-")) {
    openItem(hash.replace("#item-", ""), false);
  } else {
    showHome(false);
  }
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
}

function setup() {
  maps().forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    mapFilter.appendChild(o);
  });
  mapFilter.onchange = () => {
    state.map = mapFilter.value;
    renderHome();
    updateNav();
  };
  search.oninput = () => {
    state.q = search.value;
    renderHome();
    updateNav();
  };
  $("#back").onclick = () => showHome();
  homeBack.onclick = () => showHome();
  $("#prevItem").onclick = () => goSibling(-1);
  $("#nextItem").onclick = () => goSibling(1);
  $("#comic").onclick = openZoom;
  $("#lightbox").onclick = closeZoom;
  $("#closeZoom").onclick = closeZoom;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeZoom();
      return;
    }
    if (!state.current || isTypingTarget(e.target) || $("#lightbox").classList.contains("active")) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goSibling(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goSibling(1);
    }
  });
  window.addEventListener("hashchange", syncRoute);
  window.addEventListener("popstate", syncRoute);
  renderHome();
  syncRoute();
}

window.openItem = openItem;
setup();
