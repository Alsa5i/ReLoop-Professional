const express=require('express');
const {db}=require('../db');
const {requireAuth,revokeOtherSessions}=require('../security');
const bcrypt=require('bcryptjs');
const {audit}=require('../services/audit');
const router=express.Router();
router.get('/notifications',requireAuth,(req,res)=>{ const rows=db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.session.user.id); res.render('common/notifications',{rows}); });
router.post('/notifications/:id/read',requireAuth,(req,res)=>{ db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id,req.session.user.id); res.redirect(String(req.body.return_to||'').startsWith('/notifications')?req.body.return_to:'/notifications'); });
router.get('/profile',requireAuth,(req,res)=>{ const u=db.prepare('SELECT id,name,email,phone,role,status,verification_status,created_at FROM users WHERE id=?').get(req.session.user.id); res.render('common/profile',{account:u,saved:req.query.saved==='1'}); });
router.post('/profile',requireAuth,(req,res)=>{ const name=String(req.body.name||'').trim().slice(0,120),phone=String(req.body.phone||'').trim().slice(0,40); if(name.length<2)return res.status(400).send('Name too short'); db.prepare('UPDATE users SET name=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,phone,req.session.user.id); req.session.user.name=name; res.redirect('/profile?saved=1'); });
router.get('/account/devices',requireAuth,(req,res)=>{
 const rows=db.prepare('SELECT sid,device,browser,os,created_at,last_active FROM app_sessions WHERE user_id=? AND expires_at>? ORDER BY last_active DESC').all(req.session.user.id,Date.now()).map(r=>({...r,current:r.sid===req.sessionID}));
 res.render('common/devices',{rows,passwordChanged:req.query.password==='changed'});
});
router.post('/account/devices/:sid/revoke',requireAuth,(req,res)=>{
 const sid=String(req.params.sid);
 const removed=db.prepare('DELETE FROM app_sessions WHERE sid=? AND user_id=?').run(sid,req.session.user.id);
 if(removed.changes) audit(req,'SESSION_REVOKED','app_session',sid,{self:sid===req.sessionID});
 if(sid===req.sessionID)return req.session.destroy(()=>res.redirect('/login'));
 res.redirect('/account/devices');
});
router.post('/account/devices/revoke-others',requireAuth,(req,res)=>{
 const n=db.prepare('DELETE FROM app_sessions WHERE user_id=? AND sid<>?').run(req.session.user.id,req.sessionID).changes;
 audit(req,'SESSION_REVOKED','user',req.session.user.id,{otherSessions:n});res.redirect('/account/devices');
});
router.post('/account/password',requireAuth,async(req,res)=>{
 const old=String(req.body.old_password||''),next=String(req.body.new_password||'');
 const me=db.prepare('SELECT password FROM users WHERE id=?').get(req.session.user.id);
 if(!me||!(await bcrypt.compare(old,me.password)))return res.status(400).send('Current password is incorrect.');
 if(next.length<12||next.length>200||next===old)return res.status(400).send('New password must have 12+ characters and differ from the old password.');
 const hash=await bcrypt.hash(next,12);
 db.prepare('UPDATE users SET password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(hash,req.session.user.id);
 revokeOtherSessions(req.session.user.id,req.sessionID);
 audit(req,'PASSWORD_CHANGED','user',req.session.user.id);
 res.redirect('/account/devices?password=changed');
});
router.get('/support',requireAuth,(req,res)=>{
 const rows=db.prepare('SELECT id,subject,category,message,status,escalated,created_at FROM support_requests WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.session.user.id);
 res.render('common/support',{rows});
});
router.post('/support',requireAuth,(req,res)=>{
 const category=String(req.body.category||'other'),subject=String(req.body.subject||'').trim().slice(0,150),message=String(req.body.message||'').trim().slice(0,3000);
 if(!['account','pickup','payment','collector','partner','technical','other'].includes(category)||!subject||!message)return res.status(400).send('Provide category, subject and message.');
 const id=db.prepare('INSERT INTO support_requests(user_id,subject,category,message,status) VALUES(?,?,?,?,\'open\')').run(req.session.user.id,subject,category,message).lastInsertRowid;
 db.prepare("INSERT INTO support_events(ticket_id,user_id,status,notes) VALUES(?,?,'open','User submitted ticket')").run(id,req.session.user.id);
 audit(req,'support_ticket_created','support_request',id);res.redirect('/support');
});
module.exports=router;
