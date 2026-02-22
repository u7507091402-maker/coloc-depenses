document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM chargé (coloc.js)");

  // =======================
  // CONFIG SUPABASE (UMD)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // =======================
  // PARAMS URL
  // =======================
  const params = new URLSearchParams(window.location.search);
  const colocId = Number(params.get("id"));
  if (!colocId) {
    alert("Colocation non sélectionnée");
    location.href = "index.html";
    return;
  }

  // =======================
  // DATA (STATE)
  // =======================
  let coloc = null;
  let users = [];
  let expenses = [];
  let settlements = [];
  let categories = [];

  // =======================
  // DOM
  // =======================
  const usersList = document.getElementById("users-list");
  const expensesList = document.getElementById("expenses-list");
  const balancesList = document.getElementById("balances-list");
  const paidBySelect = document.getElementById("paid-by");
  const categorySelect = document.getElementById("expense-category");
  const expenseForm = document.getElementById("expense-form");
  const settleBtn = document.getElementById("settle-btn");

  const budgetBtn = document.getElementById("budget-btn");
  const backBtn = document.getElementById("back-btn");

  // =======================
  // HELPERS
  // =======================
  function getCategory(id) {
    return (
      categories.find(c => Number(c.id) === Number(id)) || {
        label: "Inconnu",
        emoji: "❓"
      }
    );
  }

  // Filtre "post-régularisation" (ignore dépenses <= last_expense_id)
  function getActiveExpenses() {
    if (!settlements.length) return expenses;

    const last = settlements.reduce(
      (max, s) => Math.max(max, Number(s.last_expense_id || 0)),
      0
    );

    return expenses.filter(e => Number(e.id) > last);
  }

  // Poids robustes : accepte 0.6/0.4 ou 60/40, puis normalise somme=1
  function getNormalizedWeights(listUsers) {
    const raw = listUsers.map(u => Number(u.weight) || 0);
    const sumRaw = raw.reduce((s, w) => s + w, 0);

    const looksLikePercent = sumRaw > 1.5; // ex 60+40
    const weights = raw.map(w => (looksLikePercent ? w / 100 : w));

    const sum = weights.reduce((s, w) => s + w, 0);
    if (!sum) return listUsers.map(_ => 1 / listUsers.length);

    return weights.map(w => w / sum);
  }

  // Soldes AU POIDS (sur dépenses actives)
  function getBalancesWeighted() {
    const balances = {};
    users.forEach(u => (balances[u.id] = 0));

    const active = getActiveExpenses();
    if (!active.length || !users.length) return balances;

    const total = active.reduce((s, e) => s + Number(e.amount), 0);
    if (!total) return balances;

    const weights = getNormalizedWeights(users);

    // payé par user
    const paid = {};
    users.forEach(u => (paid[u.id] = 0));
    active.forEach(e => {
      const payerId = Number(e.paidBy);
      paid[payerId] = (paid[payerId] || 0) + Number(e.amount);
    });

    users.forEach((u, idx) => {
      const share = total * weights[idx];
      balances[u.id] = Math.round((paid[u.id] - share) * 100) / 100;
    });

    return balances;
  }

  // Calcul régularisations AU POIDS
  function computeSettlements() {
    const balances = getBalancesWeighted();

    const debtors = users
      .filter(u => (balances[u.id] ?? 0) < -0.01)
      .map(u => ({ id: u.id, balance: balances[u.id] }));

    const creditors = users
      .filter(u => (balances[u.id] ?? 0) > 0.01)
      .map(u => ({ id: u.id, balance: balances[u.id] }));

    const result = [];
    let i = 0,
      j = 0;

    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(-d.balance, c.balance);

      result.push({
        colocid: colocId,
        fromuser: d.id,
        touser: c.id,
        amount: Math.round(amount * 100) / 100,
        date: new Date().toISOString()
      });

      d.balance += amount;
      c.balance -= amount;

      if (Math.abs(d.balance) < 0.01) i++;
      if (Math.abs(c.balance) < 0.01) j++;
    }

    return result;
  }

  // =======================
  // SUPPRESSION DEPENSE (UNIQUEMENT SI ACTIVE)
  // =======================
  async function deleteExpense(expenseId) {
    const id = Number(expenseId);

    // sécurité : suppression uniquement si dépense active
    const activeIds = new Set(getActiveExpenses().map(e => Number(e.id)));
    if (!activeIds.has(id)) {
      alert("⛔ Suppression impossible : cette dépense a déjà été régularisée.");
      return;
    }

    if (!confirm("Supprimer cette dépense ?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      await loadData();
    } catch (err) {
      console.error("Erreur suppression dépense :", err);
      alert("Erreur suppression dépense : " + (err.message || JSON.stringify(err)));
    }
  }

  // =======================
  // LOAD DATA
  // =======================
  async function loadData() {
    try {
      const { data: colocData, error: colocErr } = await supabase
        .from("colocs")
        .select("*")
        .eq("id", colocId)
        .single();
      if (colocErr) throw colocErr;
      coloc = colocData;

      const { data: usersData, error: usersErr } = await supabase
        .from("users")
        .select("*")
        .eq("colocid", colocId);
      if (usersErr) throw usersErr;

      const { data: expensesData, error: expErr } = await supabase
        .from("expenses")
        .select("*")
        .eq("colocid", colocId);
      if (expErr) throw expErr;

      const { data: settlementsData, error: setErr } = await supabase
        .from("settlements")
        .select("*")
        .eq("colocid", colocId);
      if (setErr) throw setErr;

      const { data: categoriesData, error: catErr } = await supabase
        .from("categories")
        .select("*");
      if (catErr) throw catErr;

      users = usersData || [];
      expenses = expensesData || [];
      settlements = settlementsData || [];
      categories = categoriesData || [];

      init();
    } catch (err) {
      console.error("Erreur loadData :", err);
      alert("Erreur de chargement : " + (err.message || JSON.stringify(err)));
    }
  }

  // =======================
  // INIT + RENDER
  // =======================
  function init() {
    const titleEl = document.getElementById("coloc-title");
    if (titleEl && coloc) titleEl.textContent = coloc.name;

    renderUsers();
    renderCategories();
    renderExpenses();
    renderBalances();
  }

  function renderUsers() {
    usersList.innerHTML = "";
    paidBySelect.innerHTML = "<option selected disabled>— Qui a payé ? —</option>";

    if (!users.length) {
      usersList.innerHTML = "<li class='muted'>Aucun colocataire</li>";
      return;
    }

    users.forEach(u => {
      usersList.innerHTML += `<li>${u.name}</li>`;

      const o = document.createElement("option");
      o.value = u.id;
      o.textContent = u.name;
      paidBySelect.appendChild(o);
    });
  }

  function renderCategories() {
    categorySelect.innerHTML = "<option selected disabled>— Catégorie —</option>";

    if (!categories.length) {
      categorySelect.innerHTML += "<option disabled>Aucune catégorie</option>";
      return;
    }

    categories.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.emoji || ""} ${c.label}`;
      categorySelect.appendChild(o);
    });
  }

  function renderExpenses() {
    expensesList.innerHTML = "";
    const active = getActiveExpenses();

    if (!active.length) {
      expensesList.innerHTML = "<li class='muted'>Aucune dépense en cours</li>";
      return;
    }

    active
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(e => {
        const payer = users.find(u => Number(u.id) === Number(e.paidBy));
        const cat = getCategory(e.categoryId);

        const li = document.createElement("li");
        li.innerHTML = `
          <div class="expense-row">
            <div class="expense-main">
              <div class="expense-title">${e.description}</div>
              <div class="expense-meta">
                ${cat.emoji} ${cat.label} • ${new Date(e.date).toLocaleDateString("fr-FR")} • payé par ${payer?.name || "?"}
              </div>
            </div>

            <div class="expense-amount">${Number(e.amount).toFixed(2)} €</div>

            <button type="button" class="icon-btn danger" aria-label="Supprimer">🗑️</button>
          </div>
        `;

        li.querySelector("button")?.addEventListener("click", () => deleteExpense(e.id));
        expensesList.appendChild(li);
      });
  }

  function renderBalances() {
    balancesList.innerHTML = "";
    if (!users.length) {
      balancesList.innerHTML = "<li class='muted'>Aucun solde</li>";
      return;
    }

    const balances = getBalancesWeighted();

    users.forEach(u => {
      const b = balances[u.id] ?? 0;
      let txt = `${u.name} est à l’équilibre`;
      if (b > 0) txt = `${u.name} doit recevoir ${b.toFixed(2)} €`;
      if (b < 0) txt = `${u.name} doit payer ${Math.abs(b).toFixed(2)} €`;
      balancesList.innerHTML += `<li>${txt}</li>`;
    });
  }

  // =======================
  // AJOUT DÉPENSE
  // =======================
  expenseForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const description = document.getElementById("expense-desc").value.trim();
    const amount = Number(document.getElementById("expense-amount").value);
    const paidBy = Number(paidBySelect.value);
    const categoryId = Number(categorySelect.value);

    if (!description || !amount || !paidBy || !categoryId) {
      alert("Tous les champs sont obligatoires");
      return;
    }

    try {
      const { error } = await supabase.from("expenses").insert([
        {
          colocid: colocId,
          description,
          amount,
          paidBy,
          categoryId,
          date: new Date().toISOString()
        }
      ]);
      if (error) throw error;

      expenseForm.reset();
      await loadData();
    } catch (err) {
      console.error("Erreur insertion dépense :", err);
      alert("Erreur insertion dépense : " + (err.message || JSON.stringify(err)));
    }
  });

  // =======================
  // RÉGULARISATION
  // =======================
  settleBtn?.addEventListener("click", async () => {
    const list = computeSettlements();
    if (!list.length) return alert("✅ Comptes déjà équilibrés");
    if (!confirm("Confirmer la régularisation ?")) return;

    const maxExpenseId = Math.max(0, ...expenses.map(e => Number(e.id)));

    try {
      const rows = list.map(s => ({
        colocid: colocId,
        fromuser: s.fromuser,
        touser: s.touser,
        amount: s.amount,
        date: new Date().toISOString(),
        last_expense_id: maxExpenseId
      }));

      const { error } = await supabase.from("settlements").insert(rows);
      if (error) throw error;

      alert("✅ Régularisation enregistrée");
      await loadData();
    } catch (err) {
      console.error("Erreur régularisation :", err);
      alert("Erreur régularisation : " + (err.message || JSON.stringify(err)));
    }
  });

  // =======================
  // NAVIGATION
  // =======================
  if (budgetBtn) {
    budgetBtn.addEventListener("click", () => {
      window.location.href = `budget.html?id=${colocId}`;
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  // =======================
  // INITIAL LOAD
  // =======================
  loadData();
});
