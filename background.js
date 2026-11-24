importScripts('common.js');

const getRules = async () => {
  const { rules } = await chrome.storage.sync.get({ rules: LgtmRules.DEFAULT_RULES });
  return Array.isArray(rules) ? rules.slice() : LgtmRules.DEFAULT_RULES.slice();
};

const desiredScripts = async () => {
  const [rules, permissions] = await Promise.all([
    getRules(),
    chrome.permissions.getAll(),
  ]);
  return LgtmRules.registrationFor(rules, permissions.origins || []);
};

const syncScripts = async () => {
  const desired = await desiredScripts();
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const staleIds = registered
    .map((script) => script.id)
    .filter((id) => id.startsWith(LgtmRules.ID_PREFIX));
  if (staleIds.length) {
    await chrome.scripting.unregisterContentScripts({ ids: staleIds });
  }
  if (desired.length) {
    await chrome.scripting.registerContentScripts(desired);
  }
  return desired.length;
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('rules');
  if (!stored.rules) {
    await chrome.storage.sync.set({ rules: LgtmRules.DEFAULT_RULES });
  }
  await syncScripts();
});

chrome.runtime.onStartup.addListener(() => syncScripts());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'sync-scripts') return;
  syncScripts().then(
    (count) => sendResponse({ ok: true, count }),
    (error) => sendResponse({ ok: false, error: String(error) })
  );
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
