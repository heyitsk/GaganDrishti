import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import passport from "passport";
import connectCluster from "./config/database";
import authRoutes from "./routes/authRoutes";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Passport configuration
require("./config/passport")(passport);
app.use(passport.initialize());

// Routes
app.use("/api/auth", authRoutes);

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