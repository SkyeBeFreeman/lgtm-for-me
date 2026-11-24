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

test('validatePattern 接受 http/https 合法规则（含端口）', () => {
  assert.equal(rules.validatePattern('https://github.com/*/pull/*').ok, true);
  assert.equal(rules.validatePattern('https://git.example.com:8443/*/merge_requests/*').ok, true);
  assert.equal(rules.validatePattern('http://review.example.com/*/pull/*').ok, true);
  assert.equal(rules.validatePattern('http://git.example.com:8080/*/merge_requests/*').ok, true);
});

test('validatePattern 拒绝非法协议、query、域名通配符、非法字符、超长与非字符串', () => {
  assert.equal(rules.validatePattern('ftp://github.com/*').ok, false);
  assert.equal(rules.validatePattern('https://github.com/*?tab=1').ok, false);
  assert.equal(rules.validatePattern('https://*.example.com/*').ok, false);
  assert.equal(rules.validatePattern('https://example.com/$(whoami)').ok, false);
  assert.equal(rules.validatePattern(`https://example.com/${'a'.repeat(600)}`).ok, false);
  assert.equal(rules.validatePattern(null).ok, false);
});

test('compileRules 跳过停用、非法与空规则，但保留 http 规则', () => {
  const compiled = rules.compileRules([
    { pattern: 'https://github.com/*/pull/*', enabled: true },
    { pattern: 'https://github.com/*/issues/*', enabled: false },
    { pattern: 'http://review.example.com/*/pull/*', enabled: true },
    { pattern: 'ftp://bad.example.com/*', enabled: true },
    null,
  ]);
  assert.equal(compiled.length, 2);
  assert.equal(rules.compileRules(null).length, 0);
  assert.equal(rules.isAllowed('https://github.com/a/b/pull/12', compiled), true);
  assert.equal(rules.isAllowed('http://review.example.com/a/b/pull/12', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/a/b/issues/12', compiled), false);
});

test('isAllowed 命中 PR / MR，忽略 query 与 hash，排除 issue、未授权站点与非法协议', () => {
  const compiled = rules.compileRules(rules.DEFAULT_RULES);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/pull/42/files', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/pull/42?diff=split#top', compiled), true);
  assert.equal(rules.isAllowed('https://github.com/acme/repo/issues/42', compiled), false);
  assert.equal(rules.isAllowed('https://gitlab.com/acme/repo/-/merge_requests/7', compiled), true);
  assert.equal(rules.isAllowed('https://gitlab.com/acme/repo/merge_requests/7', compiled), true);
  assert.equal(rules.isAllowed('https://git.example.com/acme/repo/merge_requests/7', compiled), false);
  assert.equal(rules.isAllowed('http://github.com/a/b/pull/1', compiled), false);
  assert.equal(rules.isAllowed('ftp://github.com/a/b/pull/1', compiled), false);
  assert.equal(rules.isAllowed('not a url', compiled), false);
});

test('originPatternFromRule 提取授权用 origin，支持端口与 http', () => {
  assert.equal(rules.originPatternFromRule('https://git.example.com/*/merge_requests/*'), 'https://git.example.com/*');
  assert.equal(rules.originPatternFromRule('https://gitlab.internal:8443/*/merge_requests/*'), 'https://gitlab.internal:8443/*');
  assert.equal(rules.originPatternFromRule('https://github.com/*/pull/*'), 'https://github.com/*');
  assert.equal(rules.originPatternFromRule('http://git.example.com:8080/*/merge_requests/*'), 'http://git.example.com:8080/*');
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
    { pattern: 'ftp://bad.example.com/*', enabled: true },
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

test('http 规则可生成脚本注册项与权限请求', () => {
  const pattern = 'http://review.example.com/*/pull/*';
  const origin = 'http://review.example.com/*';
  assert.equal(rules.originPatternFromRule(pattern), origin);
  assert.equal(rules.permissionRequestFor(pattern, [], true), origin);
  assert.equal(rules.permissionRequestFor(pattern, [origin], true), null);
  assert.deepEqual(rules.registrationFor([{ pattern, enabled: true }], [origin]), [
    {
      id: rules.scriptIdFor(origin),
      matches: [origin],
      js: ['common.js', 'content.js'],
      runAt: 'document_idle',
    },
  ]);
});

const mockButtonEvent = (target, path = []) => {
  const calls = { prevented: 0, stopped: 0, stoppedImmediately: 0 };
  return {
    target,
    composedPath: () => path,
    preventDefault() { calls.prevented += 1; },
    stopPropagation() { calls.stopped += 1; },
    stopImmediatePropagation() { calls.stoppedImmediately += 1; },
    calls,
  };
};

test('buttonInteraction 在捕获阶段隔离整串点击，按下时准备、click 时填入', () => {
  const host = {};
  const button = {};
  let prepared = 0;
  let activated = 0;
  const interaction = rules.buttonInteraction({
    onPrepare: () => { prepared += 1; },
    onActivate: () => { activated += 1; },
  });
  assert.deepEqual(interaction.eventTypes, [
    'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click',
  ]);

  const pointerDown = mockButtonEvent({}, [host, button]);
  assert.equal(interaction.handle('pointerdown', pointerDown, host, button), true);
  assert.equal(pointerDown.calls.prevented, 0);
  assert.equal(pointerDown.calls.stoppedImmediately, 1);
  assert.equal(prepared, 1);
  assert.equal(activated, 0);

  const mouseDown = mockButtonEvent(host);
  assert.equal(interaction.handle('mousedown', mouseDown, host, button), true);
  assert.equal(mouseDown.calls.prevented, 1);
  assert.equal(mouseDown.calls.stoppedImmediately, 1);
  assert.equal(prepared, 2);

  for (const type of ['pointerup', 'mouseup']) {
    const event = mockButtonEvent(host);
    assert.equal(interaction.handle(type, event, host, button), true);
    assert.equal(event.calls.prevented, 0);
    assert.equal(event.calls.stoppedImmediately, 1);
    assert.equal(prepared, 2);
  }

  const click = mockButtonEvent(host);
  assert.equal(interaction.handle('click', click, host, button), true);
  assert.equal(click.calls.prevented, 0);
  assert.equal(click.calls.stoppedImmediately, 1);
  assert.equal(activated, 1);
});

test('buttonInteraction 放行无关事件、未知类型，并兼容缺少 stopImmediatePropagation 的事件', () => {
  const host = {};
  const button = {};
  let activated = 0;
  const interaction = rules.buttonInteraction({ onActivate: () => { activated += 1; } });

  const other = mockButtonEvent({}, [{}]);
  assert.equal(interaction.handle('click', other, host, button), false);
  assert.equal(other.calls.stoppedImmediately, 0);
  assert.equal(other.calls.stopped, 0);
  assert.equal(interaction.handle('focusout', mockButtonEvent(host), host, button), false);
  assert.equal(activated, 0);

  const legacy = {
    target: host,
    stopped: 0,
    preventDefault() {},
    stopPropagation() { this.stopped += 1; },
  };
  assert.equal(interaction.handle('click', legacy, host, button), true);
  assert.equal(legacy.stopped, 1);
  assert.equal(activated, 1);
});

test('buttonInteraction 提供冒泡兜底与按钮 mousedown 兜底', () => {
  const interaction = rules.buttonInteraction();
  const calls = { prevented: 0, stopped: 0 };
  const event = {
    preventDefault() { calls.prevented += 1; },
    stopPropagation() { calls.stopped += 1; },
  };
  interaction.handleButtonMouseDown(event);
  assert.equal(calls.prevented, 1);
  assert.equal(calls.stopped, 0);
  interaction.handleBubble(event);
  assert.equal(calls.stopped, 1);
});

test('permissionRequestFor 仅在勾选且需要授权时返回 origin', () => {
  const pattern = 'https://git.example.com/*/merge_requests/*';
  const origin = 'https://git.example.com/*';

  assert.equal(rules.permissionRequestFor(pattern, [], true), origin);
  assert.equal(rules.permissionRequestFor(pattern, [], false), null);
  assert.equal(rules.permissionRequestFor(pattern, [origin], true), null);
  assert.equal(rules.permissionRequestFor(pattern, null, true), origin);
  assert.equal(rules.permissionRequestFor('https://github.com/*/pull/*', [], true), null);
  assert.equal(rules.permissionRequestFor('https://gitlab.com/*/merge_requests/*', [], true), null);
  assert.equal(rules.permissionRequestFor('ftp://bad.example.com/*', [], true), null);
  assert.equal(
    rules.permissionRequestFor('https://git.example.com:8443/*/merge_requests/*', [], true),
    'https://git.example.com:8443/*'
  );
});
