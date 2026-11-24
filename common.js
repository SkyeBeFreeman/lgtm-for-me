globalThis.LgtmRules = (() => {
  'use strict';

  const DEFAULT_RULES = [
    { pattern: 'https://github.com/*/pull/*', enabled: true },
    { pattern: 'https://gitlab.com/*/merge_requests/*', enabled: true },
  ];
  const DEFAULT_ORIGINS = ['https://github.com/*', 'https://gitlab.com/*'];
  const ID_PREFIX = 'lgtm-site-';
  const MAX_LENGTH = 512;
  const SAFE_CHARS = new Set(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~:/-*'.split('')
  );

  const validatePattern = (pattern) => {
    if (typeof pattern !== 'string' || !pattern.startsWith('https://')) {
      return { ok: false, reason: '规则必须以 https:// 开头' };
    }
    if (pattern.length > MAX_LENGTH) {
      return { ok: false, reason: '规则过长（上限 512 字符）' };
    }
    if ([...pattern].some((ch) => !SAFE_CHARS.has(ch))) {
      return { ok: false, reason: '规则含不支持的字符，只允许 https URL 字符与 * 通配符' };
    }
    const authority = pattern.slice('https://'.length).split('/')[0];
    if (!authority || authority.includes('*')) {
      return { ok: false, reason: '域名不能为空，也不支持通配符' };
    }
    return { ok: true };
  };

  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const toRegExp = (pattern) =>
    new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`);

  const compileRules = (rules) => {
    if (!Array.isArray(rules)) return [];
    return rules
      .filter((rule) => rule && rule.enabled && validatePattern(rule.pattern).ok)
      .map((rule) => toRegExp(rule.pattern));
  };

  const isAllowed = (url, regexes) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:') return false;
    const target = `${parsed.origin}${parsed.pathname}`;
    return regexes.some((regex) => regex.test(target));
  };

  const originPatternFromRule = (pattern) => {
    const match = /^(https:\/\/[A-Za-z0-9._~:-]+)\//.exec(pattern);
    return match ? `${match[1]}/*` : null;
  };

  const isDefaultOrigin = (originPattern) => DEFAULT_ORIGINS.includes(originPattern);

  const scriptIdFor = (originPattern) =>
    `${ID_PREFIX}${originPattern.replace(/[^A-Za-z0-9]/g, '_')}`;

  return {
    DEFAULT_RULES,
    DEFAULT_ORIGINS,
    ID_PREFIX,
    MAX_LENGTH,
    validatePattern,
    compileRules,
    isAllowed,
    originPatternFromRule,
    isDefaultOrigin,
    scriptIdFor,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.LgtmRules;
}
