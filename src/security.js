const crypto = require('crypto');
const session = require('express-session');
const { db } = require('./db');
const config = require('./config');

const sessionLimits=Object.freeze({customer:3,collector:2,partner:3,admin:3,owner:2});
function describeDevice(agent='') {
  agent=String(agent).slice(0,400);
  const os=/Android/i.test(agent)?'Android':/iPhone|iPad/i.test(agent)?'iOS':/Windows/i.test(agent)?'Windows':/Macintosh|Mac OS X/i.test(agent)?'macOS':/Linux/i.test(agent)?'Linux':'Unknown OS';
  const browser=/Edg\//i.test(agent)?'Edge':/Firefox\//i.test(agent)?'Firefox':/Chrome\//i.test(agent)?'Chrome':/Safari\//i.test(agent)?'Safari':'Unknown browser';
  const device=/Mobile|Android|iPhone/i.test(agent)?'Mobile device':/iPad|Tablet/i.test(agent)?'Tablet':'Computer';
  return {device,browser,os};
}
function revokeOtherSessions(userId,currentSid){db.prepare('DELETE FROM app_sessions WHERE user_id=? AND sid<>?').run(userId,currentSid);}
function enforceSessionLimit(userId,role,currentSid){
  db.prepare('DELETE FROM app_sessions WHERE expires_at<=?').run(Date.now());
  const limit=sessionLimits[role]||1;
  const rows=db.prepare('SELECT sid FROM app_sessions WHERE user_id=? AND sid<>? ORDER BY last_active DESC,created_at DESC,sid DESC').all(userId,currentSid);
  for(const row of rows.slice(Math.max(0,limit-1)))db.prepare('DELETE FROM app_sessions WHERE sid=?').run(row.sid);
}
function finalizeLogin(req,res,user,redirect,welcome=null){
  req.session.regenerate(err=>{
    if(err)return res.status(500).render('common/error',{code:500,title:'Login error',message:'Could not create a secure session.'});
    req.session.user={id:user.id,name:user.name,email:user.email,role:user.role};
    req.session.device=describeDevice(req.get('user-agent'));
    if(welcome)req.session.flash=welcome;
    req.session.save(err=>{
      if(err)return res.status(500).render('auth/login',{error:'Could not save your session. Please try again.',email:String(req.body?.email||'').slice(0,200),next:'',resetDone:false});
      enforceSessionLimit(user.id,user.role,req.sessionID);
      res.redirect(redirect);
    });
  });
}
class SQLiteSessionStore extends session.Store {
  constructor(){super();this.cleanup=setInterval(()=>this.prune(),30*60*1000);this.cleanup.unref?.();}
  get(sid,cb){try{const r=db.prepare('SELECT sess,expires_at FROM app_sessions WHERE sid=?').get(sid);if(!r||r.expires_at<=Date.now()){if(r)db.prepare('DELETE FROM app_sessions WHERE sid=?').run(sid);return cb(null,null);}cb(null,JSON.parse(r.sess));}catch(e){cb(e);}}
  set(sid,sess,cb){try{
    const exp=sess.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+8*60*60*1000;
    const d=sess.device||{};
    db.prepare(`INSERT INTO app_sessions(sid,sess,user_id,device,browser,os,expires_at)
     VALUES(?,?,?,?,?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,user_id=excluded.user_id,
     device=excluded.device,browser=excluded.browser,os=excluded.os,expires_at=excluded.expires_at,last_active=CURRENT_TIMESTAMP`)
     .run(sid,JSON.stringify(sess),sess.user?.id||null,d.device||'Unknown device',d.browser||'Unknown browser',d.os||'Unknown OS',exp);cb?.(null);
  }catch(e){cb?.(e);}}
  destroy(sid,cb){try{db.prepare('DELETE FROM app_sessions WHERE sid=?').run(sid);cb?.(null);}catch(e){cb?.(e);}}
  touch(sid,sess,cb){try{const exp=sess.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+8*60*60*1000;db.prepare('UPDATE app_sessions SET expires_at=?,last_active=CURRENT_TIMESTAMP WHERE sid=?').run(exp,sid);cb?.(null);}catch(e){cb?.(e);}}
  prune(){try{db.prepare('DELETE FROM app_sessions WHERE expires_at<=?').run(Date.now());}catch{}}
}

const attempts = new Map();
function authRateLimit(req,res,next){
  const email=String(req.body?.email||'').trim().toLowerCase().slice(0,200);
  // Owner retains the stricter five-attempt budget even on the shared login screen.
  const owner=req.path.startsWith('/owner/login') || !!(email && db.prepare("SELECT 1 FROM users WHERE (email=? OR username=?) AND role='owner'").get(email,email));
  const key=(owner?'owner:':'auth:')+(req.ip||'unknown')+':'+email, now=Date.now(), windowMs=15*60*1000, limit=owner?5:12;
  const current=attempts.get(key)||{count:0,reset:now+windowMs};
  if(now>current.reset){ current.count=0; current.reset=now+windowMs; }
  current.count++; attempts.set(key,current);
  if(current.count>limit){
    if(req.path==='/login'||req.path==='/owner/login')return res.status(429).render('auth/login',{error:'Too many attempts. Try signing in again after 15 minutes.',email,next:req.body?.next==='pickup'?'pickup':'',resetDone:false});
    if(req.path==='/register')return res.status(429).render('auth/register',{error:'Too many attempts. Please try creating your account later.',duplicate:false,role:['customer','collector','partner','business'].includes(req.body?.role)?req.body.role:'customer',next:req.body?.next==='pickup'?'pickup':'',formData:req.body||{}});
    return res.status(429).render('common/error',{code:429,title:'Too many attempts',message:'Please try again later.'});
  }
  next();
}
function clearRateLimit(ip,email,owner=false){attempts.delete((owner?'owner:':'auth:')+(ip||'unknown')+':'+String(email||'').trim().toLowerCase().slice(0,200));}

function securityHeaders(req,res,next){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(config.isProduction) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
}
function csrfSeed(req,res,next){
  if(!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken=req.session.csrfToken;
  next();
}
function csrfProtect(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const token=req.body?._csrf || req.get('x-csrf-token');
  const a=Buffer.from(String(token||'')), b=Buffer.from(String(req.session.csrfToken||''));
  if(!token || !req.session.csrfToken || a.length!==b.length || !crypto.timingSafeEqual(a,b)){
    if(req.get('X-ReLoop-Async')==='1')return res.status(403).json({ok:false,message:'Form expired. Reload the page to refresh its security token; your unsent fields can be restored.'});
    if(req.path==='/login'||req.path==='/owner/login')return res.status(403).render('auth/login',{error:'Your secure form expired. Review your details and sign in again.',email:String(req.body?.email||'').slice(0,200),next:req.body?.next==='pickup'?'pickup':'',resetDone:false});
    if(req.path==='/register')return res.status(403).render('auth/register',{error:'Your secure form expired. Review your details and create your account again.',duplicate:false,role:['customer','collector','partner','business'].includes(req.body?.role)?req.body.role:'customer',next:req.body?.next==='pickup'?'pickup':'',formData:req.body||{}});
    return res.status(403).render('common/error',{code:403,title:'Request blocked',message:'Your form security token was missing or expired. Refresh the page and try again.'});
  }
  next();
}
function requireAuth(req,res,next){ if(!req.session.user) return res.redirect('/login'); next(); }
function requireRole(...roles){ return (req,res,next)=>{ if(!req.session.user) return res.redirect('/login'); if(!roles.includes(req.session.user.role)) return res.status(403).render('common/error',{code:403,title:'Access denied',message:'You do not have permission to open this page.'}); next(); }; }
function requireOwner(req,res,next){ if(!req.session.user) return res.redirect('/login'); if(req.session.user.role!=='owner') return res.status(403).render('common/error',{code:403,title:'Owner access only',message:'This area is restricted to the ReLoop platform owner.'}); next(); }

module.exports={SQLiteSessionStore,authRateLimit,clearRateLimit,securityHeaders,csrfSeed,csrfProtect,requireAuth,requireRole,requireOwner,sessionLimits,describeDevice,revokeOtherSessions,enforceSessionLimit,finalizeLogin};
