const express=require('express');
const bcrypt=require('bcryptjs');
const {db,setting,setSetting}=require('../db');
const {requireOwner}=require('../security');
const {audit}=require('../services/audit');
const {paginate}=require('../services/pagination');
const {toMinor,fromMinor,validateAllocation}=require('../services/money');
const {notify}=require('../services/notifications');
const router=express.Router();
router.use(requireOwner);
function safeReturn(value,fallback='/owner/users'){const v=String(value||'');return (v.startsWith('/owner')||v.startsWith('/admin'))?v:fallback;}

function ownerMetrics(){
  const one=(sql,...p)=>Number(db.prepare(sql).get(...p)?.v||0);
  const users=one('SELECT COUNT(*) v FROM users');
  const newUsers=one("SELECT COUNT(*) v FROM users WHERE datetime(created_at)>=datetime('now','-30 day')");
  const customers=one("SELECT COUNT(*) v FROM users WHERE role='customer' AND status='active'");
  const activeCollectors=one("SELECT COUNT(*) v FROM collector_profiles cp JOIN users u ON u.id=cp.user_id WHERE u.status='active' AND cp.verification_status='verified'");
  const partners=one("SELECT COUNT(*) v FROM partner_profiles pp JOIN users u ON u.id=pp.user_id WHERE u.status='active' AND pp.verification_status='verified'");
  const completed=one("SELECT COUNT(*) v FROM pickup_requests WHERE status='completed'");
  const volume=one("SELECT COALESCE(SUM(COALESCE(verified_weight,collected_weight,0)),0) v FROM pickup_requests WHERE status IN ('verified','completed')");
  const gmv=one("SELECT COALESCE(SUM(gross_value),0) v FROM payments WHERE status='paid'");
  const revenue=one("SELECT COALESCE(SUM(reloop_commission),0) v FROM payments WHERE status='paid'");
  const payouts=one("SELECT COALESCE(SUM(collector_payout+partner_payout),0) v FROM payments WHERE status='paid'");
  const providerFees=one("SELECT COALESCE(SUM(payment_provider_fee),0) v FROM payments WHERE status='paid'");
  const pendingPayments=one("SELECT COUNT(*) v FROM payments WHERE status='pending'");
  const disputes=one("SELECT COUNT(*) v FROM disputes WHERE status IN ('open','investigating')");
  const monthRevenue=one("SELECT COALESCE(SUM(reloop_commission),0) v FROM payments WHERE status='paid' AND strftime('%Y-%m',verified_at)=strftime('%Y-%m','now')");
  const monthExpenses=one("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE strftime('%Y-%m',expense_date)=strftime('%Y-%m','now')");
  const monthProviderFees=one("SELECT COALESCE(SUM(payment_provider_fee),0) v FROM payments WHERE status='paid' AND strftime('%Y-%m',verified_at)=strftime('%Y-%m','now')");
  return {users,newUsers,customers,activeCollectors,partners,completed,volume,gmv,revenue,payouts,providerFees,pendingPayments,disputes,monthRevenue,monthExpenses,monthProviderFees,net:monthRevenue-monthProviderFees-monthExpenses};
}
router.get('/',(req,res)=>{
  const metrics=ownerMetrics();
  const monthly=db.prepare(`SELECT strftime('%Y-%m',COALESCE(verified_at,created_at)) month,
      SUM(CASE WHEN status='paid' THEN gross_value ELSE 0 END) gmv,
      SUM(CASE WHEN status='paid' THEN reloop_commission ELSE 0 END) revenue
      FROM payments GROUP BY month ORDER BY month DESC LIMIT 6`).all().reverse();
  const recent=db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 12').all();
  res.render('owner/dashboard',{metrics,monthly,recent,currency:setting('payment_currency','UGX')});
});
router.get('/users',(req,res)=>{
  const role=String(req.query.role||''),status=String(req.query.status||''),q=String(req.query.q||'').trim();
  let sql='SELECT id,name,email,phone,role,status,verification_status,created_at FROM users WHERE 1=1'; const p=[];
  if(role){sql+=' AND role=?';p.push(role)} if(status){sql+=' AND status=?';p.push(status)} if(q){sql+=' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';p.push(`%${q}%`,`%${q}%`,`%${q}%`)} sql+=' ORDER BY id DESC';
  const pages=paginate(req,db,sql,p);res.render('owner/users',{rows:pages.rows,pages,filters:{role,status,q}});
});
router.get('/admins',(req,res)=>res.render('owner/admins',{rows:db.prepare("SELECT id,name,email,status,created_at FROM users WHERE role='admin' ORDER BY id DESC").all(),error:null}));
router.post('/admins',async(req,res)=>{
  const name=String(req.body.name||'').trim().slice(0,120),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(name.length<2||!email.includes('@')||password.length<12) return res.status(400).render('owner/admins',{rows:db.prepare("SELECT id,name,email,status,created_at FROM users WHERE role='admin' ORDER BY id DESC").all(),error:'Enter the Admin name, a valid email, and a unique password of at least 12 characters.'});
  if(password!==String(req.body.password_confirmation||''))return res.status(400).render('owner/admins',{rows:db.prepare("SELECT id,name,email,status,created_at FROM users WHERE role='admin' ORDER BY id DESC").all(),error:'The Admin passwords do not match.'});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).render('owner/admins',{rows:db.prepare("SELECT id,name,email,status,created_at FROM users WHERE role='admin' ORDER BY id DESC").all(),error:'Email already exists.'});
  const hash=await bcrypt.hash(password,12); const info=db.prepare("INSERT INTO users(name,email,password,role,status,verification_status) VALUES(?,?,?,'admin','active','verified')").run(name,email,hash); audit(req,'admin_created','user',info.lastInsertRowid); res.redirect('/owner/admins');
});
router.post('/users/:id/status',(req,res)=>{
  const id=Number(req.params.id),target=db.prepare('SELECT * FROM users WHERE id=?').get(id); if(!target)return res.status(404).send('User not found'); if(target.role==='owner')return res.status(403).send('Owner account cannot be suspended here');
  const status=['active','suspended'].includes(req.body.status)?req.body.status:'suspended'; db.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);if(status==='suspended')db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(id); audit(req,'user_status_changed','user',id,{status}); notify(id,'Account status changed',`Your ReLoop account status is now ${status}.`,'/profile'); res.redirect(safeReturn(req.body.return_to));
});
router.post('/users/:id/verify',(req,res)=>{
  const id=Number(req.params.id),u=db.prepare('SELECT * FROM users WHERE id=?').get(id); if(!u||u.role==='owner')return res.status(400).send('Invalid user');
  const state=req.body.state==='rejected'?'rejected':'verified'; db.prepare('UPDATE users SET verification_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(state,id);
  if(u.role==='collector')db.prepare('UPDATE collector_profiles SET verification_status=? WHERE user_id=?').run(state==='verified'?'verified':'rejected',id);
  if(u.role==='partner')db.prepare('UPDATE partner_profiles SET verification_status=? WHERE user_id=?').run(state==='verified'?'verified':'rejected',id);
  audit(req,'user_verification_changed','user',id,{state}); notify(id,'Verification update',`Your ReLoop verification status is now ${state}.`,'/profile'); res.redirect(safeReturn(req.body.return_to));
});
router.get('/settings',(req,res)=>{
  const rows=db.prepare('SELECT * FROM settings ORDER BY key').all(); res.render('owner/settings',{settings:Object.fromEntries(rows.map(r=>[r.key,r.value])),saved:req.query.saved==='1'});
});
router.post('/settings',(req,res)=>{
  const pct=Math.min(100,Math.max(0,Number(req.body.commission_percentage||0)||0));
  const fixed=Math.max(0,Number(req.body.commission_fixed_fee||0)||0),minimum=Math.max(0,Number(req.body.commission_minimum_fee||0)||0),factor=Math.max(0,Number(req.body.impact_co2_factor_per_kg||0)||0);
  const currency=String(req.body.payment_currency||'UGX').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,8)||'UGX';
  const support=String(req.body.platform_support_email||'').trim().toLowerCase().slice(0,200),impactNote=String(req.body.impact_note||'').trim().slice(0,1000);
  setSetting('commission_percentage',pct,req.session.user.id);setSetting('commission_fixed_fee',fixed,req.session.user.id);setSetting('commission_minimum_fee',minimum,req.session.user.id);setSetting('payment_currency',currency,req.session.user.id);setSetting('payment_mode','manual_verification',req.session.user.id);setSetting('platform_support_email',support,req.session.user.id);setSetting('impact_co2_factor_per_kg',factor,req.session.user.id);setSetting('impact_note',impactNote,req.session.user.id);
  audit(req,'platform_settings_updated','settings','platform',{pct,fixed,minimum,currency,factor}); res.redirect('/owner/settings?saved=1');
});
router.get('/payments',(req,res)=>{
  const status=String(req.query.status||''); let sql=`SELECT p.*,pu.name payer_name,pe.name payee_name,pr.reference pickup_reference FROM payments p LEFT JOIN users pu ON pu.id=p.payer_id LEFT JOIN users pe ON pe.id=p.payee_id LEFT JOIN pickup_requests pr ON pr.id=p.pickup_id`; const ps=[]; if(status){sql+=' WHERE p.status=?';ps.push(status)} sql+=' ORDER BY p.id DESC'; const pages=paginate(req,db,sql,ps);res.render('owner/payments',{rows:pages.rows,pages,status,currency:setting('payment_currency','UGX')});
});
router.post('/payments/:id/status',(req,res)=>{
  const payment=db.prepare(`SELECT pay.*,pr.status pickup_status,pr.assigned_collector_id,pr.partner_id FROM payments pay LEFT JOIN pickup_requests pr ON pr.id=pay.pickup_id WHERE pay.id=?`).get(req.params.id); if(!payment)return res.status(404).send('Payment not found');
  const status=String(req.body.status||'pending'); if(!['paid','failed','cancelled','refunded','pending'].includes(status))return res.status(400).send('Invalid status');
  const note=String(req.body.verification_note||'').trim().slice(0,800),providerRef=String(req.body.provider_reference||'').trim().slice(0,160),providerFee=Math.max(0,Number(req.body.payment_provider_fee||0)||0),collectorPayout=Math.max(0,Number(req.body.collector_payout||0)||0),partnerPayout=Math.max(0,Number(req.body.partner_payout||0)||0);
  if(status==='paid'&&!note)return res.status(400).send('A verification note is required before manually marking a payment as paid.');
  if(collectorPayout>0&&(!payment.assigned_collector_id||payment.pickup_status!=='completed'))return res.status(400).send('Collector payout requires a completed pickup with an assigned collector.');
  if(partnerPayout>0&&!payment.partner_id)return res.status(400).send('Partner payout requires a recycling partner assigned to the pickup.');
  let feeMinor,collectorMinor,partnerMinor;
  try{feeMinor=toMinor(req.body.payment_provider_fee||'0');collectorMinor=toMinor(req.body.collector_payout||'0');partnerMinor=toMinor(req.body.partner_payout||'0');}catch(e){return res.status(400).send(e.message);}
  const grossMinor=Number(payment.gross_minor)||toMinor(String(payment.gross_value)),commissionMinor=Number(payment.commission_minor)||toMinor(String(payment.reloop_commission));
  if(!validateAllocation(grossMinor,commissionMinor,feeMinor,collectorMinor,partnerMinor))return res.status(400).send('Allocations exceed gross value.');
  db.prepare(`UPDATE payments SET status=?,provider_reference=?,payment_provider_fee=?,collector_payout=?,partner_payout=?,provider_fee_minor=?,collector_payout_minor=?,partner_payout_minor=?,notes=CASE WHEN ?!='' THEN COALESCE(notes,'')||' | Verification: '||? ELSE notes END,verified_by=CASE WHEN ?='paid' THEN ? ELSE verified_by END,verified_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE verified_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,providerRef,fromMinor(feeMinor),fromMinor(collectorMinor),fromMinor(partnerMinor),feeMinor,collectorMinor,partnerMinor,note,note,status,req.session.user.id,status,payment.id);
  audit(req,'payment_status_changed','payment',payment.id,{status,providerRef,providerFee,collectorPayout,partnerPayout}); if(payment.payer_id)notify(payment.payer_id,'Payment update',`Payment ${payment.reference} is now ${status}.`,'/customer'); res.redirect('/owner/payments');
});
router.get('/expenses',(req,res)=>res.render('owner/expenses',{rows:db.prepare('SELECT e.*,u.name created_by_name FROM expenses e JOIN users u ON u.id=e.created_by ORDER BY expense_date DESC,id DESC').all(),currency:setting('payment_currency','UGX')}));
router.post('/expenses',(req,res)=>{
  const category=String(req.body.category||'other').slice(0,80),amount=Number(req.body.amount||0),description=String(req.body.description||'').slice(0,500),date=String(req.body.expense_date||new Date().toISOString().slice(0,10)); if(!(amount>0))return res.status(400).send('Amount must be greater than zero'); const info=db.prepare('INSERT INTO expenses(category,amount,description,expense_date,created_by) VALUES(?,?,?,?,?)').run(category,amount,description,date,req.session.user.id); audit(req,'expense_created','expense',info.lastInsertRowid,{amount,category}); res.redirect('/owner/expenses');
});

router.get('/staff-performance',(req,res)=>{
  const rows=db.prepare(`SELECT u.id,u.name,u.email,
    SUM(CASE WHEN a.action IN ('pickup_approved','pickup_assigned','pickup_completed') THEN 1 ELSE 0 END) pickup_actions,
    SUM(CASE WHEN a.action='verification_reviewed' THEN 1 ELSE 0 END) verifications,
    SUM(CASE WHEN a.action='dispute_updated' THEN 1 ELSE 0 END) disputes,
    SUM(CASE WHEN a.action='support_updated' THEN 1 ELSE 0 END) support_actions,
    COUNT(a.id) total_actions
    FROM users u LEFT JOIN audit_logs a ON a.user_id=u.id AND datetime(a.created_at)>=datetime('now','-30 day')
    WHERE u.role='admin' GROUP BY u.id ORDER BY total_actions DESC,u.name`).all();
  res.render('owner/staff-performance',{rows});
});
router.get('/audit',(req,res)=>{const pages=paginate(req,db,`SELECT a.*,u.name user_name,u.role FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC`);res.render('owner/audit',{rows:pages.rows,pages});});
router.get('/announcements',(req,res)=>res.render('owner/announcements',{rows:db.prepare('SELECT a.*,u.name created_by_name FROM announcements a JOIN users u ON u.id=a.created_by ORDER BY a.id DESC').all()}));
router.post('/announcements',(req,res)=>{const title=String(req.body.title||'').trim().slice(0,160),body=String(req.body.body||'').trim().slice(0,2000);if(!title||!body)return res.status(400).send('Title and body are required');const info=db.prepare('INSERT INTO announcements(title,body,created_by) VALUES(?,?,?)').run(title,body,req.session.user.id);audit(req,'announcement_created','announcement',info.lastInsertRowid);res.redirect('/owner/announcements');});
router.post('/announcements/:id/toggle',(req,res)=>{db.prepare('UPDATE announcements SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?').run(req.params.id);audit(req,'announcement_toggled','announcement',req.params.id);res.redirect('/owner/announcements');});
router.get('/support',(req,res)=>{
 const rows=db.prepare('SELECT * FROM support_requests WHERE escalated=1 ORDER BY id DESC LIMIT 100').all();res.render('admin/support',{rows});
});
router.post('/backup',async(req,res)=>{
 const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
 const target=path.join(os.tmpdir(),'reloop-backup-'+crypto.randomBytes(12).toString('hex')+'.db');
 try{
  await db.backup(target);audit(req,'BACKUP_CREATED','database','manual');
  res.download(target,'ReLoop_SQLite_Backup.db',()=>fs.promises.unlink(target).catch(()=>{}));
 }catch(e){await fs.promises.unlink(target).catch(()=>{});res.status(500).send('Backup could not be generated.');}
});
module.exports=router;
