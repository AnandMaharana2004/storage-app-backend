export async function sendOtpMail(email, otp) {
  try {
    // TODO: actual email logic
    console.log(`Email send successfully to ${email}`);
    console.log("OTP:", otp);
    return { success: true, otp };
  } catch (error) {
    throw new Error("Failed to send OTP email: " + error.message);
  }
}
