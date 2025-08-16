document.addEventListener('DOMContentLoaded', () => {
  const formContainer = document.getElementById('adminFormContainer');

  async function checkAdmin() {
    try {
      const res = await fetch('/bookings', { method: 'GET', credentials: 'include' });
      if (res.status === 401) {
        // Admin not logged in, show login form
        showLoginForm(false);
      } else {
        // Already logged in, redirect to dashboard
        window.location.href = '/admin';
      }
    } catch (err) {
      console.error('Error checking admin:', err);
    }
  }

  function showLoginForm(firstTime) {
    formContainer.innerHTML = '';
    const title = document.createElement('h2');
    title.innerText = firstTime ? 'Set Admin Password' : 'Admin Login';
    formContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = 'adminForm';
    form.innerHTML = `
      <input type="password" id="password" placeholder="${firstTime ? 'Set password' : 'Password'}" required>
      <button type="submit">${firstTime ? 'Set Password' : 'Login'}</button>
    `;
    formContainer.appendChild(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('password').value.trim();
      if (!pwd) return alert('Password required');

      try {
        const payload = firstTime ? { setPassword: pwd } : { password: pwd };
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        const data = await res.json();
        if (res.ok) {
          alert(data.message || 'Login successful!');
          window.location.href = '/admin';
        } else {
          alert(data.error || 'Error logging in');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // First, check if admin exists
  async function isFirstTime() {
    try {
      const res = await fetch('/bookings', { method: 'GET', credentials: 'include' });
      if (res.status === 401) {
        // 401 could be first-time setup or just not logged in
        // We try posting empty password to detect first-time
        const test = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          credentials: 'include'
        });
        if (test.status === 400) {
          // No admin exists, first-time setup
          showLoginForm(true);
        } else {
          showLoginForm(false);
        }
      } else {
        window.location.href = '/admin';
      }
    } catch (err) {
      console.error(err);
      showLoginForm(false);
    }
  }

  isFirstTime();
});