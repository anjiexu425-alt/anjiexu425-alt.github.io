# Study Diary 后端持久化设计文档

**日期**: 2026-07-21
**状态**: 已确认,待写实施计划

## 背景与目标

Study Diary 页面目前的"写日记"功能（Write Diary 表单、Discard 删除、Mood/Weather 按钮）把数据存在浏览器的 localStorage 里——只在写日记时用的那台设备、那个浏览器里可见，刷新页面不丢，但换设备、换浏览器，或者网站真正发布上线给别人访问时，谁都看不到这些内容，也无法互通。

目标：接入一个真正的后端，让网站发布上线后：
- **任何访客**都能公开浏览日记本里的全部内容（文字 + 图片/视频），无需登录。
- **只有网站主人（Anjie）**登录后才能新增、删除日记，或者编辑心情/天气。
- 图片/视频支持**真正的文件上传**（不再是粘贴链接/本地相对路径），上传后云端持久保存。

网站的部署方式不变：仍然是纯静态站点（GitHub Pages / Netlify / Vercel 这类），不引入任何构建工具，不新增自己维护的服务器。

## 技术选型：Supabase

选择 [Supabase](https://supabase.com)（开源的 Firebase 替代品），一次性提供三个所需能力：

- **Postgres 数据库**：存日记的文字内容
- **Supabase Auth**：邮箱+密码登录，仅开放一个账号（网站主人）
- **Supabase Storage**：图片/视频文件的真实上传与托管

选型理由：
- 官方 JS 客户端库（`@supabase/supabase-js`）可以通过 CDN 以 ES module 方式直接 `<script type="module">` 引入（例如 `https://esm.sh/@supabase/supabase-js@2`），不需要 npm/构建工具，与本项目"纯 HTML/CSS/JS"的既定技术路线完全兼容。
- 权限控制（谁能读、谁能写）由数据库自身的 Row Level Security（RLS）策略强制执行，而不是依赖前端代码隐藏按钮这种"伪安全"——即使有人绕过界面直接调用接口，未登录也会被数据库拒绝。
- 免费额度（数据库 500MB、文件存储 1GB）对个人日记网站完全够用。
- Supabase 的公开 anon key 设计上就是可以出现在客户端代码、提交进 git 仓库的，不是需要保密的密钥；真正的安全边界是 RLS 策略，不是隐藏这个 key。

被否决的备选方案：
- **Firebase**（Firestore + Auth + Storage）：能力与 Supabase 基本对等，最初曾选定后又改为 Supabase，纯属选型偏好，无功能性差异。
- **自建服务器/Serverless API**（Vercel/Netlify Functions + 数据库）：需要自己编写并维护登录验证、上传处理等后端逻辑，工作量明显更大，且与"纯静态站点"的定位存在张力，予以否决。

## 数据结构

一张 `diary_entries` 表，一行对应一篇日记：

```sql
create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  number text,
  category text,
  entry_date text,
  title text,
  quote text,
  body text,
  media jsonb,        -- { type: 'image'|'video', urls: string[], caption: string }
  mood text,
  weather text,
  created_at timestamptz default now()
);
```

`media` 字段用 `jsonb` 存储一个嵌套对象，结构与当前 `js/diary.js` 里 `entry.media` 的形状（`{ type, urls, caption }`）保持一致，前端渲染函数（`leftPageHTML`/`rightPageHTML`/`mediaItemHTML` 等）改动量可以降到最低——只需把数据来源从内存数组换成数据库查询结果，渲染逻辑基本不用动。

排序：按 `created_at` 升序展示，与当前"新日记追加到末尾"的行为一致。

## 权限设计（Row Level Security）

在 `diary_entries` 表和 Storage bucket 上分别配置 RLS 策略：

- **读取（SELECT）**：对所有人开放，无需登录。
- **写入（INSERT / UPDATE / DELETE）**：仅当 `auth.uid()` 匹配网站主人的账号 UID 时允许。

Storage bucket（图片/视频文件）采用相同思路：公开可读，仅认证账号可写。

不开放注册——账号只在 Supabase 后台手动创建一个，对应网站主人本人。

## 登录与写日记交互流程

- **未登录状态**（绝大多数访客）：日记本工具栏只显示一个不起眼的"Log In"入口；"Write Diary"按钮、每篇日记左下角的"Discard"按钮、心情/天气按钮**全部不显示**。访客可以自由翻阅日记本里的全部文字和媒体内容，界面上是纯浏览模式。
- **登录**：点击"Log In"弹出邮箱+密码表单；登录成功后，"Write Diary"、"Discard"、心情/天气按钮才会出现，"Log In"变为"Log Out"。登录状态由 Supabase 客户端自动维持在浏览器本地，无需每次打开网站重新登录。
- 前端隐藏这些按钮只是体验层面的优化；真正的写入拦截始终在数据库的 RLS 策略这一层。

## 图片/视频上传流程

写日记表单里的图片/视频字段，从当前的"填链接/相对路径"文本框，改为真正的文件选择控件（`<input type="file">`），**不再支持粘贴链接**这个选项（已与用户确认，为了表单简洁，二选一去掉粘链接）：

1. 选好文件、点提交后，提交按钮进入"Uploading…"状态并禁用，避免重复提交。
2. 逐个把选中的文件上传到 Supabase Storage 的一个 bucket（如 `diary-media`），路径按时间戳+文件名生成，避免重名覆盖。
3. 全部文件上传成功后，才把这篇日记（文字内容 + 上传后拿到的公开访问链接）一次性写入 `diary_entries` 表；只要有一个文件上传失败，就不写入数据库，避免出现"文字保存了、图片丢了"的半成品记录。
4. 文件大小限制：图片单个不超过 8MB，视频单个不超过 100MB；超过大小在**上传前**就直接提示拒绝，不发起无意义的上传请求。
5. 字段留空时的占位卡片行为（`.diary-placeholder`，虚线卡片 + Tap to Upload 提示）保持不变。

## 报错处理

任何一次 Supabase 通信失败都必须给出用户可读的提示，不允许静默失败或卡死：

| 场景 | 处理方式 |
|---|---|
| 日记加载失败（网络/服务异常） | 日记本区域显示"加载失败，请检查网络后重试"，而不是呈现一本看起来"还没写日记"的空书 |
| 登录失败 | 登录表单内联提示"邮箱或密码不正确" |
| 写入/新增日记失败 | 表单内提示报错，已填内容保留不清空，可重试 |
| 上传失败 | 明确指出是哪个文件、什么原因失败；不提交半成品日记 |
| 删除失败 | 提示报错，不在界面上乐观移除该条目，避免"看起来删了、数据库里其实还在"的假象 |

## 测试策略

Supabase 相关的真实网络请求（登录、读取、写入、上传、删除）无法用项目现有的"纯函数 + `node:test`"方式做自动化测试，与 `js/diary.js` 里其余 DOM/网络交互代码从项目一开始就一贯采用的策略一致：**只对纯逻辑做自动化测试，I/O 部分靠手动浏览器验证**。

- 保留自动化测试的部分：客户端校验逻辑（如"文件是否超过大小限制"）、数据形状转换函数（数据库行 → 现有 `entry` 对象结构，供渲染函数直接复用）——这些是纯函数，可以像 `diary-state.mjs` 现有测试一样正常编写 `node:test` 用例。
- 不做自动化测试、需手动验证的部分：登录、公开读取、写入新日记、文件上传、删除——均需在浏览器里连接真实 Supabase 项目手动验证。
- 评估过 Supabase CLI 本地模拟器（本地跑一份 Supabase 服务用于集成测试）作为更严谨的选项，但会给项目引入一整套额外工具链，对个人网站来说投入产出比不高，本期不采用，后续如有需要可重新评估。

## 范围之外（本期不做）

- 多用户/多账号支持（仅一个网站主人账号）
- 注册流程（账号在 Supabase 后台手动创建一次）
- 密码找回流程
- 评论/点赞等社交互动功能
- 多标签页/多设备间的实时同步（`onSnapshot` 式的实时监听）——本期采用页面加载时一次性拉取，如后续需要可再评估
- Supabase CLI 本地模拟器集成测试
