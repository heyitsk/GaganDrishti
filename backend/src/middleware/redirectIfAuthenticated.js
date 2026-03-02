const jwt = require('jsonwebtoken');

/**
 * Middleware to block already-authenticated users from hitting
 * /login or /register again. If a valid token is present, the
 * request is rejected. If no token or an invalid/expired token
 * is found, the request continues to the next handler.
 */
const redirectIfAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // No token present → user is not logged in, allow through
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    // Token is valid → user is already logged in
    return res.status(400).json({ error: 'You are already logged in' });
  } catch (err) {
    // Token is invalid or expired → treat as unauthenticated, allow through
    return next();
  }
};

module.exports = { redirectIfAuthenticated };
