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
    let body = await response.text();

    // If it's a master playlist (m3u8), we need to rewrite URLs to go through our proxy
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.includes('.m3u8')) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      // Rewrite relative URLs in the playlist to absolute URLs through our proxy
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
      body: contentType.includes('mpegurl') || contentType.includes('m3u8') ? body : Buffer.from(await response.arrayBuffer()).toString('base64'),
      isBase64Encoded: !(contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text'))
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      body: `Proxy error: ${error.message}`
    };
  }
};
