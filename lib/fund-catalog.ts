export const fundCatalog = [
  {id:"nippon",name:"Nippon India Small Cap Fund",aumCr:82580},
  {id:"dsp",name:"DSP Small Cap Fund",aumCr:21659},
  {id:"invesco",name:"Invesco India Smallcap Fund",aumCr:15744},
  {id:"motilal",name:"Motilal Oswal Small Cap Fund",aumCr:8150},
  {id:"edelweiss",name:"Edelweiss Small Cap Fund",aumCr:7259},
  {id:"absl",name:"Aditya Birla Sun Life Small Cap Fund",aumCr:6226},
  {id:"mirae",name:"Mirae Asset Small Cap Fund",aumCr:5717},
  {id:"mahindra",name:"Mahindra Manulife Small Cap Fund",aumCr:5468},
  {id:"uti",name:"UTI Small Cap Fund",aumCr:5448},
  {id:"sundaram",name:"Sundaram Small Cap Fund",aumCr:4155},
  {id:"iti",name:"ITI Small Cap Fund",aumCr:3603},
  {id:"trustmf",name:"TRUSTMF Small Cap Fund",aumCr:3439},
  {id:"abakkus",name:"Abakkus Small Cap Fund",aumCr:2794},
  {id:"bajaj",name:"Bajaj Finserv Small Cap Fund",aumCr:2647},
  {id:"pgim",name:"PGIM India Small Cap Fund",aumCr:1794},
  {id:"helios-financial",name:"Helios Financial Services Fund"},
  {id:"helios-flexi",name:"Helios Flexi Cap Fund"},
  {id:"helios-large-mid",name:"Helios Large & Mid Cap Fund"},
  {id:"helios-mid",name:"Helios Mid Cap Fund"},
  {id:"helios",name:"Helios Small Cap Fund",aumCr:1737},
  {id:"jm",name:"JM Small Cap Fund",aumCr:929},
  {id:"lic",name:"LIC MF Small Cap Fund",aumCr:832},
  {id:"groww",name:"Groww Small Cap Fund",aumCr:764},
  {id:"quantum",name:"Quantum Small Cap Fund",aumCr:265},
  {id:"sbi-small",name:"SBI Small Cap Fund"},
  {id:"canara-small",name:"Canara Robeco Small Cap Fund"},
  {id:"franklin-small",name:"Franklin India Small Cap Fund"},
  {id:"kotak-small",name:"Kotak Small Cap Fund"},
  {id:"whiteoak-mid",name:"WhiteOak Capital Mid Cap Fund"},
  {id:"dsp-mid",name:"DSP Midcap Fund"},
  {id:"edelweiss-mid",name:"Edelweiss Mid Cap Fund"},
  {id:"uti-mid",name:"UTI Mid Cap Fund"},
  {id:"kotak-mid",name:"Kotak Midcap Fund"},
  {id:"franklin-mid",name:"Franklin India Mid Cap Fund"},
];
export const schemeAliases:Record<string,string[]> = {
  "franklin-small":["Franklin India Smaller Companies Fund"],
  "kotak-mid":["Kotak Emerging Equity Fund"],
  "franklin-mid":["Franklin India Prima Fund"],
  "dsp-mid":["DSP Mid Cap Fund"],
};
export const schemeNames:Record<string,string> = Object.fromEntries(fundCatalog.map(f=>[f.id,f.name]));
export const schemeCategories:Record<string,string> = Object.fromEntries(fundCatalog.map(f=>[f.id,({"helios-financial":"Financial services · Sector equity","helios-flexi":"Flexi cap","helios-large-mid":"Large & mid cap","helios-mid":"Mid cap","whiteoak-mid":"Mid cap","dsp-mid":"Mid cap","edelweiss-mid":"Mid cap","uti-mid":"Mid cap","kotak-mid":"Mid cap","franklin-mid":"Mid cap"} as Record<string,string>)[f.id]??"Small cap"]));
export const selectionEvidence = {
  checkedOn:"2026-10-20",
  url:"https://www.indmoney.com/mutual-funds/equity/small-cap",
  note:"The original 20 active small-cap schemes, retaining the original eight and adding the twelve largest remaining non-bank-branded schemes in the checked category list. The original selection excluded Tata, Franklin and Quant; Franklin schemes were subsequently added at your request. Coverage uses reported scheme AUM checked on 2 October 2026; fund cards and table rows are displayed alphabetically by full fund name. This is not a ranking of research quality or trust. Passive funds, ETFs and funds of funds are excluded. Four additional Helios equity schemes—Financial Services, Flexi Cap, Large & Mid Cap and Mid Cap—were added at your request on 15 October 2026. They are labelled by category and grouped with Helios Small Cap Fund. Ten further schemes—four small-cap and six mid-cap funds—were added at your request on 20 October 2026. The catalogue now contains 34 schemes: 24 small-cap, seven mid-cap, and the three other Helios categories. Holdings dates are separate from selection dates."
};

export const fundUniverseDescription = `${fundCatalog.length} equity funds · ${fundCatalog.filter(f=>schemeCategories[f.id]==="Small cap").length} small-cap · ${fundCatalog.filter(f=>schemeCategories[f.id]==="Mid cap").length} mid-cap · 3 other equity schemes`;
