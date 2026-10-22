"""Import published quarterly FII percentages, with exact NSE-symbol checks.

Screener is an aggregation source, not an independently audited exchange filing.
Missing data is retained as missing; a fetch never creates zero ownership.
"""
import concurrent.futures
import datetime
import html
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
MONTHS = {m: i + 1 for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}

class QuarterlyTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.done = False
        self.rows = []
        self.row = None
        self.cell = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.links.append(html.unescape(attrs['href']))
        if attrs.get('id') == 'quarterly-shp':
            self.active = True
        if not self.active or self.done:
            return
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = ''

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if not self.active or self.done:
            return
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None:
                self.row.append(' '.join(self.cell.split()))
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        if tag == 'table':
            self.done = True

def parse_history(page, symbol):
    table = QuarterlyTable()
    table.feed(page)
    # Do not accept a redirect to another company or a fuzzy name match.
    if not any(urllib.parse.urlparse(link).hostname in ('www.nseindia.com', 'nseindia.com') and urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get('symbol') == [symbol] for link in table.links):
        raise ValueError('NSE symbol could not be verified')
    if not table.rows:
        raise ValueError('Quarterly shareholding table unavailable')
    quarters = table.rows[0][1:]
    fii = next((row[1:] for row in table.rows[1:] if re.fullmatch(r'FIIs?\s*\+?', row[0])), None)
    if fii is None or len(fii) != len(quarters):
        raise ValueError('FII row missing or not aligned with quarter labels')
    values = {}
    for quarter, value in zip(quarters, fii):
        match = re.fullmatch(r'(Mar|Jun|Sep|Dec) (20\d\d)', quarter)
        if not match:
            continue
        date = f'{match[2]}-{MONTHS[match[1]]:02}'
        number = float(value[:-1]) if re.fullmatch(r'\d+(?:\.\d+)?%', value) else None
        if number is not None and not 0 <= number <= 100:
            raise ValueError('Ownership outside percentage range')
        values[date] = number
    if not any(v is not None for v in values.values()):
        raise ValueError('No published quarterly FII percentages')
    return values

def key(name):
    name = {'MCX': 'Multi Commodity Exchange of India', 'BHEL': 'Bharat Heavy Electricals'}.get(name, name)
    return re.sub('[^a-z0-9]', '', re.sub(r'\b(limited|ltd)\b', '', re.sub(r'\((?:formerly|previously)[^)]*\)', '', name.lower())))

def symbols():
    directory = json.loads((ROOT / 'data/nse-equity-securities.json').read_text())
    by_isin = {row[2]: row[0] for row in directory['securities']}
    names = {}
    for symbol, name, isin in directory['securities']:
        for k in (key(name), key(symbol)):
            names.setdefault(k, set()).add(symbol)
    found = {}
    def walk(value, fund=None):
        if isinstance(value, list):
            for item in value:
                walk(item, fund)
        elif isinstance(value, dict):
            if 'fundId' in value:
                fund = value['fundId']
            elif 'holdings' in value and 'id' in value:
                fund = value['id']
            if 'name' in value and ('weight' in value or 'currentQuantity' in value):
                if value.get('currentQuantity', 1) <= 0:
                    return
                matches = names.get(key(value['name']), set())
                symbol = by_isin.get(value.get('key', '')) or (next(iter(matches)) if len(matches) == 1 else None)
                if symbol:
                    found.setdefault(symbol, set()).add(fund)
            for child in value.values():
                if isinstance(child, (list, dict)):
                    walk(child, fund)
    for filename in ('seed.json', 'september-portfolios.json', 'full-portfolio-seed.json', 'fund-expansion-2026-10.json', 'quantum-top30-supplement.json'):
        walk(json.loads((ROOT / 'data' / filename).read_text()))
    return sorted(symbol for symbol, funds in found.items() if len(funds) > 1)

def retrieve(symbol):
    url = 'https://www.screener.in/company/' + urllib.parse.quote(symbol, safe='') + '/'
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (public quarterly ownership research)'})
        with urllib.request.urlopen(request, timeout=25) as response:
            page = response.read(2_000_000).decode('utf-8')
            source = response.url
        values = parse_history(page, symbol)
        return symbol, {'quarters': values, 'source': source + '#shareholding'}, None
    except Exception as error:
        return symbol, None, str(error)
    finally:
        time.sleep(0.25)

if __name__ == '__main__':
    targets = symbols()
    records, errors = {}, {}
    checked = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(f'Retrieving {len(targets)} exact NSE securities', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for count, (symbol, record, error) in enumerate(pool.map(retrieve, targets), 1):
            if record:
                records[symbol] = record
            else:
                errors[symbol] = error
            if count % 40 == 0 or count == len(targets):
                print(f'{count}/{len(targets)}: {len(records)} retrieved, {len(errors)} unavailable', flush=True)
    output = {'checkedAt': checked, 'provider': 'Screener', 'basis': 'FII/FPI shareholding as a percentage of company equity; aggregated published shareholding patterns', 'securities': records}
    existing_path = ROOT / 'data/fii-quarterly.json'
    existing = json.loads(existing_path.read_text()) if existing_path.exists() else {'securities': {}}
    # A source outage must never replace the published dataset with empty rows.
    if not set(existing['securities']).issubset(records):
        raise SystemExit('Incomplete import: published snapshot retained. Review failures before replacing it.')
    existing_path.write_text(json.dumps(output, indent=2) + '\n')
    (ROOT / 'research/fii-import-audit.json').write_text(json.dumps({'checkedAt': checked, 'requested': len(targets), 'retrieved': len(records), 'unavailable': errors}, indent=2) + '\n')
