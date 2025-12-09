import mongoose from "mongoose";
import process from "process";
import envConfig from "../config/env.js";

export async function connectDB() {
  try {
    await mongoose.connect(envConfig.MONGO_URI);
    console.log("Database connected");
  } catch (err) {
    console.log(err);
    console.log("Could Not Connect to the Database");
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  console.log("Database Disconnected!");
  process.exit(0);
});
