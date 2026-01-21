const fs = require('fs');
const path = require('path');

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
  try {
    let movies = [];
    let series = [];
    
    // ===========================
    // 1. Load from Redis (new content uploaded via admin panel)
    // ===========================
    
    // Get all movie IDs
    const movieIds = await redisCommand('SMEMBERS', 'catalog:movies') || [];
    
    for (const movieId of movieIds) {
      const movieData = await redisCommand('HGETALL', `movie:${movieId}`);
      if (movieData && movieData.length > 0) {
        // Redis HGETALL returns array: [key1, value1, key2, value2, ...]
        const movie = {};
        for (let i = 0; i < movieData.length; i += 2) {
          movie[movieData[i]] = movieData[i + 1];
        }
        movies.push(movie);
      }
    }
    
    // Get all series IDs
    const seriesIds = await redisCommand('SMEMBERS', 'catalog:series') || [];
    
    for (const seriesId of seriesIds) {
      const seriesData = await redisCommand('HGETALL', `series:${seriesId}`);
      if (!seriesData || seriesData.length === 0) continue;
      
      // Parse series info
      const seriesInfo = {};
      for (let i = 0; i < seriesData.length; i += 2) {
        seriesInfo[seriesData[i]] = seriesData[i + 1];
      }
      
      // Get episodes
      const episodeIds = await redisCommand('SMEMBERS', `series:${seriesId}:episodes`) || [];
      const episodes = [];
      
      for (const episodeId of episodeIds) {
        const epData = await redisCommand('HGETALL', `episode:${episodeId}`);
        if (epData && epData.length > 0) {
          const episode = {};
          for (let i = 0; i < epData.length; i += 2) {
            episode[epData[i]] = epData[i + 1];
          }
          // Parse subs JSON
          if (episode.subs) {
            try {
              episode.subs = JSON.parse(episode.subs);
            } catch (e) {
              episode.subs = [];
            }
          }
          episodes.push(episode);
        }
      }
      
      series.push({
        id: seriesInfo.id,
        title: seriesInfo.title,
        image: seriesInfo.image,
        genre: seriesInfo.genre,
        count: episodes.length,
        episodes
      });
    }
    
    // ===========================
    // 2. Load from Files (existing content from catalog.txt)
    // ===========================
    
    const catalogPath = path.join(process.cwd(), 'functions/data/catalog.txt');
    const seriesPath = path.join(process.cwd(), 'functions/data/series.txt');
    
    // Read movies from file
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf-8');
      const fileMovies = content.split('\n')
        .filter(line => line.trim())
        .map((line, idx) => {
          const parts = line.split('|').map(p => p.trim());
          return {
            id: `m_file_${idx}`,
            title: parts[0] || '',
            url: parts[1] || '',
            image: parts[2] || '',
            category: parts[3] || 'أفلام',
            type: 'movie'
          };
        });
      movies = [...movies, ...fileMovies];
    }
    
    // Read series from file
    if (fs.existsSync(seriesPath)) {
      const content = fs.readFileSync(seriesPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const seriesMap = new Map();
      
      lines.forEach((line, idx) => {
        const parts = line.split('|').map(p => p.trim());
        const seriesName = parts[0] || '';
        const episodeName = parts[1] || '';
        const url = parts[2] || '';
        const poster = parts[3] || '';
        const genre = parts[4] || '';
        const subsRaw = parts[5] || '';
        
        if (!seriesName) return;
        
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, {
            id: `s_file_${seriesMap.size}`,
            title: seriesName,
            image: poster,
            genre: genre,
            episodes: []
          });
        }
        
        // Parse subs
        const subs = subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        seriesMap.get(seriesName).episodes.push({
          id: `e_file_${idx}`,
          title: episodeName,
          url: url,
          subs: subs.map((s, i) => ({
            lang: `s${i+1}`,
            label: `SUB ${i+1}`,
            url: s
          }))
        });
      });
      
      series = [...series, ...Array.from(seriesMap.values())];
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movies, series })
    };
    
  } catch (error) {
    console.error('Catalog error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message, movies: [], series: [] })
    };
  }
};
