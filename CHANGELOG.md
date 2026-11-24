# Changelog

本文件记录项目的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 支持为 http 站点添加 URL 规则与按需授权（`optional_host_permissions` 扩展到 `*://*/*`，规则校验与脚本注册同步支持 http）。

### Fixed

- 点击按钮时在捕获阶段隔离整串鼠标事件、保持页面原有焦点且不再派发 `change`，避免部分评审站点在点击后收起评论框。

## [0.1.0] - 2026-11-24

### Added

- Chrome Manifest V3 扩展：在 MR / PR 页面把 `LGTM.` 填入评论框，只填不发送。
- 默认支持 GitHub PR 与 GitLab MR；其他 http / https 评审站点通过 URL 规则与按需授权启用。
- 选项页：规则增删改与启停、「添加后立即授权」开关、未授权站点的手动启用入口。
- `npm test` 单元测试覆盖规则校验、URL 匹配、脚本注册与授权决策。

[Unreleased]: https://github.com/SkyeBeFreeman/lgtm-for-me/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SkyeBeFreeman/lgtm-for-me/releases/tag/v0.1.0
