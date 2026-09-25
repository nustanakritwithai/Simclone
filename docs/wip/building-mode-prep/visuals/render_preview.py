"""Headless render of preview.html -> PNG (exact canvas backing pixels). Local only."""
import base64, functools, http.server, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=str(HERE))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
jobs = [('preview_scene.png', 'zoom=1.25&dpr=2'), ('preview_scene_grid.png', 'zoom=1.25&dpr=2&grid=1'),
        ('preview_debug_zoom4.png', 'zoom=4&dpr=1&grid=1')]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(device_scale_factor=2, viewport={'width': 1000, 'height': 880})
    errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    for name, qs in jobs:
        pg.goto(f'http://127.0.0.1:{srv.server_port}/preview.html?{qs}')
        pg.wait_for_function('window.__done===true', timeout=15000)
        data = pg.evaluate('window.__png').split(',', 1)[1]
        (HERE / name).write_bytes(base64.b64decode(data)); print('wrote', HERE / name)
    b.close()
srv.shutdown()
if errs: print('ERRORS', errs); sys.exit(1)
