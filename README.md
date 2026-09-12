# 课构 zju_CourseCraft

**课构（CourseCraft）** 是一款完全在浏览器本地运行的大学课程规划器。旨在可以提前规划未来学期的课程安排，掌握全局视角。

先叠个甲：每年开课的具体时间可能会有变动，课构只能获取爬取时刻的数据，仅供参考，一切以官网课程安排为准！

## 一、包里有什么

### 1.内置课程爬虫（仅适用于zdbk官网）

可以一键获取课程信息的脚本，需要通过浏览器的篡改猴插件配置

### 2.随仓库提供的课程包

仓库的 [`course-packs/`](course-packs/) 目录提供四份已经导出的课程包，可直接下载并导入课构：

- [`zju-courses-tongshibixiu.json`](course-packs/zju-courses-tongshibixiu.json)：通识必修，93 门课程、793 个教学班；获取于 **2026-09-12 17:05:06（UTC+8）**。
- [`zju-courses-PE.json`](course-packs/zju-courses-PE.json)：体育课，73 门课程、705 个教学班；获取于 **2026-09-12 17:06:48（UTC+8）**。
- [`zju-courses-sk.json`](course-packs/zju-courses-sk.json)：生命科学学院专业课，50 门课程、108 个教学班；获取于 **2026-09-12 17:01:04（UTC+8）**。
- [`zju-courses-rending.json`](course-packs/zju-courses-rending.json)：认定类课程，156 门课程、294 个教学班；含美育 55 门、劳育 55 门、心理 23 门、创新 24 门，其中“舞动身心疗愈”同时计入美育和心理；获取于 **2026-09-12 17:49:31（UTC+8）**。

这些文件是选课页面快照，教师、时间、地点和容量以后可能变化；使用时请以教务系统当期信息为准。

### 3.coursecraft 本体（独立网页版与Obsidian插件版）
**基本功能：**
- **导入脚本**获取的课程包，可批量取消不需要的课程。
<img width="1273" height="691" alt="image" src="https://github.com/user-attachments/assets/87fb3655-f5eb-4863-a404-e45d3ef55e58" />

- 大一至大四的秋冬、春夏与短学期规划。
- 7 天 × 13 节周历，按真实上课时间拖放教学班，允许课程重叠。
- 鼠标和触控拖放；也可先点教学班，再点高亮的起始节次。

<img width="613" height="692" alt="image" src="https://github.com/user-attachments/assets/99cc9c10-83da-446d-870c-bf6cdf9289e5" />

- **课程仓库**支持双列浏览、搜索、折叠、编辑和全库总览；一门课程有三个及以上平行班时默认收起。

- **培养方案映射**：通过导入培养方案映射可以获取课程推荐学习的学期，并在当学期顶置这些课程

- 美育、劳育、心理、创新四类课程认定与全规划学分统计；未标注认定类别的课程不参与统计。

- 4 套界面外观 × 浅色/深色，共 8 种组合。

### 4.培养方案映射范例文件

培养方案映射是一个独立 JSON 文件，只包含课程、学分、建议修读学期和标签。它不包含教师、上课时间或地点，也不会单独激活课程。

内含两个培养方案映射范例文件，可以直接导入程序获取映射关系，其他专业的同学可能需要用大模型仿照范例翻译一下自己的培养方案了qwq
- [`examples/zju-bioscience.curriculum-map.json`](examples/zju-bioscience.curriculum-map.json)：生命科学（强基计划）。
- [`examples/zju-mathematics.curriculum-map.json`](examples/zju-mathematics.curriculum-map.json)：数学与应用数学。

## 二、食用方法

### 1. 下载并打开网页
**独立网页端：**
1. 在 GitHub 页面点击 **Code → Download ZIP**。
2. 解压下载的文件，进入 `zju_coursecraft` 文件夹。
3. 双击 `index.html`，或把它拖入浏览器。
4. 不要单独移动 `index.html`；它需要同目录的 JavaScript 和 CSS 文件。

**Obsidian端：**
前往作者主页下载最新版本 i-home 插件（https://github.com/Nanoarcheaum/Obsidian-i-home）， 现已原生支持 coursecraft 功能，只需要切换到周历即可看到入口
<img width="766" height="125" alt="image" src="https://github.com/user-attachments/assets/eeca973b-e416-4e1b-affa-4a1befdc70be" />



### 2. 安装篡改猴导出脚本

1. 安装 Tampermonkey(https://www.tampermonkey.net/ 或者 浏览器自带的插件生态搜索篡改猴)。**注意 edge 用户需要在“管理扩展”界面启用脚本功能**
<img width="623" height="136" alt="image" src="https://github.com/user-attachments/assets/4cca56c6-5dd1-43af-853e-4296a2057cc8" />

2. 打开 [`tampermonkey/zju-course-exporter.user.js`](tampermonkey/zju-course-exporter.user.js)。
3. 在 GitHub 文件页面点击 **Raw**。Tampermonkey 会打开安装页面。
4. 检查脚本只匹配 `zdbk.zju.edu.cn` 后点击安装。
5. 登录浙江大学本科教务系统并打开自主选课页面。

脚本只在本地浏览器中读取课程列表，不会替你选课，也不会上传教务数据。

### 3. 导出课程包

1. 因为脚本会获取当前网页的全部课程，推荐**灵活使用搜索功能**限制当前页面的课程，再重复执行以下操作：
<img width="257" height="249" alt="image" src="https://github.com/user-attachments/assets/f4e5e7ca-aa2f-4b51-8a8e-fa5067c515e6" />

2. 点击页面右下角的 **后台加载全部课程信息** 再点击 **一键获取全部课程信息**。
3. 完成后点击 **导出 JSON**。CSV 也可，但 JSON 保留的信息更完整。


### 4. 导入课程包并排课

1. 回到课构（CourseCraft），点击课程仓库中的 **导入课程包**。
2. 在审视弹窗中取消不需要的课程，再确认导入。
3. 选择要规划的学期。
4. 从右侧课程仓库拖动教学班到左侧高亮起始节次。
5. 如果当前浏览器不方便拖动，可单击教学班，再单击高亮格。
6. 点击课表中的 `×` 可移除教学班；这不会删除课程仓库中的数据。

## 三、培养方案映射

培养方案映射是一个独立 JSON 文件，只包含课程、学分、建议修读学期和标签。它不包含教师、上课时间或地点，也不会单独激活课程。

仓库提供两份可以直接导入的浙江大学示例：

- [`examples/zju-bioscience.curriculum-map.json`](examples/zju-bioscience.curriculum-map.json)：生命科学（强基计划）。
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
