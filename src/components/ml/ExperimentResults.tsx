import { useState } from 'react';
import { Play, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMlSession } from '@/state/ml-session';
import { useDataset } from '@/state/dataset-store';
import { toNumber } from '@/services/profiling-service';
const selectClass='h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm';
const fmt=(n:number|null|undefined)=>n===null||n===undefined?'No definida':n.toLocaleString('es-ES',{maximumFractionDigits:4});
export function ExperimentResults(){
  const session=useMlSession();const {dataset}=useDataset();
  const [inputs,setInputs]=useState<Record<string,string>>({});const [inputError,setInputError]=useState('');
  const {result,selected,validated,prediction,busy}=session;
  if(!result)return null;
  const model=result.models.find(m=>m.id===selected);
  const recommended=result.models.find(m=>m.id===result.recommended);
  const predict=()=>{
    setInputError('');
    const values:Record<string,unknown>={};
    for(const f of result.config.features){const raw=inputs[f]?.trim()??'';if(!raw){setInputError(`Introduce un valor para ${f}.`);return;}const numeric=dataset?.columnProfiles.find(c=>c.name===f)?.type==='numerica';const value=numeric?toNumber(raw):raw;if(value===null){setInputError(`${f} debe ser un número válido.`);return;}values[f]=value;}
    void session.predict(values);
  };
  return <>
    <section className="space-y-3 border-t border-border pt-5">
      <h2 className="text-lg font-semibold">Comparación experimental</h2>
      <p className="text-sm text-muted-foreground">{result.trainRows} train · {result.testRows} test · {result.excludedRows} excluidos · Métrica principal: {result.principal} · Semilla 42</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{['Modelo','Métrica principal','Otras métricas','Tiempo','Observaciones'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{result.models.map(m=><tr key={m.id}><td className="p-3 font-medium">{m.name}</td><td className="p-3 font-mono">{fmt(m.metrics[result.principal])}</td><td className="min-w-48 p-3">{Object.entries(m.metrics).filter(([k])=>k!==result.principal).map(([k,v])=><p key={k}>{k}: {fmt(v)}</p>)}{m.trainScore!==null?<p>{result.principal} train: {fmt(m.trainScore)}</p>:null}</td><td className="p-3">{fmt(m.seconds)} s</td><td className="min-w-56 p-3 text-muted-foreground">{m.error?<p className="text-danger">No calculado: {m.error}</p>:m.observations.length?m.observations.map(o=><p key={o}>{o}</p>):'Sin avisos adicionales; no implica confiabilidad.'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="space-y-3 border-t border-border pt-5">
      <h2 className="text-lg font-semibold">Modelo recomendado según la evaluación experimental</h2>
      <p className="text-sm">{recommended?`${recommended.name} obtuvo ${fmt(recommended.metrics[result.principal])} en ${result.principal} en esta división. No es un modelo universalmente mejor.`:'La comparación no permite recomendar un modelo para nuevas predicciones.'}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">{result.warnings.map(w=><li key={w}>· {w}</li>)}</ul>
      <label className="flex flex-wrap items-center gap-3 text-sm">Modelo seleccionado<select aria-label="Modelo seleccionado" className={selectClass} value={selected} onChange={e=>{session.setSelected(e.target.value);session.setValidated(false);}}><option value="">Seleccionar modelo</option>{result.models.filter(m=>m.canPredict&&!m.error).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {model?<>
        <p className="text-xs text-muted-foreground">{['logistic','linear','ridge','lasso'].includes(model.id)?'Modelo de menor complejidad, útil como referencia interpretable; puede perder relaciones no lineales.':model.id==='svm'?'Modelo de margen; sensible al escalado y con coste alto al crecer la muestra.':result.problem==='clustering'?'Segmentación exploratoria, sensible a la escala y al número de grupos.':'Captura relaciones no lineales; revisar sobreajuste y estabilidad con otras muestras.'}</p>
        {model.importance.length?<div><h3 className="text-sm font-medium">Influencia de variables · Permutation importance</h3><p className="mt-1 text-xs text-muted-foreground">Caída de {result.problem==='classification'?'F1 macro':'−RMSE'} al permutar cada predictor en test (3 repeticiones). No demuestra causalidad; variables correlacionadas pueden compartir importancia.</p><ul className="mt-3 space-y-2">{model.importance.map(i=><li key={i.feature} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 text-xs"><span className="font-mono">{i.feature}</span><span className="font-mono">{fmt(i.value)}</span></li>)}</ul></div>:<p className="text-xs text-muted-foreground">No se calcula importancia supervisada para grupos sin etiquetas.</p>}
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={validated} disabled={!result.recommended} onChange={e=>session.setValidated(e.target.checked)}/><span>Revisé métricas, limitaciones y disponibilidad de las variables. Acepto usar este modelo solo para predicciones exploratorias, no como validación externa.</span></label>
      </>:null}
    </section>
    {model&&validated?<section className="space-y-3 border-t border-border pt-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Target className="size-5"/>Nuevo registro</h2><div className="grid gap-3 sm:grid-cols-2">{result.config.features.map(f=><label key={f} className="min-w-0 text-xs"><span className="mb-1 block break-words font-mono">{f}</span><input aria-label={`Predicción ${f}`} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={inputs[f]??''} onChange={e=>setInputs(p=>({...p,[f]:e.target.value}))}/></label>)}</div><Button disabled={busy} onClick={predict}><Play className="size-4"/>Calcular predicción</Button>{inputError?<p role="alert" className="text-sm text-danger">{inputError}</p>:null}{prediction?<div className="border-l-2 border-primary pl-4"><p className="text-lg font-semibold">Predicción: {String(prediction.prediction)}</p><dl className="mt-2 grid gap-1 text-xs">{Object.entries(prediction.input).map(([k,v])=><div key={k} className="flex flex-wrap gap-2"><dt className="font-mono">{k}:</dt><dd>{String(v)}</dd></div>)}</dl>{prediction.probabilities.map(p=><p key={p.label} className="mt-2 text-sm">{p.label}: {(p.probability*100).toFixed(1)}%</p>)}<p className="mt-2 text-xs text-muted-foreground">{prediction.probabilities.length?'Probabilidad estimada, no garantía ni confianza calibrada.':'El modelo no ofrece una probabilidad calibrada ni un intervalo de confianza.'} {model.importance.length?`Influencia global destacada: ${model.importance.slice(0,3).map(i=>i.feature).join(', ')}; no constituye una explicación individual.`:'La pertenencia a un grupo es exploratoria.'}</p></div>:null}</section>:null}
  </>;
}
