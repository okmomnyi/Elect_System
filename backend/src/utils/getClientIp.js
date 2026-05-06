/**
 * Extracts the real client IP address from an Express request.
 * Handles direct connections and proxied requests (nginx, load balancers).
 * req.socket replaces the deprecated req.connection in Node 13+.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = { getClientIp };
