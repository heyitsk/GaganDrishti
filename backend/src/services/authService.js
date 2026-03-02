const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Register a new user in the database.
 * @param {string} username
 * @param {string} password
 * @returns {{ message: string }}
 * @throws {Error} if username already exists
 */
const registerUser = async (username, password) => {
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    const error = new Error('Username already exists');
    error.statusCode = 400;
    throw error;
  }

  const newUser = new User({ username, password });
  await newUser.save();

  return { message: 'User registered successfully' };
};

/**
 * Authenticate a user and return a signed JWT token.
 * @param {string} username
 * @param {string} password
 * @returns {{ success: boolean, token: string, user: { id: string, username: string } }}
 * @throws {Error} if credentials are invalid
 */
const loginUser = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 400;
    throw error;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 400;
    throw error;
  }

  const payload = { id: user.id, username: user.username };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key', {
    expiresIn: '60s'
  });

  return {
    success: true,
    token: 'Bearer ' + token,
    user: {
      id: user.id,
      username: user.username
    }
  };
};

module.exports = {
  registerUser,
  loginUser
};
