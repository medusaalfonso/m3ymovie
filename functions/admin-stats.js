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
    // Read analytics from Redis or file storage
    const { createClient } = require('@upstash/redis');
    
    const redis = createClient({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    
    // Get analytics data
    const totalViews = await redis.get('analytics:totalViews') || 0;
    const totalHours = await redis.get('analytics:totalHours') || 0;
    const todayKey = `analytics:visitors:${new Date().toISOString().split('T')[0]}`;
    const todayVisitors = await redis.get(todayKey) || 0;
    
    // Get total movies count
    const catalogPath = path.join(process.cwd(), 'functions/data/catalog.txt');
    const catalogContent = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf-8') : '';
    const totalMovies = catalogContent.split('\n').filter(line => line.trim()).length;
    
    // Get top content
    const topContent = await redis.get('analytics:topContent') || 'لا توجد بيانات';
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalViews: parseInt(totalViews) || 0,
        totalHours: Math.round((parseInt(totalHours) || 0) / 3600), // Convert seconds to hours
        todayVisitors: parseInt(todayVisitors) || 0,
        totalMovies,
        topContent
      })
    };
    
  } catch (error) {
    console.error('Stats error:', error);
    
    // Fallback to mock data if Redis fails
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
