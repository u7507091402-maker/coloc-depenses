// ================================
// API SUPABASE – VERSION NAVIGATEUR
// ================================

let supabaseClient = null;

// Initialisation du client depuis index.js
function initApi(client) {
  supabaseClient = client;
}

// GET : table ou filtre simple
function apiGet(table, filter = {}) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  let query = supabaseClient.from(table).select("*");
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  return query.then(res => {
    if (res.error) throw res.error;
    return res.data;
  });
}

// POST / INSERT
function apiPost(table, payload) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");
  if (!Array.isArray(payload)) payload = [payload];

  return supabaseClient.from(table).insert(payload).select().then(res => {
    if (res.error) throw res.error;
    return res.data;
  });
}

// DELETE
function apiDelete(table, filter) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  let query = supabaseClient.from(table).delete();
  Object.entries(filter).forEach(([key, value]) => query = query.eq(key, value));

  return query.then(res => {
    if (res.error) throw res.error;
    return true;
  });
}

// UPDATE
function apiUpdate(table, values, filter) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  let query = supabaseClient.from(table).update(values);
  Object.entries(filter).forEach(([key, value]) => query = query.eq(key, value));

  return query.select().then(res => {
    if (res.error) throw res.error;
    return res.data;
  });
}

// ================================
// rendre les fonctions globales
// ================================
window.initApi = initApi;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiDelete = apiDelete;
window.apiUpdate = apiUpdate;
