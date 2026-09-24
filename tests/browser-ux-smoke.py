"""Browser-level front-end test against a fake server, not a live Express integration test.
Requires playwright and a system Chromium. Tests no-reload CRUD, in-place errors and safe drafts.
"""
import http.server
import json
import pathlib
import threading
import urllib.parse
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
JS = (ROOT / 'public/js/enhancements.js').read_bytes()
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def html(self, code, body):
        data=body.encode();self.send_response(code);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        path=urllib.parse.urlparse(self.path).path
        if path=='/js/smooth-forms.js':
            self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(JS);return
        if path=='/login':
            return self.html(200,'''<!doctype html><html><body><form id="loginForm" action="/login" method="post"><input id="loginEmail" name="email" type="email"><input id="loginPassword" name="password" type="password"><input type="checkbox" data-remember-email name="remember_email" value="1"><button>Sign in</button></form><script src="/js/enhancements.js"></script></body></html>''')
        if path=='/test':
            return self.html(200,'''<!doctype html><html><head><title>Test</title></head><body><div class="app-layout" data-role="customer" data-user="1"><header class="app-topbar"><span class="topbar-titles">Initial</span></header><main class="app-main"><h1>New pickup</h1><form method="post" action="/save"><input type="hidden" name="_csrf" value="token"><label>Address<input name="address" required></label><label>Password<input name="password" type="password"></label><button type="submit">Add pickup</button></form></main></div><script src="/js/enhancements.js"></script></body></html>''')
        if path=='/after':
            return self.html(200,'''<!doctype html><html><head><title>Saved</title></head><body><div class="app-layout" data-role="customer" data-user="1"><header class="app-topbar"><span class="topbar-titles">Saved</span></header><main class="app-main"><h1 id="ok">Pickup was added</h1></main></div></body></html>''')
        return self.html(404,'missing')
    def do_POST(self):
        n=int(self.headers.get('Content-Length','0'));fields=urllib.parse.parse_qs(self.rfile.read(n).decode())
        if self.path=='/save':
            if fields.get('address',[''])[0]=='fail':return self.html(400,'The address could not be saved. Please correct it.')
            content=json.dumps({'ok':True,'redirect':'/after','message':'Added!'}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content);return
        return self.html(404,'missing')
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=b.new_page(viewport={'width':390,'height':844})
        page.goto(base+'/test');page.locator('input[name="address"]').fill('Kansanga 21');page.locator('input[name="password"]').fill('secret-should-not-store');page.reload()
        assert page.locator('input[name="address"]').input_value()=='Kansanga 21','address draft not restored'
        assert page.locator('input[name="password"]').input_value()=='','password was stored'
        page.locator('input[name="address"]').fill('fail');page.get_by_role('button',name='Add pickup').click()
        page.locator('[data-form-message]').wait_for();assert 'could not be saved' in page.locator('[data-form-message]').inner_text()
        assert page.url.endswith('/test') and page.locator('input[name="address"]').input_value()=='fail'
        assert page.get_by_role('button',name='Add pickup').is_enabled(),'button remained disabled after failure'
        page.locator('input[name="address"]').fill('Kansanga 21');page.get_by_role('button',name='Add pickup').click()
        page.locator('#ok').wait_for();assert page.url.endswith('/after')
        assert page.evaluate('performance.getEntriesByType("navigation").length')==1,'a full page reload occurred'
        assert 'password' not in page.evaluate('JSON.stringify(sessionStorage)'),'password was saved'
        page.goto(base+'/login');page.locator('#loginEmail').fill('person@reloop.test');page.locator('#loginPassword').fill('private1234567');page.reload()
        assert page.locator('#loginEmail').input_value()=='person@reloop.test','login email not restored'
        assert page.locator('#loginPassword').input_value()=='','login password should rely on password manager, not browser storage'
        b.close()
    print('PASS Chromium browser UX: 7 checks (draft, no password storage, inline error, no reload, retry, email restore).')
finally:server.shutdown()
