import { MongoClient } from "mongodb";
import process from "process";
import envConfig from "../config/env.js";

const MONGO_URI = envConfig.MONGO_URI;

const dbClient = new MongoClient(MONGO_URI);

export async function connectDb() {
  try {
    await dbClient.connect();
    console.log("Database connected successfully");
    return dbClient.db();
  } catch (error) {
    console.error("DB connection error:", error);
    throw error;
  }
}

export async function disconnectDb() {
  try {
    await dbClient.close();
    console.log("Database disconnected successfully");
  } catch (error) {
    console.error("DB disconnection error:", error);
    throw error;
  }
}

process.on("SIGINT", async () => {
  console.log("\nSIGINT received, closing database connection...");
  await disconnectDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database connection...");
  await disconnectDb();
  process.exit(0);
});
