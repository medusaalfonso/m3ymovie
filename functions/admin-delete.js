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
      body: JSON.stringify({ success: false, error: 'Unauthorized' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { id } = JSON.parse(event.body);
    
    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'ID required' })
      };
    }

    // Determine file based on ID prefix
    let filePath;
    let lineIndex;
    
    if (id.startsWith('m_')) {
      filePath = path.join(process.cwd(), 'functions/data/catalog.txt');
      lineIndex = parseInt(id.substring(2));
    } else if (id.startsWith('s_')) {
      filePath = path.join(process.cwd(), 'functions/data/series.txt');
      lineIndex = parseInt(id.substring(2));
    } else if (id.startsWith('f_')) {
      filePath = path.join(process.cwd(), 'functions/data/foreign-series.txt');
      lineIndex = parseInt(id.substring(2));
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid ID format' })
      };
    }

    if (!fs.existsSync(filePath)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'File not found' })
      };
    }

    // Read file
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Remove the line at index
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Content not found' })
      };
    }
    
    lines.splice(lineIndex, 1);
    
    // Write back
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Content deleted' })
    };

  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
