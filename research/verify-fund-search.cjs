const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}),f);
const {searchCompanyHoldings,sharedCompanyHoldings}=require('../lib/fund-search.ts');
const data={previousMonth:'2026-08',previousFunds:[{id:'a',portfolioDate:'2026-08-31',holdings:[{name:'Example Engineering',weight:2.5}]}],funds:[
 {id:'a',name:'Alpha Fund',portfolioDate:'2026-09-30',holdings:[{name:'Example Engineering',weight:3.25}]},
 {id:'b',name:'Beta Fund',portfolioDate:'2026-09-30',holdings:[{name:'Example Engineering',weight:1.5}]},
 {id:'c',name:'Example Fund',portfolioDate:'2026-09-30',holdings:[{name:'Unrelated Company',weight:2}]}
],fullComparisons:[
 {fundId:'a',currentDate:'2026-09-30',previousDate:'2026-08-31',rows:[{name:'Example Engineering',currentQuantity:10,weight:3.25,previousWeight:2.5},{name:'Beyond Top Fifteen',currentQuantity:5,weight:null},{name:'Exited Engineering',currentQuantity:0,weight:0}]},
 {fundId:'b',currentDate:'2026-08-31',previousDate:'2026-07-31',rows:[{name:'Stale Company',currentQuantity:4,weight:2}]}
]};
const shared=searchCompanyHoldings(data,'example engineering');
assert.equal(shared.length,2,'Return matching company across all funds, without duplicate top/full rows');
assert.deepEqual(shared.map(row=>row.weight),[3.25,1.5]);
assert.equal(shared[0].previousWeight,2.5);
assert.equal(shared[0].change,0.75,'Calculate allocation change in percentage points');
assert.equal(shared[1].previousWeight,null,'Missing prior holdings must not be zero');
assert.equal(shared[1].change,null);
assert.equal(searchCompanyHoldings(data,'beyond fifteen')[0].weight,null,'Find holdings outside top 15; missing weights stay unknown');
assert.equal(searchCompanyHoldings(data,'exited').length,0,'Exclude exited positions');
assert.equal(searchCompanyHoldings(data,'stale').length,0,'Ignore comparisons from another month');
assert.equal(searchCompanyHoldings(data,'example').length,2,'Match company names rather than fund names');
assert.equal(searchCompanyHoldings(data,'   ').length,0);
assert.equal(searchCompanyHoldings(data,'no such company').length,0);
const original=sharedCompanyHoldings(data);
assert.equal(original.companies.length,1);
assert.equal(original.companies[0].funds.length,2,'Count each fund once despite top/full duplicates');
assert.equal(original.fullFunds,1,'Only same-date comparisons count as full coverage');
data.fullComparisons.push({fundId:'b',currentDate:'2026-09-30',previousDate:'2026-08-31',rows:[{name:'Beyond Top Fifteen',currentQuantity:4,weight:0.75,previousQuantity:0,previousWeight:null},{name:'Example Engineering',currentQuantity:10,weight:1.5,previousWeight:2}]});
assert.equal(searchCompanyHoldings(data,'beyond fifteen').find(row=>row.fundId==='b').change,0.75,'Confirmed new positions have zero prior allocation');
assert.equal(searchCompanyHoldings(data,'example engineering').find(row=>row.fundId==='b').change,-0.5,'Track decreases from full comparisons');
const expanded=sharedCompanyHoldings(data);
assert.equal(expanded.companies.length,2,'Include overlap outside top 15 from current full portfolios');
assert.equal(expanded.companies.find(row=>row.name==='Beyond Top Fifteen').funds.find(fund=>fund.id==='a').weight,null);
assert.equal(expanded.fullFunds,2);
assert.equal(expanded.topOnlyFunds,1);
data.funds=data.funds.filter(fund=>fund.id!=='b');
assert.equal(sharedCompanyHoldings(data).companies.length,0,'Removing a loaded fund updates the overlap; stale comparisons cannot add it back');
console.log('Fund search checks passed: cross-fund matches, full portfolio coverage, deduplication, dates, exits and unknown allocation.');
