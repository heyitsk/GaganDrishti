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
import "./workers/scanWorker.js";   // boots the scan queue worker in-process

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

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
connectCluster()
  .then(() => {
    console.log("✅ Database connection established");
    const server = app.listen(process.env.PORT || 5000, () => {
      console.log(
        `🚀 Server successfully listening on port ${process.env.PORT || 5000}`
      );
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1); // Exit process if DB connection fails
  });