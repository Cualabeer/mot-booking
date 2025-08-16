const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(express.json());
app.use(session({
  secret: 'replace-with-strong-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // must be false if not using HTTPS
}));

const db = new sqlite3.Database('./mot.db');

// Ensure admin table exists
db.run(`CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
)`);

// Admin login / first-run setup
app.post('/admin/login', async (req, res) => {
  const { email, password, setEmail, setPassword } = req.body;

  db.get("SELECT * FROM admin LIMIT 1", async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!row) {
      // First-run setup
      if (!setEmail || !setPassword)
        return res.status(400).json({ error: 'No admin exists. Provide setEmail and setPassword.' });

      const hash = await bcrypt.hash(setPassword, 10);
      db.run("INSERT INTO admin (email, password_hash) VALUES (?, ?)", [setEmail, hash], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        req.session.admin = true;
        return res.json({ success: true, firstRun: true });
      });
    } else {
      // Normal login
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (email !== row.email) return res.status(401).json({ error: 'Invalid email or password' });

      const match = await bcrypt.compare(password, row.password_hash);
      if (match) {
        req.session.admin = true;
        return res.json({ success: true, firstRun: false });
      } else return res.status(401).json({ error: 'Invalid email or password' });
    }
  });
});

// Check login status
app.get('/admin/status', (req, res) => {
  res.json({ loggedIn: !!req.session.admin });
});

// Logout route (updated)
app.post('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, error: 'Could not logout' });
    res.clearCookie('connect.sid', { path: '/' });
    return res.json({ success: true });
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));