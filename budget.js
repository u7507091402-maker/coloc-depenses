document.addEventListener("DOMContentLoaded", async () => {
  // =======================
  // SUPABASE (UMD comme index/coloc)
  // =======================
  const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";

  if (!window.supabase?.createClient) {
    alert("Supabase UMD non chargé (script supabase.min.js manquant)");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  initApi(supabaseClient);

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
  // DOM
  // =======================
  const expensesList = document.getElementById("expenses-list");
  const totalBudgetEl = document.getElementById("total-budget");
  const categoryChartEl = document.getElementById("category-chart");
  const periodSelect = document.getElementById("period-select");
  const dateFromInput = document.getElementById("date-from");
  const dateToInput = document.getElementById("date-to");
  const backBtn = document.getElementById("back-btn");

  // =======================
  // STATE
  // =======================
  let expenses = [];
  let categories = [];
  let chart = null;

  // =======================
  // HELPERS
  // =======================
  function getCategory(categoryId) {
    return categories.find(c => Number(c.id) === Number(categoryId)) || null;
  }

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

  function handlePeriodChange() {
    const custom = periodSelect?.value === "custom";
    if (dateFromInput) dateFromInput.style.display = custom ? "block" : "none";
    if (dateToInput) dateToInput.style.display = custom ? "block" : "none";
  }

  function getFilteredExpenses() {
    const now = new Date();
    let from = null;
    let to = null;

    const period = periodSelect?.value || "month";

    if (period === "month") {
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }

    if (period === "year") {
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      to = endOfDay(new Date(now.getFullYear(), 11, 31));
    }

    if (period === "custom") {
      if (!dateFromInput?.value || !dateToInput?.value) return [];
      from = startOfDay(new Date(dateFromInput.value));
      to = endOfDay(new Date(dateToInput.value));
    }

    return expenses.filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    });
  }

  function renderExpenses(list) {
    if (!expensesList) return;

    expensesList.innerHTML = "";

    if (!list.length) {
      expensesList.innerHTML = `<li class="muted">Aucune dépense</li>`;
      return;
    }

    list
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(e => {
        const cat = getCategory(e.categoryId) || { label: "Inconnu", emoji: "❓", color: "#999" };

        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${e.description}</strong><br>
          ${Number(e.amount).toFixed(2)} € —
          <span style="color:${cat.color || "#999"}">${cat.emoji || ""} ${cat.label}</span><br>
          ${new Date(e.date).toLocaleDateString("fr-FR")}
        `;
        expensesList.appendChild(li);
      });
  }

  function renderChart(list) {
    if (!categoryChartEl || !window.Chart) return;

    const byCat = {};
    list.forEach(e => {
      const cat = getCategory(e.categoryId);
      if (!cat) return;
      byCat[`${cat.emoji || ""} ${cat.label}`.trim()] =
        (byCat[`${cat.emoji || ""} ${cat.label}`.trim()] || 0) + Number(e.amount);
    });

    if (chart) {
      chart.destroy();
      chart = null;
    }

    const labels = Object.keys(byCat);
    if (!labels.length) return;

    chart = new Chart(categoryChartEl, {
      type: "pie",
      data: {
        labels,
        datasets: [{ data: Object.values(byCat) }]
      }
    });
  }

  function update() {
    const list = getFilteredExpenses();
    const total = list.reduce((s, e) => s + Number(e.amount), 0);

    if (totalBudgetEl) totalBudgetEl.textContent = total.toFixed(2) + " €";

    renderExpenses(list);
    renderChart(list);
  }

  // =======================
  // LOAD DATA
  // =======================
  async function loadData() {
    try {
      expenses = await apiGet("expenses", { colocid: colocId }) || [];
      categories = await apiGet("categories") || [];

      handlePeriodChange();
      update();
    } catch (err) {
      console.error(err);
      alert("Erreur chargement budget : " + (err.message || JSON.stringify(err)));
    }
  }

  // =======================
  // EVENTS
  // =======================
  if (periodSelect) periodSelect.onchange = () => { handlePeriodChange(); update(); };
  if (dateFromInput) dateFromInput.onchange = update;
  if (dateToInput) dateToInput.onchange = update;

  if (backBtn) {
    backBtn.onclick = () => {
      location.href = `coloc.html?id=${colocId}`;
    };
  }

  // =======================
  // GO
  // =======================
  await loadData();
  console.log("✅ budget.js (UMD) chargé");
});
