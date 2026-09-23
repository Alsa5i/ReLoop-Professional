const express=require('express');
const {db,setting}=require('../db');
const {requireRole}=require('../security');
const {audit}=require('../services/audit');
const {paginate}=require('../services/pagination');
const {toMinor,fromMinor,validateAllocation}=require('../services/money');
const {notify}=require('../services/notifications');
const {getPickup,transitionPickup}=require('../services/pickups');
const router=express.Router();
router.use(requireRole('owner','admin'));

router.get('/users',(req,res)=>{
  const role=String(req.query.role||''),status=String(req.query.status||''),q=String(req.query.q||'').trim();
  let sql="SELECT id,name,email,phone,role,status,verification_status,created_at FROM users WHERE role IN ('collector','partner','customer')"; const ps=[];
  if(role&&['collector','partner','customer'].includes(role)){sql+=' AND role=?';ps.push(role)} if(status){sql+=' AND status=?';ps.push(status)} if(q){sql+=' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';ps.push(`%${q}%`,`%${q}%`,`%${q}%`)} sql+=' ORDER BY id DESC';
  const pages=paginate(req,db,sql,ps);res.render('admin/users',{rows:pages.rows,pages,filters:{role,status,q}});
});
router.post('/users/:id/status',(req,res)=>{
  const id=Number(req.params.id),target=db.prepare("SELECT * FROM users WHERE id=? AND role IN ('collector','partner','customer')").get(id); if(!target)return res.status(404).send('User not found or not manageable by Admin');
  const status=req.body.status==='active'?'active':'suspended'; db.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);if(status==='suspended')db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(id); notify(id,'Account status changed',`Your ReLoop account status is now ${status}.`,'/profile'); audit(req,'admin_user_status_changed','user',id,{status}); res.redirect('/admin/users');
});
router.get('/payments',(req,res)=>{
  const status=String(req.query.status||''); let sql=`SELECT p.*,pu.name payer_name,pr.reference pickup_reference,pr.status pickup_status FROM payments p LEFT JOIN users pu ON pu.id=p.payer_id LEFT JOIN pickup_requests pr ON pr.id=p.pickup_id`; const ps=[]; if(status){sql+=' WHERE p.status=?';ps.push(status)} sql+=' ORDER BY p.id DESC';
  const pages=paginate(req,db,sql,ps);res.render('admin/payments',{rows:pages.rows,pages,status,currency:setting('payment_currency','UGX')});
});
router.post('/payments/:id/verify',(req,res)=>{
  const p=db.prepare(`SELECT pay.*,pr.status pickup_status,pr.assigned_collector_id,pr.partner_id FROM payments pay LEFT JOIN pickup_requests pr ON pr.id=pay.pickup_id WHERE pay.id=?`).get(req.params.id); if(!p)return res.status(404).send('Payment not found');
  const status=String(req.body.status||'pending'); if(!['pending','paid','failed','cancelled','refunded'].includes(status))return res.status(400).send('Invalid payment status');
  const note=String(req.body.verification_note||'').trim().slice(0,800),providerRef=String(req.body.provider_reference||'').trim().slice(0,160),providerFee=Math.max(0,Number(req.body.payment_provider_fee||0)||0),collectorPayout=Math.max(0,Number(req.body.collector_payout||0)||0),partnerPayout=Math.max(0,Number(req.body.partner_payout||0)||0);
  if(status==='paid'&&!note)return res.status(400).send('A verification note is required before manually marking a payment as paid.');
  if(collectorPayout>0&&(!p.assigned_collector_id||p.pickup_status!=='completed'))return res.status(400).send('Collector payout requires a completed pickup with an assigned collector.');
  if(partnerPayout>0&&!p.partner_id)return res.status(400).send('Partner payout requires a recycling partner assigned to the pickup.');
  let feeMinor,collectorMinor,partnerMinor;
  try{feeMinor=toMinor(req.body.payment_provider_fee||'0');collectorMinor=toMinor(req.body.collector_payout||'0');partnerMinor=toMinor(req.body.partner_payout||'0');}catch(e){return res.status(400).send(e.message);}
  const grossMinor=Number(p.gross_minor)||toMinor(String(p.gross_value)),commissionMinor=Number(p.commission_minor)||toMinor(String(p.reloop_commission));
  if(!validateAllocation(grossMinor,commissionMinor,feeMinor,collectorMinor,partnerMinor))return res.status(400).send('Allocations exceed gross value.');
  db.prepare(`UPDATE payments SET status=?,provider_reference=?,payment_provider_fee=?,collector_payout=?,partner_payout=?,provider_fee_minor=?,collector_payout_minor=?,partner_payout_minor=?,notes=CASE WHEN ?!='' THEN COALESCE(notes,'')||' | Verification: '||? ELSE notes END,verified_by=CASE WHEN ?='paid' THEN ? ELSE verified_by END,verified_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE verified_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,providerRef,fromMinor(feeMinor),fromMinor(collectorMinor),fromMinor(partnerMinor),feeMinor,collectorMinor,partnerMinor,note,note,status,req.session.user.id,status,p.id);
  if(p.payer_id)notify(p.payer_id,'Payment update',`Payment ${p.reference} is now ${status}.`,'/customer'); audit(req,'admin_payment_reviewed','payment',p.id,{status,providerRef,providerFee,collectorPayout,partnerPayout}); res.redirect('/admin/payments');
});
router.get('/batches',(req,res)=>{
  const rows=db.prepare(`SELECT b.*,mc.name material_name,pp.business_name partner_name,(SELECT COUNT(*) FROM batch_pickups bp WHERE bp.batch_id=b.id) pickup_count FROM material_batches b JOIN material_categories mc ON mc.id=b.category_id LEFT JOIN partner_profiles pp ON pp.user_id=b.partner_id ORDER BY b.id DESC`).all();
  const categories=db.prepare('SELECT id,name FROM material_categories WHERE active=1 ORDER BY name').all(); const partners=db.prepare("SELECT u.id,pp.business_name FROM users u JOIN partner_profiles pp ON pp.user_id=u.id WHERE pp.verification_status='verified' AND u.status='active' ORDER BY pp.business_name").all();
  res.render('admin/batches',{rows,categories,partners});
});
router.post('/batches',(req,res)=>{
  const categoryId=Number(req.body.category_id),storage=String(req.body.storage_location||'').trim().slice(0,180),partnerId=Number(req.body.partner_id)||null; if(!db.prepare('SELECT id FROM material_categories WHERE id=?').get(categoryId))return res.status(400).send('Invalid material category');
  const code=`BATCH-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; const info=db.prepare('INSERT INTO material_batches(batch_code,category_id,storage_location,partner_id) VALUES(?,?,?,?)').run(code,categoryId,storage,partnerId); audit(req,'material_batch_created','material_batch',info.lastInsertRowid,{code}); res.redirect(`/admin/batches/${info.lastInsertRowid}`);
});
router.get('/batches/:id',(req,res)=>{
  const batch=db.prepare(`SELECT b.*,mc.name material_name,pp.business_name partner_name FROM material_batches b JOIN material_categories mc ON mc.id=b.category_id LEFT JOIN partner_profiles pp ON pp.user_id=b.partner_id WHERE b.id=?`).get(req.params.id); if(!batch)return res.status(404).send('Batch not found');
  const pickups=db.prepare(`SELECT bp.weight,p.id,p.reference,p.status,p.verified_weight,p.collected_weight,u.name customer_name FROM batch_pickups bp JOIN pickup_requests p ON p.id=bp.pickup_id JOIN users u ON u.id=p.customer_id WHERE bp.batch_id=? ORDER BY bp.rowid DESC`).all(batch.id);
  const eligible=db.prepare(`SELECT p.id,p.reference,COALESCE(p.verified_weight,p.collected_weight,0) weight,u.name customer_name FROM pickup_requests p JOIN users u ON u.id=p.customer_id WHERE p.category_id=? AND p.status IN ('verified','completed') AND NOT EXISTS(SELECT 1 FROM batch_pickups bp WHERE bp.pickup_id=p.id) AND COALESCE(p.verified_weight,p.collected_weight,0)>0 ORDER BY p.id DESC`).all(batch.category_id);
  const partners=db.prepare("SELECT u.id,pp.business_name FROM users u JOIN partner_profiles pp ON pp.user_id=u.id WHERE pp.verification_status='verified' AND u.status='active' ORDER BY pp.business_name").all(); res.render('admin/batch-detail',{batch,pickups,eligible,partners});
});
router.post('/batches/:id/add-pickup',(req,res)=>{
  const batch=db.prepare('SELECT * FROM material_batches WHERE id=?').get(req.params.id),pickup=db.prepare(`SELECT * FROM pickup_requests WHERE id=? AND status IN ('verified','completed')`).get(req.body.pickup_id); if(!batch||!pickup||pickup.category_id!==batch.category_id)return res.status(400).send('Pickup is not eligible for this batch'); const weight=Number(pickup.verified_weight||pickup.collected_weight||0); if(!(weight>0))return res.status(400).send('Pickup has no verified/collected weight');
  try{db.transaction(()=>{db.prepare('INSERT INTO batch_pickups(batch_id,pickup_id,weight) VALUES(?,?,?)').run(batch.id,pickup.id,weight);db.prepare('UPDATE material_batches SET total_weight=(SELECT COALESCE(SUM(weight),0) FROM batch_pickups WHERE batch_id=?) WHERE id=?').run(batch.id,batch.id);})()}catch(e){return res.status(409).send('Pickup is already assigned to a batch');} audit(req,'pickup_added_to_batch','material_batch',batch.id,{pickupId:pickup.id,weight}); res.redirect(`/admin/batches/${batch.id}`);
});
router.post('/batches/:id/update',(req,res)=>{
  const status=['collecting','stored','sorted','ready','reserved','dispatched','delivered','completed'].includes(req.body.status)?req.body.status:'collecting',partnerId=Number(req.body.partner_id)||null,storage=String(req.body.storage_location||'').trim().slice(0,180); db.prepare('UPDATE material_batches SET status=?,partner_id=?,storage_location=?,delivery_date=CASE WHEN ? IN (\'delivered\',\'completed\') THEN COALESCE(delivery_date,CURRENT_TIMESTAMP) ELSE delivery_date END WHERE id=?').run(status,partnerId,storage,status,req.params.id); audit(req,'material_batch_updated','material_batch',req.params.id,{status,partnerId}); res.redirect(`/admin/batches/${req.params.id}`);
});

router.get('/',(req,res)=>{
  const one=(sql,...p)=>Number(db.prepare(sql).get(...p)?.v||0);
  const metrics={
    pending:one("SELECT COUNT(*) v FROM pickup_requests WHERE status='pending'"),
    active:one("SELECT COUNT(*) v FROM pickup_requests WHERE status IN ('approved','assigned','accepted','en_route','arrived','collected','delivered','verified')"),
    completedToday:one("SELECT COUNT(*) v FROM pickup_requests WHERE status='completed' AND date(completed_at)=date('now')"),
    verifiedCollectors:one("SELECT COUNT(*) v FROM collector_profiles WHERE verification_status='verified'"),
    pendingCollectors:one("SELECT COUNT(*) v FROM collector_profiles WHERE verification_status='pending_verification'"),
    verifiedPartners:one("SELECT COUNT(*) v FROM partner_profiles WHERE verification_status='verified'"),
    pendingPartners:one("SELECT COUNT(*) v FROM partner_profiles WHERE verification_status='pending'"),
    customers:one("SELECT COUNT(*) v FROM users WHERE role='customer' AND status='active'"),
    weight:one("SELECT COALESCE(SUM(COALESCE(verified_weight,collected_weight,0)),0) v FROM pickup_requests WHERE status IN ('verified','completed')"),
    disputes:one("SELECT COUNT(*) v FROM disputes WHERE status IN ('open','investigating')"),
    support:one("SELECT COUNT(*) v FROM support_requests WHERE status='open'")
  };
  const recent=db.prepare(`SELECT p.id,p.reference,p.status,p.estimated_weight,p.updated_at,u.name customer_name,mc.name material_name FROM pickup_requests p JOIN users u ON u.id=p.customer_id LEFT JOIN material_categories mc ON mc.id=p.category_id ORDER BY p.id DESC LIMIT 10`).all();
  res.render('admin/dashboard',{metrics,recent});
});
router.get('/pickups',(req,res)=>{
  const status=String(req.query.status||''),q=String(req.query.q||'').trim();
  let sql=`SELECT p.*,u.name customer_name,mc.name material_name,c.name collector_name,pp.business_name partner_name FROM pickup_requests p JOIN users u ON u.id=p.customer_id LEFT JOIN material_categories mc ON mc.id=p.category_id LEFT JOIN users c ON c.id=p.assigned_collector_id LEFT JOIN partner_profiles pp ON pp.user_id=p.partner_id WHERE 1=1`; const ps=[];
  if(status){sql+=' AND p.status=?';ps.push(status)} if(q){sql+=' AND (p.reference LIKE ? OR u.name LIKE ? OR p.area LIKE ? OR mc.name LIKE ?)';ps.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)} sql+=' ORDER BY p.id DESC';
  const pages=paginate(req,db,sql,ps);res.render('admin/pickups',{rows:pages.rows,pages,filters:{status,q}});
});
router.get('/pickups/:id',(req,res)=>{
  const pickup=getPickup(req.params.id); if(!pickup)return res.status(404).render('common/error',{code:404,title:'Pickup not found',message:'The pickup does not exist.'});
  const history=db.prepare(`SELECT h.*,u.name changed_by_name FROM pickup_status_history h JOIN users u ON u.id=h.changed_by WHERE h.pickup_id=? ORDER BY h.id`).all(pickup.id);
  const collectors=db.prepare(`SELECT u.id,u.name,cp.service_area,cp.availability,cp.rating FROM users u JOIN collector_profiles cp ON cp.user_id=u.id WHERE u.status='active' AND cp.verification_status='verified' ORDER BY u.name`).all();
  const partners=db.prepare(`SELECT u.id,pp.business_name FROM users u JOIN partner_profiles pp ON pp.user_id=u.id WHERE u.status='active' AND pp.verification_status='verified' ORDER BY pp.business_name`).all();
  const proofs=db.prepare('SELECT id,proof_type,file_name,notes,created_at FROM collection_proofs WHERE pickup_id=? ORDER BY id DESC').all(pickup.id);
  res.render('admin/pickup-detail',{pickup,history,collectors,partners,proofs});
});
router.post('/pickups/:id/approve',(req,res)=>{try{const p=transitionPickup({pickupId:Number(req.params.id),toStatus:'approved',userId:req.session.user.id,notes:req.body.notes||''});audit(req,'pickup_approved','pickup',p.id);res.redirect(`/admin/pickups/${p.id}`);}catch(e){res.status(400).send(e.message)}});
router.post('/pickups/:id/assign',(req,res)=>{
  const collectorId=Number(req.body.collector_id),p=db.prepare('SELECT * FROM pickup_requests WHERE id=?').get(req.params.id); if(!p)return res.status(404).send('Pickup not found'); const cp=db.prepare("SELECT cp.* FROM collector_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=? AND cp.verification_status='verified' AND u.status='active'").get(collectorId); if(!cp)return res.status(400).send('Collector is not verified/active'); if(cp.availability!=='available'&&req.body.override_unavailable!=='1')return res.status(400).send('Collector is not currently available. Tick the Admin override box to assign deliberately.');
  try{const force=['approved','assigned'].includes(p.status);if(!force)return res.status(400).send('Pickup must be approved before assignment');db.transaction(()=>{db.prepare("UPDATE pickup_requests SET assigned_collector_id=?,status='assigned',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(collectorId,p.id);db.prepare('INSERT INTO pickup_status_history(pickup_id,previous_status,new_status,changed_by,notes) VALUES(?,?,?,?,?)').run(p.id,p.status,'assigned',req.session.user.id,'Assigned by administration');})();notify(collectorId,'New pickup assigned',`${p.reference} has been assigned to you.`,`/collector/pickups/${p.id}`);notify(p.customer_id,'Collector assigned',`A collector has been assigned to ${p.reference}.`,`/customer/pickups/${p.id}`);audit(req,'pickup_assigned','pickup',p.id,{collectorId});res.redirect(`/admin/pickups/${p.id}`);}catch(e){res.status(400).send(e.message)}
});
router.post('/pickups/:id/partner',(req,res)=>{const partnerId=Number(req.body.partner_id)||null;const p=db.prepare('SELECT * FROM pickup_requests WHERE id=?').get(req.params.id);if(!p)return res.status(404).send('Pickup not found');if(partnerId&&!db.prepare("SELECT 1 FROM partner_profiles pp JOIN users u ON u.id=pp.user_id WHERE pp.user_id=? AND pp.verification_status='verified' AND u.status='active'").get(partnerId))return res.status(400).send('Partner not verified/active');db.prepare('UPDATE pickup_requests SET partner_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(partnerId,p.id);if(partnerId)notify(partnerId,'Incoming material assigned',`${p.reference} is assigned to your facility.`,`/partner`);audit(req,'pickup_partner_set','pickup',p.id,{partnerId});res.redirect(`/admin/pickups/${p.id}`);});
router.post('/pickups/:id/verify',(req,res)=>{const weight=Number(req.body.verified_weight);if(!(weight>0))return res.status(400).send('Verified weight must be greater than zero');try{const p=transitionPickup({pickupId:Number(req.params.id),toStatus:'verified',userId:req.session.user.id,notes:req.body.verification_notes||'',extra:{verified_weight:weight,verifier_id:req.session.user.id,verification_notes:String(req.body.verification_notes||'').slice(0,1000)}});audit(req,'pickup_verified','pickup',p.id,{weight});res.redirect(`/admin/pickups/${p.id}`);}catch(e){res.status(400).send(e.message)}});
router.post('/pickups/:id/complete',(req,res)=>{try{const p=transitionPickup({pickupId:Number(req.params.id),toStatus:'completed',userId:req.session.user.id,notes:req.body.notes||''});audit(req,'pickup_completed','pickup',p.id);res.redirect(`/admin/pickups/${p.id}`);}catch(e){res.status(400).send(e.message)}});
router.post('/pickups/:id/cancel',(req,res)=>{try{const p=transitionPickup({pickupId:Number(req.params.id),toStatus:'cancelled',userId:req.session.user.id,notes:req.body.notes||'',force:false});audit(req,'pickup_cancelled','pickup',p.id);res.redirect(`/admin/pickups/${p.id}`);}catch(e){res.status(400).send(e.message)}});

router.get('/verifications',(req,res)=>{
  const collectors=db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.status,u.created_at,cp.* FROM users u JOIN collector_profiles cp ON cp.user_id=u.id WHERE cp.verification_status!='verified' ORDER BY u.id DESC`).all();
  const partners=db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.status,u.created_at,pp.* FROM users u JOIN partner_profiles pp ON pp.user_id=u.id WHERE pp.verification_status!='verified' ORDER BY u.id DESC`).all();
  res.render('admin/verifications',{collectors,partners});
});
router.post('/verifications/:id',(req,res)=>{const id=Number(req.params.id),u=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!u||!['collector','partner'].includes(u.role))return res.status(400).send('Invalid verification target');const state=req.body.state==='rejected'?'rejected':'verified';db.prepare('UPDATE users SET verification_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(state,id);if(u.role==='collector')db.prepare('UPDATE collector_profiles SET verification_status=? WHERE user_id=?').run(state==='verified'?'verified':'rejected',id);else db.prepare('UPDATE partner_profiles SET verification_status=? WHERE user_id=?').run(state,id);notify(id,'Verification update',`Your ReLoop ${u.role} verification is now ${state}.`,'/profile');audit(req,'verification_reviewed','user',id,{state});res.redirect('/admin/verifications');});

router.get('/materials',(req,res)=>res.render('admin/materials',{rows:db.prepare('SELECT * FROM material_categories ORDER BY name').all()}));
router.post('/materials',(req,res)=>{const name=String(req.body.name||'').trim().slice(0,100),description=String(req.body.description||'').trim().slice(0,500),unit=String(req.body.unit||'kg').trim().slice(0,30),reward=req.body.indicative_reward===''?null:Number(req.body.indicative_reward);if(!name)return res.status(400).send('Name required');db.prepare('INSERT INTO material_categories(name,description,unit,indicative_reward) VALUES(?,?,?,?)').run(name,description,unit,Number.isFinite(reward)?reward:null);audit(req,'material_created','material_category',name);res.redirect('/admin/materials');});
router.post('/materials/:id/toggle',(req,res)=>{db.prepare('UPDATE material_categories SET active=CASE active WHEN 1 THEN 0 ELSE 1 END,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);audit(req,'material_toggled','material_category',req.params.id);res.redirect('/admin/materials');});
router.get('/zones',(req,res)=>res.render('admin/zones',{rows:db.prepare('SELECT * FROM service_zones ORDER BY city,name').all(),currency:setting('payment_currency','UGX')}));
router.post('/zones',(req,res)=>{const name=String(req.body.name||'').trim().slice(0,120),city=String(req.body.city||'').trim().slice(0,120),fee=Number(req.body.pickup_fee||0),eta=String(req.body.estimated_service_time||'').trim().slice(0,120);if(!name||!city)return res.status(400).send('Name and city required');db.prepare('INSERT INTO service_zones(name,city,pickup_fee,estimated_service_time) VALUES(?,?,?,?)').run(name,city,Math.max(0,fee||0),eta);audit(req,'service_zone_created','service_zone',name);res.redirect('/admin/zones');});
router.post('/zones/:id/toggle',(req,res)=>{db.prepare('UPDATE service_zones SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?').run(req.params.id);res.redirect('/admin/zones');});

router.get('/disputes',(req,res)=>res.render('admin/disputes',{rows:db.prepare(`SELECT d.*,u.name opened_by_name,p.reference pickup_reference FROM disputes d JOIN users u ON u.id=d.opened_by LEFT JOIN pickup_requests p ON p.id=d.pickup_id ORDER BY d.id DESC`).all()}));
router.post('/disputes/:id',(req,res)=>{const row=db.prepare('SELECT * FROM disputes WHERE id=?').get(req.params.id);if(!row)return res.status(404).send('Dispute not found');const status=['open','investigating','resolved','rejected'].includes(req.body.status)?req.body.status:'investigating';const resolution=String(req.body.resolution||'').slice(0,2000);db.prepare('UPDATE disputes SET status=?,resolution=?,resolved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,resolution,['resolved','rejected'].includes(status)?req.session.user.id:null,row.id);notify(row.opened_by,'Dispute update',`Your dispute is now ${status}.`,'/customer');audit(req,'dispute_updated','dispute',row.id,{status});res.redirect('/admin/disputes');});
router.get('/support',(req,res)=>res.render('admin/support',{rows:db.prepare(`SELECT s.*,u.name user_name FROM support_requests s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.id DESC`).all()}));
router.post('/support/:id/status',(req,res)=>{const row=db.prepare('SELECT * FROM support_requests WHERE id=?').get(req.params.id);if(!row)return res.status(404).send('Support request not found');const status=['open','in_progress','resolved'].includes(req.body.status)?req.body.status:'in_progress';db.prepare('UPDATE support_requests SET status=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,req.session.user.id,row.id);db.prepare('INSERT INTO support_events(ticket_id,user_id,status,notes) VALUES(?,?,?,?)').run(row.id,req.session.user.id,status,String(req.body.notes||'').slice(0,800));if(row.user_id)notify(row.user_id,'Support request update',`Your support request is now ${status}.`,'/notifications');audit(req,'support_updated','support_request',row.id,{status});res.redirect('/admin/support');});
router.get('/safety',(req,res)=>res.render('admin/safety',{rows:db.prepare(`SELECT r.*,u.name reporter_name,t.name reported_name,p.reference pickup_reference FROM safety_reports r JOIN users u ON u.id=r.reporter_id LEFT JOIN users t ON t.id=r.reported_user_id LEFT JOIN pickup_requests p ON p.id=r.pickup_id ORDER BY r.id DESC`).all()}));
router.post('/safety/:id/status',(req,res)=>{const row=db.prepare('SELECT * FROM safety_reports WHERE id=?').get(req.params.id);if(!row)return res.status(404).send('Safety report not found');const status=['open','investigating','resolved','rejected'].includes(req.body.status)?req.body.status:'investigating';db.prepare('UPDATE safety_reports SET status=?,handled_by=? WHERE id=?').run(status,req.session.user.id,row.id);notify(row.reporter_id,'Safety report update',`Your report is now ${status}.`,'/notifications');audit(req,'safety_report_updated','safety_report',row.id,{status});res.redirect('/admin/safety');});

router.get('/reports',(req,res)=>{
  const from=String(req.query.from||''),to=String(req.query.to||''),status=String(req.query.status||''),material=String(req.query.material||''); let where=' WHERE 1=1';const ps=[];
  if(from){where+=' AND date(p.requested_at)>=date(?)';ps.push(from)}if(to){where+=' AND date(p.requested_at)<=date(?)';ps.push(to)}if(status){where+=' AND p.status=?';ps.push(status)}if(material){where+=' AND p.category_id=?';ps.push(material)}
  const rows=db.prepare(`SELECT p.reference,p.status,p.estimated_weight,p.collected_weight,p.verified_weight,p.area,p.city,p.requested_at,u.name customer_name,mc.name material_name,c.name collector_name,pp.business_name partner_name FROM pickup_requests p JOIN users u ON u.id=p.customer_id LEFT JOIN material_categories mc ON mc.id=p.category_id LEFT JOIN users c ON c.id=p.assigned_collector_id LEFT JOIN partner_profiles pp ON pp.user_id=p.partner_id ${where} ORDER BY p.id DESC`).all(...ps);
  const categories=db.prepare('SELECT id,name FROM material_categories ORDER BY name').all(); res.render('admin/reports',{rows,categories,filters:{from,to,status,material}});
});
router.get('/reports/pickups.csv',(req,res)=>{
  const rows=db.prepare(`SELECT p.reference,p.status,mc.name material,p.estimated_weight,p.collected_weight,p.verified_weight,p.area,p.city,p.requested_at FROM pickup_requests p LEFT JOIN material_categories mc ON mc.id=p.category_id ORDER BY p.id DESC`).all(); const headers=['reference','status','material','estimated_weight','collected_weight','verified_weight','area','city','requested_at']; const esc=v=>`"${String(v??'').replaceAll('"','""')}"`; const csv=[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');res.type('text/csv').set('Content-Disposition','attachment; filename="reloop-pickups.csv"').send(csv);
});
router.get('/content',(req,res)=>{
 const rows=db.prepare('SELECT * FROM public_content ORDER BY content_key LIMIT 100').all();res.render('admin/content',{rows});
});
router.post('/content',(req,res)=>{
 const key=String(req.body.content_key||'').trim().toLowerCase(),title=String(req.body.title||'').trim().slice(0,150),body=String(req.body.body||'').trim().slice(0,10000);
 if(!/^[a-z][a-z0-9_]{1,60}$/.test(key)||!title||!body)return res.status(400).send('Invalid content.');
 db.prepare(`INSERT INTO public_content(content_key,title,body,updated_by) VALUES(?,?,?,?) ON CONFLICT(content_key) DO UPDATE SET title=excluded.title,body=excluded.body,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).run(key,title,body,req.session.user.id);
 audit(req,'public_content_updated','public_content',key);res.redirect('/admin/content');
});
router.get('/campaigns',(req,res)=>{
 const rows=db.prepare(`SELECT c.*,COALESCE((SELECT SUM(p.verified_weight) FROM campaign_pickups cp JOIN pickup_requests p ON p.id=cp.pickup_id WHERE cp.campaign_id=c.id AND p.status IN ('verified','completed')),0) collected_kg FROM recycling_campaigns c ORDER BY c.id DESC LIMIT 100`).all();
 res.render('admin/campaigns',{rows,categories:db.prepare('SELECT id,name FROM material_categories WHERE active=1').all(),pickups:db.prepare("SELECT id,reference,category_id,verified_weight FROM pickup_requests WHERE status IN ('verified','completed') AND verified_weight>0 AND id NOT IN (SELECT pickup_id FROM campaign_pickups) ORDER BY id DESC LIMIT 100").all()});
});
router.post('/campaigns',(req,res)=>{
 const title=String(req.body.title||'').trim().slice(0,150),sponsor=String(req.body.sponsor||'').trim().slice(0,160),target=Number(req.body.target_kg),cat=Number(req.body.category_id)||null;
 if(!title||!(target>0)||!Number.isFinite(target))return res.status(400).send('Campaign title and target required.');
 const info=db.prepare('INSERT INTO recycling_campaigns(title,sponsor,description,location,category_id,target_kg,starts_at,ends_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)').run(title,sponsor,String(req.body.description||'').slice(0,1500),String(req.body.location||'').slice(0,180),cat,target,String(req.body.starts_at||'')||null,String(req.body.ends_at||'')||null,req.session.user.id);
 audit(req,'campaign_created','campaign',info.lastInsertRowid);res.redirect('/admin/campaigns');
});
router.post('/campaigns/:id/pickups',(req,res)=>{
 const campaign=db.prepare('SELECT * FROM recycling_campaigns WHERE id=?').get(req.params.id),pickup=db.prepare("SELECT * FROM pickup_requests WHERE id=? AND status IN ('verified','completed') AND verified_weight>0").get(req.body.pickup_id);
 if(!campaign||!pickup||campaign.category_id&&pickup.category_id!==campaign.category_id)return res.status(400).send('Ineligible pickup.');
 try{db.prepare('INSERT INTO campaign_pickups(campaign_id,pickup_id) VALUES(?,?)').run(campaign.id,pickup.id);}catch{return res.status(409).send('Pickup already belongs to a campaign.');}
 audit(req,'campaign_pickup_attributed','campaign',campaign.id,{pickupId:pickup.id});res.redirect('/admin/campaigns');
});
router.post('/support/:id/escalate',(req,res)=>{
 const row=db.prepare('SELECT id FROM support_requests WHERE id=?').get(req.params.id);if(!row)return res.sendStatus(404);
 db.prepare('UPDATE support_requests SET escalated=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(row.id);audit(req,'support_escalated','support_request',row.id);res.redirect('/admin/support');
});
module.exports=router;
