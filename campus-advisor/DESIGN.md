<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: 大学百事通
description: 面向大学生的 AI 校园信息顾问
---

# Design System: 大学百事通

## 1. Overview

**Creative North Star: "The Reference Desk"**

大学百事通的设计气质类似一份严谨的学术手册——不是产品营销页，不是社交平台动态流，而是一份你可以信赖的参考资料。页面以中性深色为基底，暗红金作为克制的权威信号出现，不喧宾夺主。信息层级清晰、间距规整，内容本身是主角，装饰是配角。

**Key Characteristics:**
- 深色底、中性色为主，强调色占比 ≤10%
- 安静、权威、不打扰
- 信息密度中等偏高，排版是设计核心
- 无动效、无弹窗、无滚动故事

## 2. Colors

Restrained 策略：中性深色底色 + 暗红金强调色 ≤10%。

### Primary
- **暗红金 / Deep Crimson Gold** — 仅用于标题强调、关键数据高亮、CTA 按钮。覆盖面 ≤10%。

### Neutral
- **深墨底 / Ink Surface** — 主背景色
- **浅灰面 / Charcoal Surface** — 卡片、容器的次级背景
- **灰白文 / Warm White Text** — 正文文字色
- **暗灰 / Muted Inkt** — 辅助文字、标签、注释

> 注意：强调色不用于装饰性元素（边框、图标装饰、分割线）。它只出现在有意义的地方——标题、数据、按钮。

## 3. Typography

衬线展示 + 无衬线正文：

- **展示/标题**：衬线体（如 Georgia / IBM Plex Serif），表达权威和学术感
- **正文/标签**：无衬线体（如 Inter / Noto Sans SC），保证长文可读性
- **代码/引用**：等宽体（如 JetBrains Mono / Fira Code），用于引用政策原文或数据表格

### Hierarchy
- **Display** (Bold, clamp(1.5rem, 3vw, 2.5rem), 1.2)：大标题，仅用于页面标题
- **Headline** (Semibold, 1.25rem, 1.4)：模块标题
- **Title** (Medium, 1rem, 1.5)：卡片标题、问题分类标题
- **Body** (Regular, 0.9375rem, 1.6)：正文，max-width 70ch
- **Label** (Medium, 0.8125rem, 1.4, uppercase)：标签、按钮、辅助信息

## 4. Elevation

平面为主。卡片和模态框之间用明度分层（不同灰度背景），不加投影。唯一的层级信号是背景色的深浅变化——越往前的层级背景越亮。

**The Flat-By-Default Rule.** 所有容器在静止状态下都是扁平的。没有投影、没有毛玻璃、没有悬浮效果。层级传递只靠背景明度差异。

## 5. Components

*[项目目前为纯提示词形态，无前端组件。待实现 HTML 界面后补充按钮、卡片、导航等组件规范。]*

## 6. Do's and Don'ts

### Do:
- **Do** 使用暗红金强调色仅限于信息性的高亮——标题关键词、关键数据、可交互元素
- **Do** 保持深色底色上的文字对比度 ≥4.5:1
- **Do** 用明度分层替代投影来表达层级关系
- **Do** 正文控制在 70ch 以内
- **Do** 用衬线标题 + 无衬线正文的对比来传递学术感

### Don't:
- **Don't** 将强调色用于装饰性用途（边框、分割线、图标描边、背景色块）
- **Don't** 使用营销页的典型元素——大 Hero 图、CTA 大按钮、滚动故事
- **Don't** 使用投影、毛玻璃、渐变文字
- **Don't** 使用任何弹窗、动效、过渡动画
- **Don't** 使用 emoji 作为图标或装饰
- **Don't** 每个模块上面加「小字大写标题栏」的 AI 标配排版
