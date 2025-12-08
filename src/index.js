import express from "express";
import { asyncHandler } from "./utils/AsyncHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";
import { connectDb } from "./db/db.js";
import envConfig from "./config/env.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, null, "Server health is good"));
  }),
);

//Db connection
// const db = await connectDb();
// app.use((req, res, next) => {
//   req.db = db;
//   next();
// });

app.use(globalErrorHandler);
const PORT = envConfig.PORT;
app.listen(PORT, () => {
  console.log(`Application listen on port : ${PORT}`);
});
