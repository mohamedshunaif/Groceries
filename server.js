const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'groceries.json');

// Ensure data directory and file exist (for local fallback)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial sample data from the user's spreadsheet screenshot
const initialData = [
  { "id": "1", "date": "2026-06-16", "shop": "Supermart", "description": "Fresh Lime Green Small", "quantity": "0.22 Kg", "price": 13.20, "paidBy": "Shunaif" },
  { "id": "2", "date": "2026-06-16", "shop": "Supermart", "description": "Fresh Broccoli Kg (T)", "quantity": "0.54 Kg", "price": 91.80, "paidBy": "Shunaif" },
  { "id": "3", "date": "2026-06-16", "shop": "Supermart", "description": "Veg Tomato Plum - Kg", "quantity": "0.35 Kg", "price": 73.50, "paidBy": "Shunaif" },
  { "id": "4", "date": "2026-06-16", "shop": "Supermart", "description": "Fresh Passion Fruit kg", "quantity": "0.27 Kg", "price": 32.40, "paidBy": "Shunaif" },
  { "id": "5", "date": "2026-06-16", "shop": "Supermart", "description": "Baby Mesclun Mix Leaves (Pack)", "quantity": "1.00 pcs", "price": 70.00, "paidBy": "Shunaif" },
  { "id": "6", "date": "2026-06-16", "shop": "Supermart", "description": "Fresh White Egg", "quantity": "8.00 pcs", "price": 20.00, "paidBy": "Shunaif" },
  { "id": "7", "date": "2026-06-16", "shop": "Supermart", "description": "Veg Batana Pumpkin Kg (T)", "quantity": "0.44 Kg", "price": 15.40, "paidBy": "Shunaif" },
  { "id": "8", "date": "2026-06-16", "shop": "Supermart", "description": "Veg Sweet Potato kg (T)", "quantity": "0.53 Kg", "price": 58.30, "paidBy": "Shunaif" },
  { "id": "9", "date": "2026-06-16", "shop": "Supermart", "description": "Veg Potato White kg", "quantity": "0.72 Kg", "price": 11.52, "paidBy": "Shunaif" },
  { "id": "10", "date": "2026-06-16", "shop": "Supermart", "description": "Fresh Pomegranate kg", "quantity": "0.28 Kg", "price": 44.80, "paidBy": "Shunaif" },
  { "id": "11", "date": "2026-06-16", "shop": "Supermart", "description": "Veg Pink Onion kg", "quantity": "0.53 Kg", "price": 12.72, "paidBy": "Shunaif" },
  { "id": "12", "date": "2026-06-16", "shop": "Supermart", "description": "Felivaru Chunks In Oil With Spicy Lemon 180g", "quantity": "4.00 pcs", "price": 92.00, "paidBy": "Shunaif" },
  { "id": "13", "date": "2026-06-16", "shop": "Supermart", "description": "Seara Chicken Drumstick 1Kg (T)", "quantity": "1.00 pcs", "price": 89.00, "paidBy": "Shunaif" },
  { "id": "14", "date": "2026-06-16", "shop": "Supermart", "description": "ALPENLIBE CREAMFILLS CANDY 735 G", "quantity": "2.00 pcs", "price": 2.00, "paidBy": "Shunaif" },
  { "id": "15", "date": "2026-06-16", "shop": "Supermart", "description": "Centerfresh Spearmint Jar 225x2.8g (630g) (T)", "quantity": "2.00 pcs", "price": 2.00, "paidBy": "Shunaif" },
  { "id": "16", "date": "2026-06-16", "shop": "Stockman", "description": "CENTER FRUIT WATERMELON CHEWING GUM 420G", "quantity": "1.00 pcs", "price": 1.00, "paidBy": "Nikko" },
  { "id": "17", "date": "2026-06-16", "shop": "Fahi Plaza", "description": "CENTER FRUIT STRAWBERRY CHEWING GUM 675 G", "quantity": "1.00 pcs", "price": 1.00, "paidBy": "Nikko" }
];

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// MongoDB Database Configuration
const MONGODB_URI = process.env.MONGODB_URI;
let useMongoDB = false;

const grocerySchema = new mongoose.Schema({
  date: { type: String, required: true },
  shop: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: String, default: '1.00 pcs' },
  price: { type: Number, required: true },
  paidBy: { type: String, required: true }
});

const Grocery = mongoose.model('Grocery', grocerySchema);

if (MONGODB_URI) {
  console.log('Connecting to MongoDB Atlas...');
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Successfully connected to MongoDB Atlas database!');
      useMongoDB = true;
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB Atlas:', err.message);
      console.log('Falling back to local file database (data/groceries.json)...');
      useMongoDB = false;
    });
} else {
  console.log('MONGODB_URI environment variable not found.');
  console.log('Falling back to local file database (data/groceries.json)...');
}

// API Routes
app.get('/api/groceries', async (req, res) => {
  if (useMongoDB) {
    try {
      const records = await Grocery.find({});
      const mappedRecords = records.map(rec => ({
        id: rec._id.toString(),
        date: rec.date,
        shop: rec.shop,
        description: rec.description,
        quantity: rec.quantity,
        price: rec.price,
        paidBy: rec.paidBy
      }));
      res.json(mappedRecords);
    } catch (err) {
      res.status(500).json({ error: 'Failed to query MongoDB records: ' + err.message });
    }
  } else {
    // Local filesystem read
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to read data file' });
      }
      try {
        res.json(JSON.parse(data));
      } catch (parseErr) {
        res.status(500).json({ error: 'Data file contains invalid JSON' });
      }
    });
  }
});

app.post('/api/groceries', async (req, res) => {
  const records = req.body;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Request body must be an array of records' });
  }

  if (useMongoDB) {
    try {
      // Clear collection to sync the full spreadsheet state
      await Grocery.deleteMany({});
      
      const docs = records.map(rec => ({
        date: rec.date,
        shop: rec.shop,
        description: rec.description,
        quantity: rec.quantity,
        price: rec.price,
        paidBy: rec.paidBy
      }));

      await Grocery.insertMany(docs);
      res.json({ success: true, message: 'Data saved to MongoDB Atlas successfully', count: records.length });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save to MongoDB Atlas: ' + err.message });
    }
  } else {
    // Local filesystem write
    fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to write data file' });
      }
      res.json({ success: true, message: 'Data saved locally successfully', count: records.length });
    });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    hasServerApiKey: !!process.env.GEMINI_API_KEY
  });
});

// Serve frontend SPA for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Grocery Tracker server is running on http://localhost:${PORT}`);
});
