const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for auth routes (/login and /register).
 * Allows a maximum of 10 requests per 15-minute window per IP.
 * This protects against brute-force and credential stuffing attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 requests per window per IP
  standardHeaders: true,     // sends RateLimit-* headers in response
  legacyHeaders: false,      // disables the X-RateLimit-* legacy headers
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

module.exports = { authLimiter };
