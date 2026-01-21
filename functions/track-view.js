exports.handler = async (event) => {
  // Check authentication
  const token = event.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { videoId, duration, action } = JSON.parse(event.body || '{}');
    
    const { createClient } = require('@upstash/redis');
    
    const redis = createClient({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    if (action === 'start') {
      // Increment total views
      await redis.incr('analytics:totalViews');
      
      // Track today's visitors (using IP or session)
      const todayKey = `analytics:visitors:${new Date().toISOString().split('T')[0]}`;
      await redis.incr(todayKey);
      await redis.expire(todayKey, 86400 * 7); // Keep for 7 days
      
      // Track video views
      await redis.incr(`analytics:video:${videoId}:views`);
      
    } else if (action === 'progress' && duration) {
      // Add watch time (in seconds)
      await redis.incrby('analytics:totalHours', Math.floor(duration));
      await redis.incrby(`analytics:video:${videoId}:duration`, Math.floor(duration));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 200, // Don't fail the request
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
