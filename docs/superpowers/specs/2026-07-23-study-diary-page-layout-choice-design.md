# Study Diary 页面左右布局选择设计

## 目标

每篇日记可以独立选择文字与媒体在跨页日记本中的左右位置。用户在新建
Write Diary 或 Edit Diary 时可以选择：

- `Text Left · Media Right`
- `Media Left · Text Right`

保存后，阅读页和翻页动画始终使用该篇日记选择的布局。

## 数据模型

布局保存在现有 `media` JSON 中，不新增 Supabase 数据库列：

```json
{
  "type": "video",
  "urls": ["https://example.com/video.mp4"],
  "caption": "A quiet evening",
  "layout": "media-left"
}
```

允许值：

- `text-left`
- `media-left`

旧日记或异常值缺少有效 `layout` 时统一降级为 `text-left`，从而保持当前
页面不变。

## 表单交互

Write/Edit 表单增加一个“Page layout”双选控件：

- 新建时默认选择 `Text Left · Media Right`。
- 编辑时读取当前日记布局并显示对应选项。
- 关闭或重置表单后恢复默认 `text-left`，避免上一次编辑状态泄漏到下一篇。
- 选择布局不改变 Image/Video tab，也不影响媒体上传。

控件使用原生 radio input，支持键盘操作、清晰焦点状态和屏幕阅读器标签。

## 阅读页渲染

页面内容拆成两个语义单元：

- 文字页：日期、类别、标题、引用、正文、Discard 和文字页脚。
- 媒体页：媒体、caption、Mood、Weather、品牌页脚。

根据布局选择把这两个单元分配给物理左页和右页：

- `text-left`：左页渲染文字，右页渲染媒体。
- `media-left`：左页渲染媒体，右页渲染文字。

物理页面的装订阴影、左右边距和翻页几何仍由 left/right page class 决定；
内容函数不能把“文字”硬编码等同于“左页”。

媒体 Polaroid 的方向类、自适应比例和缓存生命周期保持不变，不论媒体位于
左页还是右页。

## 翻页动画

静态页面、目标 underlay、翻页 front/back faces 和 16 个 slices 都通过同一
页面分配函数生成内容：

- Next 和 Previous 沿用现有可逆 curl 几何。
- 动画期间不会把 `media-left` 临时恢复为默认布局。
- front/back 内容仍根据来源 entry、目标 entry 和纸张正反面映射，不根据
  文字或媒体类型猜测左右位置。

## 保存与兼容

- 新建时把选中的 `layout` 与 `type`、`urls`、`caption` 一起保存。
- 编辑时即使不上传新媒体，也要保存新的布局。
- `supabaseRowToEntry` 规范化缺失或非法布局为 `text-left`。
- `entryToSupabaseRow` 和 `buildEditPatch` 保留规范化后的布局。
- 不修改上传路径、文件限制、Supabase schema 或 RLS 策略。

## 错误处理

- 非法布局值不阻塞日记加载，直接使用 `text-left`。
- 空媒体和 placeholder 仍可交换到左页，使用现有 unknown 媒体样式。
- 保存失败沿用现有表单错误提示，页面保持原布局。

## 测试与验收

自动化测试覆盖：

- 布局值规范化和旧数据默认值。
- 新建、编辑 patch 保留布局。
- 表单默认值、编辑回填和关闭重置。
- 两种布局的静态左/右页面内容分配。
- 不同布局之间 Next、Previous、拖拽和取消时的 underlay/front/back 内容。
- 媒体在左页时仍继承真实比例和 Polaroid 方向类。

浏览器验收覆盖：

- 新建表单可以选择两种布局。
- Edit 可以切换并正确回填。
- 文字与图片或视频确实交换页面。
- 双向翻页期间布局不跳动。
- 桌面和移动端页面不溢出，控制台无错误。

## 非目标

- 不支持一篇日记的文字和媒体同时跨越两页混排。
- 不支持拖拽内容来改变左右位置。
- 不修改此前发现的中文文件名 `InvalidKey` 上传问题。
