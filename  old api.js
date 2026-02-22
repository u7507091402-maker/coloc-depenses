// ================================
// API SUPABASE
// ================================
let supabaseClient = null;

// Initialise le client depuis index.js / coloc.js / budget.js
export function initApi(client) {
  supabaseClient = client;
}

// GET : table ou action spécifique
export async function apiGet(table, filter = {}) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");
  
  let query = supabaseClient.from(table).select("*");

  // Appliquer filtre simple {colocid: 1}
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// POST / INSERT
export async function apiPost(table, payload) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  const { data, error } = await supabaseClient.from(table).insert(payload).select();
  if (error) throw error;
  return data;
}

// DELETE
export async function apiDelete(table, filter) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  let query = supabaseClient.from(table).delete();
  Object.entries(filter).forEach(([key, value]) => query = query.eq(key, value));

  const { error } = await query;
  if (error) throw error;
  return true;
}

// UPDATE
export async function apiUpdate(table, values, filter) {
  if (!supabaseClient) throw new Error("Supabase non initialisé");

  let query = supabaseClient.from(table).update(values);
  Object.entries(filter).forEach(([key, value]) => query = query.eq(key, value));

  const { error, data } = await query.select();
  if (error) throw error;
  return data;
}
