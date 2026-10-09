// @ts-check
/**
 * @file src/middleware/errorHandler.js
 * @description Central Express error handler returning structured JSON errors.
 * Never logs user plans or API keys.
 */

/**
 * Express error handling middleware.
 * @param {any} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'Malformed JSON payload',
      },
    });
    return;
  }

  // Handle payload too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    res.status(413).json({
      error: {
        code: 'payload_too_large',
        message: 'Request payload exceeds size limit',
      },
    });
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'An unexpected internal error occurred' : err.message;

  res.status(status).json({
    error: {
      code: status === 400 ? 'invalid_request' : 'internal_error',
      message,
    },
  });
}
