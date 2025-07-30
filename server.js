const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Used to generate session tokens

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In‑memory session store. Keys are random tokens associated with authenticated users.
// In a production system this should be replaced by a more persistent/session aware
// mechanism (e.g. JWTs, Redis, database‑backed sessions).
const sessions = {};

// Directory used to persist application data. If the directory doesn't exist it will be
// created on startup. Data is stored in JSON files for each resource along with the
// next ID counters. This allows the service to retain state between restarts without
// requiring a full database setup.
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Helper function to load persisted data. If the file does not exist, returns
// the provided defaults. Each data file stores an object with the following shape:
// { nextId: <number>, items: <array> }.
function loadData(fileName, defaults) {
  const filePath = path.join(dataDir, fileName);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { nextId: parsed.nextId || defaults.nextId, items: parsed.items || defaults.items };
  } catch (err) {
    // On first run or parse error, return defaults
    return { nextId: defaults.nextId, items: defaults.items };
  }
}

// Helper function to save persisted data. Writes JSON synchronously to avoid race
// conditions in this simple example. In a production system consider async writes
// and better error handling.
function saveData(fileName, data) {
  const filePath = path.join(dataDir, fileName);
  const payload = JSON.stringify({ nextId: data.nextId, items: data.items }, null, 2);
  fs.writeFileSync(filePath, payload, 'utf8');
}

// Load users. For demonstration purposes we persist users as well, although in
// real applications passwords should be hashed and stored securely.
const usersData = loadData('users.json', { nextId: 1, items: [] });
const users = usersData.items;

// Load classifieds from disk
const classifiedsData = loadData('classifieds.json', { nextId: 1, items: [] });
let nextAdId = classifiedsData.nextId;
const classifieds = classifiedsData.items;

// Load vacancies from disk
const vacanciesData = loadData('vacancies.json', { nextId: 1, items: [] });
let nextVacancyId = vacanciesData.nextId;
const vacancies = vacanciesData.items;

// Load companies from disk
const companiesData = loadData('companies.json', { nextId: 1, items: [] });
let nextCompanyId = companiesData.nextId;
const companies = companiesData.items;

// Load real estate from disk
const realEstateData = loadData('realEstate.json', { nextId: 1, items: [] });
let nextPropertyId = realEstateData.nextId;
const realEstate = realEstateData.items;

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
  // Persist users to disk. Even though we don't track user IDs here, we
  // preserve the nextId so that if we ever add incremental IDs we have a
  // consistent counter. For now it simply echoes usersData.nextId.
  saveData('users.json', { nextId: usersData.nextId, items: users });
  return res.status(201).json({ message: 'User registered successfully' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // Generate a random token and associate it with this user in the session store.
  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = { username: user.username, role: user.role };
  // Return the token along with user info to the client. The client should
  // store this token (e.g. in localStorage) and send it in the Authorization
  // header for protected requests.
  return res.json({ message: 'Login successful', token, user: { username: user.username, role: user.role } });
});

// Middleware to verify that a request is authenticated. It checks for an
// Authorization header containing a valid session token. If the token is
// missing or invalid, it responds with 401 Unauthorized. Otherwise it
// attaches the user information to req.user and calls next().
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token || !sessions[token]) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.user = sessions[token];
  next();
}

// Placeholder routes for future modules

// ----------------- Classifieds (Объявления) API -----------------

// Get all classifieds
app.get('/api/classifieds', (req, res) => {
  res.json({ classifieds });
});

// Create a new classified ad. Only authenticated users are allowed to post
// classifieds. The authenticate middleware checks for a valid session token.
app.post('/api/classifieds', authenticate, (req, res) => {
  const { title, description, category, price } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const ad = {
    id: nextAdId++,
    title,
    description,
    category,
    price: typeof price !== 'undefined' ? price : null,
    dateCreated: new Date().toISOString(),
    owner: req.user.username,
  };
  classifieds.push(ad);
  // Persist classifieds with updated next ID
  saveData('classifieds.json', { nextId: nextAdId, items: classifieds });
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
  saveData('classifieds.json', { nextId: nextAdId, items: classifieds });
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
  saveData('classifieds.json', { nextId: nextAdId, items: classifieds });
  res.json({ message: 'Ad deleted' });
});

// Placeholder route for future vacancies module
// ----------------- Vacancies (Вакансии) API -----------------

// Get all vacancies
app.get('/api/vacancies', (req, res) => {
  // Apply optional filters. Supported query parameters:
  // - category: string to match company category (case-insensitive)
  // - minSalary: minimum salary (number) — returns vacancies with salary >= minSalary.
  let result = vacancies;
  const { category, minSalary } = req.query;
  if (category) {
    const categoryLower = category.toLowerCase();
    result = result.filter(v => v.company.toLowerCase().includes(categoryLower));
  }
  if (minSalary) {
    const min = parseFloat(minSalary);
    if (!isNaN(min)) {
      result = result.filter(v => v.salary !== null && v.salary >= min);
    }
  }
  res.json({ vacancies: result });
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
  // Persist vacancies to disk
  saveData('vacancies.json', { nextId: nextVacancyId, items: vacancies });
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
  saveData('vacancies.json', { nextId: nextVacancyId, items: vacancies });
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
  saveData('vacancies.json', { nextId: nextVacancyId, items: vacancies });
  res.json({ message: 'Vacancy deleted' });
});

// ----------------- Companies (Компании и услуги) API -----------------

// Get all companies
app.get('/api/companies', (req, res) => {
  // Optional filtering by category. If ?category=<value> is provided, return
  // companies whose category includes the provided text (case-insensitive).
  const { category } = req.query;
  let result = companies;
  if (category) {
    const catLower = category.toLowerCase();
    result = companies.filter(c => c.category.toLowerCase().includes(catLower));
  }
  res.json({ companies: result });
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
  // Persist companies to disk
  saveData('companies.json', { nextId: nextCompanyId, items: companies });
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
  saveData('companies.json', { nextId: nextCompanyId, items: companies });
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
  saveData('companies.json', { nextId: nextCompanyId, items: companies });
  res.json({ message: 'Company deleted' });
});

// Placeholder for real estate (Недвижимость). Currently returns an empty list.
// ----------------- Real Estate (Недвижимость) API -----------------

// Get all properties
app.get('/api/real-estate', (req, res) => {
  // Optional filters: type and minPrice. If provided, filter results accordingly.
  let result = realEstate;
  const { type, minPrice } = req.query;
  if (type) {
    const typeLower = type.toLowerCase();
    result = result.filter(p => p.type.toLowerCase() === typeLower);
  }
  if (minPrice) {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) {
      result = result.filter(p => p.price !== null && p.price >= min);
    }
  }
  res.json({ realEstate: result });
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
  // Persist real estate to disk
  saveData('realEstate.json', { nextId: nextPropertyId, items: realEstate });
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
  saveData('realEstate.json', { nextId: nextPropertyId, items: realEstate });
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
  saveData('realEstate.json', { nextId: nextPropertyId, items: realEstate });
  res.json({ message: 'Property deleted' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
