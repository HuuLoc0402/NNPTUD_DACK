const profanityWords = [
  // Vietnamese profanity and community violations (example list)
  'ngu', 'dien', 'tao', 'may', 'dem', 'lon', 'biec', 'xau', 
  // Add more as needed
];

const spamPatterns = [
  /(\b\w+\b)(\s+\1){3,}/gi, // Repeated words
  /(http[s]?:\/\/[^\s]+)/gi, // URLs
  /[\$£¥€]/g, // Currency symbols
];

const harassmentKeywords = [
  'idiots',
  'stupid',
  'trash',
  // Add more
];

class CommunityFilter {
  // Check for profanity
  static checkProfanity(text) {
    const lowerText = text.toLowerCase();
    for (let word of profanityWords) {
      if (lowerText.includes(word)) {
        return {
          detected: true,
          type: 'profanity',
          details: `Profanity detected: ${word}`
        };
      }
    }
    return { detected: false };
  }

  // Check for spam
  static checkSpam(text) {
    for (let pattern of spamPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          type: 'spam',
          details: 'Spam pattern detected'
        };
      }
    }
    return { detected: false };
  }

  // Check for harassment
  static checkHarassment(text) {
    const lowerText = text.toLowerCase();
    for (let keyword of harassmentKeywords) {
      if (lowerText.includes(keyword)) {
        return {
          detected: true,
          type: 'harassment',
          details: `Harassment keyword detected: ${keyword}`
        };
      }
    }
    return { detected: false };
  }

  // Combined check
  static analyzeContent(text) {
    const profanityCheck = this.checkProfanity(text);
    if (profanityCheck.detected) return profanityCheck;

    const spamCheck = this.checkSpam(text);
    if (spamCheck.detected) return spamCheck;

    const harassmentCheck = this.checkHarassment(text);
    if (harassmentCheck.detected) return harassmentCheck;

    return { detected: false, type: 'none' };
  }

  // Sanitize text (mask detected violations)
  static sanitizeText(text) {
    let sanitized = text;

    profanityWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    });

    return sanitized;
  }
}

module.exports = CommunityFilter;
