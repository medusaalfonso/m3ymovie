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
  if (!verifyAdmin(event.headers.authorization)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    let movies = [];
    
    // Get movies from Redis
    const movieIds = await redisCommand('SMEMBERS', 'catalog:movies') || [];
    
    for (const movieId of movieIds) {
      const movieData = await redisCommand('HGETALL', `movie:${movieId}`);
      if (movieData && movieData.length > 0) {
        const movie = {};
        for (let i = 0; i < movieData.length; i += 2) {
          movie[movieData[i]] = movieData[i + 1];
        }
        movies.push(movie);
      }
    }
    
    // Get series from Redis
    const seriesIds = await redisCommand('SMEMBERS', 'catalog:series') || [];
    
    for (const seriesId of seriesIds) {
      const episodeIds = await redisCommand('SMEMBERS', `series:${seriesId}:episodes`) || [];
      
      for (const episodeId of episodeIds) {
        const epData = await redisCommand('HGETALL', `episode:${episodeId}`);
        if (epData && epData.length > 0) {
          const episode = {};
          for (let i = 0; i < epData.length; i += 2) {
            episode[epData[i]] = epData[i + 1];
          }
          movies.push({
            id: episode.id,
            title: `${episode.seriesTitle} - ${episode.title}`,
            url: episode.url,
            image: episode.image,
            category: 'مسلسل',
            type: 'series'
          });
        }
      }
    }
    
    // Get foreign series from Redis
    const foreignIds = await redisCommand('SMEMBERS', 'catalog:foreign') || [];
    
    for (const seriesId of foreignIds) {
      const episodeIds = await redisCommand('SMEMBERS', `series:${seriesId}:episodes`) || [];
      
      for (const episodeId of episodeIds) {
        const epData = await redisCommand('HGETALL', `episode:${episodeId}`);
        if (epData && epData.length > 0) {
          const episode = {};
          for (let i = 0; i < epData.length; i += 2) {
            episode[epData[i]] = epData[i + 1];
          }
          movies.push({
            id: episode.id,
            title: `${episode.seriesTitle} - ${episode.title}`,
            url: episode.url,
            image: episode.image,
            category: 'مسلسل أجنبي',
            type: 'foreign'
          });
        }
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movies })
    };
    
  } catch (error) {
    console.error('Content list error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message, movies: [] })
    };
  }
};
