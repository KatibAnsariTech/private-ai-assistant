import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";
import { progressEmitter } from "./utils/progress.js";

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

//    FIX 1: Disable request timeouts (important!)
app.use((req, res, next) => {
    req.setTimeout(0);   // No timeout for incoming requests
    res.setTimeout(0);   // No timeout for responses
    next();
});

//    FIX 2: CORS - Allow frontend to open SSE stream
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());

app.use("/api", uploadRoutes);
app.use("/api", aiRoutes);
app.use("/api/query", queryRoutes);

app.get("/", (req, res) => {
    res.send("server is working fine ✅");
});

//    FIX 3: SSE progress endpoint with all required headers
app.get("/api/progress", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", process.env.CLIENT_URL || "*");

    // Important for Render / Railway
    res.flushHeaders?.();

    const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    progressEmitter.on("progress", sendProgress);

    req.on("close", () => {
        progressEmitter.removeListener("progress", sendProgress);
    });
});

//    START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
