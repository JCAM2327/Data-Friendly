import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDataset } from './dataset-store';
import { MlRuntime } from '@/services/ml-client';
import type { ExperimentConfig, ExperimentResult, PredictionResult } from '@/services/ml-advisor';
const initial: ExperimentConfig = { problem: 'classification', target: '', features: [], timeColumn: '', groupColumn: '', testFraction: .2, k: 3 };
function useSessionValue() {
  const { currentTable, dataset, validationRules, registerOperation } = useDataset();
  const [config, setConfig] = useState<ExperimentConfig>(initial);
  const [purpose, setPurpose] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [selected, setSelected] = useState('');
  const [validated, setValidated] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const runtime = useRef<MlRuntime | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    runtime.current?.dispose(); runtime.current=null;
    setResult(null);setPrediction(null);setSelected('');setValidated(false);setBusy(false);setError('');setConfirmed(false);
    setConfig(initial);setPurpose('');
  }, [currentTable, validationRules]);
  useEffect(()=>()=>{generation.current++;runtime.current?.dispose();},[]);
  const updateConfig = (next: ExperimentConfig) => {
    generation.current++; runtime.current?.dispose();runtime.current=null;
    setConfig(next);setResult(null);setSelected('');setValidated(false);setPrediction(null);setConfirmed(false);setError('');setBusy(false);
  };
  const cancel=()=>{generation.current++;runtime.current?.dispose();runtime.current=null;setBusy(false);setStatus('');setError('Cálculo cancelado.');};
  const train=async()=> {
    if(!dataset||!currentTable||busy)return;
    const current=++generation.current;
    setError('');setResult(null);setPrediction(null);setValidated(false);setBusy(true);setStatus('Preparando experimento…');
    try {runtime.current?.dispose();const engine=new MlRuntime();runtime.current=engine;const next=await engine.train(currentTable,dataset,config,setStatus);if(current!==generation.current)return;setResult(next);setSelected(next.recommended??'');registerOperation({kind:'ml',label:'Comparación de modelos ejecutada',detail:`${purpose} · ${config.target||'Sin target'} · ${next.trainRows} train / ${next.testRows} test · ${next.models.filter(m=>!m.error).length} modelos calculados`});}
    catch(e){if(current===generation.current)setError(e instanceof Error?e.message:String(e));}
    finally{if(current===generation.current){setBusy(false);setStatus('');}}
  };
  const predict=async(input: Record<string,unknown>)=> {
    if(!runtime.current||!result||!selected||!validated||busy)return;
    const current=generation.current;setBusy(true);setError('');
    try{const p=await runtime.current.predict(selected,result.config,input);if(current!==generation.current)return;setPrediction(p);registerOperation({kind:'ml',label:'Predicción calculada',detail:`Modelo ${selected} · ${result.config.target||'Grupo exploratorio'} · predicción en sesión`});}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:String(e));}finally{if(current===generation.current)setBusy(false);}
  };
  return {config,updateConfig,purpose,setPurpose,confirmed,setConfirmed,result,selected,setSelected,validated,setValidated,prediction,busy,status,error,train,predict,cancel};
}
type Session = ReturnType<typeof useSessionValue>;
const Context=createContext<Session|null>(null);
export function MlSessionProvider({children}:{children:ReactNode}){const value=useSessionValue();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useMlSession(){const value=useContext(Context);if(!value)throw new Error('Falta la sesión ML');return value;}
