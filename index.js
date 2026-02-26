document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // INIT SUPABASE (UMD v1.35.7)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  initApi(supabaseClient);

  // =======================
  // LOGIN/UI ELEMENTS
  // =======================
  const loginCard = document.getElementById("login-card");
  const loginBtn = document.getElementById("login-btn");
  const loginEmail = document.getElementById("login-email");
  const loginMessage = document.getElementById("login-message");

  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logout-btn");

  // =======================
  // HELPERS
  // =======================
  function getRedirectToIndex() {
    const basePath = window.location.pathname.replace(/\/[^/]*$/, "/");
    return `${window.location.origin}${basePath}index.html`;
  }

  function showLogin() {
    if (loginCard) loginCard.style.display = "block";
    if (app) app.style.display = "none";
    if (window.lucide) lucide.createIcons();
  }

  function showApp() {
    if (loginCard) loginCard.style.display = "none";
    if (app) app.style.display = "block";
    if (window.lucide) lucide.createIcons();
  }

  function cleanUrlToIndex() {
    // Nettoie le hash (#access_token=...) sans recharger
    try {
      history.replaceState({}, document.title, "index.html");
    } catch (_) {}
  }

  // =======================
  // CAPTURE SESSION FROM MAGIC LINK (important iPhone)
  // =======================
  // Si on arrive avec un hash contenant access_token, Supabase v1 doit le lire
  // et stocker la session. On attend un peu. Si toujours rien -> 1 reload max.
  const hasAuthHash = window.location.hash.includes("access_token=");

  if (hasAuthHash) {
    // Laisse Supabase initialiser et lire le hash
    await new Promise(r => setTimeout(r, 150));

    let tmpSession = null;
    try {
      tmpSession = supabaseClient.auth.session();
    } catch (_) {}

    if (!tmpSession) {
      // 1 seul reload max (anti boucle)
      if (!sessionStorage.getItem("splitly_auth_reload_once")) {
        sessionStorage.setItem("splitly_auth_reload_once", "1");
        // IMPORTANT: on NE nettoie PAS le hash avant le reload
        window.location.reload();
        return;
      }
    }

    // Si on a une session, ou après le reload unique, on nettoie l’URL
    cleanUrlToIndex();
  }

  // =======================
  // CHECK SESSION (v1)
  // =======================
  let session = null;
  try {
    session = supabaseClient.auth.session();
  } catch (e) {
    console.warn("session() failed:", e);
    session = null;
  }

  // si connecté => on enlève le flag reload
  if (session) {
    sessionStorage.removeItem("splitly_auth_reload_once");
  }

  // =======================
  // NOT CONNECTED => LOGIN
  // =======================
  if (!session) {
    showLogin();

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (loginEmail?.value || "").trim();
        if (!email) return;

        if (loginMessage) loginMessage.textContent = "Envoi du lien…";

        try {
          const redirectTo = getRedirectToIndex();

          // Supabase v1 magic link
          const { error } = await supabaseClient.auth.signIn({ email }, { redirectTo });
          if (error) throw error;

          if (loginMessage) loginMessage.textContent = "📩 Vérifie tes emails (lien magique) !";
        } catch (err) {
          console.error("Magic link error:", err);
          if (loginMessage) loginMessage.textContent = "Erreur : " + (err.message || JSON.stringify(err));
        }
      };
    }

    return; // stop si pas connecté
  }

  // =======================
  // CONNECTED => APP
  // =======================
  showApp();
  console.log("✅ Connecté :", session.user?.email);

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        console.warn("logout warn:", e);
      }
      location.reload();
    };
  }

  // =======================
  // CLAIM INVITES
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
  // DOM APP
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
      console.error("loadData:", err);
      alert("Erreur chargement : " + (err.message || JSON.stringify(err)));
    }
  }

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
      editBtn.onclick = (e) => { e.stopPropagation(); openEditEditor(c); };

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.onclick = async (e) => {
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
    const weight = parseFloat(newUserWeight?.value);

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
      console.error("saveColoc:", err);
      alert("Erreur enregistrement : " + (err.message || JSON.stringify(err)));
    }
  }

  if (createBtn) createBtn.onclick = openCreateEditor;
  if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
  if (addUserBtn) addUserBtn.onclick = addUser;
  if (saveColocBtn) saveColocBtn.onclick = saveColoc;

  await loadData();
  if (window.lucide) lucide.createIcons();
});
