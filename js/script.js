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
  if (form && feedback) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      feedback.classList.add('success');
      feedback.textContent = "Merci. Cette maquette valide les champs du formulaire, mais l'envoi n'est pas encore connecté. Nous activerons la transmission des demandes lors de la prochaine étape.";
    });
  }
});
