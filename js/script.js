document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');
  if (!form || !feedback) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      nom: String(data.get('nom') || '').trim(),
      prenom: String(data.get('prenom') || '').trim(),
      entreprise: String(data.get('entreprise') || '').trim(),
      email: String(data.get('email') || '').trim(),
      telephone: String(data.get('telephone') || '').trim(),
      type_demande: String(data.get('type_demande') || ''),
      message: String(data.get('message') || '').trim(),
      consentement_rgpd: data.get('consentement_rgpd') === 'oui',
      date_soumission: new Date().toISOString(),
      source: 'Site NexProcessIA',
      website: String(data.get('website') || '')
    };

    const button = form.querySelector('button[type="submit"]');
    const originalButtonText = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi en cours…';
    }
    feedback.classList.remove('success');
    feedback.textContent = '';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Impossible de transmettre votre demande.');
      }
      form.reset();
      feedback.classList.add('success');
      feedback.textContent = 'Merci, votre demande a bien été transmise. Nous reviendrons vers vous prochainement.';
    } catch (error) {
      feedback.textContent = 'Votre demande n’a pas pu être envoyée. Vous pouvez nous contacter à dansinfoservice@gmail.com.';
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalButtonText;
      }
    }
  });
});
