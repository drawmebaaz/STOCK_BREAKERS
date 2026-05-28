export const notFound = (req, res) => {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
};

export const errorHandler = (err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  const payload = {
    error: status >= 500 ? "Internal server error" : err.message,
  };

  if (process.env.NODE_ENV !== "production" && status >= 500) {
    payload.detail = err.message;
  }

  res.status(status).json(payload);
};
