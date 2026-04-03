
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const authorize = require('./middleware/auth');
const path = require('path'); 
require('dotenv').config();

const app = express();
const secretKey = 'your-secret-key';

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend'))); 

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect(err => {
  if (err) {
    console.error('DB Connection Failed:', err);
  } else {
    console.log('Railway MySQL Connected 🚀');
  }
});

// ---------------------- MEDICINES ----------------------
app.get('/medicines', (req, res) => {
  db.query('SELECT * FROM medicines', (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch medicines' });
    res.json(result);
  });
});

app.post('/medicines', (req, res) => {
  let { name, brand, price, quantity, expiry_date, supplier_id } = req.body;

  const checkQuery = 'SELECT * FROM medicines WHERE LOWER(name) = ? AND LOWER(brand) = ?';
  db.query(checkQuery, [name.trim().toLowerCase(), brand.trim().toLowerCase()], (err, results) => {
    if (err) {
      console.error('Check error:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length > 0) {
      return res.status(409).json({ message: '🔴 Medicine already exists' });
    }

    const insertQuery = 'INSERT INTO medicines (name, brand, price, quantity, expiry_date, supplier_id) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(insertQuery, [name, brand, price, quantity, expiry_date, supplier_id], (err) => {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ message: 'Failed to add medicine' });
      }
      res.json({ message: '💚 Medicine added successfully!' });
    });
  });
});


app.put('/medicines/:id', (req, res) => {
  const { name, brand, price, quantity, expiry_date, supplier_id } = req.body;
  const sql = 'UPDATE medicines SET name=?, brand=?, price=?, quantity=?, expiry_date=?, supplier_id=? WHERE id=?';
  db.query(sql, [name, brand, price, quantity, expiry_date, supplier_id, req.params.id], (err) => {
    if (err) return res.status(500).send('Error updating');
    res.send('Medicine updated successfully');
  });
});

// DELETE medicine (admin only)
app.delete('/medicines/:id', authorize(['admin']), (req, res) => {
  const id = req.params.id;

  const sql = 'DELETE FROM medicines WHERE id = ?';

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('❌ Delete error:', err);  // Make sure this line is there
      return res.status(500).send('❌ Error deleting medicine');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('⚠️ Medicine not found');
    }

    res.send('✅ Medicine deleted successfully');
  });
});


// ---------------------- CUSTOMERS ----------------------

const phoneRegex = /^[0-9]{10}$/;

// GET
app.get('/customers', (req, res) => {
  db.query('SELECT * FROM customers', (err, results) => {
    if (err) return res.status(500).send('Failed to retrieve customers');
    res.json(results);
  });
});

// CREATE
app.post('/customers', (req, res) => {
  const { name, contact, address } = req.body;

  // 🔐 Validation
  if (!name || !contact || !address) {
    return res.status(400).send('❌ All fields are required');
  }

  if (!phoneRegex.test(contact)) {
    return res.status(400).send('❌ Phone must be exactly 10 digits');
  }

  const sql = 'INSERT INTO customers (name, contact, address) VALUES (?, ?, ?)';

  db.query(sql, [name.trim(), contact.trim(), address.trim()], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('❌ Failed to add customer');
    }
    res.send('✅ Customer added successfully');
  });
});

// UPDATE
app.put('/customers/:id', (req, res) => {
  const { name, contact, address } = req.body;

  if (!name || !contact || !address) {
    return res.status(400).send('❌ All fields are required');
  }

  if (!phoneRegex.test(contact)) {
    return res.status(400).send('❌ Phone must be exactly 10 digits');
  }

  const sql = 'UPDATE customers SET name=?, contact=?, address=? WHERE id=?';

  db.query(sql, [name.trim(), contact.trim(), address.trim(), req.params.id], (err) => {
    if (err) return res.status(500).send('❌ Failed to update customer');
    res.send('✅ Customer updated successfully');
  });
});

// DELETE
app.delete('/customers/:id', (req, res) => {
  db.query('DELETE FROM customers WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).send('❌ Failed to delete customer');
    res.send('✅ Customer deleted successfully');
  });
});
// ---------------------- SUPPLIERS ----------------------
app.get('/suppliers', (req, res) => {
  db.query('SELECT * FROM suppliers', (err, result) => {
    if (err) return res.status(500).send('Failed to fetch suppliers');
    res.json(result);
  });
});

app.post('/suppliers', (req, res) => {
  const { name, contact, address } = req.body;
  db.query('INSERT INTO suppliers (name, contact, address) VALUES (?, ?, ?)', [name, contact, address], (err) => {
    if (err) return res.status(500).send('Failed to add supplier');
    res.send('Supplier added successfully');
  });
});

app.put('/suppliers/:id', (req, res) => {
  const { name, contact, address } = req.body;
  db.query('UPDATE suppliers SET name=?, contact=?, address=? WHERE id=?', [name, contact, address, req.params.id], (err) => {
    if (err) return res.status(500).send('Failed to update supplier');
    res.send('Supplier updated successfully');
  });
});

app.delete('/suppliers/:id', (req, res) => {
  db.query('DELETE FROM suppliers WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).send('Failed to delete supplier');
    res.send('Supplier deleted successfully');
  });
});

// ---------------------- SALES ----------------------
app.get('/sales', (req, res) => {
  const query = `
    SELECT 
      s.id AS sale_id,
      c.name AS customer_name,
      m.name AS medicine_name,
      s.quantity_sold AS quantity,
      s.total_price,
      s.sale_date
    FROM sales s
    JOIN customers c ON s.customer_id = c.id
    JOIN medicines m ON s.medicine_id = m.id
    ORDER BY s.sale_date DESC;
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch sales' });
    res.json(results);
  });
});

app.post('/sales', (req, res) => {
  const { customer_id, medicine_id, quantity_sold } = req.body;
  const getMedQuery = 'SELECT price, quantity FROM medicines WHERE id = ?';
  db.query(getMedQuery, [medicine_id], (err, results) => {
    if (err) return res.status(500).send('Server error');
    if (results.length === 0) return res.status(404).send('Medicine not found');

    const medicine = results[0];
    if (medicine.quantity < quantity_sold) {
      return res.status(400).send('Not enough stock');
    }

    const total_price = quantity_sold * medicine.price;
    const insertSale = 'INSERT INTO sales (customer_id, medicine_id, quantity_sold, total_price) VALUES (?, ?, ?, ?)';
    db.query(insertSale, [customer_id, medicine_id, quantity_sold, total_price], (err) => {
      if (err) return res.status(500).send('Could not record sale');
      const updateQty = 'UPDATE medicines SET quantity = quantity - ? WHERE id = ?';
      db.query(updateQty, [quantity_sold, medicine_id]);
      res.send('Sale recorded successfully');
    });
  });
});

app.delete('/sales/:id', (req, res) => {
  db.query('DELETE FROM sales WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).send('Failed to delete sale');
    res.send('Sale deleted successfully');
  });
});

// ---------------------- USERS ----------------------
app.get('/users', (req, res) => {
  db.query('SELECT id, username, role FROM users', (err, result) => {
    if (err) return res.status(500).send('Failed to fetch users');
    res.json(result);
  });
});

app.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  console.log("👉 LOGIN DATA:", username, password, role); // 🔥 ADD

  const sql = 'SELECT * FROM users WHERE username = ? AND password = ? AND role = ?';

  db.query(sql, [username, password, role], (err, results) => {
    if (err) {
      console.log("❌ DB ERROR:", err);
      return res.status(500).json({ success: false });
    }

    console.log("👉 DB RESULT:", results); // 🔥 ADD

    if (results.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
});


const PORT = 3000;
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/frontend/login.html');
});



// ================== AI FEATURES ==================

// 🧠 Recommendation
app.get('/ai/recommend/:medicineId', (req, res) => {
  const medId = req.params.medicineId;

  const query = `
    SELECT m2.name, COUNT(*) as freq
    FROM sales s1
    JOIN sales s2 ON s1.customer_id = s2.customer_id
    JOIN medicines m2 ON s2.medicine_id = m2.id
    WHERE s1.medicine_id = ? AND s2.medicine_id != ?
    GROUP BY m2.name
    ORDER BY freq DESC
    LIMIT 3
  `;

  db.query(query, [medId, medId], (err, results) => {
    if (err) return res.status(500).send("Error");
    res.json(results);
  });
});

// ⚠️ Low Stock
app.get('/ai/low-stock', (req, res) => {
  db.query(
    `SELECT name, quantity FROM medicines WHERE quantity <= 10`,
    (err, results) => {
      if (err) return res.status(500).send("Error");
      res.json(results);
    }
  );
});

// ⏳ Expiry Alert

app.get('/ai/expired', (req, res) => {
  db.query(
    `SELECT name, expiry_date FROM medicines WHERE expiry_date < CURDATE()`,
    (err, results) => {
      if (err) return res.status(500).send("Error");
      res.json(results);
    }
  );
});

app.get('/ai/expiry-alerts', (req, res) => {
  const query = `
    SELECT name, expiry_date 
    FROM medicines 
    WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY expiry_date ASC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).send("Error");
    res.json(results);
  });
});


const PORT1 = process.env.PORT || 3000;

app.listen(PORT1, () => {
  console.log(`Server running on port ${PORT1}`);
});
