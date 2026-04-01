const jwt = require('jsonwebtoken');

class TokenManager {
  // Generate access token
  static generateAccessToken(userId, role) {
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  // Generate refresh token
  static generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
  }

  // Generate token pair
  static generateTokenPair(userId, role) {
    return {
      accessToken: this.generateAccessToken(userId, role),
      refreshToken: this.generateRefreshToken(userId),
      expiresIn: this.getTokenExpiry(process.env.JWT_EXPIRE || '7d')
    };
  }

  // Verify access token
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error(`Invalid or expired token: ${error.message}`);
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error(`Invalid or expired refresh token: ${error.message}`);
    }
  }

  // Convert expiry string to milliseconds
  static getTokenExpiry(expiryStr) {
    const timeUnits = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const matches = expiryStr.match(/(\d+)([smhd])/);
    if (!matches) return null;

    const [, value, unit] = matches;
    return value * timeUnits[unit];
  }

  // Decode token without verification
  static decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = TokenManager;
