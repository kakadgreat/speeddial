// Simple self-hosted Speed Dial clone with settings + GitHub config.json support

const STORAGE_KEY = "mySpeedDialStateV2";
const LAST_GROUP_KEY = "mySpeedDialLastGroup";
const REMOTE_CONFIG_URL = "config.json";

let state = null;
let activeGroupId = null;

// DOM elements
const groupTabsEl = document.getElementById("groupTabs");
const dialGridEl = document.getElementById("dialGrid");
const toolbarEl = document.getElementById("toolbar");

const quickThemeButton = document.getElementById("quickThemeButton");
const quickThemeLabel = document.getElementById("quickThemeLabel");
const quickImportButton = document.getElementById("quickImportButton");
const quickImportInput = document.getElementById("quickImportInput");
const settingsButton = document.getElementById("settingsButton");

const addGroupButton = document.getElementById("addGroupButton");
const addDialButton = document.getElementById("addDialButton");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseButton = document.getElementById("modalCloseButton");

const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsCloseButton = document.getElementById("settingsCloseButton");

const settingsTabLinks = document.querySelectorAll(".settings-tab-link");
const settingsTabs = document.querySelectorAll(".settings-tab");

const columnsSlider = document.getElementById("columnsSlider");
const columnsLabel = document.getElementById("columnsLabel");
const spacingSlider = document.getElementById("spacingSlider");
const spacingLabel = document.getElementById("spacingLabel");
const widthSlider = document.getElementById("widthSlider");
const widthLabel = document.getElementById("widthLabel");
const centerVerticallyCheckbox = document.getElementById("centerVerticallyCheckbox");
const showAddButtonsCheckbox = document.getElementById("showAddButtonsCheckbox");
const openInNewTabCheckbox = document.getElementById("openInNewTabCheckbox");

const lightBgColorInput = document.getElementById("lightBgColorInput");
const lightBgImageInput = document.getElementById("lightBgImageInput");
const darkBgColorInput = document.getElementById("darkBgColorInput");
const darkBgImageInput = document.getElementById("darkBgImageInput");

const rememberGroupCheckbox = document.getElementById("rememberGroupCheckbox");
const groupsVisibilityList = document.getElementById("groupsVisibilityList");

const exportButton = document.getElementById("exportButton");
const settingsImportButton = document.getElementById("settingsImportButton");
const settingsImportInput = document.getElementById("settingsImportInput");
const importUrlInput = document.getElementById("importUrlInput");
const importUrlButton = document.getElementById("importUrlButton");
const copyJsonButton = document.getElementById("copyJsonButton");
const resetButton = document.getElementById("resetButton");

// default state
const defaultState = {
  groups: [{ id: 0, title: "Home", position: 0 }],
  dials: [
    {
      id: 1,
      groupId: 0,
      title: "Google",
      url: "https://www.google.com",
      thumbnail:
        "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_160x56dp.png",
      position: 0
    },
    {
      id: 2,
      groupId: 0,
      title: "Gmail",
      url: "https://mail.google.com",
      thumbnail: "",
      position: 1
    }
  ],
  preferences: {
    columns: 6
  },
  settings: {
    themeMode: "auto", // auto | light | dark
    gridColumns: 6,
    gridSpacing: 16,
    maxWidth: 1440,
    centerVertically: false,
    showAddButtons: true,
    openInNewTab: true,
    rememberLastGroup: true,
    hiddenGroupIds: [],
    backgrounds: {
      light: {
        color: "#f5f5f5",
        image: ""
      },
      dark: {
        color: "#202124",
        image: ""
      }
    }
  }
};

// Startup
document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  const local = loadStateFromLocalStorage();
  if (local) {
    state = normalizeState(local);
  } else {
    state = await loadStateFromRemoteOrDefault();
  }

  activeGroupId = determineInitialGroupId();
  applyThemeFromSettings();
  applyLayoutSettings();
  renderAll();
  attachEvents();
}

// ---------- State load/save ----------

function loadStateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read local storage", e);
    return null;
  }
}

async function loadStateFromRemoteOrDefault() {
  try {
    const res = await fetch(REMOTE_CONFIG_URL, { cache: "no-cache" });
    if (res.ok) {
      const json = await res.json();
      const converted = convertRemoteConfig(json);
      if (converted) {
        const normalized = normalizeState(converted);
        saveState(normalized);
        return normalized;
      }
    }
  } catch (e) {
    console.warn("Remote config load failed, using default", e);
  }
  const defaultClone = structuredClone(defaultState);
  saveState(defaultClone);
  return defaultClone;
}

// convert either Speed Dial 2 export or internal format
function convertRemoteConfig(json) {
  if (!json) return null;

  // internal format already
  if (
    Array.isArray(json.groups) &&
    Array.isArray(json.dials) &&
    json.dials.length &&
    json.dials[0].groupId !== undefined
  ) {
    return json;
  }

  // Speed Dial 2 export: use d.idgroup
  if (
    Array.isArray(json.dials) &&
    Array.isArray(json.groups) &&
    json.dials.length &&
    json.dials[0].idgroup !== undefined
  ) {
    return convertSpeedDial2Export(json);
  }

  return null;
}

function normalizeState(raw) {
  const base = structuredClone(defaultState);

  const result = {
    groups: raw.groups || base.groups,
    dials: raw.dials || base.dials,
    preferences: Object.assign({}, base.preferences, raw.preferences || {}),
    settings: Object.assign({}, base.settings, raw.settings || {})
  };

  // ensure required fields exist
  if (!Array.isArray(result.settings.hiddenGroupIds)) {
    result.settings.hiddenGroupIds = [];
  }
  if (!result.settings.backgrounds) {
    result.settings.backgrounds = base.settings.backgrounds;
  } else {
    result.settings.backgrounds.light =
      result.settings.backgrounds.light || base.settings.backgrounds.light;
    result.settings.backgrounds.dark =
      result.settings.backgrounds.dark || base.settings.backgrounds.dark;
  }

  return result;
}

function saveState(newState = state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

function determineInitialGroupId() {
  if (!state.groups.length) return null;

  if (state.settings.rememberLastGroup) {
    const last = localStorage.getItem(LAST_GROUP_KEY);
    if (last !== null) {
      const id = Number(last);
      const exists = state.groups.some((g) => g.id === id);
      if (exists) return id;
    }
  }
  return state.groups[0].id;
}

// ---------- Theme and layout ----------

function applyThemeFromSettings() {
  const mode = state.settings.themeMode || "auto";
  let theme = "light";
  if (mode === "light" || mode === "dark") {
    theme = mode;
  } else {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }

  document.documentElement.setAttribute("data-theme", theme);
  quickThemeLabel.textContent =
    mode.charAt(0).toUpperCase() + mode.slice(1);

  const bgConfig =
    theme === "dark"
      ? state.settings.backgrounds.dark
      : state.settings.backgrounds.light;

  document.body.style.backgroundColor = bgConfig.color || "";
  if (bgConfig.image) {
    document.body.style.backgroundImage = `url("${bgConfig.image}")`;
  } else {
    document.body.style.backgroundImage = "none";
  }
}

function applyLayoutSettings() {
  const s = state.settings;

  const cols = s.gridColumns || 6;
  const spacing = s.gridSpacing || 16;
  const width = s.maxWidth || 1440;

  dialGridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  document.documentElement.style.setProperty("--grid-gap", `${spacing}px`);
  document.documentElement.style.setProperty("--app-max-width", `${width}px`);

  document.getElementById("app").style.justifyContent = s.centerVertically
    ? "center"
    : "flex-start";

  toolbarEl.style.display = s.showAddButtons ? "flex" : "none";
}

// ---------- Rendering ----------

function renderAll() {
  renderGroups();
  renderDials();
  updateSettingsUIValues();
}

function visibleGroups() {
  const hiddenIds = new Set(state.settings.hiddenGroupIds || []);
  return state.groups.filter((g) => !hiddenIds.has(g.id));
}

function renderGroups() {
  groupTabsEl.innerHTML = "";

  const groupsToShow = visibleGroups()
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (!groupsToShow.length) return;

  // if active group is hidden or missing, switch to first visible
  if (!groupsToShow.some((g) => g.id === activeGroupId)) {
    activeGroupId = groupsToShow[0].id;
  }

  groupsToShow.forEach((group) => {
    const btn = document.createElement("button");
    btn.className =
      "group-tab" + (group.id === activeGroupId ? " active" : "");
    btn.textContent = group.title;
    btn.addEventListener("click", () => {
      activeGroupId = group.id;
      if (state.settings.rememberLastGroup) {
        localStorage.setItem(LAST_GROUP_KEY, String(activeGroupId));
      }
      renderGroups();
      renderDials();
    });

    if (state.groups.length > 1) {
      const close = document.createElement("span");
      close.textContent = "×";
      close.className = "close";
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteGroup(group.id);
      });
      btn.appendChild(close);
    }

    groupTabsEl.appendChild(btn);
  });
}

function renderDials() {
  dialGridEl.innerHTML = "";
  if (activeGroupId == null) return;

  const s = state.settings;
  const openInNewTab = s.openInNewTab !== false;

  // update grid columns for mobile: force 2 cols under 600px
  const effectiveCols =
    window.innerWidth < 600 ? 2 : s.gridColumns || 6;
  dialGridEl.style.gridTemplateColumns = `repeat(${effectiveCols}, minmax(0, 1fr))`;

  const dials = state.dials
    .filter((d) => d.groupId === activeGroupId)
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  dials.forEach((dial) => {
    const a = document.createElement("a");
    a.href = dial.url;
    if (openInNewTab) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    a.className = "dial";

    const thumb = document.createElement("div");
    thumb.className = "dial-thumbnail";

    if (dial.thumbnail) {
      const img = document.createElement("img");
      img.src = dial.thumbnail;
      img.alt = dial.title;
      img.onerror = () => {
        thumb.innerHTML = "";
        thumb.appendChild(createFaviconFallback(dial));
      };
      thumb.appendChild(img);
    } else {
      thumb.appendChild(createFaviconFallback(dial));
    }

    const footer = document.createElement("div");
    footer.className = "dial-footer";

    const title = document.createElement("div");
    title.className = "dial-title";
    title.textContent = dial.title;

    const actions = document.createElement("div");
    actions.className = "dial-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditDialModal(dial);
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Del";
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteDial(dial.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    footer.appendChild(title);
    footer.appendChild(actions);

    a.appendChild(thumb);
    a.appendChild(footer);

    dialGridEl.appendChild(a);
  });
}

function createFaviconFallback(dial) {
  const div = document.createElement("div");
  div.className = "dial-favicon-fallback";
  div.textContent = dial.title ? dial.title[0].toUpperCase() : "?";
  return div;
}

// ---------- Event wiring ----------

function attachEvents() {
  window.addEventListener("resize", () => {
    renderDials();
  });

  quickThemeButton.addEventListener("click", () => {
    cycleThemeMode();
  });

  quickImportButton.addEventListener("click", () => {
    quickImportInput.click();
  });

  quickImportInput.addEventListener("change", handleImportFromFile);

  settingsButton.addEventListener("click", () => {
    openSettings();
  });

  addGroupButton.addEventListener("click", () => openAddGroupModal());
  addDialButton.addEventListener("click", () => openAddDialModal());

  modalCloseButton.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  settingsCloseButton.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", (e) => {
    if (e.target === settingsBackdrop) closeSettings();
  });

  settingsTabLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchSettingsTab(tab);
    });
  });

  // general tab
  document
    .querySelectorAll(".seg-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        setThemeModeFromButton(btn.dataset.mode)
      )
    );

  columnsSlider.addEventListener("input", () => {
    state.settings.gridColumns = Number(columnsSlider.value);
    applyLayoutSettings();
    renderDials();
    updateSettingsUIValues();
    saveState();
  });

  spacingSlider.addEventListener("input", () => {
    state.settings.gridSpacing = Number(spacingSlider.value);
    applyLayoutSettings();
    updateSettingsUIValues();
    saveState();
  });

  widthSlider.addEventListener("input", () => {
    state.settings.maxWidth = Number(widthSlider.value);
    applyLayoutSettings();
    updateSettingsUIValues();
    saveState();
  });

  centerVerticallyCheckbox.addEventListener("change", () => {
    state.settings.centerVertically = centerVerticallyCheckbox.checked;
    applyLayoutSettings();
    saveState();
  });

  showAddButtonsCheckbox.addEventListener("change", () => {
    state.settings.showAddButtons = showAddButtonsCheckbox.checked;
    applyLayoutSettings();
    saveState();
  });

  openInNewTabCheckbox.addEventListener("change", () => {
    state.settings.openInNewTab = openInNewTabCheckbox.checked;
    saveState();
    renderDials();
  });

  // theme tab
  lightBgColorInput.addEventListener("input", () => {
    state.settings.backgrounds.light.color = lightBgColorInput.value;
    applyThemeFromSettings();
    saveState();
  });
  lightBgImageInput.addEventListener("change", () => {
    state.settings.backgrounds.light.image = lightBgImageInput.value.trim();
    applyThemeFromSettings();
    saveState();
  });
  darkBgColorInput.addEventListener("input", () => {
    state.settings.backgrounds.dark.color = darkBgColorInput.value;
    applyThemeFromSettings();
    saveState();
  });
  darkBgImageInput.addEventListener("change", () => {
    state.settings.backgrounds.dark.image = darkBgImageInput.value.trim();
    applyThemeFromSettings();
    saveState();
  });

  // groups tab
  rememberGroupCheckbox.addEventListener("change", () => {
    state.settings.rememberLastGroup = rememberGroupCheckbox.checked;
    saveState();
  });

  // system tab
  exportButton.addEventListener("click", exportCurrentState);
  settingsImportButton.addEventListener("click", () =>
    settingsImportInput.click()
  );
  settingsImportInput.addEventListener("change", handleImportFromFile);

  importUrlButton.addEventListener("click", async () => {
    const url = importUrlInput.value.trim();
    if (!url) return;
    if (!confirm("Load config from this URL and replace current data?")) {
      return;
    }
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const converted = convertRemoteConfig(json);
      if (!converted) {
        alert("Could not understand JSON from that URL.");
        return;
      }
      state = normalizeState(converted);
      saveState();
      activeGroupId = determineInitialGroupId();
      applyThemeFromSettings();
      applyLayoutSettings();
      renderAll();
      alert("Imported config from URL.");
    } catch (e) {
      console.error(e);
      alert("Failed to import from URL.");
    }
  });

  copyJsonButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      alert("Current config copied to clipboard. Paste into config.json in GitHub.");
    } catch (e) {
      alert("Clipboard copy failed. Select and copy manually from console.");
      console.log("Config JSON:", JSON.stringify(state, null, 2));
    }
  });

  resetButton.addEventListener("click", () => {
    if (!confirm("Reset to default layout? This clears local storage.")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_GROUP_KEY);
    state = structuredClone(defaultState);
    saveState();
    activeGroupId = determineInitialGroupId();
    applyThemeFromSettings();
    applyLayoutSettings();
    renderAll();
  });
}

// ---------- Settings UI helpers ----------

function openSettings() {
  updateSettingsUIValues();
  settingsBackdrop.classList.remove("hidden");
}

function closeSettings() {
  settingsBackdrop.classList.add("hidden");
}

function switchSettingsTab(tab) {
  settingsTabLinks.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  settingsTabs.forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.id === "settingsTab" + capitalize(tab)
    );
  });
  document.getElementById("settingsTitle").textContent =
    capitalize(tab);
}

function updateSettingsUIValues() {
  const s = state.settings;

  columnsSlider.value = s.gridColumns || 6;
  columnsLabel.textContent = `${columnsSlider.value} columns`;

  spacingSlider.value = s.gridSpacing || 16;
  spacingLabel.textContent = `${spacingSlider.value}px spacing`;

  widthSlider.value = s.maxWidth || 1440;
  widthLabel.textContent = `${widthSlider.value}px max width`;

  centerVerticallyCheckbox.checked = !!s.centerVertically;
  showAddButtonsCheckbox.checked = !!s.showAddButtons;
  openInNewTabCheckbox.checked = s.openInNewTab !== false;

  // theme radio buttons
  document
    .querySelectorAll(".seg-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.mode === s.themeMode)
    );
  quickThemeLabel.textContent =
    s.themeMode.charAt(0).toUpperCase() + s.themeMode.slice(1);

  // theme backgrounds
  lightBgColorInput.value = s.backgrounds.light.color || "#f5f5f5";
  lightBgImageInput.value = s.backgrounds.light.image || "";
  darkBgColorInput.value = s.backgrounds.dark.color || "#202124";
  darkBgImageInput.value = s.backgrounds.dark.image || "";

  rememberGroupCheckbox.checked = !!s.rememberLastGroup;

  // groups visibility list
  groupsVisibilityList.innerHTML = "";
  state.groups
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .forEach((g) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !(s.hiddenGroupIds || []).includes(g.id);
      checkbox.addEventListener("change", () => {
        toggleGroupVisibility(g.id, checkbox.checked);
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + g.title));
      groupsVisibilityList.appendChild(label);
    });
}

function toggleGroupVisibility(groupId, visible) {
  const list = new Set(state.settings.hiddenGroupIds || []);
  if (visible) {
    list.delete(groupId);
  } else {
    list.add(groupId);
  }
  state.settings.hiddenGroupIds = Array.from(list);
  saveState();
  renderGroups();
  renderDials();
}

function cycleThemeMode() {
  const order = ["auto", "light", "dark"];
  const current = state.settings.themeMode || "auto";
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  state.settings.themeMode = next;
  applyThemeFromSettings();
  updateSettingsUIValues();
  saveState();
}

function setThemeModeFromButton(mode) {
  state.settings.themeMode = mode;
  applyThemeFromSettings();
  updateSettingsUIValues();
  saveState();
}

// ---------- Modals for add/edit ----------

function openModal(titleText, bodyNode) {
  modalTitle.textContent = titleText;
  modalBody.innerHTML = "";
  modalBody.appendChild(bodyNode);
  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
}

function openAddGroupModal() {
  const container = document.createElement("div");

  const label = document.createElement("label");
  label.textContent = "Group name";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "e.g. Marketing";

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    const title = input.value.trim();
    if (!title) return;
    addGroup(title);
    closeModal();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  container.appendChild(label);
  container.appendChild(input);
  container.appendChild(actions);

  openModal("Add Group", container);
}

function openAddDialModal() {
  openDialFormModal("Add Tile", null);
}

function openEditDialModal(dial) {
  openDialFormModal("Edit Tile", dial);
}

function openDialFormModal(title, existingDial) {
  const container = document.createElement("div");

  function createField(labelText, type, placeholder, defaultValue = "") {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = defaultValue;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  const titleField = createField(
    "Title",
    "text",
    "e.g. Google",
    existingDial?.title ?? ""
  );
  const urlField = createField(
    "URL",
    "url",
    "https://example.com",
    existingDial?.url ?? ""
  );
  const thumbField = createField(
    "Thumbnail URL (optional)",
    "url",
    "https://logo.clearbit.com/example.com?size=320",
    existingDial?.thumbnail ?? ""
  );

  const groupWrapper = document.createElement("div");
  const groupLabel = document.createElement("label");
  groupLabel.textContent = "Group";
  const groupSelect = document.createElement("select");

  visibleGroups()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.title;
      if (
        existingDial
          ? existingDial.groupId === g.id
          : g.id === activeGroupId
      ) {
        opt.selected = true;
      }
      groupSelect.appendChild(opt);
    });

  groupWrapper.appendChild(groupLabel);
  groupWrapper.appendChild(groupSelect);

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    const titleVal = titleField.input.value.trim();
    const urlVal = urlField.input.value.trim();
    const thumbVal = thumbField.input.value.trim();
    const groupId = Number(groupSelect.value);

    if (!titleVal || !urlVal) return;

    if (existingDial) {
      updateDial(existingDial.id, {
        title: titleVal,
        url: urlVal,
        thumbnail: thumbVal,
        groupId
      });
    } else {
      addDial({
        title: titleVal,
        url: urlVal,
        thumbnail: thumbVal,
        groupId
      });
    }
    closeModal();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  container.appendChild(titleField.wrapper);
  container.appendChild(urlField.wrapper);
  container.appendChild(thumbField.wrapper);
  container.appendChild(groupWrapper);
  container.appendChild(actions);

  openModal(title, container);
}

// ---------- CRUD ----------

function nextId(collection) {
  return collection.length
    ? Math.max(...collection.map((x) => x.id)) + 1
    : 1;
}

function addGroup(title) {
  const id = nextId(state.groups);
  const position = state.groups.length
    ? Math.max(...state.groups.map((g) => g.position ?? 0)) + 1
    : 0;

  state.groups.push({ id, title, position });
  if (activeGroupId == null) activeGroupId = id;
  saveState();
  renderAll();
}

function deleteGroup(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;

  if (!confirm(`Delete group "${group.title}" and all its tiles?`)) {
    return;
  }

  state.groups = state.groups.filter((g) => g.id !== groupId);
  state.dials = state.dials.filter((d) => d.groupId !== groupId);
  state.settings.hiddenGroupIds = (state.settings.hiddenGroupIds || []).filter(
    (id) => id !== groupId
  );

  const visible = visibleGroups();
  activeGroupId = visible.length ? visible[0].id : null;

  saveState();
  renderAll();
}

function addDial({ title, url, thumbnail, groupId }) {
  const id = nextId(state.dials);
  const groupDials = state.dials.filter((d) => d.groupId === groupId);
  const position = groupDials.length
    ? Math.max(...groupDials.map((d) => d.position ?? 0)) + 1
    : 0;

  state.dials.push({
    id,
    groupId,
    title,
    url,
    thumbnail,
    position
  });

  saveState();
  renderDials();
}

function updateDial(id, updates) {
  const dial = state.dials.find((d) => d.id === id);
  if (!dial) return;
  Object.assign(dial, updates);
  saveState();
  renderDials();
}

function deleteDial(id) {
  const dial = state.dials.find((d) => d.id === id);
  if (!dial) return;

  if (!confirm(`Delete tile "${dial.title}"?`)) return;

  state.dials = state.dials.filter((d) => d.id !== id);
  saveState();
  renderDials();
}

// ---------- Import / Export ----------

function handleImportFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const converted = convertRemoteConfig(json);
      if (!converted) {
        alert("Could not parse JSON format.");
        return;
      }
      state = normalizeState(converted);
      saveState();
      activeGroupId = determineInitialGroupId();
      applyThemeFromSettings();
      applyLayoutSettings();
      renderAll();
      alert("Import complete.");
    } catch (err) {
      console.error("Import error", err);
      alert("Failed to import JSON.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function convertSpeedDial2Export(json) {
  const groups = json.groups.map((g) => ({
    id: g.id,
    title: g.title,
    position: g.position ?? 0
  }));

  const dials = json.dials.map((d) => ({
    id: d.id,
    groupId: d.idgroup,
    title: d.title,
    url: d.url,
    thumbnail: d.thumbnail || "",
    position: d.position ?? 0
  }));

  return {
    groups,
    dials,
    preferences: {
      columns: json.preferences?.columns ?? 6
    }
  };
}

function exportCurrentState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-speed-dial-export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Utils ----------

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
