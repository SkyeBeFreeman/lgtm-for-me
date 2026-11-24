const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../manifest.json');

test('默认只静态注入 GitHub 与 GitLab，common.js 先加载', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://github.com/*',
    'https://gitlab.com/*',
  ]);
  assert.deepEqual(manifest.content_scripts[0].js, ['common.js', 'content.js']);
  assert.equal(manifest.content_scripts[0].run_at, 'document_idle');
});

test('按需授权所需权限与入口齐备', () => {
  assert.deepEqual(manifest.permissions, ['storage', 'scripting']);
  assert.deepEqual(manifest.optional_host_permissions, ['*://*/*']);
  assert.equal(manifest.options_page, 'options.html');
  assert.equal(manifest.background.service_worker, 'background.js');
});

test('图标在 manifest 中声明且文件齐备', () => {
  const expected = {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  };
  assert.deepEqual(manifest.icons, expected);
  assert.deepEqual(manifest.action.default_icon, expected);
  for (const file of Object.values(expected)) {
    assert.equal(fs.existsSync(path.join(__dirname, '..', file)), true, `缺少 ${file}`);
  }
});
