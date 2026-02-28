// index.js — Splitly — Email/Password Auth + CRUD colocs + users(email/weight) + invites + claim memberships
document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // INIT SUPABASE (UMD v1)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  if (typeof initApi === "function") initApi(supabaseClient);

  // =======================
  // DOM (LOGIN)
  // =======================
  const loginCard = document.getElementById("login-card");
  const loginBtn = document.getElementById("login-btn");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginMessage = document.getElementById("login-message");

  // Force change password UI
  const forcePasswordCard = document.getElementById("force-password-card");
  const newPasswordInput = document.getElementById("new-password");
  const newPasswordConfirmInput = document.getElementById("new-password-confirm"); // doit exister dans HTML
  const changePasswordBtn = document.getElementById("change-password-btn");

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

  let isAdmin = false; // Option A

  // =======================
  // HELPERS
  // =======================
  function safeMsg(err) {
    return err?.message ? err.message : String(err);
  }

  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  function showLogin() {
    if (loginCard) loginCard.style.display = "block";
    if (app) app.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "none";
    refreshIcons();
  }

  function showApp() {
    if (loginCard) loginCard.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "none";
    if (app) app.style.display = "block";
    refreshIcons();
  }

  function showForcePassword() {
    if (loginCard) loginCard.style.display = "none";
    if (app) app.style.display = "none";
    if (forcePasswordCard) forcePasswordCard.style.display = "block";
    refreshIcons();
  }

  function makeIconBtn(lucideName, title, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<i data-lucide="${lucideName}"></i>`;
    if (title) {
      btn.title = title;
      btn.setAttribute("aria-label", title);
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick?.(e);
    };
    return btn;
  }

  // =======================
  // AUTH (Supabase v1)
  // =======================
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

  // =======================
  // RPCs (DB)
  // =======================
  async function claimMyInvites() {
    const { error } = await supabaseClient.rpc("claim_my_invites");
    if (error) throw error;
  }

  async function deleteColocCascade(colocId) {
    const { error } = await supabaseClient.rpc("admin_delete_coloc", {
      p_colocid: Number(colocId),
    });
    if (error) throw error;
  }

  // =======================
  // PROFILE / ADMIN CHECK
  // =======================
  async function loadMyProfile(userId) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, is_admin, must_change_password")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  }

  // =======================
  // LOAD DATA
  // =======================
  async function loadData() {
    try {
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
    } catch (err) {
      console.error("loadData:", err);
      alert("Erreur chargement : " + safeMsg(err));
    }
  }

  // =======================
  // RENDER COLOCS (⚠️ garde la mise en page: bloc actions)
  // =======================
  function renderColocs() {
    if (!colocsList) return;

    colocsList.innerHTML = "";

    if (!colocs.length) {
      colocsList.innerHTML = "<li class='muted'>Aucune colocation</li>";
      refreshIcons();
      return;
    }

    colocs.forEach((c) => {
      const li = document.createElement("li");
      li.className = "coloc-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "coloc-name";
      nameSpan.textContent = c.name;
      nameSpan.onclick = () => (location.href = `coloc.html?id=${c.id}`);
      li.appendChild(nameSpan);

      // ✅ IMPORTANT : ton CSS attend probablement un container "actions"
      const actions = document.createElement("div");
      actions.className = "coloc-actions";

      if (isAdmin) {
        actions.appendChild(
          makeIconBtn("edit-3", "Modifier", () => openEditEditor(c))
        );

        actions.appendChild(
          makeIconBtn("trash-2", "Supprimer", async () => {
            if (!confirm(`Supprimer "${c.name}" + toutes ses données ?`)) return;
            try {
              await deleteColocCascade(c.id);
              await loadData();
            } catch (err) {
              console.error("delete coloc:", err);
              alert("Erreur suppression : " + safeMsg(err));
            }
          })
        );

        li.appendChild(actions);
      }

      colocsList.appendChild(li);
    });

    refreshIcons();
  }

  // =======================
  // EDITOR
  // =======================
  function openCreateEditor() {
    if (!isAdmin) {
      alert("Seul l’administrateur peut créer une colocation.");
      return;
    }

    isCreating = true;
    selectedColoc = null;
    tempUsers = [];

    if (editor) editor.style.display = "block";
    if (editorTitle) editorTitle.textContent = "➕ Nouvelle colocation";
    if (colocNameInput) colocNameInput.value = "";

    renderTempUsers();
  }

  function openEditEditor(coloc) {
    if (!isAdmin) return;

    isCreating = false;
    selectedColoc = coloc;

    if (editor) editor.style.display = "block";
    if (editorTitle) editorTitle.textContent = "✏️ Modifier la colocation";
    if (colocNameInput) colocNameInput.value = coloc.name;

    tempUsers = users
      .filter((u) => Number(u.colocid) === Number(coloc.id))
      .map((u) => ({
        name: u.name,
        email: (u.email || "").trim().toLowerCase(),
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
    if (newUserEmail) newUserEmail.value = "";
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
      const email = u.email ? u.email : "—";
      li.textContent = `${u.name} — ${email} (poids: ${Number(u.weight).toFixed(4)})`;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
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
    if (!isAdmin) return;

    const name = (newUserInput?.value || "").trim();
    const email = (newUserEmail?.value || "").trim().toLowerCase();
    const weight = parseFloat(newUserWeight?.value);

    if (!name) return alert("Nom obligatoire");
    if (!email || !email.includes("@")) return alert("Email invalide");
    if (tempUsers.some((u) => (u.email || "").toLowerCase() === email)) return alert("Email déjà présent");
    if (isNaN(weight) || weight <= 0 || weight > 1) return alert("Poids entre 0 et 1");

    tempUsers.push({ name, email, weight: parseFloat(weight.toFixed(4)) });

    if (newUserInput) newUserInput.value = "";
    if (newUserEmail) newUserEmail.value = "";
    if (newUserWeight) newUserWeight.value = "";
    renderTempUsers();
  }

  // =======================
  // SAVE COLOC + USERS + INVITES (admin only)
  // =======================
  async function saveColoc() {
    if (!isAdmin) {
      alert("Seul l’administrateur peut enregistrer une colocation.");
      return;
    }

    const name = (colocNameInput?.value || "").trim();
    if (!name || !tempUsers.length) return alert("Nom et colocataires obligatoires");

    const totalWeight = tempUsers.reduce((s, u) => s + Number(u.weight || 0), 0);
    if (Math.abs(totalWeight - 1) > 0.0001) return alert("La somme des poids doit faire 1");

    const normalized = tempUsers.map((u) => ({
      name: u.name,
      email: (u.email || "").trim().toLowerCase(),
      weight: parseFloat(Number(u.weight).toFixed(4)),
    }));

    try {
      let colocIdToUse = null;

      if (isCreating) {
        const { data: colocRows, error: cErr } = await supabaseClient
          .from("colocs")
          .insert([{ name }])
          .select("*");
        if (cErr) throw cErr;

        colocIdToUse = colocRows?.[0]?.id;
        if (!colocIdToUse) throw new Error("Création colocation échouée (id manquant)");
      } else {
        if (!selectedColoc?.id) throw new Error("Aucune colocation sélectionnée");
        colocIdToUse = selectedColoc.id;

        const { error: upErr } = await supabaseClient
          .from("colocs")
          .update({ name })
          .eq("id", colocIdToUse);
        if (upErr) throw upErr;

        const { error: delUsersErr } = await supabaseClient
          .from("users")
          .delete()
          .eq("colocid", colocIdToUse);
        if (delUsersErr) throw delUsersErr;
      }

      // insert users
      const usersToInsert = normalized.map((u) => ({
        name: u.name,
        email: u.email,
        weight: u.weight,
        colocid: colocIdToUse,
      }));

      const { error: uErr } = await supabaseClient.from("users").insert(usersToInsert);
      if (uErr) throw uErr;

      // upsert invites (unique(colocid,email) recommandé)
      const invitesToUpsert = normalized.map((u) => ({
        colocid: colocIdToUse,
        email: u.email,
        role: "member",
      }));

      const { error: invErr } = await supabaseClient
        .from("invites")
        .upsert(invitesToUpsert, { onConflict: "colocid,email" });
      if (invErr) throw invErr;

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

    // cache le bouton créer si pas admin
    if (createBtn) createBtn.style.display = isAdmin ? "" : "none";

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

    await loadData();
  }

  // =======================
  // AUTH FLOW
  // =======================
  const session = getSession();

  // --- PAS CONNECTÉ ---
  if (!session) {
    showLogin();

    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (loginEmail?.value || "").trim().toLowerCase();
        const password = loginPassword?.value || "";

        if (!email || !password) {
          if (loginMessage) loginMessage.textContent = "Email + mot de passe requis.";
          return;
        }

        if (loginMessage) loginMessage.textContent = "Connexion…";

        try {
          await loginWithPassword(email, password);
          location.reload();
        } catch (err) {
          console.error("login:", err);
          if (loginMessage) loginMessage.textContent = "Erreur : " + safeMsg(err);
        }
      };
    }
    return;
  }

  // --- CONNECTÉ ---
  // 1) claim invites
  try {
    await claimMyInvites();
  } catch (e) {
    console.warn("claim_my_invites:", e);
  }

  // 2) read profile (admin + must_change_password)
  let profile = null;
  try {
    profile = await loadMyProfile(session.user.id);
    isAdmin = !!profile?.is_admin;
  } catch (e) {
    console.warn("profile read:", e);
  }

  // 3) force change password
  if (profile?.must_change_password) {
    showForcePassword();

    if (changePasswordBtn) {
      changePasswordBtn.onclick = async () => {
        const newPass = (newPasswordInput?.value || "").trim();
        const confirmPass = (newPasswordConfirmInput?.value || "").trim();

        if (newPass.length < 6) {
          alert("Mot de passe trop court (min 6)");
          return;
        }
        if (newPass !== confirmPass) {
          alert("Les deux mots de passe ne correspondent pas.");
          return;
        }

        try {
          await updatePassword(newPass);

          const { error: upErr } = await supabaseClient
            .from("profiles")
            .update({ must_change_password: false })
            .eq("id", session.user.id);

          if (upErr) throw upErr;

          location.reload();
        } catch (err) {
          console.error("update password:", err);
          alert("Erreur : " + safeMsg(err));
        }
      };
    }
    return;
  }

  showApp();
  await initAppIfNeeded();

  // Re-sync UI
  try {
    supabaseClient.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") showLogin();
    });
  } catch (e) {
    console.warn("onAuthStateChange:", e);
  }
});
