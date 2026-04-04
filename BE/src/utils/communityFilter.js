const profanityWords = [
  'ngu',
  'ngoc',
  'khung',
  'dien',
  'oc cho',
  'vo hoc',
  'mat day'
];

const spamPatterns = [
  /(\b\w+\b)(\s+\1){3,}/i,
  /(https?:\/\/[^\s]+){2,}/i,
  /(.)\1{7,}/i,
  /(?:^|\s)(?:ib|inbox|zalo|telegram)(?:\s|$).*(?:https?:\/\/|@)/i
];

const harassmentKeywords = [
  'stupid',
  'idiot',
  'trash',
  'rac ruoi',
  'de doa',
  'xuc pham'
];

const leetCharacterMap = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's'
};

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class CommunityFilter {
  static stripVietnamese(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  static normalizeText(text) {
    const stripped = this.stripVietnamese(text).toLowerCase();
    const deobfuscated = stripped.replace(/[013457@$]/g, (character) => leetCharacterMap[character] || character);

    return deobfuscated
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static collapseText(text) {
    return this.normalizeText(text).replace(/\s+/g, '');
  }

  static containsKeyword(text, keyword) {
    const normalizedText = this.normalizeText(text);
    const collapsedText = this.collapseText(text);
    const normalizedKeyword = this.normalizeText(keyword);
    const collapsedKeyword = normalizedKeyword.replace(/\s+/g, '');

    if (!normalizedKeyword) {
      return false;
    }

    const wholeWordPattern = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedKeyword)}(?:$|\\s)`, 'i');
    return wholeWordPattern.test(normalizedText) || collapsedText.includes(collapsedKeyword);
  }

  static checkProfanity(text) {
    for (const word of profanityWords) {
      if (this.containsKeyword(text, word)) {
        return {
          detected: true,
          type: 'profanity',
          details: `Profanity detected: ${word}`,
          matchedKeyword: word
        };
      }
    }
    return { detected: false };
  }

  static checkSpam(text) {
    for (const pattern of spamPatterns) {
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

  static checkHarassment(text) {
    for (const keyword of harassmentKeywords) {
      if (this.containsKeyword(text, keyword)) {
        return {
          detected: true,
          type: 'harassment',
          details: `Harassment keyword detected: ${keyword}`,
          matchedKeyword: keyword
        };
      }
    }
    return { detected: false };
  }

  static analyzeContent(text) {
    const profanityCheck = this.checkProfanity(text);
    if (profanityCheck.detected) return profanityCheck;

    const spamCheck = this.checkSpam(text);
    if (spamCheck.detected) return spamCheck;

    const harassmentCheck = this.checkHarassment(text);
    if (harassmentCheck.detected) return harassmentCheck;

    return { detected: false, type: 'none' };
  }

  static sanitizeText(text) {
    let sanitized = text;

    profanityWords.forEach(word => {
      const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    });

    return sanitized;
  }
}

module.exports = CommunityFilter;
