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

// In-memory vacancies store. Each vacancy will have id, title, company, description,
// optional salary and creation date. In a real system this would live in a database.
let nextVacancyId = 1;
const vacancies = [];

// In-memory companies store. Each company will have id, name, category,
// description, optional rating and creation date. As with other resources,
// this would normally live in a database.
let nextCompanyId = 1;
const companies = [];

// In-memory real estate store. Each property has id, type (e.g. 'квартира', 'дом', 'участок'),
// title, description, optional price, location and creation date. As before,
// in a production system this data would be persisted in a database.
let nextPropertyId = 1;
const realEstate = [];

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
// ----------------- Vacancies (Вакансии) API -----------------

// Get all vacancies
app.get('/api/vacancies', (req, res) => {
  res.json({ vacancies });
});

// Create a new vacancy
app.post('/api/vacancies', (req, res) => {
  const { title, company, description, salary } = req.body;
  if (!title || !company || !description) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const vacancy = {
    id: nextVacancyId++,
    title,
    company,
    description,
    salary: typeof salary !== 'undefined' ? salary : null,
    dateCreated: new Date().toISOString(),
  };
  vacancies.push(vacancy);
  res.status(201).json({ message: 'Vacancy created', vacancy });
});

// Get a single vacancy by ID
app.get('/api/vacancies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vacancy = vacancies.find(v => v.id === id);
  if (!vacancy) {
    return res.status(404).json({ message: 'Vacancy not found' });
  }
  res.json({ vacancy });
});

// Update a vacancy by ID
app.put('/api/vacancies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const vacancy = vacancies.find(v => v.id === id);
  if (!vacancy) {
    return res.status(404).json({ message: 'Vacancy not found' });
  }
  const { title, company, description, salary } = req.body;
  if (title) vacancy.title = title;
  if (company) vacancy.company = company;
  if (description) vacancy.description = description;
  if (typeof salary !== 'undefined') vacancy.salary = salary;
  res.json({ message: 'Vacancy updated', vacancy });
});

// Delete a vacancy by ID
app.delete('/api/vacancies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = vacancies.findIndex(v => v.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Vacancy not found' });
  }
  vacancies.splice(index, 1);
  res.json({ message: 'Vacancy deleted' });
});

// ----------------- Companies (Компании и услуги) API -----------------

// Get all companies
app.get('/api/companies', (req, res) => {
  res.json({ companies });
});

// Create a new company
app.post('/api/companies', (req, res) => {
  const { name, category, description, rating } = req.body;
  if (!name || !category || !description) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const company = {
    id: nextCompanyId++,
    name,
    category,
    description,
    rating: typeof rating !== 'undefined' ? rating : null,
    dateCreated: new Date().toISOString(),
  };
  companies.push(company);
  res.status(201).json({ message: 'Company created', company });
});

// Get a single company by ID
app.get('/api/companies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const company = companies.find(c => c.id === id);
  if (!company) {
    return res.status(404).json({ message: 'Company not found' });
  }
  res.json({ company });
});

// Update a company by ID
app.put('/api/companies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const company = companies.find(c => c.id === id);
  if (!company) {
    return res.status(404).json({ message: 'Company not found' });
  }
  const { name, category, description, rating } = req.body;
  if (name) company.name = name;
  if (category) company.category = category;
  if (description) company.description = description;
  if (typeof rating !== 'undefined') company.rating = rating;
  res.json({ message: 'Company updated', company });
});

// Delete a company by ID
app.delete('/api/companies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = companies.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Company not found' });
  }
  companies.splice(index, 1);
  res.json({ message: 'Company deleted' });
});

// Placeholder for real estate (Недвижимость). Currently returns an empty list.
// ----------------- Real Estate (Недвижимость) API -----------------

// Get all properties
app.get('/api/real-estate', (req, res) => {
  res.json({ realEstate });
});

// Create a new real estate property
app.post('/api/real-estate', (req, res) => {
  const { type, title, description, price, location } = req.body;
  if (!type || !title || !description) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const property = {
    id: nextPropertyId++,
    type,
    title,
    description,
    price: typeof price !== 'undefined' ? price : null,
    location: location || null,
    dateCreated: new Date().toISOString(),
  };
  realEstate.push(property);
  res.status(201).json({ message: 'Property created', property });
});

// Get a single property by ID
app.get('/api/real-estate/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const property = realEstate.find(p => p.id === id);
  if (!property) {
    return res.status(404).json({ message: 'Property not found' });
  }
  res.json({ property });
});

// Update a property by ID
app.put('/api/real-estate/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const property = realEstate.find(p => p.id === id);
  if (!property) {
    return res.status(404).json({ message: 'Property not found' });
  }
  const { type, title, description, price, location } = req.body;
  if (type) property.type = type;
  if (title) property.title = title;
  if (description) property.description = description;
  if (typeof price !== 'undefined') property.price = price;
  if (typeof location !== 'undefined') property.location = location;
  res.json({ message: 'Property updated', property });
});

// Delete a property by ID
app.delete('/api/real-estate/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = realEstate.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Property not found' });
  }
  realEstate.splice(index, 1);
  res.json({ message: 'Property deleted' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
