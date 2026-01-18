// ================================
// API CONFIG
// ================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbwZkgp2-nlESxHQIfSLeoDULJ6yMxDOeNo3TxVi-YJ6r0ZbYP8NrHhOa2d2OhvsqexN/exec";

// ================================
// GET ALL (index)
// ================================

function apiGetAll() {
  return fetch(API_URL)
    .then(res => {
      if (!res.ok) throw new Error("Erreur réseau");
      return res.json();
    });
}

// ================================
// GET CIBLÉ
// ================================

function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("Erreur réseau");
      return res.json();
    });
}
// ================================
// POST (SANS JSON, SANS CORS)
// ================================
function apiPost(action, data = {}) {
  const formData = new URLSearchParams();
  formData.set("action", action);

  Object.entries(data).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return fetch(API_URL, {
    method: "POST",
    body: formData
  })
  .then(async res => {
    if (!res.ok) throw new Error("Erreur réseau");

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Réponse API non JSON :", text);
      throw new Error("Réponse API invalide");
    }
  });
}
