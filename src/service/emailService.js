export async function sendOtpMail(otp) {
  try {
    // TODO: actual email logic
    console.log("OTP:", otp);
    return { success: true, otp };
  } catch (error) {
    throw new Error("Failed to send OTP email: " + error.message);
  }
}
