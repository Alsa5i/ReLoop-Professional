const express=require('express');
const bcrypt=require('bcryptjs');
const {finalizeLogin}=require('../security');
const {db,setting}=require('../db');
const {audit}=require('../services/audit');
const {notifyRole}=require('../services/notifications');
const router=express.Router();

router.get('/',(req,res)=>{
  const categories=db.prepare("SELECT * FROM material_categories WHERE active=1 ORDER BY name LIMIT 8").all();
  const stats={
    recycled:Number(db.prepare("SELECT COALESCE(SUM(COALESCE(verified_weight,collected_weight,0)),0) v FROM pickup_requests WHERE status IN ('verified','completed')").get().v||0),
    completed:db.prepare("SELECT COUNT(*) c FROM pickup_requests WHERE status='completed'").get().c,
    collectors:db.prepare("SELECT COUNT(*) c FROM collector_profiles WHERE verification_status='verified'").get().c,
    partners:db.prepare("SELECT COUNT(*) c FROM partner_profiles WHERE verification_status='verified'").get().c
  };
  const announcements=db.prepare('SELECT * FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 3').all();
  res.render('public/home',{categories,stats,announcements});
});
router.get('/how-it-works',(req,res)=>res.render('public/how-it-works'));
router.get('/materials',(req,res)=>res.render('public/materials',{categories:db.prepare('SELECT * FROM material_categories WHERE active=1 ORDER BY name').all()}));
router.get('/partners',(req,res)=>res.render('public/partners',{partners:db.prepare(`SELECT u.name,p.business_name,p.location,p.profile_notes FROM partner_profiles p JOIN users u ON u.id=p.user_id WHERE p.verification_status='verified' AND u.status='active' ORDER BY p.business_name`).all()}));
router.get('/impact',(req,res)=>{
  const total=Number(db.prepare("SELECT COALESCE(SUM(COALESCE(verified_weight,collected_weight,0)),0) v FROM pickup_requests WHERE status IN ('verified','completed')").get().v||0);
  const breakdown=db.prepare(`SELECT mc.name,COALESCE(SUM(COALESCE(p.verified_weight,p.collected_weight,0)),0) weight FROM material_categories mc LEFT JOIN pickup_requests p ON p.category_id=mc.id AND p.status IN ('verified','completed') GROUP BY mc.id ORDER BY weight DESC`).all();
  const factor=Number(setting('impact_co2_factor_per_kg','0'))||0;
  res.render('public/impact',{total,breakdown,estimatedCo2:factor>0?total*factor:null,impactNote:setting('impact_note','')});
});
router.get('/about',(req,res)=>res.render('public/about'));
router.get('/faq',(req,res)=>res.render('public/faq',{entries:db.prepare("SELECT title,body FROM public_content WHERE content_key LIKE 'faq_%' AND active=1 ORDER BY content_key").all()}));
router.get('/contact',(req,res)=>res.render('public/contact',{sent:req.query.sent==='1'}));
router.post('/contact',(req,res)=>{
  const name=String(req.body.name||'').trim().slice(0,100),email=String(req.body.email||'').trim().toLowerCase().slice(0,200),subject=String(req.body.subject||'').trim().slice(0,160),message=String(req.body.message||'').trim().slice(0,3000);
  if(!subject||!message) return res.status(400).render('public/contact',{sent:false,error:'Subject and message are required.'});
  const info=db.prepare('INSERT INTO support_requests(user_id,name,email,subject,message) VALUES(?,?,?,?,?)').run(req.session.user?.id||null,name,email,subject,message);
  notifyRole('admin','New support request',subject,'/admin/support');notifyRole('owner','New support request',subject,'/admin/support');
  audit(req,'support_request_created','support_request',info.lastInsertRowid);
  return res.redirect('/contact?sent=1');
});
router.get('/terms',(req,res)=>res.render('public/terms'));
router.get('/privacy',(req,res)=>res.render('public/privacy'));
router.get('/campaigns',(req,res)=>{
 const rows=db.prepare(`SELECT c.*,COALESCE((SELECT SUM(p.verified_weight) FROM campaign_pickups cp JOIN pickup_requests p ON p.id=cp.pickup_id WHERE cp.campaign_id=c.id AND p.status IN ('verified','completed')),0) collected_kg FROM recycling_campaigns c WHERE c.active=1 ORDER BY c.id DESC LIMIT 100`).all();res.render('public/campaigns',{rows});
});
const legal={
 'collection-terms':'Collection Terms', 'payment-terms':'Payment Terms',
 'safety-guidelines':'Community & Safety Guidelines','refund-policy':'Refund Policy'};
router.get('/:policy(collection-terms|payment-terms|safety-guidelines|refund-policy)',(req,res)=>{
 const title=legal[req.params.policy];const entry=db.prepare('SELECT body FROM public_content WHERE content_key=? AND active=1').get(req.params.policy.replaceAll('-','_'));
 res.render('public/policy',{title,body:entry?.body||'Draft policy template. ReLoop must complete and obtain professional legal review before launch.'});
});
router.get('/recycle',(req,res)=>req.session.user?.role==='customer'?res.redirect('/customer/pickups/new'):res.redirect('/register?next=pickup'));
router.get('/verify/:token',(req,res)=>{
  const pickup=db.prepare(`SELECT p.reference,p.status,p.verified_weight,p.verified_at,mc.name material_name FROM pickup_requests p LEFT JOIN material_categories mc ON mc.id=p.category_id WHERE p.qr_token=?`).get(req.params.token);
  if(!pickup) return res.status(404).render('common/error',{code:404,title:'Verification not found',message:'This verification token is invalid or expired.'});
  res.render('public/verify',{pickup});
});

router.get('/register',(req,res)=>res.render('auth/register',{error:null,next:req.query.next||''}));
router.post('/register',async(req,res)=>{
  const name=String(req.body.name||'').trim().slice(0,120),email=String(req.body.email||'').trim().toLowerCase().slice(0,200),phone=String(req.body.phone||'').trim().slice(0,40),password=String(req.body.password||'');
  if(name.length<2||!email.includes('@')||password.length<10) return res.status(400).render('auth/register',{error:'Use a valid name/email and a password of at least 10 characters.',next:req.body.next||''});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).render('auth/register',{error:'An account with that email already exists.',next:req.body.next||''});
  const hash=await bcrypt.hash(password,12);
  const info=db.prepare("INSERT INTO users(name,email,password,role,phone,status,verification_status) VALUES(?,?,?,'customer',?,'active','unverified')").run(name,email,hash,phone);
  audit(req,'customer_registered','user',info.lastInsertRowid);
  finalizeLogin(req,res,{id:Number(info.lastInsertRowid),name,email,role:'customer'},req.body.next==='pickup'?'/customer/pickups/new':'/customer');
});
router.get('/become-collector',(req,res)=>res.render('auth/apply',{role:'collector',error:null}));
router.get('/become-partner',(req,res)=>res.render('auth/apply',{role:'partner',error:null}));
router.post('/apply/:role',async(req,res)=>{
  const role=req.params.role;
  if(!['collector','partner'].includes(role)) return res.status(404).send('Not found');
  const name=String(req.body.name||'').trim().slice(0,120),email=String(req.body.email||'').trim().toLowerCase().slice(0,200),phone=String(req.body.phone||'').trim().slice(0,40),password=String(req.body.password||''),area=String(req.body.area||'').trim().slice(0,160),business=String(req.body.business_name||'').trim().slice(0,180),vehicle=String(req.body.vehicle_type||'').trim().slice(0,100),idReference=String(req.body.id_reference||'').trim().slice(0,120),emergency=String(req.body.emergency_contact||'').trim().slice(0,120),registration=String(req.body.registration_info||'').trim().slice(0,300);
  if(name.length<2||!email.includes('@')||password.length<10) return res.status(400).render('auth/apply',{role,error:'Use a valid name/email and a password of at least 10 characters.'});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).render('auth/apply',{role,error:'An account with that email already exists.'});
  const hash=await bcrypt.hash(password,12);
  const info=db.prepare('INSERT INTO users(name,email,password,role,phone,status,verification_status) VALUES(?,?,?,?,?,?,?)').run(name,email,hash,role,phone,'active','pending_verification');
  const id=Number(info.lastInsertRowid);
  if(role==='collector') db.prepare("INSERT INTO collector_profiles(user_id,phone,service_area,vehicle_type,id_reference,emergency_contact,verification_status,availability) VALUES(?,?,?,?,?,?,'pending_verification','offline')").run(id,phone,area,vehicle,idReference,emergency);
  else db.prepare("INSERT INTO partner_profiles(user_id,business_name,contact_person,phone,location,registration_info,verification_status) VALUES(?,?,?,?,?,?,'pending')").run(id,business||name,name,phone,area,registration);
  audit(req,`${role}_application_created`,'user',id);notifyRole('admin',`${role} verification pending`,`${name} submitted a ${role} application.`,'/admin/verifications');notifyRole('owner',`${role} verification pending`,`${name} submitted a ${role} application.`,'/admin/verifications');
  res.render('auth/application-sent',{role});
});
module.exports=router;
