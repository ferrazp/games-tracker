import fetch from 'node-fetch';
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(bodyParser.json());

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('./games.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
});

// Inicializar tablas antes de iniciar el servidor
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
     db.run(`CREATE TABLE IF NOT EXISTS games (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       consoleId INTEGER,
       yearPlayed INTEGER,
       completed BOOLEAN,
       image TEXT,
       FOREIGN KEY (consoleId) REFERENCES consoles(id)
     )`, (err) => {
       if (err) {
         console.error('Error creating games table', err);
         reject(err);
       }
     });

     db.run(`CREATE TABLE IF NOT EXISTS consoles (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL
     )`, (err) => {
       if (err) {
         console.error('Error creating consoles table', err);
         reject(err);
       } else {
         resolve();
       }
     });
    });
  });
}

// Función para obtener el token de acceso de Twitch
async function getAccessToken() {
  try {
    const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, {
     method: 'POST',
    });
    
    if (!response.ok) {
     throw new Error(`Twitch auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.access_token) {
     throw new Error('No access token in Twitch response');
    }
    return data.access_token;
  } catch (error) {
    console.error('Error obtaining Twitch access token:', error);
    throw error;
  }
}

// Validar entrada de búsqueda
function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query must be a non-empty string' };
  }
  if (query.length > 100) {
    return { valid: false, error: 'Query must not exceed 100 characters' };
  }
  return { valid: true };
}

// Sanitizar query para IGDB (escapar caracteres especiales)
function sanitizeIGDBQuery(query) {
  return query.replace(/"/g, '\\"');
}

// Ruta para buscar juegos en IGDB
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    const validation = validateSearchQuery(query);
    if (!validation.valid) {
     return res.status(400).json({ error: validation.error });
    }

    const accessToken = await getAccessToken();
    const sanitizedQuery = sanitizeIGDBQuery(query);
    
    const response = await fetch('https://api.igdb.com/v4/games', {
     method: 'POST',
     headers: {
       'Client-ID': CLIENT_ID,
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/json',
     },
     body: `fields name,cover.url; search "${sanitizedQuery}"; limit 5;`,
    });

    if (!response.ok) {
     throw new Error(`IGDB API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error searching games:', error);
    res.status(500).json({ error: 'Error searching games. Please try again.' });
  }
});

// Validar datos del juego
function validateGameData(data) {
  const { title, consoleId, yearPlayed, completed, image } = data;
  
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'Title is required and must be a string' };
  }
  if (!consoleId || typeof consoleId !== 'number') {
    return { valid: false, error: 'ConsoleId is required and must be a number' };
  }
  if (yearPlayed && typeof yearPlayed !== 'number') {
    return { valid: false, error: 'YearPlayed must be a number' };
  }
  if (typeof completed !== 'boolean') {
    return { valid: false, error: 'Completed must be a boolean' };
  }
  return { valid: true };
}

// Obtener todos los juegos con información de consola
app.get('/games', (req, res) => {
  const query = `
    SELECT games.id, games.title, games.yearPlayed, games.completed, games.image, consoles.name as consoleName 
    FROM games 
    LEFT JOIN consoles ON games.consoleId = consoles.id
    ORDER BY games.id DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
     console.error('Error fetching games:', err);
     return res.status(500).json({ error: 'Error fetching games' });
    }
    res.json({ games: rows });
  });
});

// Agregar un nuevo juego
app.post('/games', (req, res) => {
  const validation = validateGameData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { title, consoleId, yearPlayed, completed, image } = req.body;

  db.get('SELECT id FROM consoles WHERE id = ?', [consoleId], (err, row) => {
    if (err) {
     console.error('Error verifying consoleId:', err);
     return res.status(500).json({ error: 'Error verifying console' });
    }

    if (!row) {
     return res.status(400).json({ error: 'Console does not exist' });
    }

    db.run(
     `INSERT INTO games (title, consoleId, yearPlayed, completed, image) 
      VALUES (?, ?, ?, ?, ?)`, 
     [title, consoleId, yearPlayed, completed, image],
     function(err) {
       if (err) {
         console.error('Error adding game:', err);
         return res.status(500).json({ error: 'Error adding game' });
       }
       res.json({ message: 'Game added successfully', gameId: this.lastID, success: true });
     }
    );
  });
});

// Obtener la lista de consolas
app.get('/consoles', (req, res) => {
  db.all('SELECT * FROM consoles ORDER BY name ASC', [], (err, rows) => {
    if (err) {
     console.error('Error fetching consoles:', err);
     return res.status(500).json({ error: 'Error fetching consoles' });
    }
    res.json({ consoles: rows });
  });
});

// Iniciar el servidor
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
     console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
