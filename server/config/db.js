import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config();

const DB = process.env.MONGODB_URI;

export const connectDB = async () => {
  try {
    await mongoose.connect(DB);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};
