import express from "express";
import { asyncHandler } from "./utils/AsyncHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";
import { connectDB } from "./db/connection.js";
import envConfig from "./config/env.js";
import authRouter from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import userRouter from "./routes/user.route.js";
import directoryRouter from "./routes/directory.route.js";
import fileRouter from "./routes/file.route.js";
import cdnRouter from "./routes/cloudfront.route.js";
import sharedRoute from "./routes/share.route.js";
import setupSwagger from "./docs/index.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(envConfig.COOKIE_SECRET));
app.use(
  cors({
    origin: [envConfig.FRONTEND_URL2, envConfig.FRONTEND_URL1],
    credentials: true,
  }),
);

setupSwagger(app);

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, null, "Server health is good"));
  }),
);

// Db connection
await connectDB();

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/directory", directoryRouter);
app.use("/files", fileRouter);
app.use("/cdn", cdnRouter);
app.use("/share", sharedRoute);
app.use(globalErrorHandler);
const PORT = envConfig.PORT;
app.listen(PORT, () => {
  console.log(`Application listen on port : ${PORT}`);
});
