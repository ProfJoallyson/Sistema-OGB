"""Atualiza a lista de arquivos guardados no aparelho (sw.js).
Uso: python3 ferramentas/gerar-sw.py  (rodar depois de criar ou apagar arquivos do app)"""
import os, re

PULAR = ('tests', 'node_modules', 'firebase', 'ferramentas')
EXT = ('.js', '.css', '.html', '.png', '.webmanifest', '.xlsx')
arquivos = []
for raiz, pastas, fs in os.walk('.'):
    pastas[:] = [p for p in pastas if not (raiz == '.' and p in PULAR)]
    for f in fs:
        p = os.path.join(raiz, f)[2:]
        if p.endswith(EXT) and p not in ('sw.js', 'index.html'):
            arquivos.append(p)
arquivos.sort()
sw = open('sw.js').read()
lista = 'const ARQUIVOS = [\n' + ''.join(f"  './{a}',\n" for a in [''] + arquivos) + '];'
sw = re.sub(r'const ARQUIVOS = \[.*?\];', lambda _: lista, sw, flags=re.S)
open('sw.js', 'w').write(sw)
print(len(arquivos), 'arquivos')
