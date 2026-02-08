const fs = require("fs");
const path = require("path");

exports.handler = async (event) => {
  // Check authentication
  const token = event.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ error: 'Unauthorized' }) 
    };
  }

  const { id } = event.queryStringParameters || {};
  
  if (!id) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'Video ID required' }) 
    };
  }

  try {
    // Call the catalog function to get all data
    const catalogPath = '/.netlify/functions/catalog';
    const foreignPath = '/.netlify/functions/foreignSeries';
    
    // Fetch catalog data (movies + series)
    let movies = [];
    let series = [];
    let foreign = [];
    
    try {
      // Read from catalog function
      const catalogUrl = `${process.env.SITE_URL || 'http://localhost:8888'}${catalogPath}`;
      const catalogRes = await fetch(catalogUrl, {
        headers: event.headers
      });
      
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        if (catalogData && typeof catalogData === 'object') {
          movies = Array.isArray(catalogData.movies) ? catalogData.movies : [];
          series = Array.isArray(catalogData.series) ? catalogData.series : [];
        }
      }
    } catch (e) {
      console.error('Error fetching catalog:', e);
    }
    
    try {
      // Read from foreignSeries function
      const foreignUrl = `${process.env.SITE_URL || 'http://localhost:8888'}${foreignPath}`;
      const foreignRes = await fetch(foreignUrl, {
        headers: event.headers
      });
      
      if (foreignRes.ok) {
        const foreignData = await foreignRes.json();
        foreign = Array.isArray(foreignData) ? foreignData : [];
      }
    } catch (e) {
      console.error('Error fetching foreign series:', e);
    }

    // Find the requested video by ID
    let video = null;
    
    // Check movies (id starts with m_)
    if (id.startsWith('m_')) {
      video = movies.find(m => m.id === id);
      if (video) {
        video.type = 'movie';
      }
    }
    
    // Check series episodes (id starts with e_)
    if (!video && id.startsWith('e_')) {
      for (const s of series) {
        const episode = (s.episodes || []).find(ep => ep.id === id);
        if (episode) {
          video = {
            id: episode.id,
            title: `${s.title} - ${episode.title}`,
            url: episode.url,
            poster: s.image,
            subs: episode.subs || [],
            type: 'episode'
          };
          break;
        }
      }
    }
    
    // Check foreign series episodes (id starts with fe_)
    if (!video && id.startsWith('fe_')) {
      for (const s of foreign) {
        const episode = (s.episodes || []).find(ep => ep.id === id);
        if (episode) {
          video = {
            id: episode.id,
            title: `${s.title} - ${episode.title}`,
            url: episode.url || episode.hlsUrl, // Support both field names
            poster: s.image,
            subs: episode.subs || [],
            type: 'foreign_episode'
          };
          break;
        }
      }
    }

    if (!video) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Video not found' })
      };
    }

    // Determine video type based on URL
    const videoType = detectVideoType(video.url);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: video.title,
        url: video.url,
        poster: video.poster || video.image,
        subs: video.subs || [],
        type: videoType
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};

function detectVideoType(url) {
  const urlLower = String(url || '').toLowerCase();
  
  // Check for Videas.fr embed
  if (urlLower.includes('videas.fr/embed/')) {
    return 'videas';
  }
  
  // Check if URL is a Bunny embed URL OR just a GUID (32-36 chars with dashes)
  const isBunnyGuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url);
  const isBunnyEmbed = urlLower.includes('player.mediadelivery.net') || 
                       urlLower.includes('iframe.mediadelivery.net') ||
                       isBunnyGuid;
  
  if (isBunnyEmbed) {
    return 'bunny';
  }
  
  // Default to HLS
  return 'hls';
}
