const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only allow authenticated users
  const token = event.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return { 
      statusCode: 401, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let videoId;
  try {
    const body = JSON.parse(event.body || '{}');
    videoId = body.videoId;
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }
  
  if (!videoId) {
    return { 
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'videoId required' })
    };
  }

  // Your Bunny Stream settings from environment variables
  const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
  const SECURITY_KEY = process.env.BUNNY_SECURITY_KEY;
  
  if (!LIBRARY_ID || !SECURITY_KEY) {
    console.error('Missing Bunny CDN credentials');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }
  
  // Token expiration (24 hours from now)
  const expirationTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  
  // Generate the signature for Bunny Stream Embed
  // Algorithm: SHA256(securityKey + videoId + expirationTime)
  const signatureString = `${SECURITY_KEY}${videoId}${expirationTime}`;
  const signature = crypto
    .createHash('sha256')
    .update(signatureString)
    .digest('hex');
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: signature,
      expires: expirationTime,
      libraryId: LIBRARY_ID
    })
  };
};
