document.addEventListener('DOMContentLoaded', () => {
  const formContainer = document.getElementById('adminFormContainer');
  const dashboard = document.getElementById('dashboard');

  async function showDashboard() {
    formContainer.style.display = 'none';
    dashboard.style.display = 'block';
    loadBookings();
  }

  async function loadBookings() {
    try {
      const res = await fetch('/bookings', { credentials: 'include' });
      const bookings = await res.json();
      const tbody = document.querySelector('#bookingsTable tbody');
      tbody.innerHTML = '';
      bookings.forEach(b=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${b.id}</td><td>${b.name}</td><td>${b.email}</td><td>${b.phone}</td>
          <td>${b.vehicle_reg}</td><td>${b.date}</td><td>${b.time_slot}</td><td>${b.bay}</td>
          <td>${b.garageId}</td><td>${b.status}</td>
          <td><button onclick="cancelBooking(${b.id})">Cancel</button></td>`;
        tbody.appendChild(tr);
      });
    } catch(err){ console.error(err); }
  }

  window.cancelBooking = async (id)=>{
    if(!confirm('Cancel this booking?')) return;
    try{
      const res = await fetch(`/bookings/${id}`, { method:'DELETE', credentials:'include' });
      const data = await res.json();
      if(res.ok) loadBookings();
      else alert(data.error);
    } catch(err){ alert(err.message); }
  };

  async function isFirstTime(){
    try {
      const test = await fetch('/admin/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({})});
      if(test.status===400) showLoginForm(true);
      else showLoginForm(false);
    } catch(err){ showLoginForm(false); }
  }

  function showLoginForm(firstTime){
    formContainer.innerHTML='';
    const title = document.createElement('h2');
    title.innerText = firstTime ? 'Set Admin Password' : 'Admin Login';
    formContainer.appendChild(title);

    const form = document.createElement('form');
    form.id='adminForm';
    form.innerHTML=`<input type="password" id="password" placeholder="${firstTime?'Set password':'Password'}" required>
      <button type="submit">${firstTime?'Set Password':'Login'}</button>`;
    formContainer.appendChild(form);

    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const pwd=document.getElementById('password').value.trim();
      if(!pwd) return alert('Password required');
      try{
        const payload = firstTime? {setPassword:pwd}:{password:pwd};
        const res = await fetch('/admin/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), credentials:'include' });
        const data = await res.json();
        if(res.ok) showDashboard();
        else alert(data.error);
      } catch(err){ alert(err.message); }
    });
  }

  isFirstTime();
});