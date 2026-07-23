# Study Diary 翻页动画重新设计

**日期**: 2026-07-22
**状态**: 已确认,待写实施计划

## 背景与问题

Study Diary 的翻页效果一直用一块刚性纸张（`.diary-flip-sheet`）做 `rotateY` 3D 旋转，配合 `backface-visibility:hidden` + `preserve-3d` 实现正反两面的翻转。用户反馈翻页时文字/图片会"卡顿"——具体表现为：向右翻页时下一篇日记的文字会先破碎显示，再变成完整文字；向左翻页时图片也有类似现象。

按 systematic-debugging 流程排查：
1. 把浏览器窗口缩到 768px 以下（触发代码里已有的 `prefersInstantTransition()`，直接跳过整个 3D 动画瞬间切换页面）——不卡顿。**证明问题出在动画本身，不是数据加载或重新渲染的开销。**
2. 确认测试浏览器是 Safari。
3. 依次尝试了三个改动：图片预加载、CSS `contain` 隔离重绘、`-webkit-font-smoothing` 调整字体抗锯齿方式——**均未解决**。

三次针对性修复失败，说明问题不是"某个具体性能细节"，而是 Safari 对"正在做 3D 旋转的文字内容"存在已知的渲染怪癖：文字在旋转经过接近 90°（侧面朝向用户）的角度区间时会短暂渲染破碎/模糊，等旋转停下回到平面状态才恢复清晰。这是 WebKit 在 `preserve-3d` 动画中对文字栅格化处理的固有行为，不是可以靠优化重绘性能修复的问题。

## 设计方案：弧形提起 + 旋转中段变淡

不改变翻页的底层机制（仍然是 `rotateY` 3D 旋转 + 双面卡片），而是在旋转的同时叠加两层新的运动/视觉效果：

1. **弧形提起**：纸张旋转过程中叠加一个 `translateY` 的弧线运动——旋转开始时纸张贴平，旋转进行到中段时向上抬起一定高度，旋转接近完成时落回贴平状态。视觉上像被指尖提起后翻过去，而不是绕固定轴心平面旋转的机械感。
2. **旋转中段变淡**：在旋转经过 Safari 文字渲染最容易出问题的角度区间（约 40%~60% 的旋转进度，也就是最接近侧面朝向的区间）时，整块纸张的透明度短暂降到 0.65 左右，旋转的起点和终点保持完全不透明（透明度 1）。这个区间的文字渲染瑕疵会被淡化到用户不容易察觉，而现实中快速翻页时那个角度本来也看不清内容，视觉上不违和。

两者结合后，翻页完成时文字/图片始终是清晰完整的，用户不会在动画最显眼的（贴近平面时）阶段看到破碎文字。

### 技术实现：从 `transition` 换成 `@keyframes` 动画

现在纸张的旋转靠 CSS `transition: transform`（只有起点/终点两个状态，无法插入中途效果）实现。要做"旋转过程中同时抬起+变淡"，需要换成 CSS `@keyframes` 动画（可以定义任意多个中间关键帧，把旋转角度、抬起高度、透明度编排在同一条时间轴上）。

日记本页面下方的阴影效果（`diary-underlay-shadow`、`diary-flip-shadow`）本来就是用 `@keyframes` 实现的；这次改完之后，纸张旋转和阴影会用上同一套动画机制（都是 `animation`），比目前"纸张用 transition、阴影用 animation"的混搭方式更统一。

**具体关键帧数值**（"下一页"方向，`diary-flip-next`；"上一页"方向 `diary-flip-prev` 镜像对称，旋转角度取正值）：

| 进度 | rotateY | translateY（提起高度） | opacity |
|---|---|---|---|
| 0% | 0deg | 0 | 1 |
| 40% | -72deg | -16px | 0.65 |
| 60% | -108deg | -16px | 0.65 |
| 100% | -180deg | 0 | 1 |

整体动画时长、缓动曲线沿用现有的 `--diary-flip-duration` CSS 变量和 `cubic-bezier(0.25, 1, 0.5, 1)`，不改变翻页的整体节奏感（用户此前已经确认过这个节奏是合适的）。

### JS 改动

- 翻页完成的检测方式从监听 `transitionend` 事件改成监听 `animationend` 事件（因为纸张旋转不再是 `transition`，是 `animation` 了）。
- `js/diary-state.mjs` 里防止子元素动画事件误触发翻页完成逻辑的纯函数 `isSheetTransformEnd(event, sheet)`，替换成对应 `animationend` 语义的 `isSheetAnimationEnd(event, sheet)`（依然检查 `event.target === sheet`，逻辑不变，只是不再需要检查 `propertyName`，因为 `AnimationEvent` 没有这个属性，用 `animationName` 描述的是"哪个 keyframes"而不是"哪个 CSS 属性"，而这里只要确认事件确实来自纸张本身、不是子元素冒泡上来的，就足够防止误触发）。
- 超时兜底逻辑（`transitionend` 万一不触发时的保险）改成读取 `getComputedStyle(sheet).animationDuration` 而不是 `transitionDuration`。
- 阴影效果（underlay-shadow、flip-shadow）的实现和触发逻辑不变——它们已经是 `animation`，跟纸张旋转是两套独立的视觉效果，本次不需要改动。
- 现有的"先强制触发一次布局、再用 `requestAnimationFrame` 延迟一帧添加动画触发的 class"这个两步操作（原本是为了确保 `transition` 起始状态被提交，`transition` 才能正确播放）继续保留，即使技术上 CSS `animation` 不完全需要这个技巧——保守起见，不在这次改动里顺带简化这部分时序逻辑，降低引入新问题的风险。

## 测试策略

`isSheetAnimationEnd` 是纯函数（判断"事件是否来自纸张本身"），延续项目里已有的 `node:test` 自动化测试方式，替换 `isSheetTransformEnd` 原有的 3 个测试用例（去掉 `propertyName` 相关的测试点，因为不再适用）。

动画本身的视觉效果（弧形提起是否自然、变淡时机是否掩盖了文字破碎）无法自动化测试，需要在真实 Safari 浏览器里手动翻页验证，延续本项目一直以来"纯逻辑自动化测试、DOM/动画效果手动验证"的方式。

## 范围之外

- 不做真正的纸张弯曲/卷曲效果（纯 CSS/JS 做不到把矩形元素卷成曲面，需要 Canvas/WebGL 或图片纹理映射，工作量和风险都大得多，本次不做）。
- 不改动阴影系统（underlay-shadow、flip-shadow）的具体效果，只确保它们的动画机制风格与纸张旋转保持一致（都用 `animation`）。
- 不改动"强制布局提交 + requestAnimationFrame 延迟一帧"这个时序技巧，即使理论上可以简化。
