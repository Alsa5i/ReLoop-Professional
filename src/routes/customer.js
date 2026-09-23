const express=require('express');
const {db,setting,token}=require('../db');
const {requireRole}=require('../security');
const {audit}=require('../services/audit');
const {notifyRole}=require('../services/notifications');
const {makeReference,getPickup,transitionPickup,recalcCollectorRating}=require('../services/pickups');
const router=express.Router();
router.use(requireRole('customer'));

router.get('/',(req,res)=>{
  const id=req.session.user.id;
  const metrics={
    recycled:Number(db.prepare("SELECT COALESCE(SUM(COALESCE(verified_weight,collected_weight,0)),0) v FROM pickup_requests WHERE customer_id=? AND status IN ('verified','completed')").get(id).v||0),
    completed:db.prepare("SELECT COUNT(*) c FROM pickup_requests WHERE customer_id=? AND status='completed'").get(id).c,
    active:db.prepare("SELECT COUNT(*) c FROM pickup_requests WHERE customer_id=? AND status NOT IN ('completed','cancelled')").get(id).c,
    rewards:Number(db.prepare("SELECT COALESCE(SUM(indicative_reward*COALESCE(p.verified_weight,p.collected_weight,0)),0) v FROM pickup_requests p JOIN material_categories mc ON mc.id=p.category_id WHERE p.customer_id=? AND p.status IN ('verified','completed') AND mc.indicative_reward IS NOT NULL").get(id).v||0)
  };
  const rows=db.prepare(`SELECT p.*,mc.name material_name,c.name collector_name FROM pickup_requests p LEFT JOIN material_categories mc ON mc.id=p.category_id LEFT JOIN users c ON c.id=p.assigned_collector_id WHERE p.customer_id=? ORDER BY p.id DESC LIMIT 8`).all(id);
  const factor=Number(setting('impact_co2_factor_per_kg','0'))||0;
  res.render('customer/dashboard',{metrics,rows,estimatedCo2:factor>0?metrics.recycled*factor:null,currency:setting('payment_currency','UGX')});
});
router.get('/pickups/new',(req,res)=>{
  const categories=db.prepare('SELECT * FROM material_categories WHERE active=1 ORDER BY name').all(); const zones=db.prepare('SELECT * FROM service_zones WHERE active=1 ORDER BY city,name').all(); res.render('customer/pickup-new',{categories,zones,error:null});
});
router.post('/pickups',(req,res)=>{
  const categoryId=Number(req.body.category_id),estimated=Number(req.body.estimated_weight),address=String(req.body.address||'').trim().slice(0,300),area=String(req.body.area||'').trim().slice(0,120),city=String(req.body.city||'').trim().slice(0,120),landmark=String(req.body.landmark||'').trim().slice(0,200),preferred=String(req.body.preferred_time||'').trim().slice(0,80),notes=String(req.body.notes||'').trim().slice(0,1500),lat=req.body.latitude?Number(req.body.latitude):null,lng=req.body.longitude?Number(req.body.longitude):null;
  if(!db.prepare('SELECT id FROM material_categories WHERE id=? AND active=1').get(categoryId)||!address||!(estimated>0)){
    const categories=db.prepare('SELECT * FROM material_categories WHERE active=1 ORDER BY name').all(),zones=db.prepare('SELECT * FROM service_zones WHERE active=1 ORDER BY city,name').all();return res.status(400).render('customer/pickup-new',{categories,zones,error:'Choose a material, enter an estimated weight above 0, and provide a pickup address.'});
  }
  const reference=makeReference(),qrToken=token(18);const info=db.prepare(`INSERT INTO pickup_requests(reference,customer_id,category_id,estimated_weight,address,area,city,landmark,latitude,longitude,preferred_time,notes,qr_token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(reference,req.session.user.id,categoryId,estimated,address,area,city,landmark,Number.isFinite(lat)?lat:null,Number.isFinite(lng)?lng:null,preferred,notes,qrToken);const id=Number(info.lastInsertRowid);db.prepare("INSERT INTO pickup_status_history(pickup_id,previous_status,new_status,changed_by,notes) VALUES(?,NULL,'pending',?,'Customer submitted pickup request')").run(id,req.session.user.id);notifyRole('admin','New pickup request',`${reference} is waiting for review.`,`/admin/pickups/${id}`);notifyRole('owner','New pickup request',`${reference} is waiting for review.`,`/admin/pickups/${id}`);audit(req,'pickup_created','pickup',id,{reference});res.redirect(`/customer/pickups/${id}`);
});
router.get('/pickups/:id',(req,res)=>{
  const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id)return res.status(404).render('common/error',{code:404,title:'Pickup not found',message:'This pickup is not available in your account.'});const history=db.prepare(`SELECT h.*,u.name changed_by_name FROM pickup_status_history h JOIN users u ON u.id=h.changed_by WHERE h.pickup_id=? ORDER BY h.id`).all(pickup.id);const rating=db.prepare('SELECT * FROM ratings WHERE pickup_id=?').get(pickup.id);const payments=db.prepare('SELECT * FROM payments WHERE pickup_id=? AND payer_id=? ORDER BY id DESC').all(pickup.id,req.session.user.id);res.render('customer/pickup-detail',{pickup,history,rating,payments,currency:setting('payment_currency','UGX')});
});
router.post('/pickups/:id/cancel',(req,res)=>{const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id)return res.status(404).send('Pickup not found');if(!['pending','approved','assigned'].includes(pickup.status))return res.status(400).send('This pickup can no longer be cancelled online. Contact support.');try{transitionPickup({pickupId:pickup.id,toStatus:'cancelled',userId:req.session.user.id,notes:String(req.body.notes||'Customer cancelled').slice(0,500)});audit(req,'pickup_cancelled_by_customer','pickup',pickup.id);res.redirect(`/customer/pickups/${pickup.id}`);}catch(e){res.status(400).send(e.message)}});
router.post('/pickups/:id/rate',(req,res)=>{const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id||pickup.status!=='completed'||!pickup.assigned_collector_id)return res.status(400).send('Only completed pickups with an assigned collector can be rated.');const stars=Number(req.body.stars),review=String(req.body.review||'').trim().slice(0,800);if(!Number.isInteger(stars)||stars<1||stars>5)return res.status(400).send('Rating must be 1 to 5.');try{db.prepare('INSERT INTO ratings(pickup_id,customer_id,collector_id,stars,review) VALUES(?,?,?,?,?)').run(pickup.id,req.session.user.id,pickup.assigned_collector_id,stars,review);recalcCollectorRating(pickup.assigned_collector_id);audit(req,'collector_rated','pickup',pickup.id,{stars});res.redirect(`/customer/pickups/${pickup.id}`);}catch(e){res.status(409).send('This pickup has already been rated.')}});
router.post('/pickups/:id/dispute',(req,res)=>{const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id)return res.status(404).send('Pickup not found');const category=String(req.body.category||'pickup issue').slice(0,80),description=String(req.body.description||'').trim().slice(0,2000);if(!description)return res.status(400).send('Describe the problem.');const info=db.prepare('INSERT INTO disputes(pickup_id,opened_by,category,description) VALUES(?,?,?,?)').run(pickup.id,req.session.user.id,category,description);notifyRole('admin','New dispute',`A dispute was opened for ${pickup.reference}.`,'/admin/disputes');notifyRole('owner','New dispute',`A dispute was opened for ${pickup.reference}.`,'/admin/disputes');audit(req,'dispute_created','dispute',info.lastInsertRowid);res.redirect(`/customer/pickups/${pickup.id}`);});
router.post('/pickups/:id/report',(req,res)=>{const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id)return res.status(404).send('Pickup not found');const category=String(req.body.category||'suspicious transaction').slice(0,80),description=String(req.body.description||'').trim().slice(0,2000);if(!description)return res.status(400).send('Describe the issue.');const info=db.prepare('INSERT INTO safety_reports(reporter_id,reported_user_id,pickup_id,category,description) VALUES(?,?,?,?,?)').run(req.session.user.id,pickup.assigned_collector_id||null,pickup.id,category,description);notifyRole('admin','Safety report',`A safety report was submitted for ${pickup.reference}.`,'/admin/safety');notifyRole('owner','Safety report',`A safety report was submitted for ${pickup.reference}.`,'/admin/safety');audit(req,'safety_report_created','safety_report',info.lastInsertRowid);res.redirect(`/customer/pickups/${pickup.id}`);});
router.post('/pickups/:id/payment',(req,res)=>{const pickup=getPickup(req.params.id);if(!pickup||pickup.customer_id!==req.session.user.id)return res.status(404).send('Pickup not found');const method=String(req.body.method||'').toLowerCase();if(!['mtn_momo','airtel_money','card','bank_transfer'].includes(method))return res.status(400).send('Choose a supported payment method.');let grossMinor,commissionMinorValue;try{grossMinor=toMinor(req.body.amount);commissionMinorValue=commissionMinor(grossMinor,setting('commission_percentage','0'),setting('commission_fixed_fee','0'),setting('commission_minimum_fee','0'));}catch(e){return res.status(400).send(e.message);}
 if(grossMinor<=0)return res.status(400).send('Payment amount must be greater than zero.');
 const gross=fromMinor(grossMinor),commission=fromMinor(commissionMinorValue);
 const reference=`PAY-${Date.now()}-${token(3).toUpperCase()}`;
 db.prepare(`INSERT INTO payments(reference,pickup_id,payer_id,method,gross_value,reloop_commission,gross_minor,commission_minor,status,notes) VALUES(?,?,?,?,?,?,?,?,'pending',?)`).run(reference,pickup.id,req.session.user.id,method,gross,commission,grossMinor,commissionMinorValue,'Payment initiated. Awaiting external/manual verification; ReLoop has not marked this payment as paid.');notifyRole('admin','Payment pending verification',`${reference} requires verification.`,'/admin/payments');notifyRole('owner','Payment pending verification',`${reference} requires verification.`,'/owner/payments');audit(req,'payment_initiated','payment',reference,{method,gross});res.redirect(`/customer/pickups/${pickup.id}`);});
router.get('/business',(req,res)=>{
 const id=req.session.user.id;
 res.render('customer/business',{
 business:db.prepare('SELECT * FROM customer_businesses WHERE customer_id=?').get(id),
 locations:db.prepare('SELECT * FROM customer_locations WHERE customer_id=? AND active=1 ORDER BY id DESC').all(id),
 schedules:db.prepare(`SELECT r.*,l.label,mc.name material FROM recurring_pickups r JOIN customer_locations l ON l.id=r.location_id JOIN material_categories mc ON mc.id=r.category_id WHERE r.customer_id=? ORDER BY r.id DESC`).all(id),
 categories:db.prepare('SELECT id,name FROM material_categories WHERE active=1 ORDER BY name').all()
 });
});
router.post('/business',(req,res)=>{
 const name=String(req.body.business_name||'').trim().slice(0,180),person=String(req.body.contact_person||'').trim().slice(0,160);
 if(name.length<2)return res.status(400).send('Business name required.');
 db.prepare(`INSERT INTO customer_businesses(customer_id,business_name,contact_person) VALUES(?,?,?) ON CONFLICT(customer_id) DO UPDATE SET business_name=excluded.business_name,contact_person=excluded.contact_person`).run(req.session.user.id,name,person);
 audit(req,'business_profile_updated','user',req.session.user.id);res.redirect('/customer/business');
});
router.post('/business/locations',(req,res)=>{
 const label=String(req.body.label||'').trim().slice(0,80),address=String(req.body.address||'').trim().slice(0,300);
 if(!label||!address)return res.status(400).send('Location label and address required.');
 db.prepare('INSERT INTO customer_locations(customer_id,label,address,area,city,landmark) VALUES(?,?,?,?,?,?)').run(req.session.user.id,label,address,String(req.body.area||'').slice(0,120),String(req.body.city||'').slice(0,120),String(req.body.landmark||'').slice(0,160));res.redirect('/customer/business');
});
router.post('/business/schedules',(req,res)=>{
 const id=req.session.user.id,location=Number(req.body.location_id),category=Number(req.body.category_id),weight=Number(req.body.estimated_weight),frequency=String(req.body.frequency||''),date=String(req.body.next_date||'');
 if(!db.prepare('SELECT id FROM customer_businesses WHERE customer_id=?').get(id))return res.status(400).send('Create business profile first.');
 if(!db.prepare('SELECT id FROM customer_locations WHERE customer_id=? AND id=? AND active=1').get(id,location))return res.status(400).send('Invalid location.');
 if(!db.prepare('SELECT id FROM material_categories WHERE id=? AND active=1').get(category)||!(weight>0)||!['weekly','biweekly','monthly'].includes(frequency)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<new Date().toISOString().slice(0,10))return res.status(400).send('Invalid schedule fields or date.');
 db.prepare('INSERT INTO recurring_pickups(customer_id,category_id,estimated_weight,location_id,frequency,next_date) VALUES(?,?,?,?,?,?)').run(id,category,weight,location,frequency,date);
 audit(req,'recurring_pickup_created','user',id,{frequency,date});res.redirect('/customer/business');
});
router.post('/business/schedules/:id/stop',(req,res)=>{
 db.prepare('UPDATE recurring_pickups SET active=0 WHERE id=? AND customer_id=?').run(req.params.id,req.session.user.id);res.redirect('/customer/business');
});
router.get('/business/history.csv',(req,res)=>{
 const rows=db.prepare(`SELECT reference,requested_at,preferred_time,status,estimated_weight,collected_weight,verified_weight,address,area,city FROM pickup_requests WHERE customer_id=? ORDER BY id DESC LIMIT 10000`).all(req.session.user.id);
 const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 res.attachment('reloop-recycling-history.csv').type('text/csv').send([Object.keys(rows[0]||{reference:'',requested_at:'',status:''}).join(','),...rows.map(r=>Object.values(r).map(safe).join(','))].join('\r\n'));
});
module.exports=router;
