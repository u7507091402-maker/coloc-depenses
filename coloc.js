document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // CONFIG
  // ================================
  const params = new URLSearchParams(window.location.search);
  const colocId = Number(params.get("id"));

  if (!colocId) {
    alert("Colocation non sélectionnée");
    location.href = "index.html";
    return;
  }

  // ================================
  // DATA
  // ================================
  let coloc = null;
  let users = [];
  let expenses = [];
  let settlements = [];
  let categories = [];

  // ================================
  // DOM
  // ================================
  const usersList      = document.getElementById("users-list");
  const expensesList   = document.getElementById("expenses-list");
  const balancesList   = document.getElementById("balances-list");
  const paidBySelect   = document.getElementById("paid-by");
  const categorySelect = document.getElementById("expense-category");
  const expenseForm    = document.getElementById("expense-form");
  const settleBtn      = document.getElementById("settle-btn");

  // ================================
  // LOAD DATA
  // ================================
  async function loadData() {
    try {
      const res = await fetch(`${API_URL}?action=getColoc&id=${colocId}`);
      const data = await res.json();

      coloc       = data.coloc;
      users       = data.users || [];
      expenses    = data.expenses || [];
      settlements = data.settlements || [];
      categories  = data.categories || [];

      if (!coloc) {
        alert("Colocation introuvable");
        location.href = "index.html";
        return;
      }

      init();
    } catch (e) {
      console.error(e);
      alert("Erreur de chargement");
    }
  }

  // ================================
  // INIT
  // ================================
  function init() {
    document.getElementById("coloc-title").textContent = coloc.name;
    renderUsers();
    renderCategories();
    renderExpenses();
    renderBalances();
  }

  // ================================
  // USERS
  // ================================
  function renderUsers() {
    usersList.innerHTML = "";
    paidBySelect.innerHTML = "";

    const ph = document.createElement("option");
    ph.textContent = "— Qui a payé ? —";
    ph.disabled = true;
    ph.selected = true;
    paidBySelect.appendChild(ph);

    users.forEach(u => {
      usersList.innerHTML += `<li>${u.name}</li>`;

      const o = document.createElement("option");
      o.value = u.id;
      o.textContent = u.name;
      paidBySelect.appendChild(o);
    });
  }

  // ================================
  // CATEGORIES
  // ================================
  function renderCategories() {
    categorySelect.innerHTML = "";

    const ph = document.createElement("option");
    ph.textContent = "— Catégorie —";
    ph.disabled = true;
    ph.selected = true;
    categorySelect.appendChild(ph);

    categories.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.emoji} ${c.label}`;
      categorySelect.appendChild(o);
    });
  }

  function getCategory(id) {
    return categories.find(c => Number(c.id) === Number(id));
  }

  // ================================
  // EXPENSES ACTIVES (NON SOLDÉES)
  // ================================
  function getActiveExpenses() {
    if (!settlements.length) return expenses;

    const lastSettlementDate = new Date(
      Math.max(...settlements.map(s => new Date(s.date).getTime()))
    );

    return expenses.filter(e => new Date(e.date) > lastSettlementDate);
  }

  function renderExpenses() {
    expensesList.innerHTML = "";

    const activeExpenses = getActiveExpenses();

    if (!activeExpenses.length) {
      expensesList.innerHTML = "<li>Aucune dépense en cours</li>";
      return;
    }

    activeExpenses
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .forEach(e => {
        const payer = users.find(u => u.id == e.paidBy);
        const cat = getCategory(e.categoryId);

        expensesList.innerHTML += `
          <li>
            <strong>${e.description}</strong><br>
            ${Number(e.amount).toFixed(2)} € —
            ${cat?.emoji || "❓"} ${cat?.label || "Inconnue"}<br>
            ${new Date(e.date).toLocaleDateString("fr-FR")}
            — payé par ${payer?.name || "?"}
          </li>
        `;
      });
  }

  // ================================
  // SOLDES RÉELS (VERSION FINALE)
  // ================================
  function getRealBalances() {
    const balances = {};
    users.forEach(u => balances[u.id] = 0);

    const activeExpenses = getActiveExpenses();
    if (!activeExpenses.length) return balances;

    const total = activeExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const share = total / users.length;

    users.forEach(u => {
      const paid = activeExpenses
        .filter(e => Number(e.paidBy) === Number(u.id))
        .reduce((s, e) => s + Number(e.amount), 0);

      balances[u.id] = Math.round((paid - share) * 100) / 100;
    });

    return balances;
  }

  function renderBalances() {
    balancesList.innerHTML = "";
    const balances = getRealBalances();

    users.forEach(u => {
      const b = balances[u.id];
      let txt = `${u.name} est à l’équilibre`;

      if (b > 0) txt = `${u.name} doit recevoir ${b.toFixed(2)} €`;
      if (b < 0) txt = `${u.name} doit payer ${Math.abs(b).toFixed(2)} €`;

      balancesList.innerHTML += `<li>${txt}</li>`;
    });
  }

  // ================================
  // CALCUL DES RÉGULARISATIONS
  // ================================
  function computeSettlements() {
    const balances = getRealBalances();

    const debtors = users
      .filter(u => balances[u.id] < 0)
      .map(u => ({ id: u.id, balance: balances[u.id] }));

    const creditors = users
      .filter(u => balances[u.id] > 0)
      .map(u => ({ id: u.id, balance: balances[u.id] }));

    const result = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(-d.balance, c.balance);

      result.push({
        fromUser: d.id,
        toUser: c.id,
        amount: Math.round(amount * 100) / 100
      });

      d.balance += amount;
      c.balance -= amount;

      if (Math.abs(d.balance) < 0.01) i++;
      if (Math.abs(c.balance) < 0.01) j++;
    }

    return result;
  }

  // ================================
  // AJOUT DÉPENSE
  // ================================
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

    await apiPost("createExpense", {
      colocId,
      description,
      amount,
      paidBy,
      categoryId,
      date: new Date().toISOString()
    });

    expenseForm.reset();
    loadData();
  });

  // ================================
  // RÉGULARISATION
  // ================================
  settleBtn?.addEventListener("click", async () => {
    const list = computeSettlements();

    if (!list.length) {
      alert("✅ Comptes déjà équilibrés");
      return;
    }

    if (!confirm("Confirmer la régularisation ?")) return;

    for (const s of list) {
      await apiPost("createSettlement", {
        colocId,
        fromUser: s.fromUser,
        toUser: s.toUser,
        amount: s.amount
      });
    }

    alert("✅ Régularisation enregistrée");
    loadData();
  });

  // ================================
  // NAVIGATION
  // ================================
  document.getElementById("budget-btn")?.addEventListener("click", () => {
    location.href = `budget.html?id=${colocId}`;
  });

  console.log("✅ coloc.js FINAL — soldes fiables");
  loadData();
});
