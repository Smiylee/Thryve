const toggle = document.getElementById('togglePassword');
if (toggle) {
  toggle.addEventListener('click', () => {
    const input = document.getElementById('password');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(visible));
  });
}
