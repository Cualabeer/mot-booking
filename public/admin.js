document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const password = document.getElementById('adminPassword').value;
  const res = await fetch('/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password})});
  if(res.ok){ document.getElementById('loginDiv').style.display='none'; document.getElementById('dashboard').style.display='block'; loadBookings();}
  else alert('Login failed');
});

async function loadBookings(){
  const res = await fetch('/bookings');
  const data = await res.json();
  const list = document.getElementById('bookingsList');
  list.innerHTML='';
  data.forEach(b=>{ const li=document.createElement('li'); li.textContent=JSON.stringify(b); list.appendChild(li); });
}

document.getElementById('refreshBtn').addEventListener('click', loadBookings);
