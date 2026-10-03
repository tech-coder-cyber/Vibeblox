// VibeBlox AI proxy (Self-contained JavaScript Pages Function served at /api/ai)
// -----------------------------------------------------------------------------

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function rateLimited(ip, maxRequests) {
  const limit = Number(maxRequests ?? 20) || 20;
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); 
  return false;
}

const json = (status, error) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost(context) {
  const req = context.request;
  const key = context.env.GEMINI_API_KEY;
  const clientIp = req.headers.get('CF-Connecting-IP') ?? 'unknown';

  if (!key) return json(500, 'The server has no GEMINI_API_KEY set yet.');
  if (rateLimited(clientIp, context.env.AI_REQUESTS_PER_WINDOW)) {
    return json(429, 'Too many requests. Wait a few minutes and try again.');
  }

  let input;
  try { 
    input = await req.json(); 
  } catch { 
    return json(400, 'Bad request'); 
  }
  
  // Format the history arrays natively into Google's standard layout structures
  const userMessage = input.message || (input.history && input.history[input.history.length - 1]?.text) || '';
  
  try {
    // Secure server-to-server call directly to the official Google Gemini endpoint
    const googleResponse = await fetch(`https://googleapis.com{key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }]
      })
    });

    const data = await googleResponse.json();
    
    // Extract text safely from standard Gemini schema response structure
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "The assistant is resting right now. Try again.";

    // Return the response back matching exactly what your frontend UI is expecting
    return new Response(JSON.stringify({ text: aiText }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 502 });
  }
}
