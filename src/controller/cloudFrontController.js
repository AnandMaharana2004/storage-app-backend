import { getSignedCookieValues } from "../service/cloudfrontService";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/AsyncHandler";

export const RefreshCloudFrontCookies = asyncHandler(async (req, res) => {
  const signedCookies = getSignedCookieValues(`users-${req.usrId}/*`, {
    expiresInMinutes: 60,
    // ipAddress: req.ip,          // optional
    // dateGreaterThan: new Date() // optional
  });

  const cookieOptions = {
    domain: ".devzoon.xyz",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  for (const [name, value] of Object.entries(signedCookies)) {
    res.cookie(name, value, cookieOptions);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Refresh CDN successfully"));
});

export const GenerateCloudFrontCookies = asyncHandler(
  async (req, res, next) => {
    const signedCookies = getSignedCookieValues(`users-${req.usrId}/*`, {
      expiresInMinutes: 60,
      // ipAddress: req.ip,          // optional
      // dateGreaterThan: new Date() // optional
    });

    const cookieOptions = {
      domain: ".devzoon.xyz",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    for (const [name, value] of Object.entries(signedCookies)) {
      res.cookie(name, value, cookieOptions);
    }

    return next();
  },
);
