class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = status >= 500 ? "An unexpected error occurred" : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
}

module.exports = { ApiError, errorHandler };
