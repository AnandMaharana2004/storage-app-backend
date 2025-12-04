import express from "express";
import process from "process";
import { asyncHandler } from "./utils/AsyncHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { globalErrorHandler } from "./middleware/globalErrorHandler.js";

const app = express();

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, null, "Server health is good"));
  }),
);

app.use(globalErrorHandler);
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Application listen on port : ${PORT}`);
});
