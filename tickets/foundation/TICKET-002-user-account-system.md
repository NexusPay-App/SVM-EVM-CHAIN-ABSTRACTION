# 🎫 TICKET-002: User Account System

**Priority**: 🔴 High  
**Estimate**: 8 hours  
**Phase**: Foundation  
**Status**: ⏳ Ready to Start  

**Assignee**: Backend Team  
**Dependencies**: TICKET-001 ✅  
**Blocks**: TICKET-003, TICKET-005  

---

## 📝 Description

Create a proper user registration and authentication system to replace the current scattered API key generation. This forms the foundation for project-based organization.

**Context**: Currently, anyone can generate API keys without authentication. We need proper user accounts before implementing project management.

---

## 🎯 Acceptance Criteria

- [ ] Users can register with email/password
- [ ] Email verification system working
- [ ] Secure JWT-based authentication implemented
- [ ] Profile management endpoints functional
- [ ] Password reset functionality working
- [ ] User sessions properly managed
- [ ] Security headers and rate limiting added

---

## ✅ Tasks

### **Database Schema Design**
- [ ] Create user schema (id, email, name, company, verified_at, etc.)
- [ ] Add password hashing with bcrypt
- [ ] Create email verification tokens table
- [ ] Add password reset tokens table
- [ ] Set up database connection (start with SQLite for MVP)

### **Authentication Endpoints**
- [ ] Implement `POST /auth/register`
- [ ] Implement `POST /auth/login`
- [ ] Implement `POST /auth/logout`
- [ ] Implement `POST /auth/verify-email`
- [ ] Implement `POST /auth/forgot-password`
- [ ] Implement `POST /auth/reset-password`
- [ ] Implement `GET /auth/profile`
- [ ] Implement `PUT /auth/profile`

### **Security Implementation**
- [ ] JWT token generation and validation
- [ ] Secure password hashing (bcrypt, 12 rounds)
- [ ] Email verification flow
- [ ] Rate limiting on auth endpoints
- [ ] CORS configuration
- [ ] Security headers (helmet.js)

### **Email System**
- [ ] Set up email service (start with Nodemailer)
- [ ] Create email verification template
- [ ] Create password reset template
- [ ] Add email sending queue system

---

## 🔌 API Endpoints

### **Registration & Login**
```javascript
POST /auth/register
{
  "email": "user@company.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "company": "Acme Corp"
}

POST /auth/login
{
  "email": "user@company.com", 
  "password": "SecurePassword123!"
}
```

### **Profile Management**
```javascript
GET /auth/profile
Headers: { Authorization: "Bearer jwt_token" }

PUT /auth/profile
{
  "name": "Updated Name",
  "company": "New Company"
}
```

### **Password Reset**
```javascript
POST /auth/forgot-password
{
  "email": "user@company.com"
}

POST /auth/reset-password
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

---

## 💾 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions (optional, for logout tracking)
CREATE TABLE user_sessions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] User registration validation
- [ ] Password hashing and verification
- [ ] JWT token generation and validation
- [ ] Email verification flow
- [ ] Password reset flow

### **Integration Tests**
- [ ] Full registration → verification → login flow
- [ ] Password reset end-to-end
- [ ] Invalid token handling
- [ ] Rate limiting behavior

### **Security Tests**
- [ ] SQL injection prevention
- [ ] Password strength validation
- [ ] Email validation and sanitization
- [ ] JWT token expiration and refresh

---

## 🔧 Implementation Notes

### **Technology Stack**
- **Database**: Start with SQLite (easy setup), migrate to PostgreSQL later
- **Password Hashing**: bcrypt with 12 rounds
- **JWT**: jsonwebtoken library
- **Email**: Nodemailer with Gmail SMTP (for MVP)
- **Validation**: express-validator
- **Rate Limiting**: express-rate-limit

### **Environment Variables**
```bash
# Add to .env
JWT_SECRET=your-super-secret-jwt-key-here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-app-email@gmail.com
EMAIL_PASS=your-app-password
DATABASE_URL=./database.sqlite (for SQLite)
```

### **Security Considerations**
- Password minimum 8 characters, with numbers and symbols
- JWT tokens expire in 24 hours
- Email verification tokens expire in 24 hours
- Password reset tokens expire in 1 hour
- Rate limiting: 5 requests per minute for auth endpoints

---

## 📊 Success Metrics

- [ ] Registration success rate > 95%
- [ ] Email delivery rate > 95%
- [ ] Login response time < 500ms
- [ ] Security audit passes
- [ ] No authentication bypasses possible

---

## 🚀 Next Steps

**After completion**:
1. Remove hardcoded dev API keys
2. Update frontend to use new auth system
3. Start TICKET-003 (Project Management)
4. Migrate existing API key holders to user accounts

---

## 📝 Notes

- Start with simple SQLite database for MVP
- Focus on core functionality first, optimize later
- Ensure email system works before deploying
- Test password reset flow thoroughly
- Document API changes for third-party developers 