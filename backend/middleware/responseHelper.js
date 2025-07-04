const responseHelper = {
  success: (res, data, meta = {}) => {
    const response = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: res.req.requestId || `req_${Date.now()}`,
        ...meta
      }
    };
    
    // Add cache headers for GET requests
    if (res.req.method === 'GET') {
      res.set('Cache-Control', 'public, max-age=60'); // 1 minute cache
    }
    
    return res.json(response);
  },

  error: (res, error, statusCode = 400) => {
    const response = {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred',
        details: error.details || null,
        field: error.field || null
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: res.req.requestId || `req_${Date.now()}`
      }
    };
    
    return res.status(statusCode).json(response);
  },

  paginated: (res, data, pagination, meta = {}) => {
    const response = {
      success: true,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 50,
        total: pagination.total || 0,
        pages: Math.ceil((pagination.total || 0) / (pagination.limit || 50)),
        has_more: pagination.has_more || false
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: res.req.requestId || `req_${Date.now()}`,
        ...meta
      }
    };
    
    return res.json(response);
  }
};

module.exports = responseHelper; 