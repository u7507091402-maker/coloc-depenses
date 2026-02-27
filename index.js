// index.js — Splitly (Supabase UMD v1) — Login + CRUD colocs + edit + delete cascade + users weights
document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // INIT SUPABASE (UMD v1)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // api.js (optionnel)
  if (typeof initApi === "function") initApi(supabaseClient);

  // =======================
  // DOM (LOGIN)
  // =======================
  const loginCard = document.getElementById("login-card");
  const loginBtn = document.getElementById("login-btn");
  const loginEmail = document.getElementById("login-email");
  const loginMessage = document.getElementById("login-message");

  // =======================
  // DOM (APP)
  // =======================
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logout-btn");

  const colocsList = document.getElementById("colocs-list");
  const editor = document.getElementById("coloc-editor");
  const editorTitle = document.getElementById("editor-title");
  const colocNameInput = document.getElementById("coloc-name-input");
  const usersList = document.getElementById("users-list");
  const newUserInput = document.getElementById("new-user-name");
  const newUserWeight = document.getElementById("new-user-weight");
  const createBtn = document.getElementById("create-coloc-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const addUserBtn = document.getElementById("add-user-btn");
  const saveColocBtn = document.getElementById("save-coloc-btn");

  // =======================
  // STATE
  // =======================
  let colocs = [];
  let users = []; // tous les users (admin) ou filtrés par RLS (non-admin)
  let selectedColoc = null;
  let isCreating = false;
  let tempUsers = [];

  // anti double-init handlers
  let didInitApp = false;

  // =======================
  // HELPERS
  // =======================
  function safeMsg(err) {
    // évite JSON.stringify (peut provoquer stack depth)
    return err?.message ? err.message : String(err);
  }

  function getRedirectToIndex() {
    // Force retour index.html (GitHub Pages)
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

  // =======================
  // AUTH (Supabase v1)
  // =======================
  function getSessionV1() {
    return supabaseClient.auth.session(); // null si non connecté
  }

  async function sendMagicLink(email) {
    const redirectTo = getRedirectToIndex();
    const { error } = await supabaseClient.auth.signIn({ email }, { redirectTo });
    if (error) throw error;
  }

  async function doLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  }

  // =======================
  // ADMIN DELETE CASCADE (RPC)
  // =======================
  async function deleteColocCascade(colocId) {
    const { error } = await supabaseClient.rpc("admin_delete_coloc", {
      p_colocid: Number(colocId),
    });
    if (error) throw error;
  }

  // =======================
  // LOAD DATA (direct Supabase)
  // =======================
  async function loadData() {
    try {
      const { data: colocsData, error: cErr } = await supabaseClient
        .from("colocs")
        .select("*")
        .order("id", { ascending: false });
      if (cErr) throw cErr;
      colocs = colocsData || [];

      // on garde users pour l’éditeur (openEditEditor)
      const { data: usersData, error: uErr } = await supabaseClient
        .from("users")
        .select("*");
      if (uErr) throw uErr;
      users = usersData || [];

      renderColocs();
    } catch (err) {
      console.error("loadData error:", err);
      alert("Erreur chargement : " + safeMsg(err));
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

    colocs.forEach((c) => {
      const li = document.createElement("li");
      li.className = "coloc-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "coloc-name";
      nameSpan.textContent = c.name;
      nameSpan.onclick = () => (location.href = `coloc.html?id=${c.id}`);

      // edit
      const editBtn = document.createElement("button");
      editBtn.innerHTML = '<i data-lucide="edit-3"></i>';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditEditor(c);
      };

      // delete cascade
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Supprimer "${c.name}" + toutes ses données ?`)) return;

        try {
          await deleteColocCascade(c.id);
          await loadData();
        } catch (err) {
          console.error("delete coloc:", err);
          alert("Erreur suppression : " + safeMsg(err));
        }
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

    // récupère les users liés à cette coloc
    tempUsers = users
      .filter((u) => Number(u.colocid) === Number(coloc.id))
      .map((u) => ({
        name: u.name,
        weight: parseFloat(Number(u.weight || 0).toFixed(4)),
      }));

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
      delBtn.onclick = () => {
        tempUsers.splice(i, 1);
        renderTempUsers();
      };

      li.appendChild(delBtn);
      usersList.appendChild(li);
    });
  }

  function addUser() {
    const name = (newUserInput?.value || "").trim();
    const weightRaw = parseFloat(newUserWeight?.value);

    if (!name) return alert("Nom obligatoire");
    if (tempUsers.some((u) => u.name === name)) return alert("Colocataire déjà présent");
    if (Number.isNaN(weightRaw) || weightRaw <= 0 || weightRaw > 1) return alert("Poids entre 0 et 1");

    tempUsers.push({ name, weight: parseFloat(weightRaw.toFixed(4)) });

    if (newUserInput) newUserInput.value = "";
    if (newUserWeight) newUserWeight.value = "";

    renderTempUsers();
  }

  async function saveColoc() {
    const name = (colocNameInput?.value || "").trim();
    if (!name || !tempUsers.length) return alert("Nom et colocataires obligatoires");

    const totalWeight = tempUsers.reduce((s, u) => s + Number(u.weight || 0), 0);
    if (Math.abs(totalWeight - 1) > 0.0001) return alert("La somme des poids doit faire 1");

    // normalise affichage
    tempUsers = tempUsers.map((u) => ({ name: u.name, weight: parseFloat(Number(u.weight).toFixed(4)) }));

    try {
      let colocIdToUse = null;

      if (isCreating) {
        // CREATE
        const { data: colocRows, error: cErr } = await supabaseClient
          .from("colocs")
          .insert([{ name }])
          .select("*");
        if (cErr) throw cErr;

        colocIdToUse = colocRows?.[0]?.id;
        if (!colocIdToUse) throw new Error("Création colocation échouée (id manquant)");
      } else {
        // UPDATE
        if (!selectedColoc?.id) throw new Error("Aucune colocation sélectionnée");
        colocIdToUse = selectedColoc.id;

        const { error: upErr } = await supabaseClient
          .from("colocs")
          .update({ name })
          .eq("id", colocIdToUse);
        if (upErr) throw upErr;

        // supprime anciens users puis réinsère
        const { error: delUsersErr } = await supabaseClient
          .from("users")
          .delete()
          .eq("colocid", colocIdToUse);
        if (delUsersErr) throw delUsersErr;
      }

      const usersToInsert = tempUsers.map((u) => ({
        name: u.name,
        weight: u.weight,
        colocid: colocIdToUse,
      }));

      const { error: uErr } = await supabaseClient.from("users").insert(usersToInsert);
      if (uErr) throw uErr;

      closeEditor();
      await loadData();
    } catch (err) {
      console.error("saveColoc:", err);
      alert("Erreur enregistrement : " + safeMsg(err));
    }
  }

  // =======================
  // INIT APP (once)
  // =======================
  async function initAppIfNeeded() {
    if (didInitApp) return;
    didInitApp = true;

    if (createBtn) createBtn.onclick = openCreateEditor;
    if (closeEditorBtn) closeEditorBtn.onclick = closeEditor;
    if (addUserBtn) addUserBtn.onclick = addUser;
    if (saveColocBtn) saveColocBtn.onclick = saveColoc;

    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try {
          await doLogout();
        } catch (e) {
          console.warn("logout:", e);
        }
        location.reload();
      };
    }

    // Claim invites (si tu as gardé cette fonction)
    try {
      if (typeof claimInvitesForCurrentUser === "function") {
        await claimInvitesForCurrentUser(supabaseClient);
      }
    } catch (e) {
      console.warn("claimInvitesForCurrentUser:", e);
    }

    await loadData();
  }

  // =======================
  // AUTH FLOW
  // =======================
  const session = getSessionV1();

  if (!session) {
    showLogin();

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (loginEmail?.value || "").trim();
        if (!email) return;

        if (loginMessage) loginMessage.textContent = "Envoi du lien…";

        try {
          await sendMagicLink(email);
          if (loginMessage) loginMessage.textContent = "📩 Vérifie tes emails (lien magique) !";
        } catch (err) {
          console.error("magiclink:", err);
          if (loginMessage) loginMessage.textContent = "Erreur : " + safeMsg(err);
        }
      };
    }

    return;
  }

  // connecté
  showApp();
  await initAppIfNeeded();

  // écoute auth state change SANS rediriger/reloader
  try {
    supabaseClient.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        showApp();
        await initAppIfNeeded();
      }
      if (event === "SIGNED_OUT") {
        showLogin();
      }
    });
  } catch (e) {
    console.warn("onAuthStateChange:", e);
  }
});
