# LGTM for me

一个 Chrome Manifest V3 扩展：在 MR / PR 页面点一下按钮，把 `LGTM.` 填进评论框。**发送始终由你手动完成。**

## 功能

- 默认在 GitHub PR 与 GitLab MR 页面显示右下角的 `LGTM` 按钮。
- 其他 http / https 评审站点由你在选项页添加 URL 规则并按需授权后生效。
- 规则变更实时生效；站内跳转后按钮会自动显隐。
- 不读取凭据或 token，不发起网络请求，不自动发送评论，不执行 Approve。

## 安装（开发版）

1. 克隆本仓库，打开 `chrome://extensions`。
2. 开启右上角的「开发者模式」。
3. 点「加载已解压的扩展程序」，选择仓库根目录。
4. 点工具栏图标打开选项页。

## 配置

规则形如 `https://github.com/*/pull/*`：必须以 `http://` 或 `https://` 开头，`*` 可跨目录，域名不支持通配符；匹配 `origin + pathname`，忽略 query 与 hash。默认规则：

```
https://github.com/*/pull/*
https://gitlab.com/*/merge_requests/*
```

添加非默认站点时：

1. 在选项页填入按实际评审页地址栏改写的规则，点「添加规则」。
2. 默认勾选「添加后立即授权」，提交时会弹出 Chrome 权限确认；取消勾选则规则显示「未授权」，稍后点「启用站点」即可。
3. 同意授权后**刷新该站点已打开的页面**——动态内容脚本不会注入到授权前就打开的标签页。

扩展不内置也不猜测任何站点，路径请按实际页面填写，例如 `https://git.example.com/*/merge_requests/*` 或 `http://git.example.com:8080/*/merge_requests/*`。授权按域名（origin）生效，同一站点添加多条规则只需授权一次。默认站点是静态注入，无需授权。

## 开发

```bash
npm test
```

无构建步骤、无第三方依赖。`common.js` 是纯函数模块（规则校验、匹配、脚本注册决策），`content.js` 负责页面表现，`options.js` 管理配置与授权，`background.js` 注册动态内容脚本。

## 限制

- 支持 http 与 https 页面；http 为明文传输，仅在确认站点可信后添加规则并授权。只填不发送；按钮文字固定 `LGTM`，填入文本固定 `LGTM.`，均不可配置。
- 找不到评论框时会提示「未找到评论框」；使用自研编辑器的站点可能需要在 `content.js` 的 `EDITOR_SELECTORS` 中补专用选择器。
- 目标是页面主评论框，不支持代码行内评论。

## 许可证

[MIT](LICENSE)
