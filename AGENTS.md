# AGENTS.md

本文件给在本仓库工作的 AI coding agent 提供项目上下文与协作约束。对话用中文，commit message 用英文。

## 项目是什么

`LGTM for me` 是一个 Chrome Manifest V3 扩展：在 MR / PR 页面点击右下角按钮，把 `LGTM.` 填进评论框；**只填不发送**，最终确认始终留给用户。

- 默认只在 `github.com` 的 PR 路径与 `gitlab.com` 的 MR 路径静态注入。
- 其他 http / https 评审站点由用户在选项页添加 URL 规则并显式授权后，通过动态内容脚本注入。
- 不读取凭据或 token、不发起网络请求、不自动 Approve。

## 架构与文件边界

| 文件 | 职责 |
| --- | --- |
| `common.js` | 纯函数：规则校验、glob 转正则、URL 判定、origin 提取、脚本注册决策、权限请求决策。**不依赖 DOM 与 Chrome API** |
| `content.js` | 按钮 UI（Shadow DOM）、按规则显隐、定位评论框并填入、SPA URL 变化检测 |
| `options.js` | 规则增删改与启停、「添加后立即授权」开关、未授权站点的启用入口 |
| `background.js` | 幂等注册 / 注销动态内容脚本（`onInstalled` / `onStartup` / 选项页消息） |
| `manifest.json` | 静态注入站点、`icons` / `action.default_icon`、权限声明 |
| `tests/*.test.js` | `node:test` 单元测试 |
| `icons/` | `icon.svg` 源文件、`generate.py`、16/32/48/128 透明 PNG |

新增纯逻辑放 `common.js` 并先写测试；不要引入构建步骤或第三方运行时依赖。

## 常用命令

```bash
npm test                    # node --test tests/*.test.js
node --check <file>         # 改动 JS 的语法检查
python3 icons/generate.py   # 重生成图标（需 Pillow，仅本地开发用）
```

调试：在 `chrome://extensions` 加载 unpacked 扩展；改代码后点「重新加载」。

## 关键约束（改动前先读）

- **最小权限**：`optional_host_permissions`（当前 `*://*/*`）只是可申请范围，安装时零站点权限。非默认站点必须用户主动填规则 + 显式授权。`chrome.permissions.request()` 必须在用户手势内发起，且是 submit handler 的第一个 `await`（任何 `await` 之后手势失效）。这条已实机验证，不要调整顺序。
- **规则格式**：必须以 `http://` 或 `https://` 开头，只允许 `[A-Za-z0-9._~:/-]` 与 `*`，域名不支持通配符，长度 ≤ 512；匹配 `origin + pathname`，忽略 query 与 hash。其他协议（`ftp:` 等）一律拒绝；默认规则与静态注入仍只覆盖 https 的 GitHub / GitLab。
- **不变量**：只填不发送；按钮文字 `LGTM`、填入文本 `LGTM.` 固定；目标是页面主评论框，不做代码行内评论。
- **安全**：不写入 `innerHTML`、不 `eval`；规则字符串转义后编译。http 页面为明文传输，仅在用户显式授权后注入，文档需提示风险。不提交 `.env`、密钥、`*.pem`、打包产物。对外文档与示例一律用 `example.com` 等示例域名，不写内部站点名、真实评审地址或公司邮箱。
- **图标**：`manifest.json` 的 `icons` 与 `action.default_icon` 必须指向 `icons/icon-{16,32,48,128}.png`；`tests/manifest.test.js` 会校验路径与文件存在。

## 提交规范

- conventional commits：`<type>: <subject>`，用英文；常用 `feat` / `fix` / `refactor` / `test` / `docs` / `chore`。
- 代码类改动提交前必须实际跑 `npm test` 与 `node --check`，通过后再提交；纯文档改动不需要。新功能先写测试，再写实现。
- 涉及选项页、站点权限或内容脚本的改动，需在 Chrome 加载 unpacked 后实机验证。
- 保持 `manifest.json` 的 `version` 与 `CHANGELOG.md` 一致。详见 `CONTRIBUTING.md`。

## 仓库与文档

- 远端：`git@github.com:SkyeBeFreeman/lgtm-for-me.git`（SSH）。`gh` 的 OAuth token 缺 `workflow` scope，HTTPS 推送含 workflow 文件的提交会被拒。
- `.github/workflows/test.yml` 在 push 到 `main` 与 PR 时跑 `npm test`（Node 22，无需 `npm install`）。
- 公开仓库只保留面向用户的文档：`README.md` / `CONTRIBUTING.md` / `SECURITY.md` / `CHANGELOG.md` / `LICENSE`。
- **过程性文档不提交**：方案设计、实现计划等 agent 工作文档统一放 `.agents/specs/<任务>/`，该目录已被 `.gitignore` 忽略。
