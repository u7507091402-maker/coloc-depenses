// auth-claim.js
async function claimInvitesForCurrentUser(supabase) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userRes?.user;
  if (!user) return { claimed: 0 };

  const email = (user.email || "").trim().toLowerCase();
  if (!email) return { claimed: 0 };

  // 1) Chercher les invites non réclamées pour cet email
  const { data: invites, error: invErr } = await supabase
    .from("invites")
    .select("id, colocid, role")
    .is("claimed_at", null)
    .ilike("email", email);

  if (invErr) throw invErr;
  if (!invites?.length) return { claimed: 0 };

  // 2) Pour chaque invite : ajouter dans coloc_members + lier public.users.auth_user_id + marquer l'invite claim
  for (const inv of invites) {
    // 2a) Ajouter membership (ignore si déjà présent)
    const { error: memErr } = await supabase
      .from("coloc_members")
      .insert([{ colocid: inv.colocid, user_id: user.id, role: inv.role || "member" }]);

    // Si "duplicate key", Supabase renvoie une erreur -> on l’ignore proprement
    if (memErr && !String(memErr.message || "").toLowerCase().includes("duplicate")) {
      throw memErr;
    }

    // 2b) Lier la ligne "public.users" existante (celle qui a le même email dans cette coloc)
    // Important: on ne touche qu'à la coloc de l'invite
    const { error: linkErr } = await supabase
      .from("users")
      .update({ auth_user_id: user.id })
      .eq("colocid", inv.colocid)
      .ilike("email", email);

    // Si pas de ligne trouvée, ce n’est pas bloquant (tu peux avoir des colocs sans correspondance)
    if (linkErr) throw linkErr;

    // 2c) Marquer l’invite comme "claim"
    const { error: claimErr } = await supabase
      .from("invites")
      .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
      .eq("id", inv.id);

    if (claimErr) throw claimErr;
  }

  return { claimed: invites.length };
}
