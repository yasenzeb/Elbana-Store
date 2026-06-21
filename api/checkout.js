const ALLOWED_ORIGIN = 'https://kadry1.com';

// In-memory rate limiter: prevent notification flooding.
// Max 20 notifications per IP per 10 minutes.
const notifyTracker = new Map();
const MAX_NOTIFY    = 20;
const NOTIFY_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkNotifyLimit(ip) {
  const now   = Date.now();
  const entry = notifyTracker.get(ip) || { count: 0, resetAt: now + NOTIFY_WINDOW };

  if (now > entry.resetAt) {
    notifyTracker.set(ip, { count: 1, resetAt: now + NOTIFY_WINDOW });
    return true;
  }

  entry.count += 1;
  notifyTracker.set(ip, entry);
  return entry.count <= MAX_NOTIFY;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

  if (!checkNotifyLimit(ip)) {
    // Silently drop — don't reveal rate limiting details to potential abusers
    return res.status(200).json({ success: true, notified: false });
  }

  const P_USER  = process.env.PUSHOVER_USER;
  const P_TOKEN = process.env.PUSHOVER_TOKEN;

  if (!P_USER || !P_TOKEN) {
    // Pushover not configured — order is still saved, just no notification
    return res.status(200).json({ success: true, notified: false });
  }

  const { title, message } = req.body || {};

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'title and message are required.' });
  }

  try {
    const fd = new URLSearchParams();
    fd.append('token',    P_TOKEN);
    fd.append('user',     P_USER);
    fd.append('title',    String(title).slice(0, 250));
    fd.append('message',  String(message).slice(0, 1024));
    fd.append('priority', '1');
    fd.append('sound',    'cashregister');

    const resp = await fetch('https://api.pushover.net/1/messages.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    fd.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Pushover error ${resp.status}: ${text}`);
    }

    return res.status(200).json({ success: true, notified: true });
  } catch (err) {
    console.error('[api/checkout] pushover failed:', err.message);
    // Return success so the order is not blocked by a notification failure
    return res.status(200).json({ success: true, notified: false, warning: err.message });
  }
}
