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

export async function sendForgotPasswordMail(email, url) {
  try {
    console.log(`Email send successfully to ${email}`);
    console.log("link:", url);
    return { success: true, url };
  } catch (error) {
    throw new Error("Failed to send forgot password mail" + error.message);
  }
}
