const http = require('http');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера', parseInt)
  .requiredOption('-c, --cache <path>', 'шлях до директорії кеша');

program.parse(process.argv);

const options = program.opts();
const HOST = options.host;
const PORT = options.port;
const CACHE_DIR = path.resolve(options.cache);

fs.mkdirSync(CACHE_DIR, { recursive: true });

const DATA_FILE = path.join(CACHE_DIR, 'inventory.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function loadInventory() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveInventory(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  const urlParts = req.url.split('/').filter(Boolean);
  const method = req.method;

  if (method === 'GET' && req.url === '/register-form') {
    const filePath = path.join(__dirname, 'RegisterForm.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  if (method === 'GET' && req.url === '/search-form') {
    const filePath = path.join(__dirname, 'SearchForm.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
    
if (req.url === '/register') {
  if (method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  const form = new formidable.IncomingForm({
    uploadDir: CACHE_DIR,
    keepExtensions: true,
    encoding: 'utf-8'
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }

    const inventory_name = fields['Name'] || fields['inventory_name'];
    const description = fields['Description'] || fields['description'] || '';
    const photo = files['Photo'] || files['photo'];

    if (!inventory_name) {
      res.writeHead(400);
      res.end('inventory_name is required');
      return;
    }

    const inventory = loadInventory();
    const id = inventory.length ? inventory[inventory.length - 1].id + 1 : 1;

    let photoPath = null;
    if (photo) {
      const newPhotoName = `photo_${id}${path.extname(photo.originalFilename)}`;
      const newPhotoPath = path.join(CACHE_DIR, newPhotoName);
      fs.renameSync(photo.filepath, newPhotoPath);
      photoPath = newPhotoPath;
    }

    const item = { id, inventory_name, description, photo: photoPath };
    inventory.push(item);
    saveInventory(inventory);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(item));
  });
  return;
}    
  if (req.url === '/inventory') {
    if (method !== 'GET') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    const inventory = loadInventory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inventory));
    return;
  }

  if (urlParts[0] === 'inventory' && urlParts[1]) {
    const id = parseInt(urlParts[1]);
    const inventory = loadInventory();
    const item = inventory.find(i => i.id === id);
    if (!item) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (method === 'GET') {
      if (item.photo) {
        const img = fs.readFileSync(item.photo);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(img);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(item));
      }
      return;
    }

    if (method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.inventory_name) item.inventory_name = data.inventory_name;
          if (data.description) item.description = data.description;
          saveInventory(inventory);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(item));
        } catch {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

