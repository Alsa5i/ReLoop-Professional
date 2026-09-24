"""Dependency-free static check for user-facing, literal navigation endpoints and local EJS includes."""
from pathlib import Path
import re
p=Path(__file__).resolve().parents[1]
roots={'auth':'','public':'','common':'','owner':'/owner','admin':'/admin','customer':'/customer','collector':'/collector','partner':'/partner','legacy':'/legacy'}
registered=set()
for name,prefix in roots.items():
 src=(p/'src/routes'/f'{name}.js').read_text()
 for route in re.findall(r'router\.get\(\s*[\'\"](\/[^\'\"]*)[\'\"]',src):
  registered.add((prefix+route).rstrip('/') or '/')
registered|={'/health','/api/health','/proof/:id','/pickup/:id/qr.png'}
# Fallback for routes registered as simple public express paths, not dynamic URLs.
nav=(p/'views/partials/app-sidebar.ejs').read_text()
public=(p/'views/partials/public-nav.ejs').read_text()
links=set(re.findall(r"\['[^']+','(/[^']+)'\s*,",nav))
links|=set(re.findall(r'href="(/[^"<%]+)"',public))
links.discard('/')
links={url for url in links if not url.startswith('/icons/')}
# public nav's dashboard href is dynamic, each dashboard is checked via the sidebar.
missing=sorted(url for url in links if url not in registered)
assert not missing, f'Navigation links without registered GET route: {missing}'
views=list((p/'views').rglob('*.ejs'))
inclusions=0
for file in views:
 src=file.read_text()
 for match in re.findall(r'include\(\s*[\'\"]([^\'\"]+)[\'\"]',src):
  target=(file.parent/(match+'.ejs')).resolve()
  assert target.is_file(), f'Missing include: {file.relative_to(p)} => {match}'
  inclusions+=1
assert 'onchange="this.form.submit()"' not in (p/'views/collector/dashboard.ejs').read_text()
assert 'data-sidebar-close' in (p/'views/partials/app-start.ejs').read_text()
assert 'aria-current' in nav
assert 'data-action-feedback' in (p/'views/partials/app-end.ejs').read_text()
print(f'PASS navigation audit: {len(links)} literal menu links, {inclusions} local template includes, {len(views)} EJS pages/partials')
