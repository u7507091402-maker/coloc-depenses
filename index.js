// index.js — Splitly — Email/Password Auth + CRUD + Invites
document.addEventListener("DOMContentLoaded", async () => {

  // =======================
  // INIT SUPABASE (UMD v1)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  if (typeof initApi === "function") initApi(supabaseClient);

  // =======================
  // DOM LOGIN
  // =======================
  const loginCard = document.getElementById("login-card");
  const loginBtn = document.getElementById("login-btn");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginMessage = document.getElementById("login-message");

  const forcePasswordCard = document.getElementById("force-password-card");
  const newPasswordInput = document.getElementById("new-password");
  const changePasswordBtn = document.getElementById("change-password-btn");

  // =======================
  // DOM APP
  // =======================
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logout-btn");

  const colocsList = document.getElementById("colocs-list");
  const editor = document.getElementById("coloc-editor");
  const editorTitle = document.getElementById("editor-title");
  const colocNameInput = document.getElementById("coloc-name-input");
  const usersList = document.getElementById("users-list");

  const newUserInput = document.getElementById("new-user-name");
  const newUserEmail = document.getElementById("new-user-email");
  const newUserWeight = document.getElementById("new-user-weight");

  const createBtn = document.getElementById("create-coloc-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const addUserBtn = document.getElementById("add-user-btn");
  const saveColocBtn = document.getElementById("save-coloc-btn");

  // =======================
  // STATE
  // =======================
  let colocs = [];
  let users = [];
  let selectedColoc = null;
  let isCreating = false;
  let tempUsers = [];
  let didInitApp = false;

  // =======================
  // HELPERS
  // =======================
  function safeMsg(err) {
    return err?.message ? err.message : String(err);
  }

  function showLogin() {
    if (loginCard) loginCard.style.display = "block";
    if (app) app.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "none";
  }

  function showApp() {
    if (loginCard) loginCard.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "none";
    if (app) app.style.display = "block";
  }

  function showForcePassword() {
    if (loginCard) loginCard.style.display = "none";
    if (app) app.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "block";
  }

  function getSession() {
    return supabaseClient.auth.session();
  }

  async function loginWithPassword(email, password) {
    const { error } = await supabaseClient.auth.signIn({ email, password });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const { error } = await supabaseClient.auth.update({ password: newPassword });
    if (error) throw error;
  }

  async function doLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  }

  async function deleteColocCascade(colocId) {
    const { error } = await supabaseClient.rpc("admin_delete_coloc", {
      p_colocid: Number(colocId),
    });
    if (error) throw error;
  }

  // =======================
  // LOAD DATA
  // =======================
  async function loadData() {
    const { data: colocsData, error: cErr } = await supabaseClient
      .from("colocs")
      .select("*")
      .order("id", { ascending: false });

    if (cErr) throw cErr;
    colocs = colocsData || [];

    const { data: usersData, error: uErr } = await supabaseClient
      .from("users")
      .select("*");

    if (uErr) throw uErr;
    users = usersData || [];

    renderColocs();
  }

  // =======================
  // RENDER COLOCS
  // =======================
  function renderColocs() {
    if (!colocsList) return;
    colocsList.innerHTML = "";

    if (!colocs.length) {
      colocsList.innerHTML = "<li class='muted'>Aucune colocation</li>";
      return;
    }

    colocs.forEach((c) => {
      const li = document.createElement("li");
      li.className = "coloc-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = c.name;
      nameSpan.onclick = () => (location.href = `coloc.html?id=${c.id}`);

      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditEditor(c);
      };

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Supprimer "${c.name}" ?`)) return;
        await deleteColocCascade(c.id);
        await loadData();
      };

      li.append(nameSpan, editBtn, deleteBtn);
      colocsList.appendChild(li);
    });
  }

  // =======================
  // EDITOR
  // =======================
  function openCreateEditor() {
    isCreating = true;
    selectedColoc = null;
    tempUsers = [];
    editor.style.display = "block";
    editorTitle.textContent = "Nouvelle colocation";
    colocNameInput.value = "";
    renderTempUsers();
  }

  function openEditEditor(coloc) {
    isCreating = false;
    selectedColoc = coloc;
    editor.style.display = "block";
    editorTitle.textContent = "Modifier la colocation";
    colocNameInput.value = coloc.name;

    tempUsers = users
      .filter(u => Number(u.colocid) === Number(coloc.id))
      .map(u => ({
        name: u.name,
        email: (u.email || "").toLowerCase(),
        weight: parseFloat(Number(u.weight || 0))
      }));

    renderTempUsers();
  }

  function renderTempUsers() {
    usersList.innerHTML = "";

    tempUsers.forEach((u, i) => {
      const li = document.createElement("li");
      li.textContent = `${u.name} — ${u.email} (${u.weight})`;

      const del = document.createElement("button");
      del.textContent = "✕";
      del.onclick = () => {
        tempUsers.splice(i, 1);
        renderTempUsers();
      };

      li.appendChild(del);
      usersList.appendChild(li);
    });
  }

  function addUser() {
    const name = newUserInput.value.trim();
    const email = newUserEmail.value.trim().toLowerCase();
    const weight = parseFloat(newUserWeight.value);

    if (!name || !email) return alert("Nom et email requis");

    tempUsers.push({ name, email, weight });
    renderTempUsers();

    newUserInput.value = "";
    newUserEmail.value = "";
    newUserWeight.value = "";
  }

  // =======================
  // SAVE COLOC
  // =======================
  async function saveColoc() {
    const name = colocNameInput.value.trim();
    if (!name) return alert("Nom obligatoire");

    let colocId;

    if (isCreating) {
      const { data, error } = await supabaseClient
        .from("colocs")
        .insert([{ name }])
        .select("*");

      if (error) throw error;
      colocId = data[0].id;
    } else {
      colocId = selectedColoc.id;
    }

    await supabaseClient.from("users").delete().eq("colocid", colocId);

    const usersToInsert = tempUsers.map(u => ({
      name: u.name,
      email: u.email,
      weight: u.weight,
      colocid: colocId
    }));

    await supabaseClient.from("users").insert(usersToInsert);

    editor.style.display = "none";
    await loadData();
  }

  // =======================
  // INIT APP
  // =======================
  async function initApp() {
    if (didInitApp) return;
    didInitApp = true;

    createBtn.onclick = openCreateEditor;
    closeEditorBtn.onclick = () => editor.style.display = "none";
    addUserBtn.onclick = addUser;
    saveColocBtn.onclick = saveColoc;

    logoutBtn.onclick = async () => {
      await doLogout();
      location.reload();
    };

    await loadData();
  }

  // =======================
  // AUTH FLOW
  // =======================
  const session = getSession();

  if (!session) {
    showLogin();

    loginBtn.onclick = async () => {
      const email = loginEmail.value.trim().toLowerCase();
      const password = loginPassword.value;

      try {
        await loginWithPassword(email, password);
        location.reload();
      } catch (err) {
        loginMessage.textContent = safeMsg(err);
      }
    };

    return;
  }

  // Vérifie si changement mot de passe requis
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profile?.must_change_password) {
    showForcePassword();

    changePasswordBtn.onclick = async () => {
      const newPass = newPasswordInput.value;
      if (!newPass || newPass.length < 6) {
        alert("Mot de passe trop court");
        return;
      }

      await updatePassword(newPass);
      await supabaseClient
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", session.user.id);

      location.reload();
    };

    return;
  }

  showApp();
  await initApp();
});
