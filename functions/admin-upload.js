const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function generateId(prefix = 'm') {
  const hash = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${hash}`;
}

exports.handler = async (event) => {
  if (!verifyAdmin(event.headers.authorization)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Unauthorized' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { type, title, url, image, category, seriesName, genre, subtitles } = data;

    if (!title || !url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Determine which file to append to
    let filePath, line;
    
    if (type === 'movie') {
      // Add to catalog.txt
      filePath = path.join(process.cwd(), 'functions/data/catalog.txt');
      line = `${title}|${url}|${image}|${category}`;
      
    } else if (type === 'series') {
      // Add to series.txt
      filePath = path.join(process.cwd(), 'functions/data/series.txt');
      const subsStr = Array.isArray(subtitles) ? subtitles.join(',') : '';
      line = `${seriesName}|${title}|${url}|${image}|${genre}|${subsStr}`;
      
    } else if (type === 'foreign') {
      // Add to foreign-series.txt
      filePath = path.join(process.cwd(), 'functions/data/foreign-series.txt');
      const subsStr = Array.isArray(subtitles) ? subtitles.join(',') : '';
      line = `${seriesName}|${title}|${url}|${image}|${subsStr}`;
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to file
    fs.appendFileSync(filePath, line + '\n', 'utf-8');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Content added successfully' })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
