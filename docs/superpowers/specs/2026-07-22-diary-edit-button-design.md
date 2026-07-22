# Abroad Diary — Edit 按钮设计文档

- **日期**: 2026-07-22
- **涉及文件**: `ai-studio-diary-book/App.tsx`
- **状态**: 已批准，待写实现计划

## 背景 / 目标

`ai-studio-diary-book` 是一个虚拟翻页日记本组件（`App.tsx` 单文件，约 1750 行）。目前只能通过
`Write Diary` 按钮新增一篇日记（`handleSaveEntry` 总是 `push` 一个新 spread）。用户希望能够
**编辑已有的某一页日记**——修改文字、图片、视频内容，而不是只能新增或删除。

## 需求总结（与用户确认过）

1. 在头部 `write-diary-btn` 左边新增一个 `Edit` 按钮。
2. 点击 `Edit` 编辑的是**当前正在查看的那一页**（`activeSpread`），不需要额外的页面选择器。
3. 以下情况下 `Edit` 按钮禁用/隐藏：
   - 日记本封面未打开（`!isOpen`）
   - 日记本为空（`isDiaryEmpty`）
   - 当前显示的是占位页（`activeSpread.id === 'blank-spread'`）
4. 编辑弹窗与 `Write Diary` 弹窗**完全复用同一套表单字段**，用户已明确确认：
   - 分类（Category）
   - 日期（Date）
   - 标题（Title）
   - 引言/座右铭（Quote，可选）
   - 正文内容（Body）
   - 媒体选择（预设媒体库 / 自定义链接，图片最多 4 张或单个视频链接）
   - 媒体说明文字（Caption）
5. 编辑弹窗与新建弹窗的区别仅在于：
   - 弹窗标题、提交按钮文案变为"编辑"语境
   - 提交后是**替换**当前 spread 的内容，而不是新增一条

## 方案：复用 Write 弹窗，新增"编辑模式"

不新建第二个弹窗组件，而是让现有的 `isWriting` / `write-diary-modal` 支持编辑模式，通过一个新的
状态 `editingSpreadId: string | null` 来区分"新建" vs "编辑"。

### 1. 新增状态

```ts
const [editingSpreadId, setEditingSpreadId] = useState<string | null>(null);
```

### 2. Edit 按钮（header，位于 `write-diary-btn` 左侧）

```tsx
<button
  id="edit-diary-btn"
  onClick={handleOpenEditor}
  disabled={!isOpen || isDiaryEmpty || activeSpread.id === 'blank-spread'}
  className="... (与 write-diary-btn 同尺寸，描边/次要风格以区分) ..."
>
  <Pencil size={13} />
  <span>Edit</span>
</button>
```

- 需要从 `lucide-react` 额外引入 `Pencil` 图标（当前已引入的图标集中没有编辑图标）。
- 视觉上使用与 `write-diary-btn` 相同的圆角胶囊按钮尺寸，但用描边风格（白底 + brand-blue 边框/文字）
  区分"主操作"（Write）与"次操作"（Edit）。
- `disabled` 时降低透明度、`cursor-not-allowed`，不需要额外提示文案（按需求 2 已确认此为可接受的默认行为）。

### 3. `handleOpenEditor`：预填充表单

```ts
const handleOpenEditor = useCallback(() => {
  const spread = activeSpread;
  if (!spread || spread.id === 'blank-spread') return;

  setEditingSpreadId(spread.id);
  setWritingTitle(spread.leftPage.title);
  setWritingBody(spread.leftPage.bodyText);
  setWritingDate(spread.leftPage.date || curDate());
  setCustomQuote(spread.leftPage.quote || '');
  setMediaCaption(spread.rightPage.caption || '');

  // 分类解析：从 "01 / CHILL BEACH" 中取出后半部分，
  // 与下拉选项（Abroad / Chill Beach / Cozy / Nature / City / Rain / Night）做不区分大小写匹配
  const rawCategory = spread.leftPage.category?.includes('/')
    ? spread.leftPage.category.split('/')[1].trim()
    : spread.leftPage.category || '';
  const matchedCategory = CATEGORY_OPTIONS.find(
    c => c.toLowerCase() === rawCategory.toLowerCase()
  );
  setWritingCategory(matchedCategory || 'Abroad');

  // 媒体预填充
  if (spread.rightPage.urls && spread.rightPage.urls.length > 0) {
    setUseCustomMedia(true);
    setCustomMediaType('image');
    setCustomMediaUrl(spread.rightPage.urls[0] || '');
    setCustomImageUrls([
      spread.rightPage.urls[1] || '',
      spread.rightPage.urls[2] || '',
      spread.rightPage.urls[3] || '',
    ]);
  } else {
    const matchedPreset = PRESET_MEDIA_LIST.find(m => m.url === spread.rightPage.url);
    if (matchedPreset) {
      setUseCustomMedia(false);
      setSelectedMedia(matchedPreset);
    } else {
      setUseCustomMedia(true);
      setCustomMediaType(spread.rightPage.type);
      setCustomMediaUrl(spread.rightPage.url);
      setCustomImageUrls(['', '', '']);
    }
  }

  setIsWriting(true);
}, [activeSpread]);
```

- `CATEGORY_OPTIONS` 是一个新增的常量数组，把 `<option>` 里硬编码的 7 个分类值提出来，
  供表单渲染和这里的匹配逻辑共用（避免两处字符串字面量不同步）。

### 4. `handleSaveEntry`：新增 / 编辑分支

在现有函数开头分流：

```ts
const handleSaveEntry = (e: React.FormEvent) => {
  e.preventDefault();
  if (!writingTitle.trim() || !writingBody.trim()) return;

  const mediaUrl = useCustomMedia ? customMediaUrl : selectedMedia.url;
  const mediaType = useCustomMedia ? customMediaType : selectedMedia.type;
  const activeUrls = useCustomMedia && customMediaType === 'image'
    ? [customMediaUrl, ...customImageUrls].map(u => u.trim()).filter(Boolean)
    : [];

  if (editingSpreadId) {
    // 编辑模式：替换已有 spread 的内容，保留 id 与分类编号前缀
    setSpreads(prev => prev.map(s => {
      if (s.id !== editingSpreadId) return s;
      const prefix = s.leftPage.category?.includes('/')
        ? s.leftPage.category.split('/')[0].trim()
        : String(spreads.indexOf(s)).padStart(2, '0');
      return {
        ...s,
        leftPage: {
          ...s.leftPage,
          category: `${prefix} / ${writingCategory.toUpperCase()}`,
          date: writingDate || curDate(),
          title: writingTitle,
          quote: customQuote || s.leftPage.quote,
          bodyText: writingBody,
        },
        rightPage: {
          type: mediaType,
          url: mediaUrl || PRESET_MEDIA_LIST[0].url,
          ...(activeUrls.length > 1 ? { urls: activeUrls } : {}),
          caption: mediaCaption || s.rightPage.caption,
        },
      };
    }));
    resetWriterForm();
    setIsWriting(false);
    return;
  }

  // 新建模式：沿用原有逻辑（略，未改动）
  ...
};
```

- 新增一个 `resetWriterForm()` 小工具函数，把清空各表单字段 + `setEditingSpreadId(null)`
  的逻辑收在一处，新建/编辑/取消/关闭弹窗都调用它，避免状态残留（比如编辑完一篇后再点
  `Write Diary`，不能带着上一次编辑的内容）。

### 5. 弹窗文案切换

在 `write-diary-modal` 内，根据 `editingSpreadId` 是否为空切换：

| 位置 | 新建模式 | 编辑模式 |
|---|---|---|
| 弹窗标题 | "Write Abroad Reflection" | "Edit Reflection" |
| 副标题 | "Draft new page spread" | "Update this page spread" |
| 提交按钮文案 | "Insert to Abroad Diary" | "Save Changes" |
| 提交按钮图标 | `PenTool` | `Check`（复用已引入的图标） |

### 6. 关闭 / 取消弹窗

`close-writer-btn` 和 `writer-cancel-btn` 的 `onClick` 都改为调用 `resetWriterForm()`
（内部包含 `setIsWriting(false)`），确保编辑状态不会泄漏到下一次打开弹窗。

## 不在本次范围内（Out of scope）

- 不新增单独的"选择要编辑的页面"入口——始终编辑当前页（已与用户确认）。
- 不允许编辑时只修改部分字段（比如只读分类/日期）——所有字段都可编辑（已与用户确认）。
- 不改动删除（`Trash2` / Discard）逻辑。
- 不改动 AI Polish 功能，编辑模式下依然可用（复用同一表单，天然可用，无需额外开发）。

## 测试要点

- 手动测试：
  1. 打开日记本，翻到某一页，点击 Edit，确认表单字段均正确预填充（含多图 / 单图 / 视频三种情况）。
  2. 修改若干字段后点击 Save Changes，确认当前页内容原地更新，页码不跳转，`localStorage` 同步更新。
  3. 点击 Edit 后不保存直接 Cancel/关闭，确认原数据未被修改。
  4. 编辑完成后再点击 Write Diary，确认表单是空白的新建状态，而不是残留上次编辑内容。
  5. 封面未打开、日记为空、显示 blank-spread 占位页三种场景下，确认 Edit 按钮均为禁用状态。
