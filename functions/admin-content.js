const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  const JWT_SECRET = process.env.SESSION_JWT_SECRET;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.role === 'admin';
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (!verifyAdmin(event.headers.authorization)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const catalogPath = path.join(process.cwd(), 'functions/data/catalog.txt');
    const seriesPath = path.join(process.cwd(), 'functions/data/series.txt');
    const foreignPath = path.join(process.cwd(), 'functions/data/foreign-series.txt');
    
    let movies = [];
    
    // Read movies
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf-8');
      movies = content.split('\n')
        .filter(line => line.trim())
        .map((line, idx) => {
          const parts = line.split('|').map(p => p.trim());
          return {
            id: `m_${idx}`,
            title: parts[0] || '',
            url: parts[1] || '',
            image: parts[2] || '',
            category: parts[3] || 'أفلام',
            type: 'movie'
          };
        });
    }
    
    // Read series
    if (fs.existsSync(seriesPath)) {
      const content = fs.readFileSync(seriesPath, 'utf-8');
      const seriesItems = content.split('\n')
        .filter(line => line.trim())
        .map((line, idx) => {
          const parts = line.split('|').map(p => p.trim());
          return {
            id: `s_${idx}`,
            title: `${parts[0]} - ${parts[1]}`,
            url: parts[2] || '',
            image: parts[3] || '',
            category: 'مسلسل عربي',
            type: 'series'
          };
        });
      movies = [...movies, ...seriesItems];
    }
    
    // Read foreign series
    if (fs.existsSync(foreignPath)) {
      const content = fs.readFileSync(foreignPath, 'utf-8');
      const foreignItems = content.split('\n')
        .filter(line => line.trim())
        .map((line, idx) => {
          const parts = line.split('|').map(p => p.trim());
          return {
            id: `f_${idx}`,
            title: `${parts[0]} - ${parts[1]}`,
            url: parts[2] || '',
            image: parts[3] || '',
            category: 'مسلسل أجنبي',
            type: 'foreign'
          };
        });
      movies = [...movies, ...foreignItems];
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movies })
    };
    
  } catch (error) {
    console.error('Content list error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message, movies: [] })
    };
  }
};
