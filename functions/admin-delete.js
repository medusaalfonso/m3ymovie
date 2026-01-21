const jwt = require('jsonwebtoken');

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

async function redisCommand(command, ...args) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const response = await fetch(`${REDIS_URL}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
    headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` }
  });
  return response.json();
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

    // Can't delete file-based content (read-only)
    if (id.includes('_file_')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Cannot delete file-based content. Only Redis content can be deleted.' })
      };
    }

    // Delete based on ID prefix
    if (id.startsWith('m_')) {
      // Delete movie
      await redisCommand('DEL', `movie:${id}`);
      await redisCommand('SREM', 'catalog:movies', id);
      
    } else if (id.startsWith('e_')) {
      // Delete episode
      const epData = await redisCommand('HGETALL', `episode:${id}`);
      
      if (epData && epData.length > 0) {
        let seriesId = null;
        let isForeign = false;
        
        // Parse episode data
        for (let i = 0; i < epData.length; i += 2) {
          if (epData[i] === 'seriesId') seriesId = epData[i + 1];
          if (epData[i] === 'type' && epData[i + 1] === 'foreign_episode') isForeign = true;
        }
        
        if (seriesId) {
          // Remove episode from series
          await redisCommand('SREM', `series:${seriesId}:episodes`, id);
          
          // Check if series has no more episodes
          const remainingEps = await redisCommand('SMEMBERS', `series:${seriesId}:episodes`);
          
          if (!remainingEps || remainingEps.length === 0) {
            // Delete the series too
            await redisCommand('DEL', `series:${seriesId}`);
            const listKey = isForeign ? 'catalog:foreign' : 'catalog:series';
            await redisCommand('SREM', listKey, seriesId);
          }
        }
        
        // Delete episode
        await redisCommand('DEL', `episode:${id}`);
      }
    }

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
