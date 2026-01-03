import process from "process";
export const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Development logging (optional)
  if (statusCode >= 500) console.error("🔥 Error:", err);

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message: statusCode >= 500 ? "Internal Server Error" : message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
