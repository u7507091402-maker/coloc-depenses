document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // PARAMÈTRES
  // ================================
  const params = new URLSearchParams(window.location.search);
  const colocId = Number(params.get("id"));

  if (!colocId) {
    location.href = "index.html";
    return;
  }

  // ================================
  // DATA
  // ================================
  let coloc = null;
  let users = [];
  let expenses = [];
  let categories = [];
  let chart = null;

  // ================================
  // DOM
  // ================================
  const expensesList = document.getElementById("expenses-list");
  const totalBudgetEl = document.getElementById("total-budget");
  const periodSelect = document.getElementById("period-select");
  const dateFromInput = document.getElementById("date-from");
  const dateToInput = document.getElementById("date-to");
  const backBtn = document.getElementById("back-btn");

  // ================================
  // CHARGEMENT DES DONNÉES
  // ================================
  fetch(API_URL)
    .then(r => r.json())
    .then(data => {
      coloc = data.colocs.find(c => Number(c.id) === colocId);
      users = data.users.filter(u => Number(u.colocId) === colocId);
      expenses = data.expenses.filter(e => Number(e.colocId) === colocId);
      categories = data.categories || [];

      if (!coloc) {
        alert("Colocation introuvable");
        location.href = "index.html";
        return;
      }

      init();
    })
    .catch(err => {
      console.error(err);
      alert("Erreur de chargement du budget");
    });

  // ================================
  // CATEGORIES — HELPERS (UNE FOIS)
  // ================================
  function getCategory(categoryId) {
    return categories.find(c => Number(c.id) === Number(categoryId)) || null;
  }

  // ================================
  // INIT
  // ================================
  function init() {
    periodSelect.onchange = () => {
      handlePeriodChange();
      update();
    };

    dateFromInput.onchange = update;
    dateToInput.onchange = update;

    backBtn.onclick = () => {
      location.href = "coloc.html?id=" + colocId;
    };

    handlePeriodChange();
    update();
  }

  // ================================
  // DATES
  // ================================
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  // ================================
  // FILTRE
  // ================================
  function getFilteredExpenses() {
    const now = new Date();
    let from = null;
    let to = null;

    if (periodSelect.value === "month") {
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }

    if (periodSelect.value === "year") {
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      to = endOfDay(new Date(now.getFullYear(), 11, 31));
    }

    if (periodSelect.value === "custom") {
      if (!dateFromInput.value || !dateToInput.value) return [];
      from = startOfDay(new Date(dateFromInput.value));
      to = endOfDay(new Date(dateToInput.value));
    }

    return expenses.filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    });
  }

  // ================================
  // RENDER — LISTE
  // ================================
  function renderExpenses(list) {
    expensesList.innerHTML = "";

    if (list.length === 0) {
      expensesList.innerHTML = "<li>Aucune dépense</li>";
      return;
    }

    list
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(exp => {

        const user = users.find(u => u.id === exp.paidBy);

        const category = getCategory(exp.categoryId);
        const catLabel = category ? category.label : "Inconnu";
        const catEmoji = category ? category.emoji : "";
        const catColor = category ? category.color : "#999";

        const li = document.createElement("li");

        li.innerHTML = `
          <strong>${exp.description}</strong><br>
          ${exp.amount.toFixed(2)} € —
          <span style="color:${catColor}">
            ${catEmoji} ${catLabel}
          </span><br>
          ${new Date(exp.date).toLocaleDateString("fr-FR")}
          — payé par ${user ? user.name : "?"}
        `;

        expensesList.appendChild(li);
      });
  }

  // ================================
  // RENDER — CHART
  // ================================
  function renderChart(list) {
    const byCat = {};

    list.forEach(exp => {
      const category = getCategory(exp.categoryId);
      if (!category) return;

      byCat[category.label] = (byCat[category.label] || 0) + exp.amount;
    });

    if (chart) chart.destroy();

    const labels = Object.keys(byCat);
    if (!labels.length) return;

    chart = new Chart(
      document.getElementById("category-chart"),
      {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data: Object.values(byCat)
            }
          ]
        }
      }
    );
  }

  // ================================
  // UPDATE
  // ================================
  function update() {
    const list = getFilteredExpenses();

    const total = list.reduce((s, e) => s + e.amount, 0);
    totalBudgetEl.textContent = total.toFixed(2) + " €";

    renderExpenses(list);
    renderChart(list);
  }

  // ================================
  // UI
  // ================================
  function handlePeriodChange() {
    const custom = periodSelect.value === "custom";
    dateFromInput.style.display = custom ? "block" : "none";
    dateToInput.style.display = custom ? "block" : "none";
  }

});
