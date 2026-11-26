const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

export async function onRequestPost({ request, env }) {
  if (!env.MAKE_WEBHOOK_URL) {
    return json({ success: false, error: "Service temporairement indisponible." }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ success: false, error: "Format de requête invalide." }, 415);
  }

  const raw = await request.text();
  if (raw.length > 12000) {
    return json({ success: false, error: "Demande trop volumineuse." }, 413);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ success: false, error: "Données invalides." }, 400);
  }

  // Champ piège anti-robots : un formulaire humain le laisse vide.
  if (typeof data.website === "string" && data.website.trim() !== "") {
    return json({ success: true });
  }

  const required = ["nom", "prenom", "email", "type_demande", "message"];
  if (required.some(key => typeof data[key] !== "string" || !data[key].trim())) {
    return json({ success: false, error: "Certains champs obligatoires sont manquants." }, 400);
  }
  if (data.consentement_rgpd !== true) {
    return json({ success: false, error: "Le consentement est requis." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      data.email.length > 254 ||
      data.message.length > 5000) {
    return json({ success: false, error: "Certaines informations sont invalides." }, 400);
  }

  const payload = {
    nom: data.nom.trim().slice(0, 120),
    prenom: data.prenom.trim().slice(0, 120),
    entreprise: String(data.entreprise || "").trim().slice(0, 200),
    email: data.email.trim().slice(0, 254),
    telephone: String(data.telephone || "").trim().slice(0, 40),
    type_demande: data.type_demande.trim().slice(0, 120),
    message: data.message.trim(),
    consentement_rgpd: true,
    date_soumission: new Date().toISOString(),
    source: "Site NexProcessIA"
  };

  try {
    const upstream = await fetch(env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!upstream.ok) {
      return json({ success: false, error: "Transmission momentanément indisponible." }, 502);
    }
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Transmission momentanément indisponible." }, 502);
  }
}
