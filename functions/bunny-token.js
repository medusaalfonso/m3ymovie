const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only allow authenticated users
  const token = event.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { videoId } = JSON.parse(event.body || '{}');
  
  if (!videoId) {
    return { statusCode: 400, body: 'videoId required' };
  }

  // Your Bunny Stream settings
  const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID; // e.g., "12345"
  const SECURITY_KEY = process.env.BUNNY_SECURITY_KEY; // From library settings
  
  // Token expiration (e.g., 24 hours from now)
  const expirationTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  
  // Generate the signature
  const signatureString = `${LIBRARY_ID}${SECURITY_KEY}${expirationTime}${videoId}`;
  const signature = crypto
    .createHash('sha256')
    .update(signatureString)
    .digest('hex');
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: signature,
      expires: expirationTime
    })
  };
};
```

### 2. **Update Environment Variables** (Netlify)
