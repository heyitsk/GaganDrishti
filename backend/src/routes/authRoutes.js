import express from 'express';
import { register, login } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { redirectIfAuthenticated } from '../middleware/redirectIfAuthenticated.js';

const router = express.Router();
// Register route
router.post('/register', authLimiter, redirectIfAuthenticated, register);

// Login route
router.post('/login', authLimiter, redirectIfAuthenticated, login);

export default router;
