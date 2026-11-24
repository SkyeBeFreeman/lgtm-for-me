(() => {
  'use strict';

  const ROOT_ID = 'lgtm-for-me-root';
  const BUTTON_LABEL = 'LGTM';
  const COMMENT_TEXT = 'LGTM.';
  let compiledRules = LgtmRules.compileRules(LgtmRules.DEFAULT_RULES);
  const EDITOR_SELECTORS = [
    'textarea#new_comment_field',
    'textarea[name="comment[body]"]',
    'textarea#note_note',
    'textarea[data-testid="note-body"]',
    '.md-area textarea',
    'div[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label*="comment" i]',
    'textarea[aria-label*="comment" i]',
    'textarea[placeholder*="comment" i]',
    'textarea[placeholder*="评论" i]',
    'textarea[placeholder*="留言" i]',
  ];

  if (!document.body || document.getElementById(ROOT_ID)) return;

  const host = document.createElement('div');
  host.id = ROOT_ID;
  host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;';

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    button {
      all: initial;
      display: inline-flex;
      align-items: center;
      padding: 9px 16px;
      font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: .3px;
      color: #fff;
      background: #1f883d;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, .22);
      cursor: pointer;
      transition: background .12s ease, transform .12s ease;
    }
    button:hover { background: #1a7f37; transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button:focus-visible { outline: 2px solid #0969da; outline-offset: 3px; }
    .toast {
      position: absolute;
      right: 0;
      bottom: 44px;
      white-space: nowrap;
      padding: 6px 10px;
      font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #fff;
      background: rgba(31, 35, 40, .92);
      border-radius: 6px;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity .15s ease, transform .15s ease;
      pointer-events: none;
    }
    .toast[data-visible="true"] { opacity: 1; transform: translateY(0); }
    .toast[data-tone="error"] { background: #a40e26; }
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = BUTTON_LABEL;

  const toast = document.createElement('span');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  shadow.append(style, button, toast);
  document.body.appendChild(host);

  let pendingEditor = null;
  const interaction = LgtmRules.buttonInteraction({
    onPrepare: () => {
      pendingEditor = findEditor();
    },
    onActivate: () => {
      const editor = pendingEditor && pendingEditor.isConnected ? pendingEditor : findEditor();
      pendingEditor = null;
      if (!editor) {
        showToast('未找到评论框', 'error');
        return;
      }
      if (editor.isContentEditable) appendToContentEditable(editor);
      else appendToNativeInput(editor);
      showToast('已填入，请手动发送');
    },
  });

  button.addEventListener('mousedown', interaction.handleButtonMouseDown);
  interaction.eventTypes.forEach((type) => {
    host.addEventListener(type, interaction.handleBubble);
  });

  let toastTimer;
  const showToast = (message, tone = 'ok') => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.dataset.visible = 'true';
    toastTimer = setTimeout(() => {
      toast.dataset.visible = 'false';
    }, 2000);
  };

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !el.disabled && !el.readOnly;
  };

  const isEditable = (el) =>
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && ['text', 'search'].includes(el.type)) ||
    el.isContentEditable;

  const findEditor = () => {
    for (const selector of EDITOR_SELECTORS) {
      const found = [...document.querySelectorAll(selector)].find(isVisible);
      if (found) return found;
    }
    return [...document.querySelectorAll('textarea, [contenteditable="true"]')]
      .filter((el) => isEditable(el) && isVisible(el))
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
  };

  const appendToNativeInput = (el) => {
    const current = el.value;
    const next = current.trim() ? `${current.replace(/\s+$/, '')}\n${COMMENT_TEXT}` : COMMENT_TEXT;
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, next);
    else el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (document.activeElement === el) {
      try {
        el.setSelectionRange(next.length, next.length);
      } catch {}
    }
  };

  const appendToContentEditable = (el) => {
    const current = el.innerText.trim();
    const text = current ? `\n${COMMENT_TEXT}` : COMMENT_TEXT;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand('insertText', false, text)) {
      const fallback = document.createRange();
      fallback.selectNodeContents(el);
      fallback.collapse(false);
      fallback.insertNode(document.createTextNode(text));
      el.normalize();
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    }
  };

  interaction.eventTypes.forEach((type) => {
    window.addEventListener(type, (event) => interaction.handle(type, event, host, button), true);
  });

  const syncVisibility = () => {
    host.style.display = LgtmRules.isAllowed(location.href, compiledRules) ? '' : 'none';
  };

  const refreshRules = async () => {
    const { rules } = await chrome.storage.sync.get({ rules: LgtmRules.DEFAULT_RULES });
    compiledRules = LgtmRules.compileRules(rules);
    syncVisibility();
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.rules) return;
    compiledRules = LgtmRules.compileRules(changes.rules.newValue || []);
    syncVisibility();
  });

  refreshRules();
  syncVisibility();

  let lastHref = location.href;
  setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    syncVisibility();
  }, 1000);
})();
