import json, time, math, traceback
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.svm import SVC
from sklearn.cluster import KMeans, DBSCAN
from sklearn.mixture import GaussianMixture
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.inspection import permutation_importance

def clean(value):
    if isinstance(value, dict): return {str(k):clean(v) for k,v in value.items()}
    if isinstance(value, (list,tuple)): return [clean(v) for v in value]
    if isinstance(value, np.ndarray): return clean(value.tolist())
    if isinstance(value, np.generic): return clean(value.item())
    if isinstance(value, float) and not math.isfinite(value): return None
    return value

_models = {}

def experiment(payload):
    global _models
    _models = {}
    c=payload['config']; features=c['features']; problem=c['problem']
    numeric=payload['numeric']; nums=[i for i,f in enumerate(features) if f in numeric]; cats=[i for i,f in enumerate(features) if f not in numeric]
    rows=payload['rows']; X=np.array([[np.nan if r.get(f) is None else r[f] for f in features] for r in rows],dtype=object)
    train=payload['train']; test=payload['test']; Xt=X[train]; Xv=X[test]
    y=None if problem=='clustering' else np.array([r.get(c['target']) for r in rows],dtype=float if problem=='regression' else str)
    yt=None if y is None else y[train]; yv=None if y is None else y[test]
    def pre():
        parts=[]
        if nums: parts.append(('num',Pipeline([('impute',SimpleImputer(strategy='median',keep_empty_features=True)),('scale',StandardScaler())]),nums))
        if cats: parts.append(('cat',Pipeline([('impute',SimpleImputer(strategy='most_frequent',keep_empty_features=True)),('encode',OneHotEncoder(handle_unknown='ignore',sparse_output=False))]),cats))
        return ColumnTransformer(parts)
    if problem=='classification':
        options=[('baseline','Referencia mayoritaria',DummyClassifier(strategy='most_frequent')),('logistic','Logistic Regression',LogisticRegression(max_iter=600,class_weight='balanced',random_state=42)),('tree','Decision Tree',DecisionTreeClassifier(max_depth=5,min_samples_leaf=5,class_weight='balanced',random_state=42)),('forest','Random Forest',RandomForestClassifier(n_estimators=60,max_depth=8,min_samples_leaf=3,class_weight='balanced',random_state=42,n_jobs=1)),('boost','Gradient Boosting',GradientBoostingClassifier(n_estimators=60,max_depth=2,random_state=42))]
        if len(train)<=2000: options.append(('svm','SVM',SVC(class_weight='balanced',probability=True,random_state=42)))
        principal='F1 macro'
    elif problem=='regression':
        options=[('baseline','Referencia media',DummyRegressor(strategy='mean')),('linear','Linear Regression',LinearRegression()),('ridge','Ridge',Ridge(alpha=1)),('lasso','Lasso',Lasso(alpha=.1,max_iter=1000)),('tree','Decision Tree Regressor',DecisionTreeRegressor(max_depth=5,min_samples_leaf=5,random_state=42)),('forest','Random Forest Regressor',RandomForestRegressor(n_estimators=60,max_depth=8,min_samples_leaf=3,random_state=42,n_jobs=1)),('boost','Gradient Boosting Regressor',GradientBoostingRegressor(n_estimators=60,max_depth=2,random_state=42))]
        principal='RMSE'
    else:
        k=c['k']; options=[('kmeans','K-Means',KMeans(n_clusters=k,n_init=10,random_state=42)),('dbscan','DBSCAN',DBSCAN(eps=.7,min_samples=5,n_jobs=1)),('gmm','Gaussian Mixture',GaussianMixture(n_components=k,random_state=42))];principal='Silhouette'
    results=[]
    for ident,name,estimator in options:
        started=time.perf_counter()
        try:
            model=Pipeline([('preparation',pre()),('model',estimator)])
            obs=[]; importance=[]; train_score=None
            if problem=='clustering':
                model.fit(Xt)
                if ident=='dbscan':
                    labels=estimator.labels_; matrix=model['preparation'].transform(Xt); score=silhouette_score(matrix,labels,sample_size=min(1000,len(labels)),random_state=42) if 1<len(set(labels))<len(labels) else None
                    obs.append('Silhouette en train, incluye ruido; no comparable con test. Sin predicción fuera de muestra.'); metrics={'Silhouette train':score,'Ruido train':float(np.mean(labels==-1))}
                else:
                    pred=model.predict(Xv); matrix=model['preparation'].transform(Xv); score=silhouette_score(matrix,pred,sample_size=min(1000,len(pred)),random_state=42) if 1<len(set(pred))<len(pred) else None
                    metrics={'Silhouette':score}
                    if ident=='kmeans':metrics['Inertia train']=float(estimator.inertia_)
                    obs.append('Grupos exploratorios: no son clases reales ni prueban utilidad predictiva.')
            else:
                model.fit(Xt,yt); pred=model.predict(Xv); training=model.predict(Xt)
                if problem=='classification':
                    metrics={'Accuracy':accuracy_score(yv,pred),'Precision macro':precision_score(yv,pred,average='macro',zero_division=0),'Recall macro':recall_score(yv,pred,average='macro',zero_division=0),'F1 macro':f1_score(yv,pred,average='macro',zero_division=0)}
                    train_score=f1_score(yt,training,average='macro',zero_division=0)
                    for label in estimator.classes_:
                        mask=yv==label; guessed=pred==label
                        metrics['Recall · '+str(label)]=float(np.sum(mask & guessed)/np.sum(mask)) if np.sum(mask) else None
                        metrics['Precision · '+str(label)]=float(np.sum(mask & guessed)/np.sum(guessed)) if np.sum(guessed) else 0
                    if hasattr(model,'predict_proba'):
                        try:
                            prob=model.predict_proba(Xv)
                            metrics['ROC-AUC']=roc_auc_score(yv,prob[:,1]) if len(estimator.classes_)==2 else roc_auc_score(yv,prob,labels=estimator.classes_,multi_class='ovr',average='macro')
                        except ValueError: metrics['ROC-AUC']=None;obs.append('ROC-AUC no definida para esta división.')
                    if train_score-metrics['F1 macro']>.15:obs.append('Posible overfitting: F1 train supera test en más de 0.15.')
                else:
                    mse=mean_squared_error(yv,pred);metrics={'MAE':mean_absolute_error(yv,pred),'MSE':mse,'RMSE':math.sqrt(mse),'R²':r2_score(yv,pred)};train_score=math.sqrt(mean_squared_error(yt,training))
                    if train_score < metrics['RMSE']*.65:obs.append('Posible overfitting: error train muy inferior a test.')
                if ident!='baseline':
                    imp=permutation_importance(model,Xv,yv,scoring='f1_macro' if problem=='classification' else 'neg_root_mean_squared_error',n_repeats=3,random_state=42,n_jobs=1)
                    importance=sorted([{'feature':f,'value':float(v)} for f,v in zip(features,imp.importances_mean)],key=lambda v:-v['value'])
            _models[ident]=model
            results.append({'id':ident,'name':name,'metrics':metrics,'trainScore':train_score,'seconds':time.perf_counter()-started,'observations':obs,'importance':importance,'canPredict':ident not in ('dbscan','baseline')})
        except Exception as e:
            results.append({'id':ident,'name':name,'metrics':{},'trainScore':None,'seconds':time.perf_counter()-started,'observations':[],'importance':[],'canPredict':False,'error':str(e)})
    valid=[r for r in results if not r.get('error') and r['id']!='baseline' and r['metrics'].get(principal) is not None]
    valid.sort(key=lambda r:r['metrics'][principal],reverse=problem!='regression')
    recommended=valid[0]['id'] if valid else None
    warnings=['Comparación exploratoria con una única división fija (semilla 42), sin ajuste de hiperparámetros. Validar después en datos externos; la selección entre modelos usa test y puede optimizarlo indirectamente.','No se reentrena con test; los modelos en sesión conservan exclusivamente su ajuste en train.','XGBoost y SHAP no incluidos en este motor; interpretabilidad mediante permutación en test.']
    baseline=next((r for r in results if r['id']=='baseline' and r['metrics'].get(principal) is not None),None)
    if valid and baseline:
        best=valid[0]['metrics'][principal]; base=baseline['metrics'][principal]
        if (best>=base if problem=='regression' else best<=base):recommended=None;warnings.append('Ningún modelo supera la referencia: no se recomienda usarlo para predicciones.')
    if len(valid)>1:
        a=valid[0]['metrics'][principal]; b=valid[1]['metrics'][principal]
        if abs(a-b)<=max(abs(a)*.03,.01):warnings.append('Los dos primeros modelos tienen resultados cercanos (diferencia ≤3% o 0.01). Sin prueba de significancia; no hay un ganador concluyente.')
    return clean({'models':results,'recommended':recommended,'trainRows':len(train),'testRows':len(test),'excludedRows':payload['excluded'],'problem':problem,'principal':principal,'config':c,'warnings':warnings})

def predict(payload):
    model=_models.get(payload['model'])
    if model is None:raise ValueError('El modelo ya no está disponible; repite el experimento.')
    features=payload['features']; record=payload['input']; X=np.array([[np.nan if record.get(f) is None else record[f] for f in features]],dtype=object)
    result={'prediction':clean(model.predict(X)[0]),'probabilities':[],'input':record}
    if hasattr(model,'predict_proba'):
        result['probabilities']=[{'label':str(label),'probability':float(prob)} for label,prob in zip(model['model'].classes_ if hasattr(model['model'],'classes_') else range(model['model'].n_components),model.predict_proba(X)[0])]
    return clean(result)
