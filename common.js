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
  const SCHEME_PATTERN = /^https?:\/\//;

  const validatePattern = (pattern) => {
    if (typeof pattern !== 'string' || !SCHEME_PATTERN.test(pattern)) {
      return { ok: false, reason: '规则必须以 http:// 或 https:// 开头' };
    }
    if (pattern.length > MAX_LENGTH) {
      return { ok: false, reason: '规则过长（上限 512 字符）' };
    }
    if ([...pattern].some((ch) => !SAFE_CHARS.has(ch))) {
      return { ok: false, reason: '规则含不支持的字符，只允许 URL 字符与 * 通配符' };
    }
    const authority = pattern.slice(pattern.indexOf('://') + 3).split('/')[0];
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
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const target = `${parsed.origin}${parsed.pathname}`;
    return regexes.some((regex) => regex.test(target));
  };

  const originPatternFromRule = (pattern) => {
    const match = /^(https?:\/\/[A-Za-z0-9._~:-]+)\//.exec(pattern);
    return match ? `${match[1]}/*` : null;
  };

  const isDefaultOrigin = (originPattern) => DEFAULT_ORIGINS.includes(originPattern);

  const permissionRequestFor = (pattern, grantedOrigins, autoAuthorize) => {
    if (!autoAuthorize || !validatePattern(pattern).ok) return null;
    const origin = originPatternFromRule(pattern);
    if (!origin || isDefaultOrigin(origin)) return null;
    const granted = new Set(Array.isArray(grantedOrigins) ? grantedOrigins : []);
    return granted.has(origin) ? null : origin;
  };

  const scriptIdFor = (originPattern) =>
    `${ID_PREFIX}${originPattern.replace(/[^A-Za-z0-9]/g, '_')}`;

  const registrationFor = (rules, grantedOrigins) => {
    const granted = new Set(
      Array.isArray(grantedOrigins) ? grantedOrigins : []
    );
    const scripts = new Map();
    for (const rule of Array.isArray(rules) ? rules : []) {
      if (!rule || !rule.enabled || !validatePattern(rule.pattern).ok) continue;
      const origin = originPatternFromRule(rule.pattern);
      if (!origin || isDefaultOrigin(origin) || !granted.has(origin)) continue;
      const id = scriptIdFor(origin);
      scripts.set(id, {
        id,
        matches: [origin],
        js: ['common.js', 'content.js'],
        runAt: 'document_idle',
      });
    }
    return [...scripts.values()];
  };

  const BUTTON_EVENT_TYPES = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  const BUTTON_PRESS_TYPES = ['pointerdown', 'mousedown'];

  const isButtonEvent = (event, host, button) => {
    if (!event || !host) return false;
    if (event.target === host || (button && event.target === button)) return true;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.includes(host) || (button ? path.includes(button) : false);
  };

  const stopEvent = (event) => {
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    else if (typeof event.stopPropagation === 'function') event.stopPropagation();
  };

  const buttonInteraction = ({ onPrepare, onActivate } = {}) => ({
    eventTypes: BUTTON_EVENT_TYPES.slice(),
    handle: (type, event, host, button) => {
      if (!BUTTON_EVENT_TYPES.includes(type) || !isButtonEvent(event, host, button)) return false;
      if (type === 'mousedown') event.preventDefault();
      stopEvent(event);
      if (BUTTON_PRESS_TYPES.includes(type) && onPrepare) onPrepare();
      if (type === 'click' && onActivate) onActivate();
      return true;
    },
    handleBubble: (event) => event.stopPropagation(),
    handleButtonMouseDown: (event) => event.preventDefault(),
  });

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
    permissionRequestFor,
    scriptIdFor,
    registrationFor,
    buttonInteraction,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.LgtmRules;
}
