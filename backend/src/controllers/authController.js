import { registerSchema, loginSchema } from '../utils/validationSchemas.js';
import authService from '../services/authService.js';

// Register new user
const register = async (req, res) => {
  // Validate input using Zod
  const validationResult = registerSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.issues.map(err => err.message).join(', ');
    return res.status(400).json({ error: errorMessages });
  }

  const { username, password } = validationResult.data;

  try {
    const result = await authService.registerUser(username, password);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Register error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Server error' });
  }
};

// Login user
const login = async (req, res) => {
  // Validate input using Zod
  const validationResult = loginSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.issues.map(err => err.message).join(', ');
    return res.status(400).json({ error: errorMessages });
  }

  const { username, password } = validationResult.data;

  try {
    const result = await authService.loginUser(username, password);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Server error' });
  }
};

export { register, login };
