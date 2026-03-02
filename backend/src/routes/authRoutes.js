const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { redirectIfAuthenticated } = require('../middleware/redirectIfAuthenticated');

// Register route
router.post('/register', authLimiter, redirectIfAuthenticated, register);

// Login route
router.post('/login', authLimiter, redirectIfAuthenticated, login);

module.exports = router;
