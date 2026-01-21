const jwt = require('jsonwebtoken');
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
    const data = JSON.parse(event.body);
    const { type, title, url, image, category, seriesName, genre, subtitles } = data;

    if (!title || !url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    let item;
    
    if (type === 'movie') {
      // Create movie object
      item = {
        id: generateId('m'),
        title,
        url,
        image: image || '',
        category: category || 'أفلام',
        type: 'movie'
      };
      
      // Store in Redis
      await redisCommand('HSET', `movie:${item.id}`, 
        'id', item.id,
        'title', item.title,
        'url', item.url,
        'image', item.image,
        'category', item.category,
        'type', item.type
      );
      
      // Add to movies list
      await redisCommand('SADD', 'catalog:movies', item.id);
      
    } else if (type === 'series' || type === 'foreign') {
      // Create episode object
      const episodeId = generateId('e');
      const seriesId = generateId('s');
      
      item = {
        id: episodeId,
        seriesId,
        seriesTitle: seriesName,
        title,
        url,
        image: image || '',
        genre: genre || '',
        subs: subtitles || [],
        type: type === 'foreign' ? 'foreign_episode' : 'episode'
      };
      
      // Store episode in Redis
      await redisCommand('HSET', `episode:${episodeId}`,
        'id', episodeId,
        'seriesId', seriesId,
        'seriesTitle', seriesName,
        'title', title,
        'url', url,
        'image', image || '',
        'genre', genre || '',
        'subs', JSON.stringify(subtitles || []),
        'type', item.type
      );
      
      // Add to series episodes list
      await redisCommand('SADD', `series:${seriesId}:episodes`, episodeId);
      
      // Store series info
      await redisCommand('HSET', `series:${seriesId}`,
        'id', seriesId,
        'title', seriesName,
        'image', image || '',
        'genre', genre || ''
      );
      
      // Add to series list
      const listKey = type === 'foreign' ? 'catalog:foreign' : 'catalog:series';
      await redisCommand('SADD', listKey, seriesId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Content added successfully', id: item.id })
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
