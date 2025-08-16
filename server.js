const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

app.use(session({
  secret: 'supersecretkey', 
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true }
}));

// Rate limiters
const customerLimiter = rateLimit({ windowMs: 60*1000, max: 20 });
const adminLimiter = rateLimit({ windowMs: 60*1000, max: 5 });

// SQLite DB
const db = new sqlite3.Database('./bookings.db', err => {
  if(err) console.error(err);
  else console.log('Connected to SQLite');
});

// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS garages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bay_count INTEGER NOT NULL
  )`);
  db.get("SELECT COUNT(*) AS count FROM garages", (err, row) => {
    if(!err && row.count === 0) {
      db.run("INSERT INTO garages (name, bay_count) VALUES (?, ?)", ["Main MOT Garage", 2]);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password_hash TEXT NOT NULL
  )`);

  db.get("SELECT COUNT(*) AS count FROM admin", (err,row)=>{
    if(!err && row.count===0){
      console.log('No admin password set. First user must set password.');
    }
  });
});

// Admin auth middleware
function isAdmin(req, res, next){
  if(req.session.admin) return next();
  res.status(401).json({error:'Unauthorized'});
}

// Routes
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','customer.html')));
app.get('/admin', (req,res) => res.sendFile(path.join(__dirname,'public','admin.html')));

// Admin login / first-time setup
app.post('/admin/login', adminLimiter, async (req,res)=>{
  const { password, setPassword } = req.body;
  db.get("SELECT * FROM admin LIMIT 1", async (err,row)=>{
    if(err) return res.status(500).json({error:err.message});
    if(!row){
      if(!setPassword) return res.status(400).json({error:'No admin exists. Provide setPassword to initialize.'});
      const hash = await bcrypt.hash(setPassword,10);
      db.run("INSERT INTO admin (password_hash) VALUES (?)",[hash],function(err){
        if(err) return res.status(500).json({error:err.message});
        req.session.admin = true;
        return res.json({success:true, message:'Admin password set!'});
      });
    } else {
      if(!password) return res.status(400).json({error:'Password required'});
      const match = await bcrypt.compare(password,row.password_hash);
      if(match){ req.session.admin = true; return res.json({success:true}); }
      else return res.status(401).json({error:'Invalid password'});
    }
  });
});

// Get bookings (admin)
app.get('/bookings', isAdmin, (req,res)=>{
  db.all("SELECT * FROM bookings", (err, rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Customer booking
app.post('/book', customerLimiter, (req,res)=>{
  const { name,email,phone,vehicle_reg,date,time_slot,garageId } = req.body;
  if(!name || !email || !phone || !vehicle_reg || !date || !time_slot || !garageId)
    return res.status(400).json({error:'Missing required fields'});

  db.get("SELECT * FROM garages WHERE id=?",[garageId],(err,garage)=>{
    if(err) return res.status(500).json({error:err.message});
    if(!garage) return res.status(400).json({error:'Garage not found'});

    db.all("SELECT bay FROM bookings WHERE date=? AND time_slot=? AND status!='cancelled' AND garageId=?",
      [date,time_slot,garageId], (err, rows)=>{
        if(err) return res.status(500).json({error:err.message});
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

// Update booking (admin)
app.put('/bookings/:id', isAdmin, (req,res)=>{
  const id=req.params.id;
  const fields=req.body;
  const setStr=Object.keys(fields).map(f=>`${f}=?`).join(',');
  const values=Object.values(fields);
  values.push(id);
  db.run(`UPDATE bookings SET ${setStr} WHERE id=?`, values, function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({success:true});
  });
});

// Cancel booking (admin)
app.delete('/bookings/:id', isAdmin, (req,res)=>{
  const id=req.params.id;
  db.run("UPDATE bookings SET status='cancelled' WHERE id=?",[id],function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({success:true});
  });
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));