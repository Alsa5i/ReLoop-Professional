const express=require('express');
const session=require('express-session');
const path=require('path');
const QRCode=require('qrcode');
const config=require('./src/config');
const {db,migrate,setting}=require('./src/db');
const {SQLiteSessionStore,securityHeaders,csrfSeed,csrfProtect,requireAuth}=require('./src/security');

if(config.isProduction && !config.sessionSecret){
  throw new Error('SESSION_SECRET is required in production.');
}
migrate();
const {generateRecurring}=require('./src/services/recurring');
try{generateRecurring();}catch(err){console.error('Recurring pickup generator failed:',err.message);}
const recurringTimer=setInterval(()=>{try{generateRecurring();}catch(err){console.error('Recurring pickup generator failed:',err.message);}},60*60*1000);recurringTimer.unref?.();
const app=express();
app.disable('x-powered-by');
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.set('trust proxy',config.isProduction?1:false);
app.use(securityHeaders);
app.use(express.static(path.join(__dirname,'public'),{maxAge:config.isProduction?'1d':0}));
app.use(express.urlencoded({extended:true,limit:'5mb'}));
app.use(express.json({limit:'5mb'}));
app.use(session({
  name:'reloop.sid',store:new SQLiteSessionStore(),secret:config.sessionSecret||'local-only',resave:false,saveUninitialized:false,rolling:true,
  cookie:{httpOnly:true,sameSite:'lax',secure:config.isProduction,maxAge:8*60*60*1000}
}));
app.use((req,res,next)=>{if(!/^\/(?:css|js|img|icons)\//.test(req.path))res.setHeader('Cache-Control','private, no-store');next();});
app.use(csrfSeed);
app.use((req,res,next)=>{
  if(!req.session.user) return next();
  const account=db.prepare('SELECT id,name,email,role,status FROM users WHERE id=?').get(req.session.user.id);
  if(!account||account.status!=='active') return req.session.destroy(()=>res.redirect('/login?inactive=1'));
  req.session.user={id:account.id,name:account.name,email:account.email,role:account.role};
  next();
});
app.use((req,res,next)=>{
  res.locals.appInfo={name:config.appName,tagline:config.tagline};
  res.locals.user=req.session.user||null;
  res.locals.currentPath=req.path;
  res.locals.currency=setting('payment_currency','UGX');
  res.locals.unreadNotifications=req.session.user?db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(req.session.user.id).c:0;
  next();
});
app.use(csrfProtect);
// Keep errors inside the submitting form for async requests (and preserve ordinary HTML fallback).
app.use((req,res,next)=>{
  if(req.method!=='POST'||req.get('X-ReLoop-Async')!=='1')return next();
  const originalSend=res.send.bind(res);
  res.send=function(payload){
    if(res.statusCode>=400 && typeof payload==='string' && !/^\s*</.test(payload) && !res.getHeader('Content-Type')){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return originalSend(JSON.stringify({ok:false,message:payload.slice(0,800)}));
    }
    return originalSend(payload);
  };
  next();
});
// A success message is shown only after a POST handler responds with a real redirect.
// It is consumed once by the next GET; no success message is emitted for 4xx/5xx responses.
app.use((req,res,next)=>{
  if(req.method==='GET' && req.session.flash){
    res.locals.flash=req.session.flash;
    delete req.session.flash;
  }
  if(req.method==='POST' && req.session.user && !['/logout','/owner/backup'].includes(req.path)){
    const redirect=res.redirect.bind(res);
    res.redirect=(...args)=>{
      const dest=String(args.length===1?args[0]:args[1]||'');
      if(dest.startsWith('/')&&!dest.startsWith('//')){
        const path=req.path;
        req.session.flash=path.includes('payments')||path.includes('payment')?'Payment review saved. Verify the status in the payment record.':path.includes('pickup')?'Pickup updated. Check its current status and history.':path.includes('devices')?'Session settings updated.':path.includes('support')?'Support request updated.':path.includes('password')?'Password changed; other sessions have been signed out.':'Changes saved successfully.';
      }
      if(req.get('X-ReLoop-Async')==='1') return res.json({ok:true,redirect:dest,message:req.session.flash||'Changes saved successfully.'});
      return redirect(...args);
    };
  }
  next();
});

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/password-reset'));
app.use(require('./src/routes/public'));
app.use(require('./src/routes/common'));
app.use('/owner',require('./src/routes/owner'));
app.use('/admin',require('./src/routes/admin'));
app.use('/customer',require('./src/routes/customer'));
app.use('/collector',require('./src/routes/collector'));
app.use('/partner',require('./src/routes/partner'));
app.use('/legacy',require('./src/routes/legacy'));

app.get('/proof/:id',requireAuth,(req,res)=>{
  const proof=db.prepare(`SELECT cp.*,p.customer_id,p.assigned_collector_id,p.partner_id FROM collection_proofs cp JOIN pickup_requests p ON p.id=cp.pickup_id WHERE cp.id=?`).get(req.params.id);
  if(!proof||!proof.data)return res.status(404).render('common/error',{code:404,title:'Proof not found',message:'No private file is stored for this evidence item.'});
  const u=req.session.user;const allowed=['owner','admin'].includes(u.role)||proof.customer_id===u.id||proof.assigned_collector_id===u.id||proof.partner_id===u.id;
  if(!allowed)return res.status(403).render('common/error',{code:403,title:'Access denied',message:'You are not authorized to view this private collection evidence.'});
  res.setHeader('Content-Type',proof.mime_type||'application/octet-stream');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`inline; filename="${String(proof.file_name||'proof').replace(/["\r\n]/g,'_')}"`);res.send(proof.data);
});
app.get('/pickup/:id/qr.png',requireAuth,async(req,res)=>{
  const p=db.prepare('SELECT id,customer_id,assigned_collector_id,partner_id,qr_token FROM pickup_requests WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);const u=req.session.user;const allowed=['owner','admin'].includes(u.role)||p.customer_id===u.id||p.assigned_collector_id===u.id||p.partner_id===u.id;if(!allowed)return res.sendStatus(403);try{const png=await QRCode.toBuffer(`${config.baseUrl}/verify/${p.qr_token}`,{type:'png',width:280,margin:2,errorCorrectionLevel:'M'});res.type('png').set('Cache-Control','private, no-store').send(png);}catch(e){res.status(500).send('QR generation failed');}
});
app.get(['/health','/api/health'],(req,res)=>res.json({ok:true,app:config.appName,version:'1.0.1'}));
app.use((req,res)=>res.status(404).render('common/error',{code:404,title:'Page not found',message:'The page you requested does not exist.'}));
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).render('common/error',{code:500,title:'Server error',message:config.isProduction?'An unexpected error occurred.':err.message});});
app.listen(config.port,()=>console.log(`${config.appName} v1.0.1 running on http://localhost:${config.port}`));
