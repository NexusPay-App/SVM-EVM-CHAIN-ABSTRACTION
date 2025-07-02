const APIKeyUsage = require('../models/APIKeyUsage');

class UsageTracker {
  /**
   * Middleware to track API usage for analytics
   */
  static trackAPIUsage() {
    return (req, res, next) => {
      // Skip tracking for dev keys or health checks
      if (req.isDevKey || req.path === '/health' || req.path === '/') {
        return next();
      }

      // Store start time for response time calculation
      const startTime = Date.now();
      
      // Store original response methods
      const originalSend = res.send;
      const originalJson = res.json;
      
      // Track response data
      let responseSize = 0;
      let responseData = null;

      // Override res.send to capture response
      res.send = function(data) {
        responseData = data;
        responseSize = Buffer.byteLength(data || '', 'utf8');
        return originalSend.call(this, data);
      };

      // Override res.json to capture response
      res.json = function(data) {
        responseData = data;
        responseSize = Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
        return originalJson.call(this, data);
      };

      // Hook into response finish event
      res.on('finish', async () => {
        try {
          // Only track if we have API key context
          if (!req.apiKeyRecord || !req.projectId) {
            return;
          }

          const responseTime = Date.now() - startTime;
          const requestSize = parseInt(req.headers['content-length']) || 0;

          // Prepare usage data
          const usageData = {
            apiKeyId: req.apiKeyRecord.keyId,
            projectId: req.projectId,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTimeMs: responseTime,
            ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || '',
            requestSize: requestSize,
            responseSize: responseSize
          };

          // Add error message for failed requests
          if (res.statusCode >= 400 && responseData) {
            try {
              const errorData = typeof responseData === 'string' 
                ? JSON.parse(responseData) 
                : responseData;
              usageData.errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
            } catch (e) {
              usageData.errorMessage = `HTTP ${res.statusCode}`;
            }
          }

          // Track usage asynchronously (don't block response)
          setImmediate(async () => {
            try {
              await APIKeyUsage.trackUsage(usageData);
            } catch (error) {
              console.error('Usage tracking error:', error);
              // Don't throw - usage tracking failures shouldn't affect API responses
            }
          });

        } catch (error) {
          console.error('Usage tracking setup error:', error);
        }
      });

      next();
    };
  }

  /**
   * Get comprehensive usage analytics for an API key
   */
  static async getDetailedAnalytics(apiKeyId, options = {}) {
    const {
      days = 7,
      includeHourly = false,
      includeEndpoints = true
    } = options;

    try {
      // Get basic stats
      const dailyStats = await APIKeyUsage.getUsageStats(apiKeyId, days);
      
      // Get total requests for the period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const totalRequests = await APIKeyUsage.countDocuments({
        apiKeyId: apiKeyId,
        createdAt: { $gte: startDate }
      });

      // Get today's requests
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const requestsToday = await APIKeyUsage.countDocuments({
        apiKeyId: apiKeyId,
        createdAt: { $gte: todayStart }
      });

      // Calculate average requests per day
      const avgRequestsPerDay = totalRequests / days;

      // Get error rate
      const errorCount = await APIKeyUsage.countDocuments({
        apiKeyId: apiKeyId,
        createdAt: { $gte: startDate },
        statusCode: { $gte: 400 }
      });

      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

      // Prepare response
      const analytics = {
        total_requests: totalRequests,
        requests_today: requestsToday,
        average_requests_per_day: Math.round(avgRequestsPerDay),
        error_rate: Math.round(errorRate * 100) / 100,
        last_7_days: dailyStats.map(day => ({
          date: new Date(day._id.year, day._id.month - 1, day._id.day).toISOString().split('T')[0],
          requests: day.requests,
          avg_response_time: Math.round(day.avgResponseTime || 0),
          errors: day.errors || 0
        }))
      };

      // Add hourly data if requested
      if (includeHourly) {
        const hourlyStats = await APIKeyUsage.getHourlyStats(apiKeyId, 24);
        analytics.last_24_hours = hourlyStats.map(hour => ({
          hour: `${hour._id.year}-${String(hour._id.month).padStart(2, '0')}-${String(hour._id.day).padStart(2, '0')}T${String(hour._id.hour).padStart(2, '0')}:00:00Z`,
          requests: hour.requests,
          avg_response_time: Math.round(hour.avgResponseTime || 0)
        }));
      }

      // Add endpoint stats if requested
      if (includeEndpoints) {
        const endpointStats = await APIKeyUsage.getEndpointStats(apiKeyId, days);
        analytics.top_endpoints = endpointStats.slice(0, 10).map(endpoint => ({
          endpoint: endpoint._id.endpoint,
          method: endpoint._id.method,
          requests: endpoint.requests,
          avg_response_time: Math.round(endpoint.avgResponseTime || 0),
          errors: endpoint.errors || 0,
          error_rate: endpoint.requests > 0 ? Math.round((endpoint.errors / endpoint.requests) * 10000) / 100 : 0
        }));
      }

      return analytics;

    } catch (error) {
      console.error('Error getting detailed analytics:', error);
      throw new Error('Failed to retrieve analytics data');
    }
  }
}

module.exports = UsageTracker; 