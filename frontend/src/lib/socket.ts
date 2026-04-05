import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem("gagandrishti_token");
    
    // Calculate base URL by stripping /api from VITE_API_URL if present, else fallback
    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const SOCKET_URL = baseURL.replace('/api', '');

    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("🟢 Connected to WebSocket Server:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.error("🔴 WebSocket Connection Error:", err.message);
    });

    socket.on("disconnect", () => {
      console.log("🟠 Disconnected from WebSocket Server");
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
