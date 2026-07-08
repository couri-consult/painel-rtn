import csv
import glob
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT = os.path.join(DATA_DIR, 'catalogo_variaveis.json')

catalog = {}  # (codigo, descricao) -> entry

for path in sorted(glob.glob(os.path.join(DATA_DIR, '*.csv'))):
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            key = (row['codigo'], row['descricao'])
            entry = catalog.setdefault(key, {
                'codigo': row['codigo'],
                'descricao': row['descricao'],
                'apelido': None,
                'fonte': 'RTN',
                'nivel': int(row['nivel']),
                '_disp': set(),
            })
            entry['_disp'].add((row['tabela'], row['periodicidade'], row['unidade_tipo']))

result = []
for entry in catalog.values():
    disp = sorted(entry.pop('_disp'), key=lambda d: d[0])
    entry['disponibilidade'] = [
        {'tabela': t, 'periodicidade': p, 'unidade_tipo': u} for t, p, u in disp
    ]
    result.append(entry)

result.sort(key=lambda e: (e['nivel'], e['codigo'] or '', e['descricao']))

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f'{len(result)} rubricas unicas -> {OUT}')
