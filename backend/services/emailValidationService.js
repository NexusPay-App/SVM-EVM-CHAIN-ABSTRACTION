const dns = require('dns').promises;
const net = require('net');

class EmailValidationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Validate email format using comprehensive regex
   */
  validateFormat(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Check if domain has MX record (mail exchange)
   */
  async validateDomain(domain) {
    try {
      const records = await dns.resolveMx(domain);
      return records && records.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Advanced SMTP validation (check if mailbox exists)
   * Note: Many servers block this for privacy, so we'll use it cautiously
   */
  async validateSMTP(email) {
    const [localPart, domain] = email.split('@');
    
    try {
      // Get MX records
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, reason: 'No MX record found' };
      }

      // Sort by priority (lower number = higher priority)
      mxRecords.sort((a, b) => a.priority - b.priority);
      const mailServer = mxRecords[0].exchange;

      // For security and privacy reasons, we'll only do basic MX record validation
      // Full SMTP validation is often blocked by mail servers
      return { valid: true, reason: 'MX record exists', mailServer };

    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Check against known disposable email providers
   */
  isDisposableEmail(email) {
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
      'mailinator.com', 'throwaway.email', 'temp-mail.org',
      'mohmal.com', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.includes(domain);
  }

  /**
   * Check against common business email domains
   */
  isBusinessEmail(email) {
    const businessDomains = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
      'icloud.com', 'protonmail.com', 'aol.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return !businessDomains.includes(domain);
  }

  /**
   * Comprehensive email validation
   */
  async validateEmail(email) {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = email.toLowerCase();
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return { ...cached.result, cached: true };
      }
    }

    const result = {
      email: email.toLowerCase(),
      valid: false,
      score: 0, // 0-100 confidence score
      checks: {
        format: false,
        domain: false,
        mx: false,
        disposable: false,
        business: false
      },
      warnings: [],
      suggestions: []
    };

    try {
      // 1. Format validation
      result.checks.format = this.validateFormat(email);
      if (!result.checks.format) {
        result.warnings.push('Invalid email format');
        return this.cacheAndReturn(cacheKey, result);
      }
      result.score += 20;

      const domain = email.split('@')[1]?.toLowerCase();

      // 2. Disposable email check
      result.checks.disposable = !this.isDisposableEmail(email);
      if (!result.checks.disposable) {
        result.warnings.push('Disposable email address detected');
        result.suggestions.push('Please use a permanent email address');
      } else {
        result.score += 15;
      }

      // 3. Business email check
      result.checks.business = this.isBusinessEmail(email);
      if (result.checks.business) {
        result.score += 10;
      }

      // 4. Domain validation
      result.checks.domain = await this.validateDomain(domain);
      if (!result.checks.domain) {
        result.warnings.push('Domain does not exist or has no mail servers');
        return this.cacheAndReturn(cacheKey, result);
      }
      result.score += 25;

      // 5. MX record validation
      const smtpResult = await this.validateSMTP(email);
      result.checks.mx = smtpResult.valid;
      if (result.checks.mx) {
        result.score += 30;
        result.mailServer = smtpResult.mailServer;
      } else {
        result.warnings.push(`Mail server validation failed: ${smtpResult.reason}`);
      }

      // Determine overall validity
      result.valid = result.score >= 60; // Require at least 60% confidence

      // Add suggestions based on common typos
      if (!result.valid && result.checks.format) {
        const suggestions = this.suggestCorrections(email);
        if (suggestions.length > 0) {
          result.suggestions = suggestions;
        }
      }

    } catch (error) {
      result.warnings.push(`Validation error: ${error.message}`);
    }

    result.validationTime = Date.now() - startTime;
    return this.cacheAndReturn(cacheKey, result);
  }

  /**
   * Suggest corrections for common email typos
   */
  suggestCorrections(email) {
    const suggestions = [];
    const [localPart, domain] = email.split('@');
    
    const commonDomains = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gmailcom': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yahho.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'outlok.com': 'outlook.com'
    };

    if (commonDomains[domain]) {
      suggestions.push(`${localPart}@${commonDomains[domain]}`);
    }

    return suggestions;
  }

  /**
   * Cache result and return
   */
  cacheAndReturn(cacheKey, result) {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    return result;
  }

  /**
   * Quick validation for API endpoints (lighter version)
   */
  async quickValidate(email) {
    if (!this.validateFormat(email)) {
      return { valid: false, reason: 'Invalid format' };
    }

    if (this.isDisposableEmail(email)) {
      return { valid: false, reason: 'Disposable email not allowed' };
    }

    const domain = email.split('@')[1];
    const hasMX = await this.validateDomain(domain);
    
    return { 
      valid: hasMX, 
      reason: hasMX ? 'Valid' : 'Domain has no mail servers' 
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
const emailValidationService = new EmailValidationService();

module.exports = emailValidationService; 