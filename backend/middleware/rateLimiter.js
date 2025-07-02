const rateLimit = require('express-rate-limit');

class RateLimiter {
  /**
   * Create rate limiter for API keys
   * @param {Object} options - Rate limiting options
   */
  static createAPIKeyRateLimit(options = {}) {
    const {
      windowMs = 60 * 60 * 1000, // 1 hour
      max = 1000, // max requests per window
      message = 'Rate limit exceeded for this API key'
    } = options;

    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => {
        // Use API key or IP as fallback
        return req.apiKeyRecord?.keyId || req.ip;
      },
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          details: `Maximum ${max} requests per hour allowed`
        }
      },
      skip: (req) => {
        // Skip rate limiting for dev keys
        return req.isDevKey;
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Create project-specific rate limiter
   * @param {Object} options - Rate limiting options
   */
  static createProjectRateLimit(options = {}) {
    const {
      windowMs = 60 * 60 * 1000, // 1 hour
      max = 5000, // max requests per project per window
      message = 'Rate limit exceeded for this project'
    } = options;

    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => {
        return req.projectId || req.ip;
      },
      message: {
        success: false,
        error: {
          code: 'PROJECT_RATE_LIMIT_EXCEEDED',
          message,
          details: `Maximum ${max} requests per hour per project allowed`
        }
      },
      skip: (req) => req.isDevKey,
      standardHeaders: true,
      legacyHeaders: false
    });
  }
}

module.exports = RateLimiter; 