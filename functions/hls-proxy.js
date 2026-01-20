exports.handler = async (event) => {
  // Check authentication
  const token = event.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return { 
      statusCode: 401, 
      body: 'Unauthorized' 
    };
  }

  const { url } = event.queryStringParameters || {};
  
  if (!url) {
    return { 
      statusCode: 400, 
      body: 'URL parameter required' 
    };
  }

  try {
    // Fetch the HLS content from the external server
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin,
        'Origin': new URL(url).origin
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Failed to fetch: ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    
    // Read the body once based on content type
    const isTextContent = contentType.includes('mpegurl') || 
                          contentType.includes('m3u8') || 
                          contentType.includes('text') ||
                          url.includes('.m3u8');

    let body;
    let isBase64 = false;

    if (isTextContent) {
      // Text content (playlists)
      body = await response.text();
      
      // Rewrite relative URLs in the playlist to go through our proxy
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      body = body.split('\n').map(line => {
        if (line.trim() && !line.startsWith('#')) {
          // It's a URL line
          let targetUrl = line.trim();
          
          // Convert relative URLs to absolute
          if (!targetUrl.startsWith('http')) {
            targetUrl = baseUrl + targetUrl;
          }
          
          // Proxy the URL through our function
          return `/.netlify/functions/hls-proxy?url=${encodeURIComponent(targetUrl)}`;
        }
        return line;
      }).join('\n');
    } else {
      // Binary content (video segments)
      const buffer = await response.arrayBuffer();
      body = Buffer.from(buffer).toString('base64');
      isBase64 = true;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=300'
      },
      body: body,
      isBase64Encoded: isBase64
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      body: `Proxy error: ${error.message}`
    };
  }
};
