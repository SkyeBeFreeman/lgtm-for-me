const form = document.getElementById('add-form');
const input = document.getElementById('pattern');
const autoAuthorize = document.getElementById('auto-authorize');
const errorBox = document.getElementById('error');
const list = document.getElementById('rules');
let grantedOrigins = [];

const getRules = async () => {
  const { rules } = await chrome.storage.sync.get({ rules: LgtmRules.DEFAULT_RULES });
  return Array.isArray(rules) ? rules.slice() : LgtmRules.DEFAULT_RULES.slice();
};
const setRules = (rules) => chrome.storage.sync.set({ rules });
const showError = (message) => {
  errorBox.textContent = message || '';
};

const notifyBackground = async () => {
  const response = await chrome.runtime.sendMessage({ type: 'sync-scripts' });
  if (!response || !response.ok) {
    showError(`脚本注册失败：${(response && response.error) || '请重试或重新加载扩展'}`);
  }
};

const makeButton = (label, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const render = async () => {
  const [rules, permissions] = await Promise.all([
    getRules(),
    chrome.permissions.getAll(),
  ]);
  grantedOrigins = permissions.origins || [];
  const granted = new Set(grantedOrigins);
  list.replaceChildren();

  rules.forEach((rule, index) => {
    const item = document.createElement('li');
    const pattern = document.createElement('code');
    pattern.textContent = rule.pattern;
    item.append(pattern);

    const origin = LgtmRules.originPatternFromRule(rule.pattern);
    const needsAuth = origin && !LgtmRules.isDefaultOrigin(origin) && !granted.has(origin);
    const valid = LgtmRules.validatePattern(rule.pattern).ok;

    if (!valid) {
      const status = document.createElement('span');
      status.className = 'status';
      status.textContent = '无效规则';
      item.append(status);
    } else if (needsAuth) {
      const status = document.createElement('span');
      status.className = 'status';
      status.textContent = '未授权';
      item.append(status, makeButton('启用站点', async () => {
        const ok = await chrome.permissions.request({ origins: [origin] });
        showError(ok ? '' : '未获得该站点权限，规则已保存但按钮不会出现');
        if (ok) await notifyBackground();
        await render();
      }));
    } else {
      item.append(makeButton(rule.enabled ? '停用' : '启用', async () => {
        const current = await getRules();
        current[index].enabled = !current[index].enabled;
        await setRules(current);
        await notifyBackground();
        await render();
      }));
    }

    item.append(makeButton('删除', async () => {
      const current = await getRules();
      current.splice(index, 1);
      await setRules(current);
      await notifyBackground();
      await render();
    }));
    list.append(item);
  });
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pattern = input.value.trim();
  const check = LgtmRules.validatePattern(pattern);
  if (!check.ok) {
    showError(check.reason);
    return;
  }

  // 权限请求必须在用户手势内发起：任何 await 之后手势已失效。
  const origin = LgtmRules.permissionRequestFor(pattern, grantedOrigins, autoAuthorize.checked);
  let authorized = true;
  if (origin) {
    authorized = await chrome.permissions.request({ origins: [origin] });
  }

  const rules = await getRules();
  if (rules.some((rule) => rule.pattern === pattern)) {
    showError('规则已存在');
    return;
  }
  rules.push({ pattern, enabled: true });
  await setRules(rules);
  input.value = '';
  showError(authorized ? '' : '未获得该站点权限，规则已保存但按钮不会出现');
  await notifyBackground();
  await render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.rules) render();
});

render();
