const express=require('express');
const {db}=require('../db');
const {requireRole}=require('../security');
const {audit}=require('../services/audit');
const router=express.Router();
const modules=[
 ['customers','Customers',['customer_name','phone','area','type','status']],['pickups','Pickups',['customer_name','material','weight','area','status']],['materials','Materials',['material_name','rate','unit','category','status']],['collectors','Collectors',['collector_name','phone','vehicle','area','status']],['routes','Routes',['route_name','collector','area','date','status']],['partners','Partners',['partner_name','type','phone','area','status']],['rewards','Rewards',['customer_name','points','value','date','status']],['transactions','Transactions',['reference','type','weight','value','status']],['businesses','Businesses',['business_name','contact','area','frequency','status']],['bins','Smart Bins',['bin_ref','area','capacity','fill_level','status']],['impact','Impact',['period','plastic_kg','metal_kg','co2_saved','status']],['reports','Reports',['report_name','period','value','created','status']]
].map(([key,label,fields])=>({key,label,fields}));
function mod(key){return modules.find(m=>m.key===key)}
router.use(requireRole('owner','admin'));
router.get('/',(req,res)=>res.render('legacy/index',{modules}));
router.get('/module/:key',(req,res)=>{const m=mod(req.params.key);if(!m)return res.status(404).send('Legacy module not found');const q=String(req.query.q||'').toLowerCase();let rows=db.prepare('SELECT * FROM records WHERE module=? ORDER BY id DESC').all(m.key).map(r=>({...r,data:JSON.parse(r.data)}));if(q)rows=rows.filter(r=>JSON.stringify(r.data).toLowerCase().includes(q));res.render('legacy/module',{mod:m,rows,q});});
router.get('/module/:key/new',(req,res)=>{const m=mod(req.params.key);if(!m)return res.status(404).send('Not found');res.render('legacy/form',{mod:m,row:null,error:null});});
router.post('/module/:key/new',(req,res)=>{const m=mod(req.params.key);if(!m)return res.status(404).send('Not found');const data={};m.fields.forEach(f=>data[f]=String(req.body[f]||'').trim());if(!data[m.fields[0]])return res.status(400).render('legacy/form',{mod:m,row:{data},error:'First field is required'});const info=db.prepare('INSERT INTO records(module,data,status) VALUES(?,?,?)').run(m.key,JSON.stringify(data),data.status||'Active');audit(req,'legacy_record_created',m.key,info.lastInsertRowid);res.redirect('/legacy/module/'+m.key);});
router.get('/module/:key/:id/edit',(req,res)=>{const m=mod(req.params.key),r=db.prepare('SELECT * FROM records WHERE id=? AND module=?').get(req.params.id,req.params.key);if(!m||!r)return res.status(404).send('Not found');res.render('legacy/form',{mod:m,row:{...r,data:JSON.parse(r.data)},error:null});});
router.post('/module/:key/:id/edit',(req,res)=>{const m=mod(req.params.key);if(!m)return res.status(404).send('Not found');const data={};m.fields.forEach(f=>data[f]=String(req.body[f]||'').trim());db.prepare('UPDATE records SET data=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND module=?').run(JSON.stringify(data),data.status||'Active',req.params.id,m.key);audit(req,'legacy_record_updated',m.key,req.params.id);res.redirect('/legacy/module/'+m.key);});
router.post('/module/:key/:id/delete',(req,res)=>{db.prepare('DELETE FROM records WHERE id=? AND module=?').run(req.params.id,req.params.key);audit(req,'legacy_record_deleted',req.params.key,req.params.id);res.redirect('/legacy/module/'+req.params.key);});
module.exports=router;
