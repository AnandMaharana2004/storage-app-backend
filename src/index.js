import express from "express";
import { asyncHandler } from "./utils/AsyncHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";
import { connectDB } from "./db/connection.js";
import envConfig from "./config/env.js";
import authRouter from "./routes/auth.route.js";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(envConfig.COOKIE_SECRET));

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, null, "Server health is good"));
  }),
);

// Db connection
await connectDB();

app.use("/auth", authRouter);

app.use(globalErrorHandler);
const PORT = envConfig.PORT;
app.listen(PORT, () => {
  console.log(`Application listen on port : ${PORT}`);
});
