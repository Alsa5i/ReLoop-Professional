const express=require('express');
const bcrypt=require('bcryptjs');
const {db}=require('../db');
const {authRateLimit,clearRateLimit,finalizeLogin}=require('../security');
const {audit}=require('../services/audit');
const router=express.Router();
function destination(role){ return role==='owner'?'/owner':role==='admin'?'/admin':role==='collector'?'/collector':role==='partner'?'/partner':'/customer'; }
router.get('/login',(req,res)=>res.render('auth/login',{error:req.query.inactive==='1'?'Your session ended because this account is not active.':null}));
router.post('/login',authRateLimit,async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||'');
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u||u.role==='owner'||u.status!=='active'||!(await bcrypt.compare(password,u.password))) {audit(req,'LOGIN_FAILED','user',u?.id||'',{portal:'user'});return res.status(401).render('auth/login',{error:'Invalid email/password, inactive account, or wrong login portal.'});}
  audit(req,'LOGIN','user',u.id);clearRateLimit(req.ip,email);finalizeLogin(req,res,u,destination(u.role));
});
router.get('/owner/login',(req,res)=>res.render('auth/owner-login',{error:null,configured:!!process.env.OWNER_EMAIL}));
router.post('/owner/login',authRateLimit,async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  const u=db.prepare("SELECT * FROM users WHERE email=? AND role='owner'").get(email);
  if(!u||u.status!=='active'||!(await bcrypt.compare(password,u.password))) {audit(req,'LOGIN_FAILED','user',u?.id||'',{portal:'owner'});return res.status(401).render('auth/owner-login',{error:'Invalid Owner credentials.',configured:!!process.env.OWNER_EMAIL});}
  audit(req,'LOGIN','user',u.id,{portal:'owner'});clearRateLimit(req.ip,email,true);finalizeLogin(req,res,u,'/owner');
});
router.post('/logout',(req,res)=>{ const role=req.session.user?.role; audit(req,'logout','user',req.session.user?.id||''); req.session.destroy(()=>res.redirect(role==='owner'?'/owner/login':'/')); });
module.exports=router;
