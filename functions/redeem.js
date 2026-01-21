const jwt = require('jsonwebtoken');

async function redisCommand(command, ...args) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  
  try {
    const response = await fetch(`${REDIS_URL}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
      headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` }
    });
    const data = await response.json();
    return data.result;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { code } = JSON.parse(event.body || '{}');
    
    if (!code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Code required' })
      };
    }

    const JWT_SECRET = process.env.SESSION_JWT_SECRET;
    const STATIC_PASSWORD = process.env.STATIC_LOGIN_PASSWORD || 'mystaticpass123';
    
    // ===================================
    // Check 1: Is it the static password?
    // ===================================
    if (code === STATIC_PASSWORD) {
      // Generate session token
      const token = jwt.sign(
        { 
          method: 'static_password',
          timestamp: Date.now() 
        },
        JWT_SECRET,
        { expiresIn: '30d' } // 30 days session
      );
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'Login successful',
          method: 'static_password'
        })
      };
    }
    
    // ===================================
    // Check 2: Is it a one-time code from bot?
    // ===================================
    const storedData = await redisCommand('GET', `code:${code}`);
    
    if (!storedData) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired code' 
        })
      };
    }

    // Parse stored data
    let userData;
    try {
      userData = JSON.parse(storedData);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid code format' })
      };
    }

    // Delete the code (one-time use)
    await redisCommand('DEL', `code:${code}`);

    // Generate session token
    const token = jwt.sign(
      { 
        userId: userData.userId,
        username: userData.username,
        method: 'telegram_bot',
        timestamp: Date.now() 
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Login successful',
        method: 'telegram_bot',
        user: userData.username 
      })
    };

  } catch (error) {
    console.error('Redeem error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
