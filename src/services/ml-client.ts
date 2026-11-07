import type { RawTable } from './file-parser';
import type { DatasetSummary } from '@/lib/types';
import { isNullish, toNumber } from './profiling-service';
import { partitionRows, type ExperimentConfig, type ExperimentResult, type PredictionResult } from './ml-advisor';
export class MlRuntime {
  private worker: Worker;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; progress: (status: string) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor() {
    this.worker = new Worker(new URL('./ml.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({data}) => { const request=this.pending.get(data.id); if(!request)return; if(data.status){request.progress(data.status);return;}clearTimeout(request.timer);this.pending.delete(data.id);data.error?request.reject(new Error(data.error)):request.resolve(data.result); };
    this.worker.onerror = () => this.dispose('No se pudo iniciar el motor. Revisa tu conexión y vuelve a intentarlo.');
  }
  dispose(reason='Experimento cancelado') { this.worker.terminate(); for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(new Error(reason));}this.pending.clear(); }
  private request<T>(kind: 'experiment'|'predict', payload: unknown, progress=(status:string)=>{void status;}) {
    return new Promise<T>((resolve,reject)=> { const id=crypto.randomUUID(); const timer=setTimeout(()=>this.dispose('El cálculo excedió 5 minutos. Reduce los datos o predictores.'),300000);this.pending.set(id,{resolve:value=>resolve(value as T),reject,progress,timer});this.worker.postMessage({id,kind,payload}); });
  }
  train(t: RawTable, ds: DatasetSummary, config: ExperimentConfig, progress: (status:string)=>void) {
    const split=partitionRows(t,config);
    const numeric=ds.columnProfiles.filter(c=>c.type==='numerica').map(c=>c.name);
    const columns=[...new Set([...config.features,config.target].filter(Boolean))];
    const rows=t.rows.map(r=>Object.fromEntries(columns.map(f=>[f,isNullish(r[f])?null:numeric.includes(f)?toNumber(r[f]):String(r[f])])));
    return this.request<ExperimentResult>('experiment',{config,rows,numeric,...split},progress);
  }
  predict(model: string, config: ExperimentConfig, input: Record<string,unknown>) { return this.request<PredictionResult>('predict',{model,features:config.features,input}); }
}
