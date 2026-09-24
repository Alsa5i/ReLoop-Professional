// Dependency-free route contract tests; not a substitute for an installed Express/browser run.
// These execute the actual route handlers with in-memory substitutes for Express/SQLite/bcrypt.
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const original=Module._load;
const users=new Map();const profiles={collector:[],partner:[],business:[]};const events=[];const notifications=[];const logins=[];
let sequence=5, checks=0;
for(const [id,role] of ['owner','admin','collector','partner','customer'].entries())users.set(role+'@reloop.test',{id:id+1,name:role,email:role+'@reloop.test',password:'hash:Correct-Horse-2026',role,status:'active'});
const db={
 prepare(sql){return {
  get(...args){if(sql.includes('SELECT * FROM users WHERE email=?'))return users.get(args[0])||[...users.values()].find(u=>u.username===args[1])||null;if(sql.includes('SELECT id FROM users WHERE email=?'))return users.get(args[0]);return null;},
  run(...args){
   if(sql.startsWith('INSERT INTO users(')){
    sequence++;const [name,email,password,role,phone,status,verification_status]=args;
    if(users.has(email))throw Error('UNIQUE constraint failed: users.email');
    users.set(email,{id:sequence,name,email,password,role,phone,status,verification_status});return {lastInsertRowid:sequence};
   }
   if(sql.startsWith('INSERT INTO collector_profiles'))profiles.collector.push(args);
   if(sql.startsWith('INSERT INTO partner_profiles'))profiles.partner.push(args);
   if(sql.startsWith('INSERT INTO customer_businesses'))profiles.business.push(args);
   return {lastInsertRowid:1};
  },all(){return [];}
 };},transaction(fn){return fn;}
};
const routers=[];
const express={Router(){const routes=[];const router={routes,get(p,...handlers){routes.push({method:'GET',p,handlers});},post(p,...handlers){routes.push({method:'POST',p,handlers});}};routers.push(router);return router;}};
const mocks={express,'bcryptjs':{hash:async p=>'hash:'+p,compare:async(p,h)=>h==='hash:'+p},
 '../db':{db,setting:()=>''},'../security':{authRateLimit:(req,res,next)=>next(),clearRateLimit:()=>{},finalizeLogin:(req,res,user,destination,welcome)=>{logins.push({user,destination,welcome});res.redirect(destination);}},
 '../services/audit':{audit:(...args)=>events.push(args)},'../services/notifications':{notifyRole:(...args)=>notifications.push(args)}};
Module._load=function(request,parent,...rest){if(parent?.filename?.includes('/src/routes/')&&Object.hasOwn(mocks,request))return mocks[request];return original.apply(this,arguments);};
const auth=require('../src/routes/auth');const pub=require('../src/routes/public');Module._load=original;
function route(router,method,p){const r=router.routes.find(r=>r.method===method&&(Array.isArray(r.p)?r.p.includes(p):r.p===p));assert(r,'missing '+method+' '+p);return r;}
async function run(router,method,p,body={},session={},query={}){
 const r=route(router,method,p),out={code:200,kind:null};
 const req={body,session,query,params:{},ip:'127.0.0.1',path:p};
 const res={status(code){out.code=code;return this;},render(view,data){out.kind='render';out.view=view;out.data=data;return this;},redirect(a,b){out.kind='redirect';out.url=b||a;return this;},sendStatus(code){out.code=code;out.kind='status';return this;}};
 let i=0;async function next(){const fn=r.handlers[i++];if(fn)await fn(req,res,next);}
 await next();return out;
}
(async()=>{
 for(const role of ['owner','admin','collector','partner','customer']){
  const out=await run(auth,'POST','/login',{email:role+'@reloop.test',password:'Correct-Horse-2026'});
  assert.equal(out.url,'/'+role,role+' should open its own workspace');checks++;
 }
 users.get('customer@reloop.test').username='recycleuser101';
 let usernameLogin=await run(auth,'POST','/login',{email:'recycleuser101',password:'Correct-Horse-2026'});assert.equal(usernameLogin.url,'/customer');checks++;
 let out=await run(auth,'GET','/owner/login');assert.equal(out.url,'/login');checks++;
 out=await run(auth,'POST','/owner/login',{email:'owner@reloop.test',password:'Correct-Horse-2026'});assert.equal(out.url,'/owner');checks++;
 out=await run(auth,'GET','/login',{}, {user:users.get('customer@reloop.test')});assert.equal(out.url,'/customer');checks++;
 out=await run(auth,'GET','/dashboard',{}, {user:users.get('partner@reloop.test')});assert.equal(out.url,'/partner');checks++;
 out=await run(auth,'POST','/login',{email:'owner@reloop.test',password:'wrong'});assert.equal(out.code,401);assert.equal(out.view,'auth/login');checks++;
 users.get('admin@reloop.test').status='suspended';out=await run(auth,'POST','/login',{email:'admin@reloop.test',password:'Correct-Horse-2026'});assert.equal(out.code,403);checks++;
 for(const [role,destination] of [['customer','/customer/pickups/new'],['business','/customer/business'],['collector','/collector'],['partner','/partner']]){
  out=await run(pub,'POST','/register',{role,name:'Example User',email:role+'-new@example.test',password:'Reliable-passphrase-2026',password_confirmation:'Reliable-passphrase-2026',business_name:'Example Recycling Facility',next:'pickup'});
  assert.equal(out.url,destination,role+' signup redirect');checks++;
  const record=users.get(role+'-new@example.test');assert.equal(record.role,role==='business'?'customer':role);checks++;
  if(['collector','partner'].includes(role)){assert.equal(record.verification_status,'pending_verification');checks++;}
 }
 out=await run(pub,'POST','/register',{role:'owner',name:'Not Owner',email:'fake-owner@test.local',password:'Reliable-passphrase-2026'});assert.equal(out.code,400);checks++;
 out=await run(pub,'POST','/register',{role:'customer',name:'Example User',email:'customer-new@example.test',password:'Reliable-passphrase-2026',password_confirmation:'Reliable-passphrase-2026'});assert.equal(out.code,409);assert.equal(out.data.duplicate,true);checks++;
 out=await run(pub,'POST','/register',{role:'customer',name:'Example User',email:'another@example.test',password:'short'});assert.equal(out.code,400);checks++;
 out=await run(pub,'POST','/register',{role:'customer',name:'Mismatch User',email:'mismatch@example.test',password:'Reliable-passphrase-2026',password_confirmation:'different-passphrase-2026'});assert.equal(out.code,400);assert.match(out.data.error,/do not match/);assert.equal(users.has('mismatch@example.test'),false);checks+=3;
 out=await run(pub,'GET','/become-collector');assert.equal(out.url,'/register?role=collector');checks++;
 out=await run(pub,'GET','/become-partner');assert.equal(out.url,'/register?role=partner');checks++;
 assert.equal(profiles.collector.length,1);checks++;
 assert.equal(profiles.partner.length,1);checks++;
 assert.equal(profiles.business.length,1);checks++;
 assert.equal(logins.filter(l=>l.user.role==='owner').length,2);checks++;
 console.log('PASS dependency-free actual-route login/signup contract tests:',checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
