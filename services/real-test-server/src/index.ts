import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/database";
import authRoutes from "./routes/auth.route";
import adminRoutes from "./routes/admin.route";
import userRoutes from "./routes/user.route";
import { installSiren } from "./siren";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Siren demo instrumentation: fault-aware /health + runtime fault injection +
// background self-check. Registered BEFORE the routes so its /health wins.
installSiren(app);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

// Listen FIRST so /health responds immediately. The DB status is simulated from
// the baked fault (see siren.ts); we only open a real connection if explicitly
// asked (USE_REAL_DB=true) so the demo logs stay focused on the injected fault.
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (process.env.MONGODB_URI && process.env.USE_REAL_DB === "true") {
  connectDB().catch((error) => {
    console.error("MongoDB connection failed (continuing for demo):", error);
  });
}
