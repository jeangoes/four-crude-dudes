#!/usr/bin/env python3
"""Servidor de desenvolvimento que nao deixa o navegador guardar nada.

O `python3 -m http.server` nao manda cabecalho de cache, e o navegador
guarda modulo ES com forca. Editar um arquivo e a mudanca nao aparecer
quase sempre e isso, nao um bug no codigo. A query `?v=` do index.html
resolve para quem joga no GitHub Pages, mas so cobre main.js e styles.css:
os modulos importados por eles mantem a mesma URL e continuam vindo do
cache. Em desenvolvimento a saida e simplesmente proibir o cache.
"""

import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# A raiz e sempre a pasta acima de tools/, nao o diretorio de onde o comando
# foi chamado. Assim `npm run serve` e o launch.json do Claude servem a
# mesma coisa, venham de onde vierem.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '"GET' in (fmt % args) and ' 200 ' in (fmt % args):
            return
        super().log_message(fmt, *args)


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(SemCache, directory=RAIZ)
    print(f'Servindo {RAIZ} em http://localhost:{porta} sem cache. Ctrl+C para parar.')
    ThreadingHTTPServer(('', porta), handler).serve_forever()
