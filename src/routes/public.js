const express=require('express');
const bcrypt=require('bcryptjs');
const {finalizeLogin,authRateLimit}=require('../security');
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
router.get('/install',(req,res)=>res.render('public/install'));
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
router.get('/recycle',(req,res)=>req.session.user?.role==='customer'?res.redirect('/customer/pickups/new'):req.session.user?res.redirect('/'+req.session.user.role):res.redirect('/register?next=pickup'));
router.get('/verify/:token',(req,res)=>{
  const pickup=db.prepare(`SELECT p.reference,p.status,p.verified_weight,p.verified_at,mc.name material_name FROM pickup_requests p LEFT JOIN material_categories mc ON mc.id=p.category_id WHERE p.qr_token=?`).get(req.params.token);
  if(!pickup) return res.status(404).render('common/error',{code:404,title:'Verification not found',message:'This verification token is invalid or expired.'});
  res.render('public/verify',{pickup});
});

// Customers, collectors, partners and business customers begin at one account-creation screen.
const signupRoles=['customer','collector','partner','business'];
const landing={customer:'/customer',collector:'/collector',partner:'/partner',business:'/customer/business'};
function roleFrom(value){return signupRoles.includes(value)?value:'customer';}
function signupPage(req,res,{error=null,duplicate=false,status=200}={}){
  const role=roleFrom(req.body?.role||req.query.role);
  return res.status(status).render('auth/register',{error,duplicate,role,next:req.body?.next==='pickup'||req.query.next==='pickup'?'pickup':'',formData:req.body||{}});
}
router.get('/register',(req,res)=>req.session.user?res.redirect('/'+req.session.user.role):signupPage(req,res));
// Legacy application URLs remain functional but use the same unified signup view.
router.get('/become-collector',(req,res)=>res.redirect(302,'/register?role=collector'));
router.get('/become-partner',(req,res)=>res.redirect(302,'/register?role=partner'));
function validEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=200;}
async function createAccount(req,res){
  const role=roleFrom(req.body.role),realRole=role==='business'?'customer':role;
  const name=String(req.body.name||'').trim().slice(0,120),email=String(req.body.email||'').trim().toLowerCase(),phone=String(req.body.phone||'').trim().slice(0,40);
  const password=String(req.body.password||''),area=String(req.body.area||'').trim().slice(0,160);
  const business=String(req.body.business_name||'').trim().slice(0,180),vehicle=String(req.body.vehicle_type||'').trim().slice(0,100);
  if(!signupRoles.includes(String(req.body.role||'customer')))return signupPage(req,res,{error:'Choose the account type you need.',status:400});
  if(name.length<2||!validEmail(email))return signupPage(req,res,{error:'Enter your full name and a valid email address.',status:400});
  if(password.length<12||password.length>200)return signupPage(req,res,{error:'Create a password between 12 and 200 characters.',status:400});
  if(password!==String(req.body.password_confirmation||''))return signupPage(req,res,{error:'The passwords do not match. Please confirm your password.',status:400});
  if((role==='business'||role==='partner')&&business.length<2)return signupPage(req,res,{error:'Enter your business or facility name.',status:400});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return signupPage(req,res,{error:'An account already exists for this email. Sign in instead, or contact support if you cannot access it.',duplicate:true,status:409});
  const hash=await bcrypt.hash(password,12);
  let id;
  try{
    id=db.transaction(()=>{
      const verification=realRole==='customer'?'unverified':'pending_verification';
      const info=db.prepare('INSERT INTO users(name,email,password,role,phone,status,verification_status) VALUES(?,?,?,?,?,?,?)').run(name,email,hash,realRole,phone,'active',verification);
      const userId=Number(info.lastInsertRowid);
      if(realRole==='collector')db.prepare("INSERT INTO collector_profiles(user_id,phone,service_area,vehicle_type,verification_status,availability) VALUES(?,?,?,?,'pending_verification','offline')").run(userId,phone,area,vehicle);
      if(realRole==='partner')db.prepare("INSERT INTO partner_profiles(user_id,business_name,contact_person,phone,location,verification_status) VALUES(?,?,?,?,?,'pending')").run(userId,business,name,phone,area);
      if(role==='business')db.prepare('INSERT INTO customer_businesses(customer_id,business_name,contact_person) VALUES(?,?,?)').run(userId,business,name);
      return userId;
    })();
  }catch(err){
    if(/UNIQUE constraint failed: users.email/i.test(err.message))return signupPage(req,res,{error:'An account already exists for this email. Sign in instead.',duplicate:true,status:409});
    throw err;
  }
  audit(req,realRole==='customer'?'CUSTOMER_REGISTERED':realRole.toUpperCase()+'_APPLICATION_CREATED','user',id);
  if(['collector','partner'].includes(realRole)){
    notifyRole('admin',realRole+' verification pending',name+' submitted an application.','/admin/verifications');
    notifyRole('owner',realRole+' verification pending',name+' submitted an application.','/admin/verifications');
  }
  // An applicant can see the new account immediately; only privileged marketplace actions remain gated.
  const next=role==='customer'&&req.body.next==='pickup'?'/customer/pickups/new':landing[role];
  finalizeLogin(req,res,{id,name,email,role:realRole},next,realRole==='customer'?'Welcome to ReLoop! Your account is ready. Start with your first pickup or explore your workspace.':'Welcome to ReLoop! Your account is ready; ReLoop must verify your application before marketplace work begins.');
}
router.post('/register',authRateLimit,createAccount);
router.post('/apply/:role',authRateLimit,(req,res)=>{
  if(!['collector','partner'].includes(req.params.role))return res.sendStatus(404);
  req.body.role=req.params.role;
  return createAccount(req,res);
});
module.exports=router;
