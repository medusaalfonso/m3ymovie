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
    
    const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!REDIS_URL || !REDIS_TOKEN) {
      console.log('Redis not configured, skipping analytics');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // Helper function to call Redis REST API
    async function redisCommand(command, ...args) {
      const response = await fetch(`${REDIS_URL}/${command}/${args.join('/')}`, {
        headers: {
          'Authorization': `Bearer ${REDIS_TOKEN}`
        }
      });
      return response.json();
    }

    if (action === 'start') {
      // Increment total views
      await redisCommand('INCR', 'analytics:totalViews');
      
      // Track today's visitors (using IP or session)
      const todayKey = `analytics:visitors:${new Date().toISOString().split('T')[0]}`;
      await redisCommand('INCR', todayKey);
      await redisCommand('EXPIRE', todayKey, 86400 * 7); // Keep for 7 days
      
      // Track video views
      if (videoId) {
        await redisCommand('INCR', `analytics:video:${videoId}:views`);
      }
      
    } else if (action === 'progress' && duration) {
      // Add watch time (in seconds)
      await redisCommand('INCRBY', 'analytics:totalHours', Math.floor(duration));
      
      if (videoId) {
        await redisCommand('INCRBY', `analytics:video:${videoId}:duration`, Math.floor(duration));
      }
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
