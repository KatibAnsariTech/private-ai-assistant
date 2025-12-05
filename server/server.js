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
app.use(cors());
app.use(express.json());

app.use("/api", uploadRoutes);
app.use("/api", aiRoutes);
app.use("/api/query", queryRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));

