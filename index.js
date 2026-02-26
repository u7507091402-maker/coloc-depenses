document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // INIT SUPABASE
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // api.js utilise une variable globale "supabase" interne
  initApi(supabaseClient);

  // =======================
  // LOGIN/UI ELEMENTS (index.html)
  // =======================
  const loginCard = document.getElementById("login-card");
  const loginBtn = document.getElementById("login-btn");
  const loginEmail = document.getElementById("login-email");
  const loginMessage = document.getElementById("login-message");

  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logout-btn");

  // =======================
  // CHECK SESSION
  // =======================
  const { data: sessionData, error: sessErr } = await supabaseClient.auth.getSession();
  if (sessErr) console.warn("⚠️ getSession error:", sessErr);

  const session = sessionData?.session || null;

  // NOT CONNECTED => show login, hide app
  if (!session) {
    if (loginCard) loginCard.style.display = "block";
    if (app) app.style.display = "none";

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (loginEmail?.value || "").trim();
        if (!email) return;

        if (loginMessage) loginMessage.textContent = "Envoi du lien…";

        // Redirige vers ton index GitHub Pages (ou localhost en dev)
        // -> préfère toujours index.html pour éviter les surprises.
        const redirectTo = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/index.html")}`;

        const { error } = await supabaseClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo
          }
        });

        if (error) {
          if (loginMessage) loginMessage.textContent = "Erreur : " + error.message;
        } else {
          if (loginMessage) loginMessage.textContent = "📩 Vérifie tes emails (lien magique) !";
        }
      };
    }

    if (window.lucide) lucide.createIcons();
    return; // stop ici si pas connecté
  }

  // CONNECTED => hide login, show app
  if (loginCard) loginCard.style.display = "none";
  if (app) app.style.display = "block";

  // logout
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabaseClient.auth.signOut();
      location.reload();
    };
  }

  console.log("✅ Connecté :", session.user.email);

  // =======================
  // CLAIM INVITES (si présent)
  // =======================
  try {
    if (typeof claimInvitesForCurrentUser === "function") {
      const res = await claimInvitesForCurrentUser(supabaseClient);
      if (res?.claimed) console.log("✅ Invites réclamées:", res.claimed);
    }
  } catch (e) {
    console.warn("⚠️ claimInvitesForCurrentUser:", e);
  }

  // =======================
  // RÉFÉRENCES DOM (APP)
  // =======================
  const colocsList     = document.getElementById("colocs-list");
  const editor         = document.getElementById("coloc-editor");
  const editorTitle    = document.getElementById("editor-title");
  const colocNameInput = document.getElementById("coloc-name-input");
  const usersList      = document.getElementById("users-list");
  const newUserInput   = document.getElementById("new-user-name");
  const newUserWeight  = document.getElementById("new-user-weight");
  const createBtn      = document.getElementById("create-coloc-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const addUserBtn     = document.getElementById("add-user-btn");
  const saveColocBtn   = document.getElementById("save-coloc-btn");

  // =======================
  // STATE
  // =======================
  let colocs = [];
  let users  = [];
  let selectedColoc = null;
  let isCreating = false;
  let tempUsers = [];

  // =======================
  // LOAD DATA
  // =======================
  async function loadData() {
    try {
      colocs = await apiGet("colocs");
      users  = await apiGet("users");
      renderColocs();
    } catch (err) {
      console.error(err);
      alert("Erreur chargement : " + (err.message || JSON.stringify(err)));
    }
  }

  // =======================
  // RENDER COLOCS
  // =======================
  function renderColocs() {
    if (!colocsList) return;

    colocsList.innerHTML = "";
    if (!colocs.length) {
      colocsList.innerHTML = "<li class='muted'>Aucune colocation</li>";
      if (window.lucide) lucide.createIcons();
      return;
    }

    colocs.forEach(c => {
      const li = document.createElement("li");
      li.className = "coloc-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "coloc-name";
      nameSpan.textContent = c.name;
      nameSpan.onclick = () => (location.href = `coloc.html?id=${c.id}`);

      const editBtn = document.createElement("button");
      editBtn.innerHTML = '<i data-lucide="edit-3"></i>';
      editBtn.onclick = e => { e.stopPropagation(); openEditEditor(c); };

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.onclick = async e => {
        e.stopPropagation();
        if (!confirm(`Supprimer "${c.name}" ?`)) return;
        await apiDelete("colocs", { id: c.id });
        await loadData();
      };

      li.append(nameSpan, editBtn, deleteBtn);
      colocsList.appendChild(li);
    });

    if (window.lucide) lucide.createIcons();
  }

  // =======================
  // EDITOR
  // =======================
  function openCreateEditor() {
    isCreating = true;
    selectedColoc = null;
    tempUsers = [];
    if (editor) editor.style.display = "block";
    if (editorTitle) editorTitle.textContent = "➕ Nouvelle colocation";
    if (colocNameInput) colocNameInput.value = "";
    renderTempUsers();
  }

  function openEditEditor(coloc) {
    isCreating = false;
    selectedColoc = coloc;
    if (editor) editor.style.display = "block";
    if (editorTitle) editorTitle.textContent = "✏️ Modifier la colocation";
    if (colocNameInput) colocNameInput.value = coloc.name;

    tempUsers = users
      .filter(u => Number(u.colocid) === Number(coloc.id))
      .map(u => ({ name: u.name, weight: Number(u.weight) }));

    renderTempUsers();
  }

  function closeEditor() {
    if (editor) editor.style.display = "none";
    selectedColoc = null;
    isCreating = false;
    tempUsers = [];
    if (usersList) usersList.innerHTML = "";
    if (newUserInput) newUserInput.value = "";
    if (newUserWeight) newUserWeight.value = "";
  }

  function renderTempUsers() {
    if (!usersList) return;

    usersList.innerHTML = "";
    if (!tempUsers.length) {
      usersList.innerHTML = "<li class='muted'>Aucun colocataire</li>";
      return;
    }

    tempUsers.forEach((u, i) => {
      const li = document.createElement("li");
      li.textContent = `${u.name} (poids: ${u.weight.toFixed(4)})`;

      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.onclick = () => { tempUsers.splice(i, 1); renderTempUsers(); };

      li.appendChild(delBtn);
      usersList.appendChild(li);
    });
  }

  function addUser() {
    const name = (newUserInput?.value || "").trim();
    let weight = parseFloat(newUserWeight?.value);

    if (!name) return alert("Nom obligatoire");
    if (tempUsers.some(u => u.name === name)) return alert("Colocataire déjà présent");
    if (isNaN(weight) || weight <= 0 || weight > 1) return alert("Poids entre 0 et 1");

    tempUsers.push({ name, weight });
    if (newUserInput) newUserInput.value = "";
    if (newUserWeight) newUserWeight.value = "";
    renderTempUsers();
  }

  async function saveColoc() {
    const name = (colocNameInput?.value || "").trim();
    if (!name || !tempUsers.length) return alert("Nom et colocataires obligatoires");

    const totalWeight = tempUsers.reduce((s, u) => s + u.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.0001) return alert("La somme des poids doit faire 1");

    tempUsers = tempUsers.map(u => ({ name: u.name, weight: parseFloat(u.weight.toFixed(4)) }));

    try {
      if (isCreating) {
        const colocData = await apiPost("colocs", { name });
        const newColocId = colocData[0].id;

        const usersToInsert = tempUsers.map(u => ({
          name: u.name,
          colocid: newColocId,
          weight: u.weight
        }));

        await apiPost("users", usersToInsert);
      } else {
        await apiUpdate("colocs", { name }, { id: selectedColoc.id });
        await apiDelete("users", { colocid: selectedColoc.id });

        const usersToInsert = tempUsers.map(u => ({
          name: u.name,
          colocid: selectedColoc.id,
          weight: u.weight
        }));

        await apiPost("users", usersToInsert);
      }

      await loadData();
      closeEditor();
    } catch (err) {
      console.error(err);
      alert("Erreur enregistrement : " + (err.message || JSON.stringify(err)));
    }
  }

  // =======================
  // EVENTS
  // =======================
  if (createBtn) createBtn.onclick = openCreateEditor;
  if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
  if (addUserBtn) addUserBtn.onclick = addUser;
  if (saveColocBtn) saveColocBtn.onclick = saveColoc;

  // =======================
  // START
  // =======================
  await loadData();
  if (window.lucide) lucide.createIcons();

  console.log("✅ index.js OK — login + app + claim invites + CRUD");
});
