// app.js — Aplicación UNE Consumo Eléctrico
const DEFAULT_RANGES=[[100,0.33],[50,1.07],[50,1.43],[50,2.46],[50,3.00],[50,4.00],[50,5.00],[50,6.00],[50,7.00],[100,9.20],[100,9.45],[300,9.85],[800,10.80],[800,11.80],[800,12.90],[800,13.95],[800,15.00],[Infinity,20.00]];
const DEFAULT_SURCHARGE=25;
const LABELS=['0–100','101–150','151–200','201–250','251–300','301–350','351–400','401–450','451–500','501–600','601–700','701–1000','1001–1800','1801–2600','2601–3400','3401–4200','4201–5000','>5000'];

let config={tariffs:{ranges:DEFAULT_RANGES,surcharge:DEFAULT_SURCHARGE},alertThreshold:450,billCycleDay:1,meters:['Metro 1'],activeMeter:0,theme:'dark'};
let readings=[],equipment=[],blackouts=[];

// XSS sanitization
function esc(str){const d=document.createElement('div');d.textContent=str;return d.innerHTML;}

// UUID generation
function newId(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);}

// === TARIFFS CALC ===
function calcBill(kwh,tariffs){
  tariffs=tariffs||config.tariffs;
  const ranges=tariffs.ranges,surcharge=tariffs.surcharge/100;
  if(kwh<=0)return{total:0,breakdown:[]};
  let breakdown=[];
  if(kwh<=500){
    let cost=0,rem=kwh;
    for(const[size,rate]of ranges){if(rem<=0)break;const used=Math.min(rem,size);cost+=used*rate;breakdown.push({used,rate,subtotal:used*rate});rem-=used;}
    return{total:cost,breakdown};
  }
  let base=0,rem=500;
  for(const[size,rate]of ranges){if(rem<=0)break;const used=Math.min(rem,size);base+=used*rate;breakdown.push({used,rate,subtotal:used*rate});rem-=used;}
  let acc=0,excRate=ranges[ranges.length-1][1];
  for(const[size,rate]of ranges){acc+=size;if(kwh<=acc){excRate=rate;break;}}
  const excess=kwh-500,excCost=excess*excRate*(1+surcharge);
  breakdown.push({used:excess,rate:excRate,recargo:true,surcharge:tariffs.surcharge,subtotal:excCost});
  return{total:base+excCost,breakdown};
}

// === PHOTO ===
function compressPhoto(file,maxW=800){
  return new Promise(res=>{
    if(!file){res(null);return;}
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1,maxW/img.width);
      const c=document.createElement('canvas');
      c.width=img.width*scale;c.height=img.height*scale;
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg',0.7));
    };
    img.src=url;
  });
}

// === UI HELPERS ===
function toast(msg,type='success'){
  const el=document.createElement('div');
  el.className='toast toast-'+type;el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3000);
}

function closeModal(){document.getElementById('modal').innerHTML='';}

function confirmDialog(msg,{confirmText='Confirmar',cancelText='Cancelar',type='warn'}={}){
  return new Promise(res=>{
    const colors={warn:'var(--accent2)',info:'var(--accent)',danger:'#ff4444'};
    const icons={warn:'⚠️',info:'ℹ️',danger:'🗑️'};
    const modal=document.getElementById('modal');
    modal.innerHTML=`<div class="modal"><div class="modal-content" style="text-align:center;max-width:400px">
      <p style="font-size:2rem;margin-bottom:.5rem">${icons[type]||icons.warn}</p>
      <p style="font-size:.95rem;margin-bottom:1.2rem;line-height:1.5">${esc(msg)}</p>
      <div style="display:flex;gap:.6rem">
        <button class="btn btn-sec" style="flex:1" id="dlgCancel">${esc(cancelText)}</button>
        <button class="btn" style="flex:1;background:${colors[type]||colors.warn}" id="dlgConfirm">${esc(confirmText)}</button>
      </div>
    </div></div>`;
    document.getElementById('dlgConfirm').onclick=()=>{modal.innerHTML='';res(true);};
    document.getElementById('dlgCancel').onclick=()=>{modal.innerHTML='';res(false);};
  });
}


// === METERS ===
function renderMeters(){
  const sel=document.getElementById('meterSelect');
  sel.innerHTML=config.meters.map((m,i)=>`<option value="${i}"${i===config.activeMeter?' selected':''}>${esc(m)}</option>`).join('');
}
async function switchMeter(){
  config.activeMeter=parseInt(document.getElementById('meterSelect').value);
  await dbPutSync('config',{key:'main',value:config});
  await loadReadings();await loadBlackouts();renderAll();renderBlackouts();
}
async function addMeter(){
  const name=prompt('Nombre del metro:');
  if(!name)return;
  config.meters.push(name);
  config.activeMeter=config.meters.length-1;
  await dbPutSync('config',{key:'main',value:config});
  renderMeters();await loadReadings();renderAll();
}
function renderMetersEditor(){
  let html='';
  config.meters.forEach((m,i)=>{
    html+=`<div class="tariff-row"><span style="min-width:20px;color:var(--accent)">#${i+1}</span><input type="text" id="meter_${i}" value="${esc(m)}" style="margin-bottom:0;flex:1">${config.meters.length>1?`<button class="act" onclick="deleteMeter(${i})" title="Eliminar">✕</button>`:''}</div>`;
  });
  document.getElementById('metersEditor').innerHTML=html;
}
async function addMeterFromConfig(){
  const name=prompt('Nombre del nuevo metro:');
  if(!name)return;
  config.meters.push(name);
  await dbPutSync('config',{key:'main',value:config});
  renderMetersEditor();renderMeters();
}
async function deleteMeter(idx){
  if(config.meters.length<=1)return toast('Debe haber al menos un metro','warn');
  if(!await confirmDialog(`¿Eliminar "${config.meters[idx]}"? Los registros asociados no se eliminarán.`,{type:'danger',confirmText:'Eliminar'}))return;
  config.meters.splice(idx,1);
  if(config.activeMeter>=config.meters.length)config.activeMeter=0;
  await dbPutSync('config',{key:'main',value:config});
  renderMetersEditor();renderMeters();await loadReadings();renderAll();
}

// === CONFIG ===
async function loadConfig(){
  try{
    const all=await dbGetAll('config');
    const c=all.find(x=>x.key==='main');
    if(c)config={...config,...c.value};
  }catch(e){}
  // Migrate from localStorage
  const old=localStorage.getItem('une_readings');
  if(old){
    const arr=JSON.parse(old);
    for(const r of arr){
      if(!r.id)r.id=newId();
      if(!r.meter)r.meter=0;
      if(!r.createdAt)r.createdAt=new Date().toISOString();
      if(!r.updatedAt)r.updatedAt=r.createdAt;
      await dbPutSync('readings',r);
    }
    localStorage.removeItem('une_readings');
  }
  const oldT=localStorage.getItem('une_tariffs');
  if(oldT){config.tariffs=JSON.parse(oldT);localStorage.removeItem('une_tariffs');}
}

async function saveConfig(){
  if(!await confirmDialog('¿Guardar los cambios de configuración?',{type:'info',confirmText:'Guardar'}))return;
  const ranges=config.tariffs.ranges.map((r,i)=>[r[0],parseFloat(document.getElementById('rate_'+i).value)||r[1]]);
  config.tariffs={ranges,surcharge:parseFloat(document.getElementById('surcharge').value)||25};
  config.alertThreshold=parseFloat(document.getElementById('alertThreshold').value)||450;
  config.billCycleDay=parseInt(document.getElementById('billCycleDay').value)||1;
  config.meters=config.meters.map((_,i)=>{const el=document.getElementById('meter_'+i);return el?el.value.trim()||`Metro ${i+1}`:_;});
  await dbPutSync('config',{key:'main',value:config});
  renderMeters();toast('Configuración guardada');
}

async function loadReadings(){
  readings=(await dbGetAll('readings')).filter(r=>r.meter===config.activeMeter);
  readings.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
}
async function loadEquipment(){equipment=(await dbGetAll('equipment')).filter(e=>(e.meter??0)===config.activeMeter);}

// === CALCULATOR ===
function calculate(){
  const kwh=parseFloat(document.getElementById('kwh').value);
  if(!kwh||kwh<0)return toast('Ingresa un consumo válido','error');
  const{total,breakdown}=calcBill(kwh);
  let bd=breakdown.map(b=>`${b.used} kWh × $${b.rate.toFixed(2)}${b.recargo?` (+${b.surcharge}%)`:''} = <span>$${b.subtotal.toFixed(2)}</span>`).join('<br>');
  document.getElementById('calcResult').innerHTML=`<div class="result"><h3>Resultado</h3><p>Consumo: <strong>${kwh} kWh</strong></p><p class="big">${total.toFixed(2)} CUP</p><div class="breakdown">${bd}</div></div>`;
}

function setCalcMode(mode){
  document.getElementById('calcNormal').style.display=mode==='normal'?'':'none';
  document.getElementById('calcInverse').style.display=mode==='inverse'?'':'none';
  document.getElementById('modeNormal').style.background=mode==='normal'?'linear-gradient(135deg,var(--accent),var(--accent3))':'';
  document.getElementById('modeNormal').style.color=mode==='normal'?'#fff':'var(--text)';
  document.getElementById('modeInverse').style.background=mode==='inverse'?'linear-gradient(135deg,var(--accent),var(--accent3))':'';
  document.getElementById('modeInverse').style.color=mode==='inverse'?'#fff':'var(--text)';
  document.getElementById('calcResult').innerHTML='';
}

function calcInverse(){
  const budget=parseFloat(document.getElementById('budget').value);
  if(!budget||budget<=0)return toast('Ingresa un presupuesto válido','error');
  const ranges=config.tariffs.ranges,surcharge=config.tariffs.surcharge/100;
  let remaining=budget,kwh=0,breakdown=[];
  for(const[size,rate]of ranges){
    if(kwh>=500)break;
    const maxInRange=Math.min(size,500-kwh);
    const canAfford=Math.min(maxInRange,remaining/rate);
    if(canAfford<=0)break;
    kwh+=canAfford;remaining-=canAfford*rate;
    breakdown.push({used:canAfford,rate,subtotal:canAfford*rate});
  }
  if(remaining>0&&kwh>=500){
    let acc=0,excRate=ranges[ranges.length-1][1];
    for(const[size,rate]of ranges){acc+=size;if(kwh<acc){excRate=rate;break;}}
    const effectiveRate=excRate*(1+surcharge);
    const extra=remaining/effectiveRate;
    if(extra>0){kwh+=extra;remaining-=extra*effectiveRate;breakdown.push({used:extra,rate:excRate,recargo:true,subtotal:extra*effectiveRate});}
  }
  let bd=breakdown.map(b=>`${b.used.toFixed(1)} kWh × $${b.rate.toFixed(2)}${b.recargo?' (+'+config.tariffs.surcharge+'%)':''} = <span>$${b.subtotal.toFixed(2)}</span>`).join('<br>');
  document.getElementById('calcResult').innerHTML=`<div class="result"><h3>💰 Con tu presupuesto</h3><p>Puedes consumir: <span class="big">${kwh.toFixed(1)} kWh</span></p><p>Gasto: <strong>${(budget-remaining).toFixed(2)} CUP</strong> | Sobrante: <strong>${remaining.toFixed(2)} CUP</strong></p><div class="breakdown">${bd}</div></div>`;
}


// === READINGS ===
async function addReading(){
  const reading=parseFloat(document.getElementById('reading').value),date=document.getElementById('date').value,time=document.getElementById('time').value||'';
  if(!reading||!date)return toast('Completa lectura y fecha','error');
  if(readings.length>0){
    const last=readings[readings.length-1];
    if(reading<last.reading&&!await confirmDialog(`La lectura ${reading} es menor que la anterior (${last.reading}). ¿Estás seguro?`,{type:'warn',confirmText:'Sí, registrar'}))return;
  }
  const photo=await compressPhoto(document.getElementById('photo').files[0]);
  const now=new Date().toISOString();
  const entry={id:newId(),reading,date,time,photo,meter:config.activeMeter,tariffs:{...config.tariffs},createdAt:now,updatedAt:now};
  await dbPutSync('readings',entry);
  readings.push(entry);
  readings.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  document.getElementById('reading').value='';
  document.getElementById('photo').value='';
  renderAll();checkAlerts();
}

function getMonthKey(date){
  const d=new Date(date+'T12:00:00');
  if(d.getDate()<config.billCycleDay)d.setMonth(d.getMonth()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function getMonthReadings(month){return readings.filter(r=>getMonthKey(r.date)===month);}
function getMonths(){return[...new Set(readings.map(r=>getMonthKey(r.date)))].sort().reverse();}
function getMonthTariffs(month){const md=getMonthReadings(month),last=md[md.length-1];return last&&last.tariffs?last.tariffs:config.tariffs;}

function checkAlerts(){
  const months=getMonths();if(!months.length)return;
  const md=getMonthReadings(months[0]);
  if(md.length<2){document.getElementById('alertBox').innerHTML='';return;}
  const consumed=md[md.length-1].reading-md[0].reading;
  const threshold=config.alertThreshold||450;
  const pct=Math.min(100,Math.round((consumed/threshold)*100));
  let html=`<div class="thermo"><div class="thermo-label"><span>0 kWh</span><span>${consumed} / ${threshold} kWh</span></div><div class="thermo-bar"><div class="thermo-fill${pct>=80?' warn':''}" style="width:${pct}%"></div><span class="thermo-pct">${pct}%</span></div></div>`;
  if(consumed>=config.alertThreshold){
    html+=`<div class="alert-box">⚠️ <strong>Alerta:</strong> Consumo actual ${consumed} kWh alcanzó el umbral de ${config.alertThreshold} kWh.</div>`;
  }
  if(consumed>400&&consumed<500){
    html+=`<div class="alert-box" style="border-color:rgba(255,165,0,.3);color:orange">⚡ Te acercas a los 500 kWh. Después se aplica recargo del ${config.tariffs.surcharge}%.</div>`;
  }
  const days=md.length>1?((new Date(md[md.length-1].date)-new Date(md[0].date))/86400000):1;
  if(days>0){
    const avgPerDay=consumed/days,daysLeft=Math.max(0,30-days);
    const estimated=consumed+avgPerDay*daysLeft;
    const{total}=calcBill(Math.round(estimated),getMonthTariffs(months[0]));
    html+=`<div class="result"><h3>📊 Estimación fin de mes</h3><p>Promedio diario: <strong>${avgPerDay.toFixed(1)} kWh/día</strong></p><p>Consumo estimado: <strong>${Math.round(estimated)} kWh</strong></p><p>Factura estimada: <span class="big">${total.toFixed(2)} CUP</span></p></div>`;
  }
  document.getElementById('alertBox').innerHTML=html;
}

function renderRegResult(){
  const months=getMonths();if(!months.length)return;
  const md=getMonthReadings(months[0]);
  if(md.length<2){document.getElementById('regResult').innerHTML='<div class="result"><p>Registra al menos 2 lecturas para calcular.</p></div>';return;}
  const consumed=md[md.length-1].reading-md[0].reading;
  const{total}=calcBill(consumed,getMonthTariffs(months[0]));
  document.getElementById('regResult').innerHTML=`<div class="result"><h3>Resumen del ciclo actual</h3><p>Consumo: <strong>${consumed} kWh</strong></p><p class="big">${total.toFixed(2)} CUP</p></div>`;
}

function renderHistory(){
  const sel=document.getElementById('monthSelect'),months=getMonths(),cur=sel.value||months[0]||'';
  sel.innerHTML=months.map(m=>`<option value="${m}"${m===cur?' selected':''}>${m}</option>`).join('')||'<option>Sin datos</option>';
  const month=sel.value,data=getMonthReadings(month);
  if(!data.length){document.getElementById('history').innerHTML='<p class="empty">No hay registros</p>';return;}
  let html='<table><tr><th>Fecha</th><th>Hora</th><th>Lectura</th><th>Consumo</th><th></th></tr>';
  data.forEach((d,i)=>{
    const daily=i>0?(d.reading-data[i-1].reading):'-';
    const hasPhoto=d.photo?'📷':'';
    const upd=d.updatedAt&&d.updatedAt!==d.createdAt?`<br><span class="updated">✏️${esc(d.updatedAt.slice(0,10))}</span>`:'';
    html+=`<tr><td>${esc(d.date)}${upd}</td><td>${esc(d.time)||'–'}</td><td>${d.reading}</td><td>${daily==='-'?'–':daily+' kWh'}</td><td><div class="actions">${hasPhoto?`<button class="act" onclick="viewPhoto('${d.id}')">📷</button>`:''}<button class="act" onclick="editReading('${d.id}')">✏️</button><button class="act" onclick="delReading('${d.id}')">✕</button></div></td></tr>`;
  });
  html+='</table>';
  const total=data.length>1?data[data.length-1].reading-data[0].reading:0;
  if(total>0){
    const{total:bill}=calcBill(total,getMonthTariffs(month));
    html+=`<div class="result"><p>Total: <strong>${total} kWh</strong></p><p class="big">${bill.toFixed(2)} CUP</p><button class="view-tariffs" onclick="showUsedTariffs('${month}')">📋 Tarifas aplicadas</button></div>`;
  }
  document.getElementById('history').innerHTML=html;
}

async function delReading(id){
  if(!await confirmDialog('¿Eliminar este registro de lectura?',{type:'danger',confirmText:'Eliminar'}))return;
  await dbDeleteSync('readings',id);
  readings=readings.filter(r=>r.id!==id);
  renderAll();
}

function viewPhoto(id){
  const d=readings.find(r=>r.id===id);
  if(!d||!d.photo)return toast('No hay foto para este registro','warn');
  document.getElementById('modal').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modal-content"><button class="modal-close" onclick="closeModal()">&times;</button><h3>📷 Evidencia — ${esc(d.date)} ${esc(d.time||'')}</h3><p>Lectura: <strong>${d.reading} kWh</strong></p><img src="${d.photo}" alt="Foto"></div></div>`;
}

function editReading(id){
  const d=readings.find(r=>r.id===id);
  if(!d)return;
  document.getElementById('modal').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modal-content">
    <button class="modal-close" onclick="closeModal()">&times;</button><h3>✏️ Editar Registro</h3>
    <label>Lectura (kWh)</label><input type="number" id="editReading" value="${d.reading}">
    <label>Fecha</label><input type="date" id="editDate" value="${d.date}">
    <label>Hora</label><input type="time" id="editTime" value="${d.time||''}">
    <label>📷 Cambiar foto</label><input type="file" id="editPhoto" accept="image/*">
    ${d.photo?`<img src="${d.photo}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:.4rem">`:''}
    <p style="margin-top:.8rem;font-size:.72rem;color:var(--muted)">Creado: ${esc((d.createdAt||'').slice(0,16).replace('T',' '))}<br>Actualizado: ${esc((d.updatedAt||'').slice(0,16).replace('T',' '))}</p>
    <button class="btn" style="margin-top:.8rem" onclick="saveEdit('${d.id}')">💾 Guardar</button></div></div>`;
}

async function saveEdit(id){
  if(!await confirmDialog('¿Guardar los cambios en este registro?',{type:'info',confirmText:'Guardar'}))return;
  const idx=readings.findIndex(r=>r.id===id);
  if(idx===-1)return;
  const newReading=parseFloat(document.getElementById('editReading').value);
  const newDate=document.getElementById('editDate').value;
  const newTime=document.getElementById('editTime').value||'';
  if(!newReading||!newDate)return toast('Completa lectura y fecha','error');
  const file=document.getElementById('editPhoto').files[0];
  const newPhoto=file?await compressPhoto(file):readings[idx].photo;
  readings[idx]={...readings[idx],reading:newReading,date:newDate,time:newTime,photo:newPhoto,updatedAt:new Date().toISOString()};
  await dbPutSync('readings',readings[idx]);
  readings.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  closeModal();renderAll();
}

async function resetMonth(){
  const month=document.getElementById('monthSelect').value;
  if(!month||!await confirmDialog(`¿Eliminar todos los registros de ${month}?`,{type:'danger',confirmText:'Eliminar todo'}))return;
  const toDelete=readings.filter(r=>getMonthKey(r.date)===month);
  for(const r of toDelete)await dbDeleteSync('readings',r.id);
  readings=readings.filter(r=>getMonthKey(r.date)!==month);
  renderAll();
}


// === CHART ===
function renderChart(){
  const sel=document.getElementById('chartMonth'),months=getMonths(),cur=sel.value||months[0]||'';
  sel.innerHTML=months.map(m=>`<option value="${m}"${m===cur?' selected':''}>${m}</option>`).join('')||'<option>Sin datos</option>';
  const month=sel.value,data=getMonthReadings(month);
  const canvas=document.getElementById('chartCanvas'),ctx=canvas.getContext('2d');
  canvas.width=canvas.offsetWidth*2;canvas.height=400;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(data.length<2){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.font='14px sans-serif';ctx.fillText('Datos insuficientes',canvas.width/2-60,200);return;}
  const dailyData=[];
  for(let i=1;i<data.length;i++)dailyData.push({label:data[i].date.slice(5),value:data[i].reading-data[i-1].reading});
  const max=Math.max(...dailyData.map(d=>d.value),1);
  const barW=Math.min(40,(canvas.width-80)/dailyData.length-4);
  const chartH=canvas.height-60;
  const accent=getComputedStyle(document.body).getPropertyValue('--accent').trim();
  const accent2=getComputedStyle(document.body).getPropertyValue('--accent2').trim();
  const muted=getComputedStyle(document.body).getPropertyValue('--muted').trim();
  dailyData.forEach((d,i)=>{
    const h=(d.value/max)*chartH;
    const x=40+i*(barW+4);
    const gradient=ctx.createLinearGradient(x,canvas.height-30-h,x,canvas.height-30);
    gradient.addColorStop(0,accent);gradient.addColorStop(1,accent2);
    ctx.fillStyle=gradient;
    ctx.beginPath();ctx.roundRect(x,canvas.height-30-h,barW,h,4);ctx.fill();
    ctx.fillStyle=muted;ctx.font='10px sans-serif';
    ctx.save();ctx.translate(x+barW/2,canvas.height-5);ctx.rotate(-0.5);ctx.fillText(d.label,0,0);ctx.restore();
    ctx.fillStyle=accent;ctx.font='10px sans-serif';ctx.fillText(d.value,x,canvas.height-35-h);
  });
  renderComparison(month);renderCostPerDay(month);
}

function renderComparison(month){
  const months=getMonths(),idx=months.indexOf(month);
  if(idx===-1||idx>=months.length-1){document.getElementById('comparison').innerHTML='';return;}
  const prev=months[idx+1];
  const curData=getMonthReadings(month),prevData=getMonthReadings(prev);
  if(curData.length<2||prevData.length<2){document.getElementById('comparison').innerHTML='';return;}
  const curTotal=curData[curData.length-1].reading-curData[0].reading;
  const prevTotal=prevData[prevData.length-1].reading-prevData[0].reading;
  const diff=curTotal-prevTotal;
  const pct=prevTotal>0?((diff/prevTotal)*100).toFixed(1):0;
  const badge=diff>0?`<span class="badge badge-up">↑ ${pct}%</span>`:`<span class="badge badge-down">↓ ${Math.abs(pct)}%</span>`;
  document.getElementById('comparison').innerHTML=`<div class="compare"><div class="compare-card"><div class="val">${curTotal}</div><div class="lbl">kWh este mes</div></div><div class="compare-card"><div class="val">${prevTotal}</div><div class="lbl">kWh mes anterior</div></div></div><p style="text-align:center;margin-top:.5rem;font-size:.85rem">Diferencia: <strong>${diff>0?'+':''}${diff} kWh</strong> ${badge}</p>`;
}

function renderCostPerDay(month){
  const data=getMonthReadings(month);
  if(data.length<2){document.getElementById('costPerDay').innerHTML='';return;}
  const total=data[data.length-1].reading-data[0].reading;
  const days=(new Date(data[data.length-1].date)-new Date(data[0].date))/86400000;
  if(days<=0){document.getElementById('costPerDay').innerHTML='';return;}
  const{total:bill}=calcBill(total,getMonthTariffs(month));
  document.getElementById('costPerDay').innerHTML=`<div class="result" style="margin-top:.8rem"><h3>💰 Costo por día</h3><p>Consumo promedio: <strong>${(total/days).toFixed(1)} kWh/día</strong></p><p>Costo promedio: <strong>${(bill/days).toFixed(2)} CUP/día</strong></p></div>`;
}

// === EQUIPMENT ===
async function addEquipment(){
  const name=document.getElementById('equipName').value.trim();
  const watts=parseFloat(document.getElementById('equipWatts').value);
  const hours=parseFloat(document.getElementById('equipHours').value);
  if(!name||!watts||!hours)return toast('Completa todos los campos','error');
  const entry={id:newId(),name,watts,hours,meter:config.activeMeter};
  await dbPutSync('equipment',entry);
  equipment.push(entry);
  document.getElementById('equipName').value='';document.getElementById('equipWatts').value='';document.getElementById('equipHours').value='';
  renderEquipment();
}

async function delEquipment(id){
  if(!await confirmDialog('¿Eliminar este equipo?',{type:'danger',confirmText:'Eliminar'}))return;
  await dbDeleteSync('equipment',id);
  equipment=equipment.filter(e=>e.id!==id);
  renderEquipment();
}

function editEquipment(id){
  const e=equipment.find(x=>x.id===id);
  if(!e)return;
  document.getElementById('modal').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modal-content">
    <button class="modal-close" onclick="closeModal()">&times;</button><h3>✏️ Editar Equipo</h3>
    <label>Nombre</label><input type="text" id="editEquipName" value="${esc(e.name)}">
    <label>Potencia (Watts)</label><input type="number" id="editEquipWatts" value="${e.watts}">
    <label>Horas de uso diario</label><input type="number" id="editEquipHours" value="${e.hours}" step="0.5">
    <button class="btn" style="margin-top:.5rem" onclick="saveEquipEdit('${e.id}')">💾 Guardar</button></div></div>`;
}

async function saveEquipEdit(id){
  const name=document.getElementById('editEquipName').value.trim();
  const watts=parseFloat(document.getElementById('editEquipWatts').value);
  const hours=parseFloat(document.getElementById('editEquipHours').value);
  if(!name||!watts||!hours)return toast('Completa todos los campos','error');
  if(!await confirmDialog('¿Guardar los cambios en este equipo?',{type:'info',confirmText:'Guardar'}))return;
  const idx=equipment.findIndex(x=>x.id===id);
  if(idx===-1)return;
  equipment[idx]={...equipment[idx],name,watts,hours};
  await dbPutSync('equipment',equipment[idx]);
  closeModal();renderEquipment();
}

function renderEquipment(){
  if(!equipment.length){document.getElementById('equipList').innerHTML='<p class="empty">No hay equipos registrados</p>';document.getElementById('equipTotal').innerHTML='';return;}
  let html='<table><tr><th>Equipo</th><th>W</th><th>Hrs/día</th><th>kWh/mes</th><th></th></tr>';
  let totalKwh=0;
  equipment.forEach(e=>{
    const monthly=(e.watts*e.hours*30)/1000;
    totalKwh+=monthly;
    html+=`<tr><td>${esc(e.name)}</td><td>${e.watts}</td><td>${e.hours}</td><td>${monthly.toFixed(1)}</td><td><div class="actions"><button class="act" onclick="editEquipment('${e.id}')">✏️</button><button class="act" onclick="delEquipment('${e.id}')">✕</button></div></td></tr>`;
  });
  html+='</table>';
  document.getElementById('equipList').innerHTML=html;
  const{total}=calcBill(Math.round(totalKwh));
  document.getElementById('equipTotal').innerHTML=`<div class="result"><h3>Estimación mensual por equipos</h3><p>Consumo total estimado: <strong>${totalKwh.toFixed(0)} kWh</strong></p><p>Factura estimada: <span class="big">${total.toFixed(2)} CUP</span></p></div>`;
}

// === BLACKOUTS ===
async function loadBlackouts(){blackouts=(await dbGetAll('blackouts')).filter(b=>b.metroId===config.activeMeter);blackouts.sort((a,b)=>a.timestamp-b.timestamp);}
function getBlackoutState(){const last=blackouts[blackouts.length-1];return last&&last.tipo==='inicio';}

async function toggleBlackout(){
  const isOff=getBlackoutState();
  const entry={id:newId(),tipo:isOff?'fin':'inicio',timestamp:Date.now(),metroId:config.activeMeter};
  await dbPutSync('blackouts',entry);
  blackouts.push(entry);
  renderBlackouts();
  toast(isOff?'💡 Luz registrada':'⚡ Apagón registrado');
}

function renderBlackouts(){
  const btn=document.getElementById('blackoutBtn');
  const isOff=getBlackoutState();
  btn.textContent=isOff?'💡 VOLVIÓ LA LUZ':'⚡ SE FUE LA LUZ';
  btn.className=isOff?'blackout-off':'blackout-on';
  const now=Date.now(),monthAgo=now-30*86400000;
  const recent=blackouts.filter(b=>b.timestamp>=monthAgo);
  let totalHours=0,longest=0;
  for(let i=0;i<recent.length;i++){
    if(recent[i].tipo==='inicio'){
      const end=recent.find((b,j)=>j>i&&b.tipo==='fin');
      const dur=((end?end.timestamp:now)-recent[i].timestamp)/3600000;
      totalHours+=dur;longest=Math.max(longest,dur);
    }
  }
  const el=document.getElementById('blackoutStats');
  if(totalHours>0){
    el.innerHTML=`<div class="blackout-stats">Últimos 30 días: <strong>${totalHours.toFixed(1)}h</strong> sin luz | Promedio: <strong>${(totalHours/30).toFixed(1)}h/día</strong> | Racha: <strong>${longest.toFixed(1)}h</strong></div>`;
  }else{el.innerHTML='';}
}

// === CONFIG UI ===
function renderTariffEditor(){
  const t=config.tariffs;
  document.getElementById('tariffEditor').innerHTML=t.ranges.map((r,i)=>`<div class="tariff-row"><span>${LABELS[i]}</span><input type="number" step="0.01" value="${r[1]}" id="rate_${i}"><span>CUP</span></div>`).join('');
  document.getElementById('surcharge').value=t.surcharge;
  document.getElementById('alertThreshold').value=config.alertThreshold;
  document.getElementById('billCycleDay').value=config.billCycleDay;
}

async function resetTariffs(){
  if(!await confirmDialog('¿Restaurar tarifas por defecto?',{type:'warn',confirmText:'Restaurar'}))return;
  config.tariffs={ranges:DEFAULT_RANGES,surcharge:DEFAULT_SURCHARGE};
  await dbPutSync('config',{key:'main',value:config});
  renderTariffEditor();
}

function showUsedTariffs(month){
  const t=getMonthTariffs(month);
  let rows=t.ranges.map((r,i)=>`<tr><td>${LABELS[i]}</td><td>${r[1].toFixed(2)}</td></tr>`).join('');
  document.getElementById('modal').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modal-content"><button class="modal-close" onclick="closeModal()">&times;</button><h3>Tarifas — ${esc(month)}</h3><table><tr><th>Rango</th><th>CUP/kWh</th></tr>${rows}</table><p style="margin-top:.8rem;color:var(--muted);font-size:.82rem">Recargo >500 kWh: <strong style="color:var(--text)">${t.surcharge}%</strong></p></div></div>`;
}

// === THEME ===
function toggleTheme(){
  config.theme=config.theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',config.theme);
  dbPutSync('config',{key:'main',value:config});
}

// === EXPORT/IMPORT ===
async function exportData(){
  const allReadings=await dbGetAll('readings');
  const allEquip=await dbGetAll('equipment');
  const allBlack=await dbGetAll('blackouts');
  const data=JSON.stringify({readings:allReadings,equipment:allEquip,blackouts:allBlack,config},null,2);
  const blob=new Blob([data],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`une-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
}

async function importData(e){
  const file=e.target.files[0];if(!file)return;
  if(!await confirmDialog(`¿Importar datos desde "${file.name}"? Esto puede sobrescribir registros existentes.`,{type:'warn',confirmText:'Importar'})){e.target.value='';return;}
  const text=await file.text();
  try{
    const data=JSON.parse(text);
    if(data.readings)for(const r of data.readings)await dbPutSync('readings',r);
    if(data.equipment)for(const eq of data.equipment)await dbPutSync('equipment',eq);
    if(data.blackouts)for(const b of data.blackouts)await dbPutSync('blackouts',b);
    if(data.config){config={...config,...data.config};await dbPutSync('config',{key:'main',value:config});}
    await loadReadings();await loadEquipment();await loadBlackouts();
    renderAll();toast('Datos importados correctamente');
  }catch(err){toast('Error al importar: '+err.message,'error');}
  e.target.value='';
}

// === TABS & RENDER ===
function showTab(tab){
  const tabs={calc:'Calc',reg:'Reg',chart:'Chart',equip:'Equip',tar:'Tar'};
  Object.entries(tabs).forEach(([k,v])=>{
    const p=document.getElementById('panel'+v);if(p)p.classList.toggle('visible',k===tab);
    const b=document.getElementById('tab'+v);if(b)b.classList.toggle('active',k===tab);
  });
  if(tab==='tar'){renderTariffEditor();renderMetersEditor();}
  if(tab==='chart')renderChart();
  if(tab==='equip')renderEquipment();
}

function renderAll(){renderRegResult();renderHistory();checkAlerts();}

// === INIT ===
async function init(){
  await openDB();
  await loadConfig();
  document.documentElement.setAttribute('data-theme',config.theme);
  renderMeters();
  await loadReadings();
  await loadEquipment();
  await loadBlackouts();
  document.getElementById('date').value=new Date().toISOString().slice(0,10);
  document.getElementById('time').value=new Date().toTimeString().slice(0,5);
  showTab('calc');
  setCalcMode('normal');
  renderAll();
  renderBlackouts();
  // Start sync with backend
  initSync();
}
init();

if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
