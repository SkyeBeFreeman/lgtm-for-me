# 贡献指南

## 准备

- Node.js（仅用于 `node --test`，仓库无第三方依赖）。
- Chrome，通过 `chrome://extensions` 加载 unpacked 扩展调试。

## 提交前

1. 代码类改动必须实际执行 `npm test` 与 `node --check <改动文件>`，通过后再提交；纯文档改动不需要。
2. 新功能先写测试（`tests/*.test.js`）。纯逻辑放进 `common.js`，并保持它不依赖 DOM 与 Chrome API。
3. 涉及选项页、站点权限或内容脚本的改动，需在加载 unpacked 扩展后实机验证。

## 提交规范

- 使用 conventional commits：`<type>: <subject>`，用英文。常用 `feat` / `fix` / `refactor` / `test` / `docs` / `chore`。
- 每次提交用 `git commit -s` 带上 `Signed-off-by`。
- 由 AI 协助产出的提交，在正文末尾追加 `Co-Authored-By: CodeBuddy <codebuddy@tencent.com>`。

## Pull Request

- 说明改动动机、验证方式（命令与实机步骤）、影响的规则匹配 / 权限范围。
- 保持 `manifest.json` 的版本与 `CHANGELOG.md` 一致：未打 tag / 创建 release 前，所有变更只记在 `Unreleased`，不写版本段落或指向 tag / release 的链接；`manifest.json` 的 `version` 只是待发布版本号。发版时再把 `Unreleased` 转为同名版本段落。
- 不要提交 `.env`、密钥、`*.pem`、打包产物，或含内部域名与真实评审地址的规则示例；文档统一使用 `example.com` 等示例域名。
