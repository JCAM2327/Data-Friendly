/// <reference lib="webworker" />
import engine from './ml-engine.py?raw';
import type { PyodideInterface } from 'pyodide';
let ready: Promise<PyodideInterface> | undefined;
async function init() {
  const { loadPyodide } = await import('pyodide');
  const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' });
  await py.loadPackage(['numpy', 'scikit-learn']);
  await py.runPythonAsync(engine);
  return py;
}
self.onmessage = async (event: MessageEvent<{id: string; kind: 'experiment' | 'predict'; payload: unknown}>) => {
  const { id, kind, payload } = event.data;
  try {
    self.postMessage({ id, status: ready ? 'Calculando modelos…' : 'Descargando motor científico…' });
    const py = await (ready ??= init());
    py.globals.set('request_json', JSON.stringify(payload));
    const result = await py.runPythonAsync(`json.dumps(clean(${kind === 'experiment' ? 'experiment' : 'predict'}(json.loads(request_json))), allow_nan=False)`);
    self.postMessage({ id, result: JSON.parse(String(result)) });
    py.globals.delete('request_json');
  } catch (error) { self.postMessage({ id, error: String(error) }); }
};
