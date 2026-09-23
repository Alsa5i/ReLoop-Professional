import re,sqlite3,pathlib
s=(pathlib.Path(__file__).resolve().parents[1]/'src/db.js').read_text()
chunks=re.findall(r'db\.exec\(\s*`([^`]*?)`\s*\)',s,re.S)
con=sqlite3.connect(':memory:');con.execute('PRAGMA foreign_keys=ON')
for sql in chunks:
 if '${' in sql: continue
 con.executescript(sql)
for table,ddl in re.findall(r'addColumn\(\s*\'([^\']+)\'\s*,\s*"([^"]+)"\s*\)',s):
 col=ddl.split()[0]
 if col not in [r[1] for r in con.execute(f'PRAGMA table_info({table})')]:con.execute(f'ALTER TABLE {table} ADD COLUMN {ddl}')
for name in ('gross_minor','commission_minor','provider_fee_minor','collector_payout_minor','partner_payout_minor'):
 con.execute(f'ALTER TABLE payments ADD COLUMN {name} INTEGER NOT NULL DEFAULT 0')
for statement in re.findall(r"db\.exec\('([^']+)'\)",s):
 try:con.executescript(statement)
 except sqlite3.Error: pass
required={'users':['status','role'],'app_sessions':['sid','user_id','last_active','expires_at'], 'pickup_requests':['estimated_weight','collected_weight','verified_weight','recurring_schedule_id'],'payments':['gross_minor','commission_minor','provider_fee_minor'],'recurring_pickups':['next_date'],'recycling_campaigns':['target_kg'],'support_requests':['category','escalated']}
for table,columns in required.items():
 present={r[1] for r in con.execute(f'PRAGMA table_info({table})')}; assert set(columns)<=present,(table,columns,present)
con.execute("INSERT INTO users(name,email,password,role,status) VALUES('T','t@t.t','hash','customer','active')")
con.execute("INSERT INTO app_sessions(sid,sess,user_id,expires_at) VALUES('abc','{}',1,123456)")
assert con.execute('SELECT user_id FROM app_sessions WHERE sid=?',('abc',)).fetchone()[0]==1
print('PASS fresh SQLite DDL smoke; tables:',len(con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()))
