const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('./config');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
function addColumn(table, ddl) {
  const name = ddl.trim().split(/\s+/)[0];
  if (!hasColumn(table, name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
function safeJson(text, fallback={}) { try { return JSON.parse(text || '{}'); } catch { return fallback; } }
function token(bytes=18){ return crypto.randomBytes(bytes).toString('hex'); }

function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS records(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions(
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS material_categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'kg',
    active INTEGER NOT NULL DEFAULT 1,
    image_url TEXT,
    indicative_reward REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS service_zones(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    pickup_fee REAL NOT NULL DEFAULT 0,
    estimated_service_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, city)
  );
  CREATE TABLE IF NOT EXISTS collector_profiles(
    user_id INTEGER PRIMARY KEY,
    phone TEXT,
    service_area TEXT,
    vehicle_type TEXT,
    photo_url TEXT,
    availability TEXT NOT NULL DEFAULT 'offline',
    verification_status TEXT NOT NULL DEFAULT 'pending_verification',
    id_reference TEXT,
    emergency_contact TEXT,
    completed_pickups INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS partner_profiles(
    user_id INTEGER PRIMARY KEY,
    business_name TEXT,
    contact_person TEXT,
    phone TEXT,
    location TEXT,
    registration_info TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    profile_notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS pickup_requests(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    category_id INTEGER,
    estimated_weight REAL,
    collected_weight REAL,
    verified_weight REAL,
    address TEXT NOT NULL,
    area TEXT,
    city TEXT,
    landmark TEXT,
    latitude REAL,
    longitude REAL,
    preferred_time TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_collector_id INTEGER,
    partner_id INTEGER,
    partner_receipt_confirmed_at TEXT,
    verifier_id INTEGER,
    verification_notes TEXT,
    qr_token TEXT UNIQUE NOT NULL,
    requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    collected_at TEXT,
    delivered_at TEXT,
    verified_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES users(id),
    FOREIGN KEY(category_id) REFERENCES material_categories(id),
    FOREIGN KEY(assigned_collector_id) REFERENCES users(id),
    FOREIGN KEY(partner_id) REFERENCES users(id),
    FOREIGN KEY(verifier_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS pickup_status_history(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pickup_id INTEGER NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS collection_proofs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pickup_id INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    proof_type TEXT NOT NULL,
    mime_type TEXT,
    file_name TEXT,
    data BLOB,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS notifications(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ratings(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pickup_id INTEGER UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    collector_id INTEGER NOT NULL,
    stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
    review TEXT,
    moderated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id),
    FOREIGN KEY(customer_id) REFERENCES users(id),
    FOREIGN KEY(collector_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS payments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    pickup_id INTEGER,
    payer_id INTEGER,
    payee_id INTEGER,
    method TEXT NOT NULL,
    gross_value REAL NOT NULL DEFAULT 0,
    reloop_commission REAL NOT NULL DEFAULT 0,
    payment_provider_fee REAL NOT NULL DEFAULT 0,
    collector_payout REAL NOT NULL DEFAULT 0,
    partner_payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_reference TEXT,
    notes TEXT,
    verified_by INTEGER,
    verified_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id),
    FOREIGN KEY(payer_id) REFERENCES users(id),
    FOREIGN KEY(payee_id) REFERENCES users(id),
    FOREIGN KEY(verified_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS expenses(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    expense_date TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS disputes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pickup_id INTEGER,
    opened_by INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT,
    resolved_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id),
    FOREIGN KEY(opened_by) REFERENCES users(id),
    FOREIGN KEY(resolved_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS safety_reports(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER,
    pickup_id INTEGER,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    handled_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id),
    FOREIGN KEY(reported_user_id) REFERENCES users(id),
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id),
    FOREIGN KEY(handled_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS support_requests(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    email TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(assigned_to) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(updated_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS audit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    ip TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS material_batches(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code TEXT UNIQUE NOT NULL,
    category_id INTEGER NOT NULL,
    total_weight REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'collecting',
    storage_location TEXT,
    partner_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    delivery_date TEXT,
    FOREIGN KEY(category_id) REFERENCES material_categories(id),
    FOREIGN KEY(partner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS batch_pickups(
    batch_id INTEGER NOT NULL,
    pickup_id INTEGER NOT NULL UNIQUE,
    weight REAL NOT NULL,
    PRIMARY KEY(batch_id,pickup_id),
    FOREIGN KEY(batch_id) REFERENCES material_batches(id) ON DELETE CASCADE,
    FOREIGN KEY(pickup_id) REFERENCES pickup_requests(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS marketplace_listings(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    estimated_quantity REAL,
    unit TEXT DEFAULT 'kg',
    location TEXT,
    expected_price REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id),
    FOREIGN KEY(category_id) REFERENCES material_categories(id)
  );
  CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickup_requests(status);
  CREATE INDEX IF NOT EXISTS idx_pickups_customer ON pickup_requests(customer_id);
  CREATE INDEX IF NOT EXISTS idx_pickups_collector ON pickup_requests(assigned_collector_id);
  CREATE INDEX IF NOT EXISTS idx_pickups_partner ON pickup_requests(partner_id);
  CREATE INDEX IF NOT EXISTS idx_history_pickup ON pickup_status_history(pickup_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      sid TEXT PRIMARY KEY, sess TEXT NOT NULL, user_id INTEGER,
      device TEXT NOT NULL DEFAULT 'Unknown device', browser TEXT NOT NULL DEFAULT 'Unknown browser', os TEXT NOT NULL DEFAULT 'Unknown OS',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_active TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_reset_expiry ON password_reset_tokens(expires_at);
    CREATE TABLE IF NOT EXISTS customer_businesses (
      customer_id INTEGER PRIMARY KEY REFERENCES users(id), business_name TEXT NOT NULL, contact_person TEXT,
      registration_info TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id),
      label TEXT NOT NULL, address TEXT NOT NULL, area TEXT, city TEXT, landmark TEXT,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recurring_pickups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES material_categories(id), estimated_weight REAL NOT NULL,
      location_id INTEGER NOT NULL REFERENCES customer_locations(id),
      frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly')),
      next_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recycling_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, sponsor TEXT, location TEXT,
      description TEXT, category_id INTEGER REFERENCES material_categories(id), target_kg REAL NOT NULL,
      starts_at TEXT, ends_at TEXT, active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS campaign_pickups (
      campaign_id INTEGER NOT NULL REFERENCES recycling_campaigns(id),
      pickup_id INTEGER NOT NULL UNIQUE REFERENCES pickup_requests(id),
      PRIMARY KEY(campaign_id,pickup_id)
    );
    CREATE TABLE IF NOT EXISTS public_content (
      content_key TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES users(id), updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES support_requests(id),
      user_id INTEGER REFERENCES users(id), status TEXT NOT NULL, notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_app_sessions_active ON app_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_pickups(active,next_date);
    CREATE INDEX IF NOT EXISTS idx_customer_locations_user ON customer_locations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_pickups_campaign ON campaign_pickups(campaign_id);
  `);
  for(const name of ['gross_minor','commission_minor','provider_fee_minor','collector_payout_minor','partner_payout_minor'])addColumn('payments',`${name} INTEGER NOT NULL DEFAULT 0`);
  addColumn('support_requests', "category TEXT NOT NULL DEFAULT 'other'");
  addColumn('support_requests', "escalated INTEGER NOT NULL DEFAULT 0");
  addColumn('pickup_requests', "recurring_schedule_id INTEGER");
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_pickups_schedule_occurrence ON pickup_requests(recurring_schedule_id, preferred_time) WHERE recurring_schedule_id IS NOT NULL');
  addColumn('users', "phone TEXT");
  addColumn('users', "username TEXT");
  addColumn('users', "status TEXT NOT NULL DEFAULT 'active'");
  addColumn('users', "verification_status TEXT NOT NULL DEFAULT 'unverified'");
  addColumn('users', "updated_at TEXT");
  db.prepare('UPDATE users SET updated_at=COALESCE(updated_at,created_at,CURRENT_TIMESTAMP)').run();
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role,status); CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL; CREATE INDEX IF NOT EXISTS idx_pickups_recurring ON pickup_requests(recurring_schedule_id,requested_at)');
  // Historical REAL amounts remain for compatibility. New financial calculations use exact integer units.
  const scale=setting('payment_currency','UGX')==='UGX'?1:100;
  db.prepare(`UPDATE payments SET gross_minor=ROUND(gross_value*?),commission_minor=ROUND(reloop_commission*?),provider_fee_minor=ROUND(payment_provider_fee*?),collector_payout_minor=ROUND(collector_payout*?),partner_payout_minor=ROUND(partner_payout*?) WHERE gross_minor=0 AND gross_value>0`).run(scale,scale,scale,scale,scale);
  // Upgrade old sqlite session rows without silently trusting unlinked session data.
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get()) {
    for(const s of db.prepare('SELECT * FROM sessions WHERE expires_at > ?').all(Date.now())) {
      const data=safeJson(s.sess);if(!data.user?.id)continue;
      db.prepare('INSERT OR IGNORE INTO app_sessions(sid,sess,user_id,expires_at) VALUES(?,?,?,?)').run(s.sid,s.sess,data.user.id,s.expires_at);
    }
    db.prepare('DELETE FROM sessions').run();
  }

  const defaults = {
    commission_percentage: '5',
    commission_fixed_fee: '0',
    commission_minimum_fee: '0',
    payment_currency: 'UGX',
    payment_mode: 'manual_verification',
    platform_support_email: 'support@reloop.local',
    impact_co2_factor_per_kg: '0',
    impact_note: 'Environmental estimates are shown only when the Owner configures a documented conversion factor.'
  };
  const set = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
  Object.entries(defaults).forEach(([k,v]) => set.run(k,v));

  const categories = [
    ['PET plastic','Beverage bottles and other PET items','kg'],
    ['HDPE plastic','High-density polyethylene containers','kg'],
    ['Mixed plastic','Mixed recyclable plastics','kg'],
    ['Paper','Paper suitable for recycling','kg'],
    ['Cardboard','Corrugated and other recyclable cardboard','kg'],
    ['Aluminium','Aluminium cans and scrap','kg'],
    ['Steel','Steel cans and scrap','kg'],
    ['Glass','Recyclable glass','kg'],
    ['E-waste','Eligible electronic waste','kg'],
    ['Textile waste','Textile and fabric waste','kg'],
    ['Organic waste','Organic material where service is available','kg'],
    ['Other','Other approved recyclable material','kg']
  ];
  const catIns = db.prepare('INSERT OR IGNORE INTO material_categories(name,description,unit) VALUES(?,?,?)');
  categories.forEach(c=>catIns.run(...c));

  // The original MVP seeded public demo.local accounts with a shared demo password.
  // Preserve their records for migration, but disable those accounts until the Owner deliberately replaces/reactivates them.
  db.prepare("UPDATE users SET status='suspended' WHERE lower(email) LIKE '%@demo.local' AND role!='owner'").run();
  seedOwner();
  seedLegacyRoleProfiles();
  seedFromLegacy();
}

function seedOwner(){
  if (!config.ownerEmail || !config.ownerPassword) return;
  if (config.ownerPassword.length < 12) {
    if (config.isProduction) throw new Error('OWNER_PASSWORD must be at least 12 characters in production.');
    console.warn('Warning: OWNER_PASSWORD should be at least 12 characters.');
  }
  const existingOwner=db.prepare("SELECT * FROM users WHERE role='owner' ORDER BY id LIMIT 1").get();
  const target=db.prepare('SELECT id,role FROM users WHERE email=?').get(config.ownerEmail);
  if(target && target.role!=='owner')throw Error('OWNER_EMAIL belongs to a non-Owner account; choose a different address.');
  const seedFingerprint=crypto.createHmac('sha256',config.sessionSecret).update('owner-provision-v1:'+config.ownerPassword).digest('hex');
  const priorFingerprint=setting('owner_provision_fingerprint','');
  if(existingOwner){
    const initialProvision=!priorFingerprint&&bcrypt.compareSync(config.ownerPassword,existingOwner.password);
    const newProvision=!!priorFingerprint&&priorFingerprint!==seedFingerprint;
    // Rotate only when OWNER_PASSWORD changes; an Owner's UI password must survive restarts.
    const hash=newProvision?bcrypt.hashSync(config.ownerPassword,12):existingOwner.password;
    db.prepare("UPDATE users SET email=?,password=?,status='active',verification_status='verified',updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(config.ownerEmail,hash,existingOwner.id);
    if(newProvision)db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(existingOwner.id);
    if(newProvision||!priorFingerprint)db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('owner_provision_fingerprint',seedFingerprint);
    db.prepare("UPDATE users SET role='admin',status='suspended' WHERE role='owner' AND id<>?").run(existingOwner.id);
  }else{
    db.prepare("INSERT INTO users(name,email,password,role,status,verification_status) VALUES(?,?,?,'owner','active','verified')")
      .run(config.ownerName,config.ownerEmail,bcrypt.hashSync(config.ownerPassword,12));
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('owner_provision_fingerprint',seedFingerprint);
  }
}

function seedLegacyRoleProfiles(){
  const users = db.prepare('SELECT * FROM users').all();
  const cp = db.prepare('INSERT OR IGNORE INTO collector_profiles(user_id,service_area,vehicle_type,availability,verification_status) VALUES(?,?,?,?,?)');
  const pp = db.prepare('INSERT OR IGNORE INTO partner_profiles(user_id,business_name,contact_person,verification_status) VALUES(?,?,?,?)');
  users.forEach(u=>{
    if(u.role==='collector') cp.run(u.id,'','', 'offline','pending_verification');
    if(u.role==='partner') pp.run(u.id,`${u.name} Recycling Partner`,u.name,'pending');
  });
}

function seedFromLegacy(){
  const customer = db.prepare("SELECT id FROM users WHERE role='customer' ORDER BY id LIMIT 1").get();
  if (!customer) return;
  const pickupCount = db.prepare('SELECT COUNT(*) c FROM pickup_requests').get().c;
  if (!pickupCount) {
    const rows = db.prepare("SELECT * FROM records WHERE module='pickups' ORDER BY id").all();
    const catLookup = db.prepare('SELECT id FROM material_categories WHERE lower(name) LIKE ? ORDER BY id LIMIT 1');
    const ins = db.prepare(`INSERT INTO pickup_requests(reference,customer_id,category_id,estimated_weight,address,area,city,status,qr_token,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    rows.slice(0,8).forEach((r,i)=>{
      const d=safeJson(r.data); const material=String(d.material||'Other').toLowerCase();
      const cat=catLookup.get(`%${material.split(' ')[0]}%`) || db.prepare("SELECT id FROM material_categories WHERE name='Other'").get();
      const rawStatus=String(d.status||'pending').toLowerCase();
      const status=config.pickupStatuses.includes(rawStatus)?rawStatus:(rawStatus==='completed'?'completed':'pending');
      ins.run(`RL-LEG-${String(r.id).padStart(5,'0')}`,customer.id,cat.id,Number(d.weight)||null,d.area||'Legacy pickup address',d.area||'', '',status,token(16),'Migrated from legacy ReLoop records');
    });
  }
}

function setting(key, fallback='') { const r=db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r?r.value:fallback; }
function setSetting(key,value,userId){
  db.prepare(`INSERT INTO settings(key,value,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).run(key,String(value),userId||null);
}

module.exports = { db, migrate, setting, setSetting, token, safeJson };
