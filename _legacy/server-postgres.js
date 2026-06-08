import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import pg from 'pg';

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

// Configurar pool de conexiones PostgreSQL
const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'games_tracker',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Sanitizar query para IGDB
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
  const { title, console_id, year_played, completed, image } = data;
  
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'Title is required and must be a string' };
  }
  if (console_id && typeof console_id !== 'number') {
    return { valid: false, error: 'Console ID must be a number' };
  }
  if (year_played && typeof year_played !== 'number') {
    return { valid: false, error: 'Year played must be a number' };
  }
  if (completed && typeof completed !== 'boolean') {
    return { valid: false, error: 'Completed must be a boolean' };
  }
  return { valid: true };
}

// Obtener todos los juegos
app.get('/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games_view');
    res.json({ games: result.rows });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Error fetching games' });
  }
});

// Obtener un juego por ID
app.get('/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM games_view WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({ game: result.rows[0] });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Error fetching game' });
  }
});

// Agregar un nuevo juego
app.post('/games', async (req, res) => {
  try {
    const validation = validateGameData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { title, console_id, year_played, completed, image } = req.body;

    // Verificar que la consola existe si se proporciona
    if (console_id) {
      const consoleResult = await pool.query('SELECT id FROM consoles WHERE id = $1', [console_id]);
      if (consoleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Console does not exist' });
      }
    }

    const result = await pool.query(
      `INSERT INTO games (title, console_id, year_played, completed, image) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [title, console_id || null, year_played || null, completed || false, image || null]
    );

    res.json({ 
      message: 'Game added successfully', 
      game: result.rows[0], 
      success: true 
    });
  } catch (error) {
    console.error('Error adding game:', error);
    res.status(500).json({ error: 'Error adding game' });
  }
});

// Actualizar un juego
app.put('/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = validateGameData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { title, console_id, year_played, completed, image } = req.body;

    const result = await pool.query(
      `UPDATE games 
       SET title = $1, console_id = $2, year_played = $3, completed = $4, image = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, console_id || null, year_played || null, completed || false, image || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ message: 'Game updated successfully', game: result.rows[0], success: true });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Error updating game' });
  }
});

// Eliminar un juego
app.delete('/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ message: 'Game deleted successfully', gameId: id, success: true });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Error deleting game' });
  }
});

// Obtener consolas
app.get('/consoles', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM consoles ORDER BY name ASC');
    res.json({ consoles: result.rows });
  } catch (error) {
    console.error('Error fetching consoles:', error);
    res.status(500).json({ error: 'Error fetching consoles' });
  }
});

// Agregar consola
app.post('/consoles', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Console name is required' });
    }

    const result = await pool.query(
      'INSERT INTO consoles (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    res.json({ 
      message: 'Console added successfully', 
      console: result.rows[0], 
      success: true 
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Console already exists' });
    }
    console.error('Error adding console:', error);
    res.status(500).json({ error: 'Error adding console' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`✓ Connected to PostgreSQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});
