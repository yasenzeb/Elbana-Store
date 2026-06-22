const ALLOWED_ORIGIN = 'https://kadry1.com';

// In-memory brute-force tracker: ip -> { count, resetAt }
// Serverless functions share state only within the same instance.
// This is a best-effort defence — for stronger protection add Upstash/Redis.
const ipAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 60 * 1000; // 1 minute

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = ipAttempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    // Window expired — reset
    ipAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  entry.count += 1;
  ipAttempts.set(ip, entry);

  if (entry.count > MAX_ATTEMPTS) {
    const waitSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, waitSec };
  }

  return { allowed: true };
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
  const { allowed, waitSec } = checkRateLimit(ip);

  if (!allowed) {
    return res.status(429).json({
      success: false,
      error: `محظور مؤقتاً. انتظر ${waitSec} ثانية.`,
    });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ success: false, error: 'كلمة المرور مطلوبة.' });
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    console.error('[api/auth] ADMIN_PASSWORD env var is not set.');
    return res.status(500).json({ success: false, error: 'خطأ في إعداد الخادم.' });
  }

  if (password === ADMIN_PASSWORD) {
    // Reset counter on successful login
    ipAttempts.delete(ip);
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false, error: 'كلمة المرور غلط!' });
}
