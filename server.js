// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1); // for secure cookies behind proxy

app.use(session({
  secret: 'supersecretkey', // replace with strong secret
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true }
}));

// Rate limiters
const customerLimiter = rateLimit({ windowMs: 60*1000, max: 20 });
const adminLimiter = rateLimit({ windowMs: 60*1000, max: 5 });

// Connect to DB
const db = new sqlite3.Database('./bookings.db', err => {
  if(err) console.error(err);
  else console.log('Connected to SQLite');
});

// Auto-check and initialize DB
db.serialize(() => {
  // Garages table
  db.run(`
    CREATE TABLE IF NOT EXISTS garages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bay_count INTEGER NOT NULL
    )
  `);

  // Insert default garage if none
  db.get("SELECT COUNT(*) AS count FROM garages", (err, row) => {
    if(!err && row.count === 0) {
      db.run("INSERT INTO garages (name, bay_count) VALUES (?, ?)", ["Main MOT Garage", 2]);
    }
  });

  // Bookings table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_reg TEXT NOT NULL,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      bay INTEGER NOT NULL,
      garageId INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      FOREIGN KEY(garageId) REFERENCES garages(id)
    )
  `);
});

// Admin password hash (replace with your own)
const ADMIN_PASSWORD_HASH = '$2b$10$kYz3...';

// Admin authentication middleware
function isAdmin(req, res, next) {
  if(req.session.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Routes
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','customer.html')));
app.get('/admin', isAdmin, (req,res) => res.sendFile(path.join(__dirname,'public','admin.html')));

// Admin login
app.post('/admin/login', adminLimiter, async (req,res) => {
  const { password } = req.body;
  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if(match) { req.session.admin=true; return res.json({success:true}); }
  res.status(401).json({error:'Invalid password'});
});

// Get bookings (admin only)
app.get('/bookings', isAdmin, (req,res) => {
  db.all("SELECT * FROM bookings", (err, rows) => {
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Customer booking
app.post('/book', customerLimiter, [
  body('name').isLength({ min:1,max:100 }).trim(),
  body('email').isEmail(),
  body('phone').matches(/^[0-9+ ]+$/),
  body('vehicle_reg').isLength({ min:5,max:10 }).trim(),
  body('date').isISO8601(),
  body('time_slot').matches(/^\d{2}:\d{2}$/),
  body('garageId').isInt()
], (req,res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name,email,phone,vehicle_reg,date,time_slot,garageId } = req.body;

  db.get("SELECT * FROM garages WHERE id=?", [garageId], (err, garage) => {
    if(err) return res.status(500).json({ error: err.message });
    if(!garage) return res.status(400).json({ error:'Garage not found' });

    db.all("SELECT bay FROM bookings WHERE date=? AND time_slot=? AND status!='cancelled' AND garageId=?",
      [date,time_slot,garageId], (err, rows) => {
        if(err) return res.status(500).json({ error:err.message });

        const bookedBays = rows.map(r=>r.bay);
        let assignedBay = null;
        for(let i=1;i<=garage.bay_count;i++){
          if(!bookedBays.includes(i)){ assignedBay=i; break; }
        }
        if(!assignedBay) return res.status(400).json({error:'No bay available'});

        db.run("INSERT INTO bookings (name,email,phone,vehicle_reg,date,time_slot,bay,garageId) VALUES (?,?,?,?,?,?,?,?)",
          [name,email,phone,vehicle_reg,date,time_slot,assignedBay,garageId],
          function(err){
            if(err) return res.status(500).json({error:err.message});
            res.json({success:true, id:this.lastID, bay:assignedBay});
          });
      });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));