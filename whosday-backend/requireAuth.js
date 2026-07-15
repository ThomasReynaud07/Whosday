const supabaseAdmin = require('./supabaseAdmin');

// Verifies the Supabase session JWT the app sends in the Authorization
// header, and attaches the authenticated user's id to the request.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  req.userId = data.user.id;
  next();
}

module.exports = requireAuth;
