---
version: alpha
name: 智能客服 Agent
description: 面向客户、坐席和运营人员的中文客服学习型产品，运行时视觉由 YB UI Token 系统提供。
colors:
  background: "oklch(0.985 0.003 264)"
  foreground: "oklch(0.205 0.035 264)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.5 0.22 276)"
  border: "oklch(0.89 0.012 264)"
typography:
  sans:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
rounded:
  panel: "1.125rem"
spacing:
  panel: "2rem"
components:
  button:
    owner: "@chenyibo111/ui"
  alert:
    owner: "@chenyibo111/ui"
  spinner:
    owner: "@chenyibo111/ui"
---

## Overview

这是一个产品型工作台，而不是营销页面。客户、坐席和运营人员需要在有限空间内确认状态并完成操作；设计基调是克制、可信、可追溯。运行时视觉 Token 和基础组件以 `@chenyibo111/tokens`、`@chenyibo111/ui` 为唯一来源，应用 CSS 只负责布局和领域内容。

## Colors

蓝紫色主色用于主要操作和客户消息；成功、警告、失败分别使用 YB UI 的语义组件变体。不得用普通信息提示来表达失败，也不得在页面中复制组件库内部色值。

## Typography

界面以中文优先的无衬线字体栈呈现。标题承担页面定位，正文简短直接，错误信息说明可执行的恢复路径，不暴露模型、密钥或堆栈信息。

## Layout

工作区在大屏使用具有轻微层次的居中面板，保留客户聊天、坐席处理和运营审查各自的任务密度。窄屏时单列呈现，关键操作不依赖悬停。

## Elevation & Depth

页面工作区使用 YB Token 的轻阴影与卡片表面区分任务层级；静态内容不额外堆叠装饰性阴影。

## Shapes

工作区使用圆角面板，消息气泡和状态标签的圆角服务于分组和识别，不将所有元素强制做成药丸形。

## Components

YB UI 是 Button、Field、Input、Textarea、Card、Badge、Alert、Empty 与 Spinner 的规范拥有者。应用通过 `FeedbackAlert` 统一成功、信息与失败的反馈语义；应用样式只能依赖自身的 class，而不能选择 YB 的内部 class 名。

## Do's and Don'ts

- 使用语义 Alert：成功为 `success`，可恢复失败为 `destructive`，普通状态为 `info`。
- 异步提交保持布局稳定，进行中禁用同一操作并显示组件库加载状态。
- 失败时保留用户输入并让原操作可安全重试。
- 不使用库内部动画或结构选择器作为应用布局契约。
