import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initIO(server) {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    },
  });

  // JWT Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'your_jwt_secret_key');
      
      socket.user = decoded; // { id: userId, ... }
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: User ${socket.user.id} (${socket.id})`);
    
    // Automatically join a private room securely locked to this user's ID
    const userRoom = `user_${socket.user.id}`;
    socket.join(userRoom);

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: User ${socket.user.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}
