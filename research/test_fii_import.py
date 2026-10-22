import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('fii', pathlib.Path(__file__).resolve().parents[1] / 'scripts/import-fii-history.py')
fii = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fii)

def page(cells, symbol='MCX'):
    return f'<a href="https://www.nseindia.com/get-quotes/equity?symbol={symbol}">NSE</a><div id="quarterly-shp"><table><tr><th></th><th>Dec 2025</th><th>Mar 2026</th><th>Jun 2026</th><th>Sep 2026</th></tr><tr><td>FIIs +</td>{cells}</tr></table></div><div id="yearly-shp"><table><tr><th>Mar 2026</th></tr><tr><td>FIIs +</td><td>99%</td></tr></table></div>'

class ImportTests(unittest.TestCase):
    def test_missing_is_not_zero_and_annual_table_ignored(self):
        result = fii.parse_history(page('<td>0.00%</td><td>—</td><td>29.85%</td><td>27.06%</td>'), 'MCX')
        self.assertEqual(result, {'2025-12': 0, '2026-03': None, '2026-06': 29.85, '2026-09': 27.06})

    def test_rejects_wrong_security(self):
        with self.assertRaises(ValueError):
            fii.parse_history(page('<td>1%</td>' * 4, 'OTHER'), 'MCX')

    def test_rejects_misaligned_quarters(self):
        with self.assertRaises(ValueError):
            fii.parse_history(page('<td>1%</td>' * 3), 'MCX')

    def test_rejects_invalid_percentage(self):
        with self.assertRaises(ValueError):
            fii.parse_history(page('<td>101%</td>' * 4), 'MCX')

if __name__ == '__main__':
    unittest.main()
