const passport = require('passport');
const User = require('../models/User');

// Only set up Google strategy if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  
  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
      ? "https://backend-amber-zeta-94.vercel.app/auth/google/callback"
      : "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      let user = await User.findByGoogleId(profile.id);
      
      if (user) {
        // Update user info from Google profile
        user.name = profile.displayName;
        user.profile_picture = profile.photos[0]?.value;
        user.last_login = new Date();
        await user.save();
        
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findByEmail(profile.emails[0].value);
      
      if (user) {
        // Link Google account to existing user
        user.google_id = profile.id;
        user.auth_provider = 'google';
        user.profile_picture = profile.photos[0]?.value;
        user.email_verified = true; // Google accounts are pre-verified
        user.last_login = new Date();
        await user.save();
        
        return done(null, user);
      }

      // Create new user with Google account
      const newUser = new User({
        google_id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        profile_picture: profile.photos[0]?.value,
        auth_provider: 'google',
        email_verified: true, // Google accounts are pre-verified
        last_login: new Date()
      });

      await newUser.save();
      return done(null, newUser);

    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️ Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
}

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ id });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 