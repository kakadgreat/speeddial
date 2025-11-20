// Simple self-hosted Speed Dial clone
const STORAGE_KEY = "mySpeedDialStateV1";
const THEME_KEY = "mySpeedDialTheme";

const defaultState = {
  groups: [
    { id: 0, title: "Home", position: 0 }
  ],
  dials: [
    {
      id: 1,
      groupId: 0,
      title: "Google",
      url: "https://www.google.com",
      thumbnail: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_160x56dp.png",
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
  }
};

let state = loadState();
let activeGroupId =
  state.groups.length > 0 ? state.groups[0].id : null;

// Elements
const groupTabsEl = document.getElementById("groupTabs");
const dialGridEl = document.getElementById("dialGrid");
const themeToggleEl = document.getElementById("themeToggle");
const addGroupButton = document.getElementById("addGroupButton");
const addDialButton = document.getElementById("addDialButton");
const importInput = document.getElementById("importInput");
const exportButton = document.getElementById("exportButton");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseButton = document.getElementById("modalCloseButton");

// ---------- Initialization ----------

applySavedTheme();
renderAll();
attachEvents();

// ---------- State helpers ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    // Basic sanity check
    if (!parsed.groups || !parsed.dials) {
      return structuredClone(defaultState);
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load state, using default", e);
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

function nextId(collection) {
  return collection.length
    ? Math.max(...collection.map((x) => x.id)) + 1
    : 1;
}

// ---------- Rendering ----------

function renderAll() {
  renderGroups();
  renderDials();
}

function renderGroups() {
  groupTabsEl.innerHTML = "";

  state.groups
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((group) => {
      const btn = document.createElement("button");
      btn.className = "group-tab" + (group.id === activeGroupId ? " active" : "");
      btn.textContent = group.title;
      btn.addEventListener("click", () => {
        activeGroupId = group.id;
        renderGroups();
        renderDials();
      });

      // small close button (except if only one group)
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

  const dials = state.dials
    .filter((d) => d.groupId === activeGroupId)
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  dials.forEach((dial) => {
    const a = document.createElement("a");
    a.href = dial.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "dial";

    // Thumbnail
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

    // Footer
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

// ---------- Events ----------

function attachEvents() {
  themeToggleEl.addEventListener("click", toggleTheme);
  addGroupButton.addEventListener("click", () => openAddGroupModal());
  addDialButton.addEventListener("click", () => openAddDialModal());
  importInput.addEventListener("change", handleImportJson);
  exportButton.addEventListener("click", exportCurrentState);
  modalCloseButton.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
}

// ---------- Theme ----------

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    // default: match prefers-color-scheme
    const prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light"
    );
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

// ---------- Modals & Forms ----------

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

  state.groups
    .slice()
    .sort((a, b) => a.position - b.position)
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

// ---------- CRUD operations ----------

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

  if (activeGroupId === groupId) {
    activeGroupId = state.groups.length ? state.groups[0].id : null;
  }

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

function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const converted = convertSpeedDial2Export(json);
      if (!converted) {
        alert("Could not parse JSON format.");
        return;
      }
      state = converted;
      activeGroupId = state.groups.length ? state.groups[0].id : null;
      saveState();
      renderAll();
      alert("Import complete. Your tiles are now loaded.");
    } catch (err) {
      console.error("Import error", err);
      alert("Failed to import JSON.");
    } finally {
      // reset input so the same file can be chosen again later if needed
      importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function convertSpeedDial2Export(json) {
  if (!json || !Array.isArray(json.dials) || !Array.isArray(json.groups)) {
    return null;
  }

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
