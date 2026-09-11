# 培养方案软加载提示词

请阅读培养方案全文，将课程与建议修读学期转换为严格 JSON。输出必须符合同目录的 `academic-curriculum-map.schema.json`，不得输出 Markdown 代码围栏或解释文字。

每门课程只保留 `code`、`name`、`credits`、`recommendedTerms` 和 `tags`。`tags` 使用培养方案明确给出的“必修”“选修”等标签。不要加入教师、上课时间、地点、课程内容、修读理由、先修关系或额外课程；这些不属于本映射文件。同一课程按课程代码合并，可对应多个建议学期。

学期只能使用：`y1-fall`、`y1-spring`、`y1-short`、`y2-fall`、`y2-spring`、`y2-short`、`y3-fall`、`y3-spring`、`y3-short`、`y4-fall`、`y4-spring`。

培养方案文件只提供推荐顺序，不激活课程，也不直接生成排课。不能确定的学分使用 `null`，不能确定的标签使用空数组，不要杜撰。
