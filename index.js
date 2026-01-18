document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // DOM
  // ================================
  const colocsList     = document.getElementById("colocs-list");
  const editor         = document.getElementById("coloc-editor");

  const editorTitle    = document.getElementById("editor-title");
  const colocNameInput = document.getElementById("coloc-name-input");

  const usersList      = document.getElementById("users-list");
  const newUserInput   = document.getElementById("new-user-name");

  const createBtn      = document.getElementById("create-coloc-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const addUserBtn     = document.getElementById("add-user-btn");
  const saveColocBtn   = document.getElementById("save-coloc-btn");

  // ================================
  // STATE
  // ================================
  let colocs = [];
  let users  = [];

  let selectedColoc = null;
  let isCreating    = false;
  let tempUsers     = [];

  // ================================
  // LOAD DATA
  // ================================
  apiGetAll()
    .then(data => {
      colocs = data.colocs || [];
      users  = data.users  || [];
      renderColocs();
    })
    .catch(err => {
      console.error(err);
      alert("Erreur de chargement des données");
    });

  // ================================
  // RENDER COLOCS
  // ================================
  function renderColocs() {
    colocsList.innerHTML = "";

    if (colocs.length === 0) {
      colocsList.innerHTML = "<li>Aucune colocation</li>";
      return;
    }

    colocs.forEach(coloc => {
      const li = document.createElement("li");
      li.className = "coloc-item";

      // Nom → ouvre coloc.html
      const nameSpan = document.createElement("span");
      nameSpan.className = "coloc-name";
      nameSpan.textContent = coloc.name;
      nameSpan.onclick = () => {
        location.href = "coloc.html?id=" + coloc.id;
      };

      // ✏️ Modifier
      const editBtn = document.createElement("button");
      editBtn.className = "edit-coloc-btn";
      editBtn.textContent = "✏️";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditEditor(coloc);
      };

      // ❌ Supprimer
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-coloc-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();

        const ok = confirm(`Supprimer la colocation "${coloc.name}" ?`);
        if (!ok) return;

        try {
          await apiPost("deleteColoc", { id: coloc.id });
          location.reload();
        } catch (err) {
          console.error(err);
          alert("Erreur suppression");
        }
      };

      li.append(nameSpan, editBtn, deleteBtn);
      colocsList.appendChild(li);
    });
  }

  // ================================
  // OPEN CREATE
  // ================================
  function openCreateEditor() {
    isCreating = true;
    selectedColoc = null;
    tempUsers = [];

    editor.style.display = "block";
    editorTitle.textContent = "➕ Nouvelle colocation";
    colocNameInput.value = "";

    renderTempUsers();
  }

  // ================================
  // OPEN EDIT
  // ================================
  function openEditEditor(coloc) {
    isCreating = false;
    selectedColoc = coloc;

    editor.style.display = "block";
    editorTitle.textContent = "✏️ Modifier la colocation";
    colocNameInput.value = coloc.name;

    // ⬅️ POINT CRITIQUE : charger les colocataires existants
    tempUsers = users
      .filter(u => String(u.colocId) === String(coloc.id))
      .map(u => u.name);

    renderTempUsers();
  }

  // ================================
  // CLOSE
  // ================================
  function closeEditor() {
    editor.style.display = "none";
    selectedColoc = null;
    isCreating = false;
    tempUsers = [];
    usersList.innerHTML = "";
    newUserInput.value = "";
  }

  closeEditorBtn.onclick = closeEditor;
  createBtn.onclick = openCreateEditor;

  // ================================
  // USERS (TEMP)
  // ================================
  function renderTempUsers() {
    usersList.innerHTML = "";

    if (tempUsers.length === 0) {
      usersList.innerHTML = "<li>Aucun colocataire</li>";
      return;
    }

    tempUsers.forEach((name, index) => {
      const li = document.createElement("li");
      li.textContent = name;

      const delBtn = document.createElement("button");
      delBtn.className = "mini-delete";
      delBtn.textContent = "✕";
      delBtn.onclick = () => {
        tempUsers.splice(index, 1);
        renderTempUsers();
      };

      li.appendChild(delBtn);
      usersList.appendChild(li);
    });
  }

  addUserBtn.onclick = () => {
    const name = newUserInput.value.trim();
    if (!name) return;

    if (tempUsers.includes(name)) {
      alert("Ce colocataire existe déjà");
      return;
    }

    tempUsers.push(name);
    newUserInput.value = "";
    renderTempUsers();
  };

  // ================================
  // SAVE
  // ================================
  saveColocBtn.onclick = async () => {
    const name = colocNameInput.value.trim();
    if (!name) {
      alert("Nom de colocation obligatoire");
      return;
    }

    if (tempUsers.length === 0) {
      alert("Ajoute au moins un colocataire");
      return;
    }

    try {
      if (isCreating) {
        await apiPost("createColocWithUsers", {
          name,
          users: JSON.stringify(tempUsers)
        });
      } else {
        await apiPost("updateColocUsers", {
          colocId: selectedColoc.id,
          name,
          users: JSON.stringify(tempUsers)
        });
      }

      location.reload();

    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement");
    }
  };

  console.log("✅ index.js chargé correctement");
});
