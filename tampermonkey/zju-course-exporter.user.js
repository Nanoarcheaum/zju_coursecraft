// ==UserScript==
// @name         浙大选课课程信息导出助手
// @namespace    local.codex.zju.course-exporter
// @version      1.8.0
// @description  在已登录的浙大本科教务选课页面中，本地捕获课程数据并导出 JSON/CSV；不上传数据。
// @match        *://zdbk.zju.edu.cn/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = '__zju_course_exporter_capture_v8__';
  const MESSAGE_TYPE = '__zju_course_exporter_v2__';
  const captured = [];
  const seen = new Set();
  const courseCatalog = new Map();
  const diagnostics = [];
  const diagnosticSeen = new Set();
  const pageWindow = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  const isTopFrame = window.top === window.self;

  const now = () => new Date().toISOString();
  const text = (value) => value == null ? '' : String(value).trim();
  const compact = (value) => text(value).replace(/\s+/g, '');

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      for (const key of [...url.searchParams.keys()]) {
        if (/^(su|xh|xh_id|zgh|sfzh)$/i.test(key)) url.searchParams.set(key, '[redacted]');
      }
      return url.toString();
    } catch (_) {
      return String(value || '').replace(/([?&](?:su|xh|xh_id|zgh|sfzh)=)[^&]*/gi, '$1[redacted]');
    }
  }

  function looksLikeCourseObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value).map((key) => compact(key).toLowerCase());
    const hasCode = keys.some((key) => ['kch', 'kch_id', 'kcdm', 'coursecode', 'course_code', '课程代码', '课程号'].includes(key));
    const hasName = keys.some((key) => ['kcmc', 'kcm', 'coursename', 'course_name', '课程名称', '课程名'].includes(key));
    const hasTeaching = keys.some((key) => ['jxbmc', 'jxb_id', 'jsxx', 'jsxm', 'xf', 'sksj', 'jxdd', '教学班', '教师', '学分', '上课时间'].includes(key));
    return (hasCode && hasName) || (hasName && hasTeaching);
  }

  function collectCourseObjects(value, output = [], depth = 0) {
    if (depth > 10 || value == null) return output;
    if (Array.isArray(value)) {
      for (const item of value) collectCourseObjects(item, output, depth + 1);
      return output;
    }
    if (typeof value !== 'object') return output;
    if (looksLikeCourseObject(value)) output.push(value);
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === 'object') collectCourseObjects(nested, output, depth + 1);
    }
    return output;
  }

  function pick(value, keys) {
    for (const key of keys) {
      if (value && value[key] != null && text(value[key])) return text(value[key]);
    }
    return '';
  }

  function stableKey(value) {
    const code = pick(value, ['kch', 'kch_id', 'kcdm', 'courseCode', 'course_code', '课程代码', '课程号']);
    const name = pick(value, ['kcmc', 'kcm', 'courseName', 'course_name', '课程名称', '课程名']);
    const classId = pick(value, ['jxb_id', 'jxbmc', '教学班', '教学班名称']);
    const teacher = pick(value, ['jsxm', 'jsxx', 'jstxt', '教师', '教师姓名']);
    const time = pick(value, ['sksj', 'sksj_text', 'sjdd', '上课时间', '时间']);
    const capacity = pick(value, ['jxbrl', 'zrl', '容量', '余量/容量']);
    const semester = pick(value, ['xq', 'xqmc', '学期']);
    const fallback = Object.entries(value || {}).map(([key, item]) => `${key}:${text(item)}`).join('|');
    return [code, name, classId, teacher, time].some(Boolean)
      ? [code, name, classId, teacher, time, capacity, semester].join('|')
      : fallback;
  }

  function addCapturedItem(item, relay = true) {
    if (!item || !item.data) return false;
    const key = stableKey(item.data);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    captured.push(item);
    persist();
    updatePanel();
    if (relay && !isTopFrame) postToTop({ action: 'records', items: [item] });
    return true;
  }

  function recordPayload(url, payload, kind) {
    for (const record of collectCourseObjects(payload)) {
      addCapturedItem({ sourceUrl: safeUrl(url), capturedAt: now(), transport: kind, data: enrichFromCatalog(record) });
    }
  }

  function catalogCourse(data) {
    for (const token of [data.课程代码, data.课程号]) {
      if (compact(token)) courseCatalog.set(compact(token).toLowerCase(), data);
    }
  }

  function enrichFromCatalog(record) {
    if (!record || typeof record !== 'object') return record;
    if (pick(record, ['kcmc', 'kcm', 'courseName', 'course_name', '课程名称', '课程名'])) return record;
    for (const value of Object.values(record)) {
      if (!['string', 'number'].includes(typeof value)) continue;
      const summary = courseCatalog.get(compact(value).toLowerCase());
      if (summary) return { ...summary, ...record };
    }
    return record;
  }

  function addDiagnostic(item, relay = true) {
    const key = [item.frame, item.transport, item.sourceUrl, item.observedAt].join('|');
    if (diagnosticSeen.has(key)) return;
    diagnosticSeen.add(key);
    diagnostics.push(item);
    if (diagnostics.length > 200) diagnostics.shift();
    updatePanel();
    if (relay && !isTopFrame) postToTop({ action: 'diagnostic', item });
  }

  function observeResponse(url, kind, body, parsed) {
    let description = '';
    if (parsed && typeof parsed === 'object') {
      description = Array.isArray(parsed)
        ? `JSON array (${parsed.length})`
        : `JSON object: ${Object.keys(parsed).slice(0, 12).join(', ')}`;
    } else {
      description = `text (${typeof body === 'string' ? body.length : 0} chars)`;
    }
    addDiagnostic({ sourceUrl: safeUrl(url), observedAt: now(), transport: kind,
      frame: isTopFrame ? 'top' : safeUrl(location.href), description });
  }

  function postToTop(payload) {
    try { window.top.postMessage({ type: MESSAGE_TYPE, ...payload }, location.origin); } catch (_) {}
  }

  if (isTopFrame) {
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin || !event.data || event.data.type !== MESSAGE_TYPE) return;
      if (event.data.action === 'records' && Array.isArray(event.data.items)) {
        for (const item of event.data.items) addCapturedItem(item, false);
      } else if (event.data.action === 'diagnostic' && event.data.item) {
        addDiagnostic(event.data.item, false);
      }
    });
  }

  function persist() {
    if (!isTopFrame) return;
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(captured)); } catch (_) {}
  }

  function restore() {
    if (!isTopFrame) return;
    try {
      const prior = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]');
      if (Array.isArray(prior)) for (const item of prior) addCapturedItem(item, false);
    } catch (_) {}
  }

  function parseMaybeJson(body) {
    if (typeof body !== 'string') return body;
    let trimmed = body.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('while(1);')) trimmed = trimmed.slice(9).trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try { return JSON.parse(trimmed); } catch (_) { return null; }
  }

  try {
    const nativeFetch = pageWindow.fetch;
    if (nativeFetch) {
      pageWindow.fetch = async function (...args) {
        const response = await nativeFetch.apply(this, args);
        try {
          const clone = response.clone();
          const contentType = clone.headers.get('content-type') || '';
          if (/json|text|javascript|html/i.test(contentType)) {
            const body = await clone.text();
            const parsed = parseMaybeJson(body);
            observeResponse(clone.url || String(args[0]), 'fetch', body, parsed);
            if (parsed) recordPayload(clone.url || String(args[0]), parsed, 'fetch');
          }
        } catch (_) {}
        return response;
      };
    }
  } catch (error) {
    console.warn('[浙大课程导出助手] fetch 捕获未启用。', error);
  }

  try {
    const NativeXHR = pageWindow.XMLHttpRequest;
    if (NativeXHR) {
      const nativeOpen = NativeXHR.prototype.open;
      const nativeSend = NativeXHR.prototype.send;
      NativeXHR.prototype.open = function (method, url, ...rest) {
        this.__zjuExporterUrl = String(url);
        return nativeOpen.call(this, method, url, ...rest);
      };
      NativeXHR.prototype.send = function (...args) {
        this.addEventListener('load', () => {
          try {
            let body = '';
            let parsed = null;
            if (this.responseType === 'json') parsed = this.response;
            else if (this.responseType === '' || this.responseType === 'text') {
              body = this.responseText || '';
              parsed = parseMaybeJson(body);
            }
            const url = this.responseURL || this.__zjuExporterUrl || '';
            observeResponse(url, 'xhr', body, parsed);
            if (parsed) recordPayload(url, parsed, 'xhr');
          } catch (_) {}
        });
        return nativeSend.apply(this, args);
      };
    }
  } catch (error) {
    console.warn('[浙大课程导出助手] XHR 捕获未启用。', error);
  }

  function rowLooksLikeCourse(record) {
    const keys = Object.keys(record).map(compact);
    const values = Object.values(record).map(compact);
    return keys.some((key) => /课程名称|课程名|课程代码|课程号/.test(key))
      && values.some((value) => value && !/^(查询|选择|操作)$/.test(value));
  }

  function parseCourseSummary(rawText) {
    const source = text(rawText).replace(/\s+/g, ' ').trim();
    if (!source || source.length > 500) return null;
    const head = source.match(/(?:^|\s)([A-Za-z]{2,}\d+[A-Za-z]?)\s*[（(]\s*([0-9A-Za-z-]+)\s*[）)]\s*(.*?)\s+(\d+(?:\.\d+)?)\s*学分/i);
    if (!head) return null;
    const field = (label, nextLabels) => {
      const next = nextLabels.length ? `(?=\\s*(?:${nextLabels.join('|')})\\s*[：:]|$)` : '$';
      const match = source.match(new RegExp(`${label}\\s*[：:]\\s*(.*?)\\s*${next}`));
      return match ? text(match[1]) : '';
    };
    return {
      课程代码: head[1],
      课程号: head[2],
      课程名称: text(head[3]),
      学分: head[4],
      课程类别: field('课程类别', ['认定类别', '开课学院', '状态']),
      认定类别: field('认定类别', ['开课学院', '状态']),
      开课学院: field('开课学院', ['状态']),
      状态: field('状态', []),
    };
  }

  function parseLabeledSpan(header, label) {
    if (!header) return '';
    for (const span of header.querySelectorAll('h3.panel-title > span')) {
      const value = text(span.textContent).replace(/\s+/g, ' ');
      const match = value.match(new RegExp(`^${label}\\s*[：:]\\s*(.*)$`));
      if (match) return text(match[1]);
    }
    return '';
  }

  function parseCoursePanel(panel) {
    if (!panel) return null;
    const header = panel.querySelector('.panel-heading.kc_head, .panel-heading');
    if (!header) return null;
    const code = text(header.querySelector('input[name="kcdm"]')?.value)
      || text(header.dataset.xkcdm)
      || text(header.querySelector('.kcmc')?.id).replace(/^kcmc_/, '');
    const chosenText = text(header.querySelector('[id^="kcmc_chosen_"]')?.textContent).replace(/\s+/g, ' ');
    const visibleTitle = header.querySelector('.kcmc');
    const numberMatch = chosenText.match(/[（(]\s*([^）)]+)\s*[）)]/)
      || text(visibleTitle?.textContent).match(/[（(]\s*([^）)]+)\s*[）)]/);
    const courseNumber = numberMatch ? text(numberMatch[1]) : '';
    let courseName = text(visibleTitle?.querySelector('a')?.textContent).replace(/\s+/g, ' ');
    if (!courseName && chosenText) {
      courseName = chosenText
        .replace(/^.*?[（(][^）)]+[）)]\s*/, '')
        .replace(/\s*[-－]?\s*\d+(?:\.\d+)?\s*学分.*$/, '')
        .trim();
    }
    const credits = text(header.querySelector('[id^="xf_"]')?.textContent)
      || (chosenText.match(/(\d+(?:\.\d+)?)\s*学分/) || [])[1]
      || '';
    if (!code && !courseName) return null;
    return {
      课程代码: code,
      课程号: courseNumber,
      课程名称: courseName,
      学分: credits,
      课程类别: parseLabeledSpan(header, '课程类别'),
      认定类别: parseLabeledSpan(header, '认定类别'),
      开课学院: parseLabeledSpan(header, '开课学院'),
      状态: parseLabeledSpan(header, '状态'),
    };
  }

  function scanCourseSummaries() {
    const byCourse = new Map();
    for (const panel of document.querySelectorAll('.tjxk_list .panel.panel-info')) {
      const data = parseCoursePanel(panel);
      if (!data) continue;
      const key = `${data.课程代码}|${data.课程号}`;
      byCourse.set(key, { element: panel, data });
    }
    if (!byCourse.size) {
      const selector = '.panel-heading, .panel-title, [data-toggle="collapse"], [aria-expanded]';
      for (const element of document.querySelectorAll(selector)) {
        const raw = element.textContent;
        if (!raw || raw.length > 500) continue;
        const data = parseCourseSummary(raw);
        if (!data) continue;
        const key = `${data.课程代码}|${data.课程号}`;
        byCourse.set(key, { element, data });
      }
    }
    const summaries = [...byCourse.values()];
    for (const summary of summaries) {
      catalogCourse(summary.data);
      addCapturedItem({
        sourceUrl: safeUrl(location.href),
        capturedAt: now(),
        transport: 'dom-course-summary',
        data: summary.data,
      });
    }
    return summaries;
  }

  function precedingCourseForTable(table, summaries) {
    let nearest = null;
    for (const summary of summaries) {
      const relation = summary.element.compareDocumentPosition(table);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) nearest = summary;
    }
    return nearest ? nearest.data : null;
  }

  function cellValue(cell) {
    return text(cell?.innerText) || text(cell?.textContent);
  }

  function joinedValue(element) {
    return text(element?.innerText || element?.textContent).replace(/\s*\n+\s*/g, ';').replace(/\s*;\s*/g, ';');
  }

  function scanPanelTeachingRows(panel, panelIndex = 0) {
    const summary = parseCoursePanel(panel);
    let added = 0;
    for (const row of panel.querySelectorAll('tbody tr.body_tr, tbody tr[id^="tr_"]')) {
      const data = row.dataset || {};
      const record = {
        ...(summary || {}),
        教学班: text(data.xkkh) || joinedValue(row.querySelector('.xkkh')) || text(row.id).replace(/^tr_/, ''),
        教师: joinedValue(row.querySelector('.jsxm')),
        学期: joinedValue(row.querySelector('.xxq')) || text(data.xxq),
        上课时间: text(data.sksj) || joinedValue(row.querySelector('.sksj')),
        上课地点: joinedValue(row.querySelector('.skdd')),
        地点: joinedValue(row.querySelector('.skdd')),
        考试时间: text(data.kssj) || joinedValue(row.querySelector('.kssj')),
        授课形式: joinedValue(row.querySelector('.skxs')),
        面向对象: joinedValue(row.querySelector('.mxdx')),
        国际化课程: joinedValue(row.querySelector('.gjhkc')),
        教学方式: joinedValue(row.querySelector('.jxfs')),
        '余量/容量': text(data.rsxx) || joinedValue(row.querySelector('.rsxx')),
        本专业待定人数: joinedValue(row.querySelector('.bxdd')),
        所有待定人数: joinedValue(row.querySelector('.sydd')),
        总学时结构: text(data.zxs),
      };
      for (const [key, value] of Object.entries(data)) if (text(value)) record[`data-${key}`] = text(value);
      if (!record.课程代码) record.课程代码 = text(data.xkcdm) || text(data.kcdm);
      if (!record.教学班 && !record.上课时间) continue;
      if (addCapturedItem({ sourceUrl: safeUrl(location.href), capturedAt: now(), transport: `dom-teaching-row-${panelIndex + 1}`, data: record })) added += 1;
    }
    return added;
  }

  function scanTables() {
    const summaries = scanCourseSummaries();
    [...document.querySelectorAll('.tjxk_list .panel.panel-info')].forEach((panel, index) => scanPanelTeachingRows(panel, index));
    for (const [tableIndex, table] of [...document.querySelectorAll('table')].entries()) {
      const rows = [...table.rows];
      const panel = table.closest('.panel.panel-info');
      const courseSummary = parseCoursePanel(panel) || precedingCourseForTable(table, summaries);
      const headerIndex = rows.findIndex((row) => [...row.cells].some((cell) => /教师|上课时间|上课地点|余量.?容量|课程名称|课程代码|教学班/.test(compact(cellValue(cell)))));
      if (headerIndex < 0) continue;
      const headers = [...rows[headerIndex].cells].map((cell, index) => compact(cellValue(cell)) || `列${index + 1}`);
      for (const row of rows.slice(headerIndex + 1)) {
        const cells = [...row.cells]
          .filter((cell) => cell.style.display !== 'none' && !cell.hidden)
          .map(cellValue);
        if (!cells.some(Boolean)) continue;
        const record = courseSummary ? { ...courseSummary } : {};
        headers.forEach((header, index) => { if (cells[index]) record[header] = cells[index]; });
        for (const [key, value] of Object.entries(row.dataset || {})) {
          if (text(value)) record[`data-${key}`] = text(value);
        }
        if (!courseSummary && !rowLooksLikeCourse(record)) continue;
        addCapturedItem({ sourceUrl: safeUrl(location.href), capturedAt: now(),
          transport: `dom-table-${tableIndex + 1}`, data: record });
      }
    }
  }

  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  let loadingAll = false;
  let loadingEverything = false;

  function setProgress(message) {
    if (progressNode) progressNode.textContent = message;
  }

  async function waitForMoreCoursePanels(previousCount, timeout = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      await sleep(250);
      const currentCount = document.querySelectorAll('.tjxk_list .panel.panel-info').length;
      if (currentCount > previousCount) return currentCount;
    }
    return previousCount;
  }

  async function loadAllCoursePages() {
    let pageLoads = 0;
    let stalled = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const nextPage = document.querySelector('#nextPage');
      if (!nextPage || !nextPage.isConnected || nextPage.offsetParent === null) break;
      const before = document.querySelectorAll('.tjxk_list .panel.panel-info').length;
      setProgress(`正在加载更多课程：当前 ${before} 门…`);
      nextPage.click();
      const after = await waitForMoreCoursePanels(before);
      if (after <= before) {
        stalled = true;
        break;
      }
      pageLoads += 1;
      scanCourseSummaries();
      await sleep(350);
    }
    const total = document.querySelectorAll('.tjxk_list .panel.panel-info').length;
    return { pageLoads, total, stalled };
  }

  async function loadEverythingInOneClick() {
    if (loadingEverything || loadingAll) return;
    loadingEverything = true;
    try {
      const result = await loadAllCoursePages();
      if (result.stalled) {
        setProgress(`“查看更多”在 ${result.total} 门处未返回新课程；继续加载已有课程的教学班…`);
      } else {
        setProgress(`课程列表已全部加载：${result.total} 门；开始加载教学班…`);
      }
      await loadAllTeachingClasses();
    } finally {
      loadingEverything = false;
    }
  }

  async function waitForTeachingRows(panel, timeout = 12000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const rows = panel.querySelectorAll('tbody tr.body_tr, tbody tr[id^="tr_"]');
      if (rows.length) return rows.length;
      await sleep(180);
    }
    return 0;
  }

  async function expandAndCapturePanel(panel, index, total) {
    const header = panel.querySelector('.panel-heading.kc_head, .panel-heading');
    if (!header) return { requested: 0, loaded: 0, failed: 1 };
    let rows = panel.querySelectorAll('tbody tr.body_tr, tbody tr[id^="tr_"]').length;
    if (rows) {
      scanPanelTeachingRows(panel, index);
      return { requested: 0, loaded: rows, failed: 0 };
    }
    setProgress(`自动展开并加载教学班 ${index + 1}/${total}…`);
    try {
      const bodyBefore = panel.querySelector('.panel-body');
      if (bodyBefore) bodyBefore.style.removeProperty('display');
      let result;
      if (typeof pageWindow.loadJxbxxZzxk === 'function') {
        result = pageWindow.loadJxbxxZzxk.call(header, header);
      } else {
        header.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      if (result && typeof result.then === 'function') await result.catch(() => {});
      rows = await waitForTeachingRows(panel);
      if (!rows) {
        const toggle = panel.querySelector('.expand_close, a[onclick*="loadJxbxxZzxk"]');
        if (toggle && toggle !== header) toggle.click();
        rows = await waitForTeachingRows(panel, 5000);
      }
      const added = scanPanelTeachingRows(panel, index);
      const body = panel.querySelector('.panel-body');
      if (body) body.style.display = 'none';
      return { requested: 1, loaded: Math.max(rows, added), failed: rows ? 0 : 1 };
    } catch (error) {
      console.warn('[浙大课程导出助手] 自动展开教学班失败', parseCoursePanel(panel), error);
      return { requested: 1, loaded: 0, failed: 1 };
    }
  }

  async function loadAllTeachingClasses() {
    if (loadingAll) return;
    const panels = [...document.querySelectorAll('.tjxk_list .panel.panel-info')];
    if (!panels.length) { setProgress('当前没有课程列表，请先执行课程查询。'); return; }
    loadingAll = true;
    let requested = 0, loaded = 0, failed = 0;
    try {
      scanCourseSummaries();
      const batchSize = 3;
      for (let start = 0; start < panels.length; start += batchSize) {
        const batch = panels.slice(start, start + batchSize);
        const results = await Promise.all(batch.map((panel, offset) => expandAndCapturePanel(panel, start + offset, panels.length)));
        for (const result of results) { requested += result.requested; loaded += result.loaded; failed += result.failed; }
        scanTables();
        await sleep(250);
      }
      scanTables();
      setProgress(`完成：处理 ${panels.length} 门课程，读取 ${loaded} 个教学班${failed ? `，${failed} 门未返回教学班` : ''}。可直接导出 JSON/CSV。`);
    } finally {
      loadingAll = false;
    }
  }

  let scanTimer;
  function scheduleTableScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanTables, 250);
  }

  function download(filename, content, mime) {
    const blob = new Blob(['\ufeff', content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function timestampForFile() {
    return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
  }

  function exportJson() {
    scanTables();
    const exportedRecords = captured.map((item) => ({ ...item, data: enrichFromCatalog(item.data) }));
    const output = {
      exportedAt: now(), page: safeUrl(location.href), version: '1.8.0',
      count: captured.length, observedResponses: diagnostics.length,
      note: '由浙大选课课程信息导出助手在本地浏览器中生成。diagnostics 只记录接口地址和结构摘要，不含响应正文。',
      diagnostics, records: exportedRecords,
    };
    download(`zju-courses-${timestampForFile()}.json`, JSON.stringify(output, null, 2), 'application/json');
  }

  const commonFields = [
    ['课程代码', ['kch', 'kch_id', 'kcdm', 'courseCode', 'course_code', '课程代码', '课程号']],
    ['课程名称', ['kcmc', 'kcm', 'courseName', 'course_name', '课程名称', '课程名']],
    ['教学班', ['jxbmc', 'jxb_id', '教学班', '教学班名称', 'data-xkkh']],
    ['学分', ['xf', 'credits', '学分']],
    ['认定类别', ['rdlb', '认定类别', '认定类型', 'recognition']],
    ['教师', ['jsxm', 'jsxx', 'jstxt', '教师', '教师姓名']],
    ['上课时间', ['sksj', 'sksj_text', 'sjdd', '上课时间', '时间']],
    ['地点', ['jxdd', 'cdmc', '上课地点', '地点']],
    ['容量', ['jxbrl', 'zrl', '容量']],
    ['余量', ['syrs', 'yl', '余量']],
    ['校区', ['xqmc', '校区']],
    ['开课学院', ['kkxy', 'kkxy_name', 'kkxyName', '开课学院']],
  ];

  function csvCell(value) {
    return `"${text(value).replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    scanTables();
    const header = [...commonFields.map(([label]) => label), '来源接口或表格', '捕获时间', '原始记录JSON'];
    const rows = captured.map((item) => {
      const data = enrichFromCatalog(item.data);
      return [
      ...commonFields.map(([, keys]) => pick(data, keys)), item.sourceUrl,
      item.capturedAt, JSON.stringify(data),
      ];
    });
    download(`zju-courses-${timestampForFile()}.csv`, [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  }

  function exportVisibleTables() {
    const tables = [...document.querySelectorAll('.tjxk_list table, table')]
      .filter((table, index, array) => array.indexOf(table) === index)
      .filter((table) => table.closest('.tjxk_list') || table.offsetParent !== null);
    const sections = [];
    tables.forEach((table, index) => {
      const summary = parseCoursePanel(table.closest('.panel.panel-info'));
      sections.push([`页面可见表格 ${index + 1}`]);
      if (summary) {
        const prefixHeader = ['课程代码', '课程号', '课程名称', '学分', '课程类别', '认定类别', '开课学院', '状态'];
        const prefixValues = prefixHeader.map((key) => summary[key] || '');
        [...table.rows].forEach((row, rowIndex) => {
          const cells = [...row.cells]
            .filter((cell) => cell.style.display !== 'none' && !cell.hidden)
            .map(cellValue);
          sections.push(rowIndex === 0 ? [...prefixHeader, ...cells] : [...prefixValues, ...cells]);
        });
      } else {
        for (const row of table.rows) {
          sections.push([...row.cells]
            .filter((cell) => cell.style.display !== 'none' && !cell.hidden)
            .map(cellValue));
        }
      }
      sections.push([]);
    });
    if (!sections.length) {
      alert('当前页面没有课程表格。请先执行课程查询，再重试。');
      return;
    }
    download(`zju-visible-tables-${timestampForFile()}.csv`, sections.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  }

  function clearCapture() {
    captured.length = 0;
    seen.clear();
    diagnostics.length = 0;
    diagnosticSeen.clear();
    sessionStorage.removeItem(STORE_KEY);
    updatePanel();
  }

  let countNode;
  let progressNode;
  function updatePanel() {
    if (countNode) countNode.textContent = `已捕获 ${captured.length} 条课程 · 已观察 ${diagnostics.length} 个接口响应`;
  }

  function addButton(parent, label, handler, primary = false) {
    const button = document.createElement('button');
    button.textContent = label;
    button.type = 'button';
    button.style.cssText = [
      'border:1px solid #b9c9c5', `background:${primary ? '#166a61' : '#fff'}`,
      `color:${primary ? '#fff' : '#173c39'}`, 'border-radius:5px',
      'padding:6px 9px', 'font-size:12px', 'cursor:pointer',
    ].join(';');
    button.addEventListener('click', handler);
    parent.appendChild(button);
  }

  function createPanel() {
    if (!isTopFrame || !document.body || document.getElementById('__zju_course_exporter_panel__')) return;
    const panel = document.createElement('div');
    panel.id = '__zju_course_exporter_panel__';
    panel.style.cssText = [
      'position:fixed', 'right:18px', 'bottom:18px', 'z-index:2147483647',
      'width:292px', 'padding:12px', 'background:#f8faf7', 'color:#173c39',
      'border:1px solid #a9bbb6', 'border-radius:7px',
      'box-shadow:0 8px 30px rgba(20,50,45,.22)',
      'font-family:"Microsoft YaHei",sans-serif',
    ].join(';');
    const title = document.createElement('div');
    title.textContent = '课程信息导出助手 · v1.7';
    title.style.cssText = 'font-size:14px;font-weight:700;margin-bottom:3px';
    countNode = document.createElement('div');
    countNode.style.cssText = 'font-size:12px;color:#58716d;margin-bottom:9px;line-height:1.5';
    progressNode = document.createElement('div');
    progressNode.textContent = '先查询一次，然后点击“一键获取全部课程信息”。';
    progressNode.style.cssText = 'font-size:11px;color:#7a6252;margin-bottom:9px;line-height:1.5';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    addButton(buttons, '导出 JSON', exportJson, true);
    addButton(buttons, '导出 CSV', exportCsv);
    addButton(buttons, '一键获取全部课程信息', loadEverythingInOneClick, true);
    addButton(buttons, '后台加载全部教学班', loadAllTeachingClasses, true);
    addButton(buttons, '导出全部表格', exportVisibleTables);
    addButton(buttons, '重新扫描表格', scanTables);
    addButton(buttons, '清空', clearCapture);
    const help = document.createElement('div');
    help.textContent = '一键功能会自动点完“查看更多”，逐门展开并等待教学班表格，再读取教师、时间、地点等字段；不会点击“选课”。';
    help.style.cssText = 'font-size:11px;color:#6b7b78;margin-top:9px;line-height:1.5';
    panel.append(title, countNode, progressNode, buttons, help);
    document.body.appendChild(panel);
    updatePanel();
  }

  restore();
  const start = () => {
    createPanel();
    setTimeout(scanTables, 600);
    if (document.documentElement) {
      new MutationObserver(() => {
        createPanel();
        scheduleTableScan();
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  if (isTopFrame) setInterval(createPanel, 1200);
})();
