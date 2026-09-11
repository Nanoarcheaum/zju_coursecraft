(function(){
  'use strict';
  const xml=text=>{const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('工作簿 XML 无法读取');return doc;};
  const content=node=>[...node.getElementsByTagName('t')].map(t=>t.textContent).join('');
  const column=ref=>[...ref.match(/^[A-Z]+/)[0]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
  async function read(file){
    if(file.size>12*1024*1024)throw Error('请选择小于 12 MB 的课程表');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const get=async path=>{const entry=zip.file(path);if(!entry)throw Error('工作簿缺少 '+path);return xml(await entry.async('string'));};
    const shared=zip.file('xl/sharedStrings.xml')?[...(await get('xl/sharedStrings.xml')).getElementsByTagName('si')].map(content):[];
    const workbook=await get('xl/workbook.xml'),rels=await get('xl/_rels/workbook.xml.rels');
    const targets=new Map([...rels.getElementsByTagName('Relationship')].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')])),results=[];
    for(const sheet of workbook.getElementsByTagName('sheet')){
      const target=targets.get(sheet.getAttribute('r:id'));if(!target)continue;
      const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
      const doc=await get(path),rows=[];
      for(const row of doc.getElementsByTagName('row')){const values=[];for(const cell of row.getElementsByTagName('c')){const raw=cell.getElementsByTagName('v')[0]?.textContent||'';values[column(cell.getAttribute('r'))]=cell.getAttribute('t')==='s'?(shared[Number(raw)]||''):cell.getAttribute('t')==='inlineStr'?content(cell):raw;}rows.push({number:Number(row.getAttribute('r')),values});}
      const result=parseRows(rows,sheet.getAttribute('name'));if(result)results.push(result);
    }
    if(!results.length)throw Error('未找到课程名称、课程代码、上课时间表头；请使用教务系统导出的课表');return results;
  }
  function parseRows(rows,sheet){
    const header=rows.findIndex(r=>r.values.includes('课程名称')&&r.values.includes('上课时间')&&r.values.includes('课程代码'));if(header<0)return null;
    const h=rows[header].values,idx=n=>h.indexOf(n),courses=[],pending=[],warnings=[],seen=new Set(),unique=new Set();let duplicates=0;
    for(const row of rows.slice(header+1)){
      const field=n=>String(row.values[idx(n)]||'').trim(),name=field('课程名称'),code=field('课程代码');if(!name&&!code)continue;
      if(!name||!code){warnings.push(`${sheet} 第${row.number}行：缺少课程名称或代码，未导入`);continue;}
      unique.add(code);const base={name,code,teacher:field('教师姓名'),semester:field('学期'),importance:70,urgency:30},time=field('上课时间'),places=field('上课地点').split(/[;；]/).map(x=>x.trim());
      if(!time){if(!pending.some(p=>p.code===code))pending.push({...base,place:places.join('；'),reason:'未提供上课时间'});continue;}
      const segments=time.split(/[;；]/).map(x=>x.trim()).filter(Boolean);if(places.length!==segments.length)warnings.push(`${sheet} 第${row.number}行：${segments.length}段时间与${places.length}段地点不匹配，缺少的地点保留为空`);
      segments.forEach((part,i)=>{
        const m=part.match(/^周([一二三四五六日天])第([\d,，、\-–]+)节$/);
        if(!m){warnings.push(`${sheet} 第${row.number}行：无法识别“${part}”，保留在待排课程`);pending.push({...base,reason:part,place:places[i]||''});return;}
        let nums=[];m[2].split(/[,，、]/).forEach(s=>{const p=s.split(/[-–]/).map(Number);if(p.length===2&&p[1]>=p[0]&&p[1]<=13)for(let n=p[0];n<=p[1];n++)nums.push(n);else if(p.length===1)nums.push(p[0]);else nums.push(NaN);});nums=[...new Set(nums)].sort((a,b)=>a-b);
        if(!nums.length||nums.some(n=>!Number.isInteger(n)||n<1||n>13)){warnings.push(`${sheet} 第${row.number}行：节次超出1–13，保留在待排课程`);pending.push({...base,reason:part,place:places[i]||''});return;}
        const runs=[];for(const n of nums){const last=runs.at(-1);if(last&&last[1]===n-1)last[1]=n;else runs.push([n,n]);}
        for(const [start,end] of runs){const day='一二三四五六日'.indexOf(m[1].replace('天','日'))+1,place=places[i]||'',key=[code,day,start,end,place].join('|');if(seen.has(key)){duplicates++;continue;}seen.add(key);courses.push({...base,id:IHome.uid(),day,start,end,place});}
      });
    }
    return {sheet,courses,unscheduled:pending,warnings,unique:unique.size,duplicates};
  }
  window.IHomeXlsx={read,parseRows};
})();
