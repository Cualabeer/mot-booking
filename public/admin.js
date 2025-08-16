document.addEventListener('DOMContentLoaded', async () => {
  const formContainer = document.getElementById('adminFormContainer');
  const dashboard = document.getElementById('dashboard');

  // Show dashboard
  function showDashboard() {
    formContainer.style.display = 'none';
    dashboard.style.display = 'block';
    loadBookings();
  }

  // Placeholder for bookings load
  async function loadBookings() {
    // Your existing code to fetch and populate bookings
  }

  // Check if already logged in
  async function checkLoginStatus() {
    try {
      const res = await fetch('/admin/status', { credentials: 'include' });
      const data = await res.json();
      if (data.loggedIn) showDashboard();
      else checkFirstRun();
    } catch (err) {
      checkFirstRun();
    }
  }

  // Check if first-run setup required
  async function checkFirstRun() {
    try {
      // Call login endpoint with empty body to detect first-run
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // 400 = first-run required
      if (res.status === 400) showLoginForm(true);
      else showLoginForm(false);
    } catch (err) {
      showLoginForm(false);
    }
  }

  // Show login / first-run form
  function showLoginForm(firstTime) {
    formContainer.innerHTML = '';
    const title = document.createElement('h2');
    title.innerText = firstTime ? 'Set Admin Email & Password' : 'Admin Login';
    formContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = 'adminForm';

    form.innerHTML = `
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">${firstTime ? 'Set Account' : 'Login'}</button>
    `;

    formContainer.appendChild(form);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const pwd = document.getElementById('password').value.trim();

      if (!email || !pwd) return alert('Email and password required');

      const payload = firstTime
        ? { setEmail: email, setPassword: pwd }
        : { email: email, password: pwd };

      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        const data = await res.json();
        if (data.success) showDashboard();
        else alert(data.error || 'Login failed');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  checkLoginStatus();
});