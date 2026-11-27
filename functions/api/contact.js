const MAX_BODY_BYTES = 12000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000"
    }
  });

async function readBodyWithLimit(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new RangeError("body_too_large");
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const cleanText = (value, maxLength) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);

export async function onRequestPost({ request, env }) {
  // Refuse les appels navigateur provenant d'une autre origine.
  // Les appels serveur-à-serveur sans en-tête Origin restent possibles.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ success: false, error: "Origine de requête non autorisée." }, 403);
      }
    } catch {
      return json({ success: false, error: "Origine de requête invalide." }, 403);
    }
  }

  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json({ success: false, error: "Format de requête invalide." }, 415);
  }

  let raw;
  try {
    raw = await readBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return json({ success: false, error: "Demande trop volumineuse." }, 413);
    }
    return json({ success: false, error: "Impossible de lire la demande." }, 400);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ success: false, error: "Données invalides." }, 400);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ success: false, error: "Format de données invalide." }, 400);
  }

  // Champ piège anti-robots : un formulaire humain le laisse vide.
  if (typeof data.website === "string" && data.website.trim() !== "") {
    return json({ success: true });
  }

  if (!env.MAKE_WEBHOOK_URL) {
    return json({ success: false, error: "Service temporairement indisponible." }, 503);
  }

  const required = ["nom", "prenom", "email", "type_demande", "message"];
  if (required.some(key => typeof data[key] !== "string" || !data[key].trim())) {
    return json({ success: false, error: "Certains champs obligatoires sont manquants." }, 400);
  }

  if (data.consentement_rgpd !== true) {
    return json({ success: false, error: "Le consentement est requis." }, 400);
  }

  if (data.telephone !== undefined && data.telephone !== null && typeof data.telephone !== "string") {
    return json({ success: false, error: "Le numéro de téléphone est invalide." }, 400);
  }
  if (data.entreprise !== undefined && data.entreprise !== null && typeof data.entreprise !== "string") {
    return json({ success: false, error: "Le nom de l'entreprise est invalide." }, 400);
  }

  const nom = cleanText(data.nom, 120);
  const prenom = cleanText(data.prenom, 120);
  const entreprise = cleanText(typeof data.entreprise === "string" ? data.entreprise : "", 200);
  const email = cleanText(data.email, 254);
  const telephone = cleanText(typeof data.telephone === "string" ? data.telephone : "", 16);
  const typeDemande = cleanText(data.type_demande, 120);
  const message = cleanText(data.message, 5000);

  if (!nom || !prenom || !typeDemande || !message ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (telephone && !/^\+[1-9]\d{6,14}$/.test(telephone))) {
    return json({ success: false, error: "Certaines informations sont invalides." }, 400);
  }

  const payload = {
    nom,
    prenom,
    entreprise,
    email,
    telephone,
    type_demande: typeDemande,
    message,
    consentement_rgpd: true,
    date_soumission: new Date().toISOString(),
    source: "Site NexProcessIA"
  };

  try {
    const upstream = await fetch(env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) {
      return json({ success: false, error: "Transmission momentanément indisponible." }, 502);
    }
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Transmission momentanément indisponible." }, 502);
  }
}
