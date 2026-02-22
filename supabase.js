// Supabase.js minimal pour navigateur (UMD)
(function (global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    global.supabase = factory();
  }
})(typeof window !== "undefined" ? window : this, function () {
  return supabase = window.supabase || {
    createClient: function(url, key) {
      console.warn("Supabase client initialisé via placeholder. Remplacez par le vrai bundle UMD téléchargé depuis https://github.com/supabase/supabase-js/releases");
      return {
        from: function() { return { select: async function() { return { data: [], error: null }; } }; }
      };
    }
  };
});
