const crypto = require('crypto');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { password } = JSON.parse(event.body);
    
    // Get admin password from environment variable
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    const JWT_SECRET = process.env.SESSION_JWT_SECRET;
    
    if (password === ADMIN_PASSWORD) {
      // Generate admin token
      const token = jwt.sign(
        { role: 'admin', timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, token })
      };
    }
    
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid password' })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
