const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Verify admin token
function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
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
  // Verify admin
  if (!verifyAdmin(event.headers.authorization)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    let totalViews = 0;
    let totalHours = 0;
    let todayVisitors = 0;
    
    if (REDIS_URL && REDIS_TOKEN) {
      // Helper function to call Redis REST API
      async function redisGet(key) {
        try {
          const response = await fetch(`${REDIS_URL}/GET/${key}`, {
            headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` }
          });
          const data = await response.json();
          return data.result || 0;
        } catch (e) {
          return 0;
        }
      }
      
      // Get analytics data
      totalViews = await redisGet('analytics:totalViews');
      totalHours = await redisGet('analytics:totalHours');
      const todayKey = `analytics:visitors:${new Date().toISOString().split('T')[0]}`;
      todayVisitors = await redisGet(todayKey);
    }
    
    // Get total movies count
    const catalogPath = path.join(process.cwd(), 'functions/data/catalog.txt');
    const catalogContent = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf-8') : '';
    const totalMovies = catalogContent.split('\n').filter(line => line.trim()).length;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalViews: parseInt(totalViews) || 0,
        totalHours: Math.round((parseInt(totalHours) || 0) / 3600), // Convert seconds to hours
        todayVisitors: parseInt(todayVisitors) || 0,
        totalMovies,
        topContent: 'قريباً'
      })
    };
    
  } catch (error) {
    console.error('Stats error:', error);
    
    // Fallback to zero data if error
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalViews: 0,
        totalHours: 0,
        todayVisitors: 0,
        totalMovies: 0,
        topContent: 'لا توجد بيانات'
      })
    };
  }
};
