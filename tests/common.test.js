const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../common.js');

test('默认规则只覆盖 GitHub PR 与 GitLab MR', () => {
  assert.deepEqual(rules.DEFAULT_RULES, [
    { pattern: 'https://github.com/*/pull/*', enabled: true },
    { pattern: 'https://gitlab.com/*/merge_requests/*', enabled: true },
  ]);
  assert.deepEqual(rules.DEFAULT_ORIGINS, [
    'https://github.com/*',
    'https://gitlab.com/*',
  ]);
  assert.equal(rules.ID_PREFIX, 'lgtm-site-');
});

test('validatePattern 接受合法规则（含端口）', () => {
  assert.equal(rules.validatePattern('https://github.com/*/pull/*').ok, true);
  assert.equal(rules.validatePattern('https://git.example.com:8443/*/merge_requests/*').ok, true);
});

test('validatePattern 拒绝非 https、query、域名通配符、非法字符、超长与非字符串', () => {
  assert.equal(rules.validatePattern('http://github.com/*').ok, false);
  assert.equal(rules.validatePattern('https://github.com/*?tab=1').ok, false);
  assert.equal(rules.validatePattern('https://*.example.com/*').ok, false);
  assert.equal(rules.validatePattern('https://example.com/$(whoami)').ok, false);
  assert.equal(rules.validatePattern(`https://example.com/${'a'.repeat(600)}`).ok, false);
  assert.equal(rules.validatePattern(null).ok, false);
});

test('compileRules 跳过停用、非法与空规则', () => {
  const compiled = rules.compileRules([
    { pattern: 'https://github.com/*/pull/*', enabled: true },
    { pattern: 'https://github.com/*/issues/*', enabled: false },
    { pattern: 'http://bad.example.com/*', enabled: true },
    null,
  ]);
  assert.equal(compiled.length, 1);
  assert.equal(rules.compileRules(null).length, 0);
  assert.equal(rules.isAllowed('https://github.com/a/b/pull/12', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/a/b/issues/12', compiled), false);
});

test('isAllowed 命中 PR / MR，忽略 query 与 hash，排除 issue、内网与非 https', () => {
  const compiled = rules.compileRules(rules.DEFAULT_RULES);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/pull/42/files', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/pull/42?diff=split#top', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/issues/42', compiled), false);
  assert.equal(rules.isAllowed('https://gitlab.com/acme/repo/-/merge_requests/7', compiled), true);
  assert.equal(rules.isAllowed('https://gitlab.com/acme/repo/merge_requests/7', compiled), true);
  assert.equal(rules.isAllowed('https://git.example.com/acme/repo/merge_requests/7', compiled), false);
  assert.equal(rules.isAllowed('http://github.com/a/b/pull/1', compiled), false);
  assert.equal(rules.isAllowed('not a url', compiled), false);
});

test('originPatternFromRule 提取授权用 origin，支持端口', () => {
  assert.equal(rules.originPatternFromRule('https://git.example.com/*/merge_requests/*'), 'https://git.example.com/*');
  assert.equal(rules.originPatternFromRule('https://gitlab.internal:8443/*/merge_requests/*'), 'https://gitlab.internal:8443/*');
  assert.equal(rules.originPatternFromRule('https://github.com/*/pull/*'), 'https://github.com/*');
});

test('isDefaultOrigin 与 scriptIdFor 稳定且只含安全字符', () => {
  assert.equal(rules.isDefaultOrigin('https://github.com/*'), true);
  assert.equal(rules.isDefaultOrigin('https://gitlab.com/*'), true);
  assert.equal(rules.isDefaultOrigin('https://review.example.com/*'), false);
  assert.equal(rules.scriptIdFor('https://review.example.com/*'), 'lgtm-site-https___review_example_com__');
  assert.equal(rules.scriptIdFor('https://review.example.com/*'), rules.scriptIdFor('https://review.example.com/*'));
});

test('registrationFor 只为已授权的非默认站点生成注册项并去重', () => {
  const ruleset = [
    { pattern: 'https://github.com/*/pull/*', enabled: true },
    { pattern: 'https://git.example.com/*/merge_requests/*', enabled: true },
    { pattern: 'https://review.example.com/*/merge_requests/*', enabled: true },
    { pattern: 'https://review.example.com/*/pull/*', enabled: true },
    { pattern: 'https://disabled.example.com/*', enabled: false },
    { pattern: 'http://bad.example.com/*', enabled: true },
  ];

  assert.deepEqual(rules.registrationFor(ruleset, []), []);

  const granted = ['https://git.example.com/*', 'https://review.example.com/*', 'https://disabled.example.com/*'];
  assert.deepEqual(rules.registrationFor(ruleset, granted), [
    {
      id: 'lgtm-site-https___git_example_com__',
      matches: ['https://git.example.com/*'],
      js: ['common.js', 'content.js'],
      runAt: 'document_idle',
    },
    {
      id: 'lgtm-site-https___review_example_com__',
      matches: ['https://review.example.com/*'],
      js: ['common.js', 'content.js'],
      runAt: 'document_idle',
    },
  ]);
  assert.deepEqual(rules.registrationFor(null, granted), []);
});
