// Wraps an async controller so thrown errors are handled with automatic transient DB retry
const asyncHandler = (fn) => async (req, res, next) => {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(req, res, next);
    } catch (err) {
      const isMongoGlitch =
        err.name === "MongoNetworkError" ||
        err.name === "MongoPoolClearedError" ||
        err.name === "MongoServerSelectionError" ||
        (err.message && (err.message.includes("SSL routines") || err.message.includes("connection closed")));

      if (isMongoGlitch && attempt < maxRetries && !res.headersSent) {
        console.warn(
          `[Database Retry] Transient network glitch on ${req.method} ${req.originalUrl}. Retrying in 750ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await new Promise((r) => setTimeout(r, 750));
        continue;
      }
      return next(err);
    }
  }
};

module.exports = asyncHandler;
