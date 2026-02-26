document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // INIT SUPABASE
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";

  // IMPORTANT: sur tes pages tu as chargé supabase.min.js (UMD)
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // init API (api.js)
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
  // HELPERS AUTH COMPAT (v1 + v2)
  // =======================
  async function getSessionCompat() {
    // v2: auth.getSession()
    if (supabaseClient.auth?.getSession) {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    }
    // v1: auth.session()
    if (supabaseClient.auth?.session) {
      return supabaseClient.auth.session() || null;
    }
    throw new Error("Auth API inconnue: ni getSession() ni session()");
  }

  async function sendMagicLinkCompat(email, redirectTo) {
    // v2: signInWithOtp
    if (supabaseClient.auth?.signInWithOtp) {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      return;
    }
    // v1: signIn
    if (supabaseClient.auth?.signIn) {
      const { error } = await supabaseClient.auth.signIn(
        { email },
        { redirectTo }
      );
      if (error) throw error;
      return;
    }
    throw new Error("Auth API inconnue: ni signInWithOtp() ni signIn()");
  }

  async function signOutCompat() {
    if (supabaseClient.auth?.signOut) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      return;
    }
    throw new Error("Auth API inconnue: ni signOut()");
  }

  function getRedirectToIndex() {
    // Force retour sur index.html (super important sur GitHub Pages)
    const basePath = window.location.pathname.replace(/\/[^/]*$/, "/");
    return `${window.location.origin}${basePath}index.html`;
  }

  // =======================
  // AUTH EVENT (v1 + v2)
  // =======================
  // Quand l'utilisateur clique le magic link, parfois iOS met un peu de temps.
  // On force l'app à revenir sur index après SIGNED_IN.
  try {
    if (supabaseClient.auth?.onAuthStateChange) {
      supabaseClient.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          // revient proprement sur index (standalone)
          location.href = "index.html";
        }
      });
    }
  } catch (e) {
    console.warn("onAuthStateChange warning:", e);
  }

  // =======================
  // CHECK SESSION
  // =======================
  let session = null;
  try {
    session = await getSessionCompat();
  } catch (e) {
    console.warn("⚠️ Session read failed:", e);
    session = null;
  }

  // NOT CONNECTED => login visible / app cachée
  if (!session) {
    if (loginCard) loginCard.style.display = "block";
    if (app) app.style.display = "none";

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (loginEmail?.value || "").trim();
        if (!email) return;

        if (loginMessage) loginMessage.textContent = "Envoi du lien…";

        try {
          await sendMagicLinkCompat(email, getRedirectToIndex());
          if (loginMessage) loginMessage.textContent = "📩 Vérifie tes emails (lien magique) !";
        } catch (err) {
          console.error("Magic link error:", err);
          if (loginMessage) loginMessage.textContent = "Erreur : " + (err.message || JSON.stringify(err));
        }
      };
    }

    if (window.lucide) lucide.createIcons();
    return;
  }

  // CONNECTED => login caché / app visible
  if (loginCard) loginCard.style.display = "none";
  if (app) app.style.display = "block";

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await signOutCompat();
      } catch (e) {
        console.warn("logout warn:", e);
      }
      location.reload();
    };
  }

  console.log("✅ Connecté :", session.user?.email);

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
      console.error("saveColoc:", err);
      alert("Erreur enregistrement : " + (err.message || JSON.stringify(err)));
    }
  }

  // EVENTS
  if (createBtn) createBtn.onclick = openCreateEditor;
  if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
  if (addUserBtn) addUserBtn.onclick = addUser;
  if (saveColocBtn) saveColocBtn.onclick = saveColoc;

  // START
  await loadData();
  if (window.lucide) lucide.createIcons();

  console.log("✅ index.js OK — auth compat + app");
});
