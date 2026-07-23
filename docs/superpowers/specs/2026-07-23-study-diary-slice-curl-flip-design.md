# Study Diary 切片卷曲翻页重设计

**日期**: 2026-07-23
**状态**: 已确认,待写实施计划

## 背景

Study Diary 的翻页效果经过两轮迭代：

1. 最早是单块矩形"纸"（`.diary-flip-sheet`）绕书脊做 `rotateY` 旋转（详见 `2026-07-22-study-diary-page-flip-redesign.md`），发现 Safari 在旋转经过接近 90°（侧面朝向用户）时文字/图片会渲染破碎，靠"弧形提起 + 旋转中段变淡"的 `@keyframes` 动画掩盖了这个问题。
2. 随后加入了拖拽翻页（详见 `2026-07-22-study-diary-drag-page-flip-design.md`）：按住页面拖动，进度直接由指针位置驱动 `transform`/`opacity`，绕开了 `@keyframes` 多段插值导致的卡顿；松手结算阶段用一次性 CSS `transition`。

这两版的共同局限是：翻动的"纸"始终是一块平面矩形做整体旋转，视觉上是"卡片翻转"而不是"纸张卷曲"，抬起弧线和透明度渐隐是补偿平面旋转显得机械的手段，不是真实的纸张形变。

参考实现（用户提供的静态 HTML 书本效果）把每页切成 16 条竖直窄条（slice），每条各自旋转、角度略有差异（越靠近卷曲边缘的切片滞后越多、中段略微鼓起），叠加一条随卷曲边缘移动的高光和一片跟随的投影，用切片轮廓真实地模拟出纸张卷曲的曲面，而不是单纯旋转一个矩形。这次重设计把 Study Diary 的翻页换成同样的切片卷曲机制，同时把点击/键盘触发的翻页动画和拖拽翻页统一到同一套渲染逻辑上。

## 设计方案

### 架构：一个进度值驱动一切

新增一个纯粹的“进度 → 视觉状态”的计算层，进度 `progress`（0 到 1）不区分来源——可以是拖拽指针的实时位置换算出来的，也可以是一段定时动画每帧递增的值。点击/键盘翻页、拖拽中的实时跟手、松手后的"翻完/弹回"结算，三种场景都只是这个进度值如何随时间变化的区别，视觉计算和渲染代码完全共享。

这带来一个连带简化：现有代码里为了应对"某些 WebKit 版本不可靠触发 `animationend`/`transitionend`"而写的兜底超时定时器、以及区分事件目标是否为纸张本身的 `isSheetEventTarget`，在 JS 逐帧驱动的模型下不再需要——`requestAnimationFrame` 循环本身就知道什么时候跑完，不依赖浏览器事件触发的可靠性。这部分连同旧的 `computeFlipVisualState` 一起移除。

### 切片 DOM 结构

`buildCurlDOM(direction, oldEntry, newEntry)`（替换现有 `buildFlipDOM`）：

- 静态的左右两页（`.diary-page--left`/`.diary-page--right`，含 underlay 阴影）逻辑不变，继续用 `leftPageHTML`/`rightPageHTML` 渲染。
- `.diary-flip-sheet` 内部不再是两个整面，而是 `SLICE_COUNT`（= 16，仅桌面/平板双页视图启用）个 `.diary-flip-slice`，每个切片有 `--front`/`--back` 两个面（`backface-visibility: hidden`，和现在一样）。
- 每个面内部是一个 `.diary-flip-slice__canvas`，尺寸等于整页宽高，`innerHTML` 是完整的 `leftPageHTML`/`rightPageHTML` 输出（和现在两个面各自渲染整页内容一样，内容本身不变），但整个 canvas 沿水平方向偏移 `-i * segWidth`（`front`）或镜像偏移（`back`），切片元素自身 `overflow: hidden`、宽度只有 `segWidth`，所以每个切片只露出自己对应的那一竖条内容——这是参考实现里 `slice-canvas` 偏移 + 裁剪的手法，直接套用到真实动态内容上。
- 新增两个元素：`.diary-flip-tip`（沿卷曲边缘移动的高光条）、`.diary-flip-castshadow`（跟随卷曲边缘的投影块）。两者的位置/宽度/透明度由卷曲计算结果实时算出。
- 旧的按面渲染的 `.diary-flip-shadow--front`/`--back`（固定方向的线性渐变阴影）被切片自身的阴影遮罩取代，予以移除；`.diary-underlay-shadow--in`/`--out`（渲染在**静态**页面上、翻页时那半边变暗/变亮的阴影）保留不变，因为它遮盖的是纸张之外的东西，跟切片卷曲无关。

一次性的布局测量（`layoutSlices()`：量出页面实际宽高，算出每片宽度、设置各切片/canvas 的初始尺寸和偏移量）只在每次翻页开始时（点击/键盘触发时、或拖拽越过阈值判定为拖拽时）跑一次，之后同一次翻页过程中的每帧更新只写 `transform`/`opacity`，不再重新测量或重建 DOM——参照 `segWidth` 从 `.diary-page` 的实际渲染宽度算出，而不是像参考实现那样写死书本宽度，以保持响应式布局下的正确性。

### 卷曲计算（纯函数，`js/diary-state.mjs`）

- `computeSliceThetas(progress, sliceCount, direction)`：返回长度为 `sliceCount` 的弧度数组。基础旋转随 `progress` 线性变化（`direction` 决定正负），叠加两个连续曲线分量：边缘滞后（越靠卷曲末端的切片，旋转略微落后于基础值，用 `sin(2π·progress)` 乘以切片位置的幂函数）、中段鼓起（用 `sin(π·progress)` 乘以切片位置的正弦，越靠中间的切片鼓起越明显）——直接沿用参考实现里验证过的公式形状，只是把"切片索引 → 参数 t"的换算和整体旋转方向按现有 `next`/`prev` 语义接好。
- `computeSliceLayout(thetas, sliceWidthPx)`：给定角度数组和单片宽度，按参考实现的累加方式（每片贡献 `segWidth·cos(theta)` 的水平位移和 `-segWidth·sin(theta)` 的深度位移，逐片累加）算出每片的 `{x, z}` 位置，以及卷曲末端（最后一片的末端位置 + 最后一片的角度）供高光条定位。
- `computeCurlMotion(progress)`：一条单峰曲线（`sin(π·progress)`，两端为 0、中点为峰值 1），驱动四处视觉效果的强度：
  - 每个切片正/反面的遮罩透明度（延续之前验证过的"旋转中段变淡以掩盖 Safari 文字渲染瑕疵"思路，但现在是逐片、连续变化，而不是整块纸固定降到 65%）；
  - 高光条的不透明度；
  - 投影块的不透明度和宽度。
- 保留 `computeDragProgress`（拖拽位移 → 进度，逻辑不变）、`shouldCompleteFlip`（阈值维持 `progress >= 0.5`，按已确认的决定不对齐参考实现的甩动手感）。
- 新增 `easeInOutCubic(t)`：点击/键盘触发的定时翻页动画用的缓动函数（拖拽中的实时跟手和松手结算都不经过它，只有"从 0 播到 1"这种定时动画场景需要）。
- 移除 `computeFlipVisualState`（拆分进上述三个函数）、`isSheetEventTarget`（不再需要，见"架构"一节）。

### 动画驱动（`js/diary.js`）

- `updateCurl(progress, direction, elements)`：每帧调用一次，内部依次调用 `computeSliceThetas` → `computeSliceLayout` → `computeCurlMotion`，把结果写成每个切片的 `style.transform`（`translate3d(x, 0, z) rotateY(theta)`）和遮罩 `style.opacity`，以及高光条、投影块的 `style.transform`/`style.opacity`。纯粹是读计算结果写 DOM，不做测量，开销低，可以安全地每帧调用。
- `runFlipAnimation(direction, elements, fromProgress, toProgress)`：一个 `requestAnimationFrame` 循环，用 `easeInOutCubic` 从 `fromProgress` 缓动到 `toProgress`，每帧调用 `updateCurl`，循环结束后 resolve 一个 Promise。
  - `playFlip`（点击/键盘触发）：`buildCurlDOM` 建好切片后，直接 `await runFlipAnimation(direction, elements, 0, 1)`，结束后更新 `state` 并 `renderStatic()`——不再需要监听事件或设兜底定时器。
  - 拖拽结束时的结算（原 `settleDragFlip`）：改为 `await runFlipAnimation(direction, elements, dragFlip.progress, target)`，`target` 是 `shouldCompleteFlip` 判定出的 0 或 1，取代原来的一次性 CSS `transition`。
- 拖拽进行中（`pointermove`，越过 8px 阈值之后）：逻辑基本不变，仍是每次移动直接算出 `progress` 后调用 `updateCurl(progress, ...)`；只是内部从"写单块矩形的 transform"变成"写 16 个切片的 transform"。

## 视觉参数

- `SLICE_COUNT = 16`，只在双页视图（> 768px 且非 `prefers-reduced-motion`）启用；窄屏和减少动画偏好继续走现有的瞬间切页（`prefersInstantTransition()`），不受本次改动影响。
- 整体动画时长沿用现有的 `--diary-flip-duration` CSS 变量（读取方式从 `getComputedStyle(sheet).animationDuration`/`transitionDuration` 改成直接读 CSS 变量值，因为不再有 CSS animation/transition 对象可读）。
- 不再叠加整体的 `translateY` 提起弧线——切片各自的旋转角度差异本身就会产生曲面鼓起的视觉效果，两者叠加会显得不自然，故移除。

## 测试策略

新增/修改的纯函数按项目现有的 `node:test` 方式测试（扩展 `js/diary-state.test.mjs`）：

- `computeSliceThetas`：验证 `progress=0`/`1` 时所有切片角度为 0/±180°等价值；`direction` 翻转时角度符号相反；`sliceCount` 变化时数组长度正确。
- `computeSliceLayout`：给定全 0 角度数组时，累加位置应等价于一条直线（`x` 均匀分布、`z` 全为 0）；验证末端位置计算与手算值一致。
- `computeCurlMotion`：`progress=0`/`1` 时返回 0，`progress=0.5` 时接近峰值 1。
- `computeDragProgress`、`shouldCompleteFlip`：现有测试不变（本次逻辑未改动）。
- `easeInOutCubic`：`t=0`/`0.5`/`1` 的已知值。

移除 `computeFlipVisualState`、`isSheetEventTarget` 对应的旧测试用例。

视觉层面（切片卷曲曲面是否自然、透明度遮罩是否足够掩盖 Safari 文字渲染瑕疵、高光/投影的观感）无法自动化测试，延续项目一贯做法，在真实浏览器（含 Safari）里手动翻页验证。

## 风险与兜底

16 片 × 2 面 × 完整页面内容（真实文字、图片、多媒体网格）意味着每次翻页要构建 32 个包含真实渲染内容的 DOM 节点，比参考实现（每片装的是一张静态图片）更重。`SLICE_COUNT` 做成一个独立常量，如果实测在真机上（尤其是移动端以上、但性能较弱的设备，例如平板）出现卡顿，只需要把这一个数字调低（比如 8～10），不需要改动任何架构或计算公式。

## 范围之外

- 不改动移动端窄屏（≤768px）/ `prefers-reduced-motion` 的瞬间切页逻辑。
- 不改动图片放大（lightbox）、心情/天气按钮、删除按钮、编辑弹窗的排除逻辑——翻页过程中渲染的页面内容继续保持 `active=false`（媒体不可点击），与现状一致。
- 不做基于拖动速度的"甩动即使没拖过一半也直接翻完"（flick 手势）——沿用现有"必须拖过 50% 才算翻完"的规则，按已确认的决定不对齐参考实现的甩动手感。
- 不响应式调整 `SLICE_COUNT`（比如按屏幕宽度分级），只有"卷曲 vs 瞬间切页"这一个断点，切片数量固定。
- 不新增窗口 resize 时重新测量正在进行中的翻页布局的逻辑——现有实现在翻页过程中也不处理 resize，本次保持一致，不额外补充。
