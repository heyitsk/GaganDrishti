import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import passport from "passport";
import connectCluster from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import awsScanRoutes from "./routes/awsScanRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import scanRoutes from "./routes/scanRoutes.js";
import credentialRoutes from "./routes/credentialRoutes.js";
import configurePassport from "./config/passport.js";
import { checkRedisConnection } from "./config/bullmq.js";


import { initIO } from "./config/socket.js";

const app = express();


// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

// Passport configuration
configurePassport(passport);
app.use(passport.initialize());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/aws/scan", awsScanRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api", scanRoutes);

// Database connection and server start
Promise.all([
  connectCluster().then(() => console.log("✅ Database connection established")),
  checkRedisConnection() // logs its own success message
])
  .then(async () => {
    // Boot the scan queue worker ONLY after verifying Redis is actually up
    await import("./workers/scanWorker.js"); 
    
    const server = app.listen(process.env.PORT || 5000, () => {
      console.log(
        `🚀 Server successfully listening on port ${process.env.PORT || 5000}`
      );
    });
    
    // Initialize WebSockets bcz web sockets use exisiting http connection to setup and initialise
    initIO(server);
  })
  .catch((err) => {
    console.error("❌ Startup failed due to connection error:", err.message);
    process.exit(1); // Exit process if DB or Redis connection fails
  });