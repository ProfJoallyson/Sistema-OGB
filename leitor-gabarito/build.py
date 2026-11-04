#!/usr/bin/env python3
"""Monta index.html: um arquivo único, que funciona sem internet.
Uso: npm install && python3 build.py node_modules"""
import re, sys, os
aqui = os.path.dirname(os.path.abspath(__file__))
nm = sys.argv[1]
def ler(p): return open(p, encoding='utf-8').read()
def limpar(js): return re.sub(r'^if \(typeof module.*$', '', js, flags=re.M)
libs = [nm + '/qrcode-generator/qrcode.js', nm + '/jsqr/dist/jsQR.js', nm + '/xlsx/dist/xlsx.full.min.js']
tags = ''.join('<script>' + ler(p).replace('</script', '<\\/script') + '</script>\n' for p in libs)
app = ''.join(limpar(ler(f'{aqui}/src/{n}')) + '\n' for n in ['layout.js', 'notas.js', 'folha.js', 'leitor.js', 'app.js'])
html = ler(f'{aqui}/src/app.html')
html = html.replace('<!--LIBS-->', tags)
html = html.replace('/*APP-SCRIPTS*/', app.replace('</script', '<\\/script'))
open(f'{aqui}/index.html', 'w', encoding='utf-8').write(html)
print('index.html', len(html.encode()) // 1024, 'KB')
