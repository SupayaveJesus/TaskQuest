
const jwt = require("jsonwebtoken");
const { ApiError } = require("./error.middleware");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === "string" && authHeader.match(/^Bearer ([^\s]+)$/);
  if (!match) return next(new ApiError(401, "AUTH_REQUIRED", "A Bearer token is required"));
  try {
    req.user = jwt.verify(match[1], process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new ApiError(401, "INVALID_TOKEN", "The access token is invalid or expired"));
  }
};

module.exports = authenticateToken;
