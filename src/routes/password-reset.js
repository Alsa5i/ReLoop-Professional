const express=require('express');
const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const config=require('../config');
const {db}=require('../db');
const {mailReady,sendPasswordReset}=require('../services/email');
const {audit}=require('../services/audit');
const router=express.Router();
const requests=new Map();
const safeEmail=s=>String(s||'').trim().toLowerCase().slice(0,200);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const invalidMessage='This reset link is invalid or expired. Request another link if needed.';
function limit(req,res,next){
  const key=String(req.ip||'unknown');const now=Date.now();
  if(requests.size>3000)for(const [k,v] of requests)if(v.until<=now)requests.delete(k);
  const item=requests.get(key)||{count:0,until:now+15*60*1000};
  if(now>=item.until){item.count=0;item.until=now+15*60*1000;}
  item.count++;requests.set(key,item);
  if(item.count>8){
  if(req.path==='/forgot-password')return res.status(429).render('auth/forgot-password',{done:false,error:'Too many requests. Please try again after 15 minutes.',mailConfigured:mailReady()});
  if(req.path.startsWith('/reset-password/'))return res.status(429).render('auth/reset-password',{valid:!!tokenRecord(req.params.token),token:req.params.token,error:'Too many requests. Please try again after 15 minutes.'});
  return res.status(429).render('common/error',{code:429,title:'Try again later',message:'Too many reset requests. Please try again later.'});
 }
  next();
}
router.get('/forgot-password',(req,res)=>res.render('auth/forgot-password',{done:false,error:null,mailConfigured:mailReady()}));
router.post('/forgot-password',limit,async(req,res)=>{
  const email=safeEmail(req.body.email);
  if(!email||email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).render('auth/forgot-password',{done:false,error:'Enter a valid email address.',mailConfigured:mailReady()});
  // Never reveal whether an address belongs to a ReLoop user.
  const account=db.prepare("SELECT id,name,email FROM users WHERE email=? AND status='active' AND role<>'owner'").get(email);
  if(account&&mailReady()){
    const recent=db.prepare("SELECT id FROM password_reset_tokens WHERE user_id=? AND created_at>datetime('now','-2 minutes') ORDER BY id DESC LIMIT 1").get(account.id);
    if(!recent){
      const raw=crypto.randomBytes(32).toString('hex');const digest=hash(raw);
      db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<? OR used_at IS NOT NULL').run(Date.now());
      db.prepare('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)').run(account.id,digest,Date.now()+30*60*1000);
      try{
        const base=config.baseUrl.replace(/\/$/,'');
        if(config.isProduction && !base.startsWith('https://'))throw new Error('APP_BASE_URL must use HTTPS');
        await sendPasswordReset(account.email,account.name,base+'/reset-password/'+raw);
        audit(req,'PASSWORD_RESET_REQUESTED','user',account.id);
      }catch(err){
        db.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?').run(digest);
        console.error('Password reset email delivery failed:',err.message);
      }
    }
  }
  res.render('auth/forgot-password',{done:true,error:null,mailConfigured:mailReady()});
});
function tokenRecord(raw){
  if(!/^[a-f0-9]{64}$/i.test(String(raw||'')))return null;
  return db.prepare(`SELECT t.id,t.user_id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND u.status='active' AND u.role<>'owner'`).get(hash(raw),Date.now());
}
router.get('/reset-password/:token',(req,res)=>{
  res.set('Referrer-Policy','no-referrer');res.set('Cache-Control','private, no-store');
  const valid=Boolean(tokenRecord(req.params.token));
  res.status(valid?200:400).render('auth/reset-password',{valid,token:valid?req.params.token:'',error:valid?null:invalidMessage});
});
router.post('/reset-password/:token',limit,async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  const found=tokenRecord(req.params.token);
  if(!found)return res.status(400).render('auth/reset-password',{valid:false,token:'',error:invalidMessage});
  const password=String(req.body.password||'');const confirmation=String(req.body.password_confirmation||'');
  if(password.length<12||password.length>200||password!==confirmation)
    return res.status(400).render('auth/reset-password',{valid:true,token:req.params.token,error:'Use a password of 12–200 characters and confirm it correctly.'});
  const digest=await bcrypt.hash(password,12);
  // Claim this single-use token atomically; a second concurrent reset cannot use it.
  const updated=db.transaction(()=>{
    const claim=db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?').run(Date.now(),found.id,Date.now());
    if(!claim.changes)return false;
    db.prepare('UPDATE users SET password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(digest,found.user_id);
    db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(found.user_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND id<>?').run(found.user_id,found.id);
    return true;
  })();
  if(!updated)return res.status(400).render('auth/reset-password',{valid:false,token:'',error:invalidMessage});
  audit(req,'PASSWORD_RESET','user',found.user_id);
  req.session.destroy(()=>res.redirect('/login?reset=success'));
});
module.exports=router;
