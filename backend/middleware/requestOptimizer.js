const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

// Initialize cache with 5 minute default TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const requestOptimizer = {
  // Add request ID and timing
  requestId: (req, res, next) => {
    req.requestId = uuidv4();
    req.startTime = Date.now();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  },

  // Compression middleware
  compression: compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024 // Only compress if > 1KB
  }),

  // Cache middleware for GET requests
  cache: (ttl = 300) => {
    return (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const key = `${req.originalUrl}_${req.user?.id || 'anonymous'}`;
      const cachedResponse = cache.get(key);
      
      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', cache.getTtl(key));
        return res.json(cachedResponse);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          cache.set(key, data, ttl);
          res.setHeader('X-Cache', 'MISS');
        }
        return originalJson.call(this, data);
      };

      next();
    };
  },

  // Security headers
  security: (req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove server header
    res.removeHeader('X-Powered-By');
    
    next();
  },

  // Rate limiting per user
  rateLimit: (limit = 100, windowMs = 60000) => {
    const requests = new Map();
    
    return (req, res, next) => {
      const key = req.user?.id || req.ip;
      const now = Date.now();
      const userRequests = requests.get(key) || [];
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
      
      if (validRequests.length >= limit) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: `Limit: ${limit} requests per ${windowMs / 1000} seconds`
          }
        });
      }
      
      validRequests.push(now);
      requests.set(key, validRequests);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - validRequests.length));
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      next();
    };
  },

  // Performance monitoring
  performance: (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const duration = Date.now() - req.startTime;
      
      // Add performance headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`🐌 Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  }
};

module.exports = requestOptimizer; 