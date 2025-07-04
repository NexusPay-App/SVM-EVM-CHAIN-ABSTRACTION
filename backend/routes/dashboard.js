const express = require('express');
const router = express.Router();
const AuthMiddleware = require('../middleware/auth');
const DashboardService = require('../services/dashboardService');
const responseHelper = require('../middleware/responseHelper');
const requestOptimizer = require('../middleware/requestOptimizer');
const UltraCache = require('../middleware/ultraCache');

// Apply optimization middleware
router.use(requestOptimizer.requestId);
router.use(requestOptimizer.performance);
router.use(requestOptimizer.security);
router.use(requestOptimizer.compression);
router.use(requestOptimizer.rateLimit(500, 60000)); // Increased to 500 requests per minute

/**
 * @route GET /api/dashboard
 * @desc Get complete dashboard data in a single ULTRA-FAST call with aggressive caching
 * @access Private
 */
router.get('/', 
  AuthMiddleware.authenticateToken, 
  UltraCache.middleware('dashboard', 180), // Ultra-aggressive 3-minute cache
  async (req, res) => {
    try {
      const userId = req.user.id;
      const startTime = Date.now();
      
      const options = {
        activityLimit: parseInt(req.query.activity_limit) || 5, // Reduced for speed
        includeAnalytics: req.query.include_analytics !== 'false'
      };

      const dashboardData = await DashboardService.getDashboardData(userId, options);
      const responseTime = Date.now() - startTime;
      
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      return responseHelper.success(res, dashboardData, {
        cache_ttl: 180,
        optimization: 'ultra_fast_aggregation',
        response_time_ms: responseTime
      });

    } catch (error) {
      console.error('Dashboard API error:', error);
      return responseHelper.error(res, {
        code: 'DASHBOARD_FETCH_FAILED',
        message: 'Failed to fetch dashboard data',
        details: error.message
      }, 500);
    }
  }
);

/**
 * @route GET /api/dashboard/project/:projectId
 * @desc Get detailed project data
 * @access Private
 */
router.get('/project/:projectId', 
  AuthMiddleware.authenticateToken,
  requestOptimizer.cache(30), // Cache for 30 seconds
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      const projectData = await DashboardService.getProjectDetails(projectId, userId);
      
      if (!projectData) {
        return responseHelper.error(res, {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }, 404);
      }

      return responseHelper.success(res, projectData, {
        cache_ttl: 30,
        project_id: projectId
      });

    } catch (error) {
      console.error('Project details API error:', error);
      return responseHelper.error(res, {
        code: 'PROJECT_FETCH_FAILED',
        message: 'Failed to fetch project details',
        details: error.message
      }, 500);
    }
  }
);

/**
 * @route GET /api/dashboard/stats
 * @desc Get quick stats for dashboard header
 * @access Private
 */
router.get('/stats', 
  AuthMiddleware.authenticateToken,
  requestOptimizer.cache(120), // Cache for 2 minutes
  async (req, res) => {
    try {
      const userId = req.user.id;
      const dashboardData = await DashboardService.getDashboardData(userId, { 
        activityLimit: 0, 
        includeAnalytics: false 
      });

      const stats = dashboardData.user.stats;
      
      return responseHelper.success(res, stats, {
        cache_ttl: 120,
        lightweight: true
      });

    } catch (error) {
      console.error('Stats API error:', error);
      return responseHelper.error(res, {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch dashboard stats',
        details: error.message
      }, 500);
    }
  }
);

/**
 * @route POST /api/dashboard/refresh
 * @desc Force refresh dashboard data (clears cache)
 * @access Private
 */
router.post('/refresh', 
  AuthMiddleware.authenticateToken,
  requestOptimizer.rateLimit(10, 60000), // 10 refreshes per minute
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Clear cache for this user
      const NodeCache = require('node-cache');
      const cache = new NodeCache();
      const cacheKeys = cache.keys();
      
      cacheKeys.forEach(key => {
        if (key.includes(userId)) {
          cache.del(key);
        }
      });

      const dashboardData = await DashboardService.getDashboardData(userId);
      
      return responseHelper.success(res, dashboardData, {
        cache_cleared: true,
        forced_refresh: true
      });

    } catch (error) {
      console.error('Dashboard refresh error:', error);
      return responseHelper.error(res, {
        code: 'DASHBOARD_REFRESH_FAILED',
        message: 'Failed to refresh dashboard data',
        details: error.message
      }, 500);
    }
  }
);

module.exports = router; 