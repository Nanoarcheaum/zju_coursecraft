# 课构 CourseCraft

**课构（CourseCraft）**是一款完全在浏览器本地运行的大学课程规划器。它把教务系统导出的教学班信息和培养方案中的推荐学期分开处理：课程包负责提供真实教师、时间和地点，培养方案映射只负责提供“哪门课建议在哪个学期修、属于必修还是选修”。

> 当前附带的浙大课程导出脚本按浙江大学本科教务选课页面编写。规划器本身不依赖学校网站，也可以导入符合格式的 JSON、CSV 或 XLSX。

## 功能

- 大一至大四的秋冬、春夏与短学期规划。
- 7 天 × 13 节周历，按真实上课时间拖放教学班，允许课程重叠。
- 鼠标和触控拖放；也可先点教学班，再点高亮的起始节次。
- 课程仓库搜索、折叠、编辑和全库总览。
- 导入前审视课程包，可批量取消不需要的课程。
- 时间与地点均为 `--` 的教学班自动识别为短学期课程。
- 培养方案“软加载”：未匹配到有效教学班的课程显示为灰色待激活项。
- 可随时删除培养方案映射，不影响已导入课程和排课。
- 必修、选修、普通课程使用不同颜色。
- 4 套界面外观 × 浅色/深色，共 8 种组合。
- 数据保存在浏览器 `localStorage`，不会上传到服务器。

## 依赖

运行规划器只需要现代桌面浏览器，例如 Edge、Chrome 或 Firefox。项目是静态网页，不需要 Node.js、Python、数据库或后端服务，所需的 JSZip 已放在仓库中。

从浙江大学教务系统抓取课程时，需要先安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。篡改猴只负责在已登录的选课页面读取并导出数据；规划器本身不依赖扩展。

## 快速开始

### 1. 下载并打开网页

1. 在 GitHub 页面点击 **Code → Download ZIP**。
2. 解压下载的文件，进入 `zju_coursecraft` 文件夹。
3. 双击 `index.html`，或把它拖入浏览器。
4. 不要单独移动 `index.html`；它需要同目录的 JavaScript 和 CSS 文件。

### 2. 安装浙大课程导出脚本

1. 安装并启用 Tampermonkey。
2. 打开 [`tampermonkey/zju-course-exporter.user.js`](tampermonkey/zju-course-exporter.user.js)。
3. 在 GitHub 文件页面点击 **Raw**。Tampermonkey 会打开安装页面。
4. 检查脚本只匹配 `zdbk.zju.edu.cn` 后点击安装。
5. 登录浙江大学本科教务系统并打开自主选课页面。

脚本只在本地浏览器中读取课程列表，不会替你选课，也不会上传教务数据。

### 3. 导出课程包

1. 在选课页面先执行一次课程查询。
2. 点击页面右下角的 **一键获取全部课程信息**。
3. 等待脚本自动加载“查看更多”、展开课程并读取教学班。
4. 完成后点击 **导出 JSON**。CSV 也可导入，但 JSON 保留的信息更完整。
5. 导出文件前可以查看脚本显示的课程数和诊断信息。

### 4. 导入课程包并排课

1. 回到课构（CourseCraft），点击课程仓库中的 **导入课程包**。
2. 在审视弹窗中取消不需要的课程，再确认导入。
3. 选择要规划的学期。
4. 从右侧课程仓库拖动教学班到左侧高亮起始节次。
5. 如果当前浏览器不方便拖动，可单击教学班，再单击高亮格。
6. 点击课表中的 `×` 可移除教学班；这不会删除课程仓库中的数据。

## 培养方案映射

培养方案映射是一个独立 JSON 文件，只包含课程、学分、建议修读学期和标签。它不包含教师、上课时间或地点，也不会单独激活课程。

仓库提供两份可以直接导入的浙江大学示例：

- [`examples/zju-bioscience.curriculum-map.json`](examples/zju-bioscience.curriculum-map.json)：生物科学。
- [`examples/zju-mathematics.curriculum-map.json`](examples/zju-mathematics.curriculum-map.json)：数学与应用数学。

示例由特定版本培养方案整理，使用前应按照自己入学年份和学校最新方案核对。课构（CourseCraft）的初始页面不预装任何培养方案或个人课程数据。

其他专业可以把自己的培养方案 PDF 和以下文件一起交给大模型：

- [`docs/curriculum-map-prompt.zh-CN.md`](docs/curriculum-map-prompt.zh-CN.md)：转换提示词。
- [`curriculum-map.template.json`](curriculum-map.template.json)：最小范例。
- [`academic-curriculum-map.schema.json`](academic-curriculum-map.schema.json)：严格 JSON Schema。

让大模型只输出 JSON，保存为 `.json` 后，在课构（CourseCraft）中点击 **导入培养方案映射**。学期标识如下：

| 标识 | 学期 |
| --- | --- |
| `y1-fall` / `y1-spring` / `y1-short` | 大一秋冬 / 春夏 / 短学期 |
| `y2-fall` / `y2-spring` / `y2-short` | 大二秋冬 / 春夏 / 短学期 |
| `y3-fall` / `y3-spring` / `y3-short` | 大三秋冬 / 春夏 / 短学期 |
| `y4-fall` / `y4-spring` | 大四秋冬 / 春夏 |

需要撤销时，点击课程仓库底部的 **删除培养方案映射**。此操作会移除灰色提示和推荐学期，不会删除课程包及已经排入课表的教学班。

## 支持的文件

- 课程包：篡改猴导出的 JSON、CSV，以及 课构（CourseCraft）/i-home 可识别的 XLSX。
- 培养方案：符合 `academic-curriculum-map` schema version 1 的 JSON。
- 规划备份：页面顶部 **导出规划** 生成的完整 JSON。

## 隐私与限制

- 所有解析和排课都在本地完成。
- 教务系统账号、Cookie 和页面响应不会写入本仓库。
- 导出的课程包可能含教师、教室和教学班信息，公开分享前请自行检查。
- 浏览器清理站点数据会删除本地规划，请定期使用 **导出规划** 保存备份。
- 教务系统页面结构变化后，篡改猴脚本可能需要更新。

## 目录

```text
zju_coursecraft/
├─ index.html
├─ future-planner.js
├─ future-planner.css
├─ xlsx-import.js
├─ jszip.min.js
├─ initial-plan.js
├─ academic-curriculum-map.schema.json
├─ curriculum-map.template.json
├─ examples/
├─ docs/
└─ tampermonkey/
```

## License

[MIT](LICENSE)


