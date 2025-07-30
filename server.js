const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory user store for demonstration purposes
const users = [];

// In-memory classifieds store (announcements). Each ad has id, title, description, category,
// optional price and dateCreated. This is a simple demonstration; in a real system
// you would use a database.
let nextAdId = 1;
const classifieds = [];

// Register endpoint
app.post('/api/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password' });
  }
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ message: 'User already exists' });
  }
  users.push({ username, password, role: role || 'user' });
  return res.status(201).json({ message: 'User registered successfully' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // In a real application, generate and return a JWT or session token here
  return res.json({ message: 'Login successful', user: { username, role: user.role } });
});

// Placeholder routes for future modules

// ----------------- Classifieds (Объявления) API -----------------

// Get all classifieds
app.get('/api/classifieds', (req, res) => {
  res.json({ classifieds });
});

// Create a new classified ad
app.post('/api/classifieds', (req, res) => {
  const { title, description, category, price } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const ad = {
    id: nextAdId++,
    title,
    description,
    category,
    price: price || null,
    dateCreated: new Date().toISOString(),
  };
  classifieds.push(ad);
  res.status(201).json({ message: 'Classified created', ad });
});

// Get a single classified by ID
app.get('/api/classifieds/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ad = classifieds.find(a => a.id === id);
  if (!ad) {
    return res.status(404).json({ message: 'Ad not found' });
  }
  res.json({ ad });
});

// Update a classified by ID
app.put('/api/classifieds/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ad = classifieds.find(a => a.id === id);
  if (!ad) {
    return res.status(404).json({ message: 'Ad not found' });
  }
  const { title, description, category, price } = req.body;
  ad.title = title || ad.title;
  ad.description = description || ad.description;
  ad.category = category || ad.category;
  ad.price = typeof price !== 'undefined' ? price : ad.price;
  res.json({ message: 'Ad updated', ad });
});

// Delete a classified by ID
app.delete('/api/classifieds/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = classifieds.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Ad not found' });
  }
  classifieds.splice(index, 1);
  res.json({ message: 'Ad deleted' });
});

// Placeholder route for future vacancies module
app.get('/api/vacancies', (req, res) => {
  res.json({ vacancies: [] });
});


app.get('/api/companies', (req, res) => {
  res.json({ companies: [] });
});

app.get('/api/real-estate', (req, res) => {
  res.json({ realEstate: [] });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
