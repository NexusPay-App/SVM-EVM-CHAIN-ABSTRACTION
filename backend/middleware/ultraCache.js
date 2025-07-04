const NodeCache = require('node-cache');

// Ultra-aggressive cache - 5 minute TTL for dashboard data
const ultraCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check every minute
  useClones: false // Don't clone objects for speed
});

// Stats cache - 2 minute TTL for stats
const statsCache = new NodeCache({ 
  stdTTL: 120, 
  checkperiod: 30,
  useClones: false 
});

// User cache - 10 minute TTL for user profile
const userCache = new NodeCache({ 
  stdTTL: 600, 
  checkperiod: 120,
  useClones: false 
});

const UltraCache = {
  // Lightning-fast dashboard cache
  getDashboard: (userId) => {
    const key = `dashboard_${userId}`;
    return ultraCache.get(key);
  },

  setDashboard: (userId, data, ttl = 300) => {
    const key = `dashboard_${userId}`;
    ultraCache.set(key, data, ttl);
  },

  // Quick stats cache
  getStats: (userId) => {
    const key = `stats_${userId}`;
    return statsCache.get(key);
  },

  setStats: (userId, data, ttl = 120) => {
    const key = `stats_${userId}`;
    statsCache.set(key, data, ttl);
  },

  // User profile cache
  getUser: (userId) => {
    const key = `user_${userId}`;
    return userCache.get(key);
  },

  setUser: (userId, data, ttl = 600) => {
    const key = `user_${userId}`;
    userCache.set(key, data, ttl);
  },

  // Invalidate all cache for a user when they make changes
  invalidateUser: (userId) => {
    const dashboardKey = `dashboard_${userId}`;
    const statsKey = `stats_${userId}`;
    const userKey = `user_${userId}`;
    
    ultraCache.del(dashboardKey);
    statsCache.del(statsKey);
    userCache.del(userKey);
    
    console.log(`🗑️ Cache invalidated for user ${userId}`);
  },

  // Get cache performance stats
  getCacheStats: () => {
    return {
      dashboard: {
        keys: ultraCache.keys().length,
        hits: ultraCache.getStats().hits,
        misses: ultraCache.getStats().misses
      },
      statsCache: {
        keys: statsCache.keys().length,
        hits: statsCache.getStats().hits,
        misses: statsCache.getStats().misses
      },
      user: {
        keys: userCache.keys().length,
        hits: userCache.getStats().hits,
        misses: userCache.getStats().misses
      }
    };
  },

  // Middleware for ultra-fast responses
  middleware: (cacheName = 'dashboard', ttl = 300) => {
    return (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const userId = req.user?.id;
      if (!userId) {
        return next();
      }

      let cachedData;
      const cacheKey = `${cacheName}_${userId}`;

      switch (cacheName) {
        case 'dashboard':
          cachedData = UltraCache.getDashboard(userId);
          break;
        case 'stats':
          cachedData = UltraCache.getStats(userId);
          break;
        case 'user':
          cachedData = UltraCache.getUser(userId);
          break;
      }

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', ultraCache.getTtl(cacheKey));
        res.setHeader('X-Response-Time', '0ms'); // Cached responses are instant
        
        console.log(`⚡ CACHE HIT: ${cacheName} for user ${userId}`);
        
        return res.json({
          success: true,
          data: cachedData,
          meta: {
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
            cached: true,
            cache_hit: true
          }
        });
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data.success && data.data) {
          switch (cacheName) {
            case 'dashboard':
              UltraCache.setDashboard(userId, data.data, ttl);
              break;
            case 'stats':
              UltraCache.setStats(userId, data.data, ttl);
              break;
            case 'user':
              UltraCache.setUser(userId, data.data, ttl);
              break;
          }
          
          res.setHeader('X-Cache', 'MISS');
          console.log(`💾 CACHE SET: ${cacheName} for user ${userId}`);
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }
};

module.exports = UltraCache; 