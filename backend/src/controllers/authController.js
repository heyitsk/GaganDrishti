const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerSchema } = require('../utils/validationSchemas');

// Register new user
const register = async (req, res) => {
  const { username, password } = req.body;

  // Validate input using Zod
  const validationResult = registerSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    const errorMessages = validationResult.error.issues.map(err => err.message).join(', ');
    return res.status(400).json({ error: errorMessages });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Login user
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key', {
      expiresIn: '60s'
    });

    res.json({
      success: true,
      token: 'Bearer ' + token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  register,
  login
};
