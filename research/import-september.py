import json,pathlib,pandas as pd,re,datetime,hashlib
import sys
p=pathlib.Path(sys.argv[1]);site=pathlib.Path(__file__).resolve().parents[1]
seed=json.loads((site/'data/seed.json').read_text());now=datetime.datetime.now(datetime.timezone.utc).isoformat()
urls={
'dsp': ['https://www.dspim.com/media/pages/mandatory-disclosures/portfolio-disclosures/7737577fda-1791551248/dsp-monthend-portfolio-as-on-30-september-2026.zip','https://www.dspim.com/media/pages/mandatory-disclosures/portfolio-disclosures/8a6dbe504f-1791453357/dsp-monthend-portfolio-as-on-31-aug-2026.zip'],
'nippon':['https://mf.nipponindiaim.com/InvestorServices/FactsheetsDocuments/NIMF-MONTHLY-PORTFOLIO-30-Sep-26.xls','https://mf.nipponindiaim.com/InvestorServices/FactsheetsDocuments/NIMF-MONTHLY-PORTFOLIO-31-Aug-26.xls']}
files={'dsp':(next((p/'dsp').glob('*Equity*')),next((p/'dsp-aug').glob('*Equity*')),'SMALLCAP',2,1,4,6),'nippon':(p/'nippon.xls',p/'nippon-aug.xls','SC',1,2,4,6)}
funds=[];comparisons=[];audit=[]
for id,(cur,prev,sheet,ic,nc,qc,wc) in files.items():
 def parse(file,month):
  a=pd.read_excel(file,sheet_name=sheet,header=None);assert month in ' '.join(a.head(3).astype(str).values.flatten())
  rows={};active=False
  for _,r in a.iterrows():
   name=str(r[nc]);isin=str(r[ic])
   if 'equity' in name.lower():active=True
   if 'money market' in name.lower():active=False
   if not active or not re.fullmatch(r'INE[A-Z0-9]{9}',isin):continue
   q=float(r[qc]);w=float(r[wc])*100
   assert q==int(q) and q>=0 and 0<=w<=100
   assert isin not in rows,(id,isin)
   rows[isin]={'key':isin,'name':name.strip().rstrip('*^').strip(),'quantity':int(q),'weight':round(w,2)}
  assert len(rows)>50
  return rows
 current=parse(cur,'September');previous=parse(prev,'August')
 rows=[]
 for k in current.keys()|previous.keys():
  a=current.get(k);b=previous.get(k)
  rows.append({'key':k,'name':(a or b)['name'],'previousQuantity':b['quantity'] if b else 0,'currentQuantity':a['quantity'] if a else 0,'weight':a['weight'] if a else 0,'previousWeight':b['weight'] if b else 0,'note':None})
 rows.sort(key=lambda r:r['weight'],reverse=True)
 assert sum(r['weight'] for r in rows)<100.1
 provider='https://mfscanner.com/fund/'+('dsp-small-cap-fund' if id=='dsp' else 'nippon-india-small-cap-fund')
 sources=[{'label':'Official September portfolio','url':urls[id][0],'scope':'Full equity share quantities and allocations as at 30 September 2026; original AMC spreadsheet.'},{'label':'Official August portfolio','url':urls[id][1],'scope':'Full equity share quantities and allocations as at 31 August 2026; original AMC spreadsheet.'},{'label':'MFScanner — August only','url':provider,'scope':'Still reports August; checked as historical corroboration, not a September cross-check.'}]
 notes=['Parsed original AMC spreadsheets for both adjacent month ends; matched securities by exact ISIN. Cash, debt and TREPS are excluded.','September independent-provider corroboration is pending: comparison websites checked still displayed August. Do not interpret the official-source status as a multi-provider match.','Changes are net month-end share quantities, not confirmed trades. Corporate actions, security changes and corrections may affect quantities.']
 comparisons.append({'fundId':id,'currentDate':'2026-09-30','previousDate':'2026-08-31','checkedAt':now,'scope':'full_equity','basis':'official_disclosures','rows':rows,'sources':sources,'notes':notes})
 f=next(f for f in seed['funds'] if f['id']==id).copy()
 f.update(portfolioDate='2026-09-30',lastCheckedAt=now,verification='official_only',checkStatus='checked',holdings=[{'key':r['key'],'name':r['name'],'weight':r['weight']} for r in rows if r['currentQuantity']>0][:30],sources=[{'label':'Official September portfolio','url':urls[id][0],'type':'official','portfolioDate':'2026-09-30','matched':True},{'label':'MFScanner — August only','url':provider,'type':'third_party','portfolioDate':'2026-08-31','matched':False}],notes=notes)
 f.pop('holdingsEvidence',None);funds.append(f)
 # Compare official August against existing saved provider quantities, flag discrepancies in report.
 old=next(c for c in json.loads((site/'data/full-portfolio-seed.json').read_text()) if c['fundId']==id)
 mismatches=[]
 for b in previous.values():
  normalize=lambda n:re.sub('[^a-z0-9]','',re.sub(r'\b(limited|ltd)\b','',n.lower()))
  found=[r for r in old['rows'] if r['key']==b['key'] or normalize(r['name'])==normalize(b['name'])]
  if len(found)==1 and found[0]['currentQuantity']!=b['quantity']:mismatches.append(b['name'])
 audit.append({'fundId':id,'currentEquities':len(current),'previousEquities':len(previous),'currentWeightSum':round(sum(r['weight'] for r in current.values()),2),'previousProviderQuantityDiscrepancies':mismatches,'top30':f['holdings'],'files':[{'filename':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()} for file in [cur,prev]]})
 print(id,len(current),len(previous),'weight',audit[-1]['currentWeightSum'],'historical quantity mismatches',mismatches)
(site/'data/september-portfolios.json').write_text(json.dumps({'checkedAt':now,'funds':funds,'comparisons':comparisons},ensure_ascii=False,indent=2)+'\n')
(site/'research/september-import-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
