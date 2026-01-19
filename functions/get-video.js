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
    // Read catalog files
    const catalogPath = path.join(__dirname, "data", "catalog.txt");
    const seriesPath = path.join(__dirname, "data", "series.txt");
    const foreignSeriesPath = path.join(__dirname, "data", "foreign-series.txt");
    
    let catalogText = "";
    let seriesText = "";
    let foreignSeriesText = "";
    
    if (fs.existsSync(catalogPath)) {
      catalogText = fs.readFileSync(catalogPath, "utf8");
    }
    if (fs.existsSync(seriesPath)) {
      seriesText = fs.readFileSync(seriesPath, "utf8");
    }
    if (fs.existsSync(foreignSeriesPath)) {
      foreignSeriesText = fs.readFileSync(foreignSeriesPath, "utf8");
    }

    // Parse movies
    const movies = catalogText
      .split("\n")
      .filter(line => line.trim())
      .map((line, index) => {
        const parts = line.split("|").map(p => p.trim());
        return {
          id: `movie_${index}`,
          type: 'movie',
          title: parts[0] || "",
          url: parts[1] || "",
          poster: parts[2] || ""
        };
      });

    // Parse series (Arabic)
    const seriesMap = new Map();
    seriesText
      .split("\n")
      .filter(line => line.trim())
      .forEach((line, index) => {
        const parts = line.split("|").map(p => p.trim());
        const seriesName = parts[0] || "";
        const episodeName = parts[1] || "";
        const url = parts[2] || "";
        const poster = parts[3] || "";
        const genre = parts[4] || "";

        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, {
            id: `series_${seriesMap.size}`,
            type: 'series',
            title: seriesName,
            poster: poster,
            genre: genre,
            episodes: []
          });
        }

        seriesMap.get(seriesName).episodes.push({
          id: `episode_${index}`,
          name: episodeName,
          url: url
        });
      });

    // Parse foreign series
    const foreignSeriesMap = new Map();
    foreignSeriesText
      .split("\n")
      .filter(line => line.trim())
      .forEach((line, index) => {
        const parts = line.split("|").map(p => p.trim());
        const seriesName = parts[0] || "";
        const episodeName = parts[1] || "";
        const url = parts[2] || "";
        const poster = parts[3] || "";
        const genre = parts[4] || "";

        if (!foreignSeriesMap.has(seriesName)) {
          foreignSeriesMap.set(seriesName, {
            id: `foreign_series_${foreignSeriesMap.size}`,
            type: 'foreign_series',
            title: seriesName,
            poster: poster,
            genre: genre,
            episodes: []
          });
        }

        foreignSeriesMap.get(seriesName).episodes.push({
          id: `foreign_episode_${index}`,
          name: episodeName,
          url: url
        });
      });

    const series = Array.from(seriesMap.values());
    const foreignSeries = Array.from(foreignSeriesMap.values());
    
    // Find the requested video by ID
    let video = null;
    
    // Check movies
    video = movies.find(m => m.id === id);
    
    // Check Arabic series episodes
    if (!video) {
      for (const s of series) {
        video = s.episodes.find(ep => ep.id === id);
        if (video) {
          video.title = `${s.title} - ${video.name}`;
          video.poster = s.poster;
          video.type = 'episode';
          break;
        }
      }
    }

    // Check foreign series episodes
    if (!video) {
      for (const s of foreignSeries) {
        video = s.episodes.find(ep => ep.id === id);
        if (video) {
          video.title = `${s.title} - ${video.name}`;
          video.poster = s.poster;
          video.type = 'foreign_episode';
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

    // Determine if it's a Bunny video
    const isBunny = video.url.includes('player.mediadelivery.net') || 
                    video.url.includes('iframe.mediadelivery.net');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: video.title,
        url: video.url,
        poster: video.poster,
        type: isBunny ? 'bunny' : 'hls'
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
