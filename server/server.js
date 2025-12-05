import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.use("/api", uploadRoutes);
app.use("/api", aiRoutes);
app.use("/api/query", queryRoutes);

const PORT = process.env.PORT || 5000;

// THIS MUST RUN IN RENDER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
