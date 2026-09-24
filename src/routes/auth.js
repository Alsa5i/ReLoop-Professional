const express=require('express');
const bcrypt=require('bcryptjs');
const {db}=require('../db');
const {authRateLimit,clearRateLimit,finalizeLogin}=require('../security');
const {audit}=require('../services/audit');
const router=express.Router();

function destination(role){return role==='owner'?'/owner':role==='admin'?'/admin':role==='collector'?'/collector':role==='partner'?'/partner':'/customer';}
function safeNext(req,role){return role==='customer'&&req.body?.next==='pickup'?'/customer/pickups/new':destination(role);}
function loginPage(req,res,error=null,status=200){
  return res.status(status).render('auth/login',{error,email:String(req.body?.email||'').trim().slice(0,200),next:req.body?.next==='pickup'||req.query.next==='pickup'?'pickup':'',resetDone:req.query.reset==='success'});
}
// One visual login for every role. Keep the former Owner URL as a compatibility link.
router.get('/owner/login',(req,res)=>res.redirect(302,'/login'));
router.get('/login',(req,res)=>req.session.user?res.redirect(destination(req.session.user.role)):loginPage(req,res,req.query.inactive==='1'?'Your session ended. Sign in again or contact ReLoop support if the account was suspended.':null));
router.get('/dashboard',(req,res)=>res.redirect(req.session.user?destination(req.session.user.role):'/login'));
router.post(['/login','/owner/login'],authRateLimit,async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase().slice(0,200);
  const password=String(req.body.password||'');
  const account=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(email,email);
  // The same generic message for any invalid role/email/password; no Owner discovery.
  const valid=account&&await bcrypt.compare(password,account.password);
  if(!valid){audit(req,'LOGIN_FAILED','user',account?.id||'',{portal:'unified'});return loginPage(req,res,'We could not sign you in with those details. Check your email and password, then try again.',401);}
  if(account.status!=='active'){
    audit(req,'LOGIN_FAILED','user',account.id,{reason:'inactive'});
    return loginPage(req,res,'This account is not currently active. Contact ReLoop support if you need help.',403);
  }
  audit(req,'LOGIN','user',account.id,{portal:'unified'});
  clearRateLimit(req.ip,email,account.role==='owner');
  finalizeLogin(req,res,account,safeNext(req,account.role));
});
router.post('/logout',(req,res)=>{audit(req,'LOGOUT','user',req.session.user?.id||'');req.session.destroy(()=>res.redirect('/login'));});
module.exports=router;
