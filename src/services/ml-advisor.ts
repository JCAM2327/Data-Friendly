import type { DatasetSummary } from '@/lib/types';
import type { RawTable } from './file-parser';
import { isNullish, toDate, toNumber } from './profiling-service';
import { assessQuality, type ValidationRule } from './validation-service';

export type Problem = 'classification' | 'regression' | 'clustering';
export interface ExperimentConfig { problem: Problem; target: string; features: string[]; timeColumn: string; groupColumn: string; testFraction: number; k: number }
export interface ModelResult { id: string; name: string; metrics: Record<string, number | null>; trainScore: number | null; seconds: number; observations: string[]; importance: { feature: string; value: number }[]; canPredict: boolean; error?: string }
export interface ExperimentResult { models: ModelResult[]; recommended: string | null; trainRows: number; testRows: number; excludedRows: number; problem: Problem; principal: string; config: ExperimentConfig; warnings: string[] }
export interface PredictionResult { prediction: string | number; probabilities: { label: string; probability: number }[]; input: Record<string, unknown> }
export const problemLabels: Record<Problem, string> = { classification: 'Clasificación', regression: 'Regresión', clustering: 'Clustering' };
export function candidates(ds: DatasetSummary) {
  return ds.columnProfiles.filter(c => !/(^id($|_)|_id$|codigo|code)/i.test(c.name) && c.uniqueCount > 1 && (c.type === 'numerica' || c.type === 'categorica' || c.type === 'booleana')).map(c => ({ ...c, problem: (c.type === 'numerica' && c.uniqueCount > 20 ? 'regression' : 'classification') as Problem, reason: c.type === 'numerica' && c.uniqueCount > 20 ? 'Resultado numérico variable; requiere un objetivo predictivo concreto.' : `${c.uniqueCount} valores distintos; posible etiqueta si se conoce después de los predictores.` }));
}
export function inspectFeatures(t: RawTable, ds: DatasetSummary, target: string, groupColumn = '') {
  return ds.columnProfiles.map(c => {
    const reasons: string[] = [];
    if (c.name === target) reasons.push('Es el target; nunca puede ser predictor.');
    if (c.name === groupColumn) reasons.push('Identificador de grupo; solo se usa para separar registros.');
    if (c.uniqueCount <= 1) reasons.push('Variable constante o vacía.');
    if (c.type === 'fecha') reasons.push('Fecha: se reserva para separación temporal.');
    if (c.type === 'texto') reasons.push('Texto libre: requiere un procesamiento específico no incluido.');
    if (/(^id($|_)|_id$|codigo|code)/i.test(c.name) || (c.type !== 'numerica' && c.uniqueCount > t.rows.length * .8)) reasons.push('Posible identificador o cardinalidad excesiva.');
    if (c.missingPct > 40) reasons.push('Más del 40% de valores faltantes.');
    if (/(resultado|prediccion|prediction|posterior|futuro|future|final|outcome|target)/i.test(c.name) && c.name !== target) reasons.push('Nombre sospechoso de información posterior al resultado.');
    const pairs = target ? t.rows.filter(r => !isNullish(r[c.name]) && !isNullish(r[target])) : [];
    if (c.name !== target && pairs.length && pairs.every(r => String(r[c.name]) === String(r[target]))) reasons.push('Copia exacta del target: riesgo de leakage.');
    if (c.name !== target && c.type === 'numerica' && pairs.length > 2) {
      const values = pairs.map(r => [toNumber(r[c.name]), toNumber(r[target])]).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
      const n = values.length;
      if (n > 2) { const sx = values.reduce((s,p)=>s+p[0],0), sy=values.reduce((s,p)=>s+p[1],0); const cov=values.reduce((s,p)=>s+(p[0]-sx/n)*(p[1]-sy/n),0); const den=Math.sqrt(values.reduce((s,p)=>s+(p[0]-sx/n)**2,0)*values.reduce((s,p)=>s+(p[1]-sy/n)**2,0)); if(den && Math.abs(cov/den)>.995) reasons.push('Relación casi perfecta con el target: revisar derivación o leakage.'); }
    }
    return { column: c.name, type: c.type, reasons, eligible: reasons.length === 0 };
  });
}
export function assessMl(t: RawTable, ds: DatasetSummary, rules: ValidationRule[], config: ExperimentConfig) {
  const blockers: string[] = [], warnings: string[] = [];
  const quality = assessQuality(t, ds, rules);
  blockers.push(...quality.blockers);
  const featureInfo = inspectFeatures(t, ds, config.target, config.groupColumn);
  const allowed = featureInfo.filter(f => f.eligible).map(f => f.column);
  if (config.features.some(f => !allowed.includes(f)) || new Set(config.features).size !== config.features.length) blockers.push('Hay predictores excluidos o repetidos; revisa la selección.');
  if (config.features.length < (config.problem === 'clustering' ? 2 : 1)) blockers.push('No hay suficientes predictores útiles para este problema.');
  if (config.problem !== 'clustering' && !t.headers.includes(config.target)) blockers.push('Selecciona una variable objetivo.');
  if (config.problem === 'regression' && !ds.columnProfiles.some(c => c.name === config.target && c.type === 'numerica')) blockers.push('La regresión requiere un target numérico.');
  const usable = t.rows.filter(r => config.problem === 'clustering' || (config.problem === 'regression' ? toNumber(r[config.target]) !== null : !isNullish(r[config.target])));
  if (usable.length < 40) blockers.push(`Solo ${usable.length} registros con objetivo disponible: mínimo operativo 40, no garantía de suficiencia.`);
  else if (usable.length < 200) warnings.push(`Dataset pequeño (${usable.length} registros): resultados inestables y riesgo de overfitting.`);
  if (usable.length < config.features.length * 10) blockers.push('Menos de 10 registros por predictor: reduce variables o amplía la muestra.');
  const counts = new Map<string, number>();
  if (config.problem === 'classification') {
    usable.forEach(r => { const k=String(r[config.target]); counts.set(k,(counts.get(k)??0)+1); });
    if(counts.size < 2 || counts.size > 20) blockers.push('Clasificación requiere entre 2 y 20 clases; revisa el target.');
    if([...counts.values()].some(n=>n<10)) blockers.push('Alguna clase tiene menos de 10 ejemplos: no permite una comparación estable.');
    if (counts.size && Math.min(...counts.values()) / usable.length < .2) warnings.push('Clases desbalanceadas: priorizar F1 macro, precision y recall por clase, no solo accuracy.');
  }
  if (ds.missingPct > 0) warnings.push('Los predictores faltantes se imputan usando exclusivamente el conjunto de entrenamiento.');
  const dates = ds.columnProfiles.filter(c=>c.type==='fecha').map(c=>c.name);
  if (dates.length && !config.timeColumn) blockers.push('Hay fechas disponibles: selecciona la fecha que establece el orden temporal antes de entrenar.');
  if (config.timeColumn && (!dates.includes(config.timeColumn) || usable.some(r=>!toDate(r[config.timeColumn])))) blockers.push('La separación temporal requiere una fecha válida en todos los registros elegibles.');
  if (config.groupColumn && (!t.headers.includes(config.groupColumn) || usable.some(r=>isNullish(r[config.groupColumn])))) blockers.push('La separación por entidad requiere un identificador de grupo no nulo.');
  if (config.testFraction < .15 || config.testFraction > .35) blockers.push('La proporción de test debe estar entre 15% y 35%.');
  warnings.push('La relación estadística no demuestra utilidad predictiva ni causalidad. Confirma el objetivo y cuándo se conoce cada variable.');
  return { blockers: [...new Set(blockers)], warnings, quality, featureInfo, usableRows: usable.length, classes: [...counts].map(([label,count])=>({label,count,pct:count/usable.length*100})), dates, state: blockers.length ? 'No viable con la configuración actual' : 'Viabilidad condicionada al objetivo y la disponibilidad de variables' };
}
/** Stable seed: all models receive the exact same disjoint train/test indices. */
export function partitionRows(t: RawTable, c: ExperimentConfig) {
  const eligible = t.rows.map((r,i)=>({r,i})).filter(({r})=>c.problem==='clustering' || (c.problem==='regression' ? toNumber(r[c.target])!==null : !isNullish(r[c.target])));
  let seed=42; const random=()=> { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const shuffle=(a:number[])=> { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1)); const x=b[i], y=b[j]; if(x!==undefined&&y!==undefined){b[i]=y;b[j]=x;} } return b; };
  let train:number[]=[], test:number[]=[];
  if(c.timeColumn) {
    const sorted=eligible.map(x=>({...x,time:toDate(x.r[c.timeColumn])?.getTime()}));
    if(sorted.some(x=>x.time===undefined)) throw new Error('Hay fechas inválidas.');
    sorted.sort((a,b)=>(a.time??0)-(b.time??0));
    const cut=sorted[Math.floor(sorted.length*(1-c.testFraction))]?.time;
    if(cut===undefined) throw new Error('No hay suficientes periodos.');
    test=sorted.filter(x=>(x.time??0)>=cut).map(x=>x.i);
    train=sorted.filter(x=>(x.time??0)<cut).map(x=>x.i);
    if(c.groupColumn){ const groups=new Set(test.map(i=>String(t.rows[i]?.[c.groupColumn]))); train=train.filter(i=>!groups.has(String(t.rows[i]?.[c.groupColumn]))); }
  } else if(c.groupColumn) {
    const groups=[...new Set(eligible.map(x=>String(x.r[c.groupColumn])))];
    const selected=new Set(shuffle(groups.map((_,i)=>i)).slice(0,Math.max(1,Math.ceil(groups.length*c.testFraction))).map(i=>groups[i]));
    for(const x of eligible) (selected.has(String(x.r[c.groupColumn]))?test:train).push(x.i);
  } else if(c.problem==='classification') {
    const groups=new Map<string,number[]>(); for(const x of eligible){const key=String(x.r[c.target]); groups.set(key,[...(groups.get(key)??[]),x.i]);}
    for(const indices of groups.values()){const shuffled=shuffle(indices), n=Math.max(1,Math.round(indices.length*c.testFraction)); test.push(...shuffled.slice(0,n));train.push(...shuffled.slice(n));}
  } else {const indices=shuffle(eligible.map(x=>x.i)), n=Math.round(indices.length*c.testFraction);test=indices.slice(0,n);train=indices.slice(n);}
  if(train.length<20 || test.length<8) throw new Error('La separación deja menos de 20 filas de entrenamiento u 8 de test; agrega datos o revisa grupos y fechas.');
  if(c.problem==='classification') { const labels=new Set(eligible.map(x=>String(x.r[c.target]))); for(const label of labels) if(train.filter(i=>String(t.rows[i]?.[c.target])===label).length<5 || test.filter(i=>String(t.rows[i]?.[c.target])===label).length<2) throw new Error('Cada clase necesita al menos 5 ejemplos en train y 2 en test con esta separación.'); }
  return {train,test,excluded:t.rows.length-train.length-test.length};
}
