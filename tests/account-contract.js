// Dependency-free executable handler tests. Live Express/browser testing still required.
const assert=require('node:assert/strict');
const Module=require('node:module');const original=Module._load;
let n=0;const users=new Map(),auditEvents=[],revocations=[];
const roles=['customer','collector','partner','admin','owner'];
for(const [i,role] of roles.entries())users.set(i+1,{id:i+1,name:'Old '+role,username:null,email:role+'@test.invalid',phone:'',password:'hash:'+role+'-original-passphrase',role,status:'active',verification_status:'verified',created_at:'today'});
const db={prepare(sql){return {
 get(...args){
  if(sql.includes('SELECT id,name,username,email,phone'))return users.get(args[0]);
  if(sql.includes('SELECT id FROM users WHERE (username=? OR email=?)'))return [...users.values()].find(u=>u.id!==args[2]&&(u.username===args[0]||u.email===args[1]))||null;
  if(sql.includes('SELECT password FROM users WHERE id=?'))return users.get(args[0]);
  return null;
 },
 all(...args){if(sql.includes('FROM app_sessions'))return [];return [];},
 run(...args){
  if(sql.includes('UPDATE users SET name=?,username=?,phone=')){const u=users.get(args[3]);u.name=args[0];u.username=args[1];u.phone=args[2];return {changes:1};}
  if(sql.includes('UPDATE users SET password=')){users.get(args[1]).password=args[0];return {changes:1};}
  return {changes:1,lastInsertRowid:1};
 }
};}};
const fake={
 express:{Router(){const routes=[];return {routes,get(p,...handlers){routes.push({method:'GET',p,handlers});},post(p,...handlers){routes.push({method:'POST',p,handlers});}};}},
 bcryptjs:{compare:async(p,h)=>h==='hash:'+p,hash:async p=>'hash:'+p},
 '../db':{db},'../security':{requireAuth:(req,res,next)=>next(),revokeOtherSessions:(id,sid)=>revocations.push({id,sid})},
 '../services/audit':{audit:(...args)=>auditEvents.push(args)}
};
Module._load=function(request,parent,...args){if(parent?.filename?.includes('/src/routes/')&&Object.hasOwn(fake,request))return fake[request];return original.apply(this,arguments);};
const routes=require('../src/routes/common').routes;Module._load=original;
async function hit(path,body,id){const r=routes.find(r=>r.method==='POST'&&r.p===path);assert(r,'Missing '+path);const req={session:{user:{...users.get(id)}},sessionID:'sid-'+id,body,path};const out={code:200};const res={status(c){out.code=c;return this;},render(view,data){out.view=view;out.data=data;return this;},redirect(url){out.url=url;return this;}};
 let index=0;async function next(){const handler=r.handlers[index++];if(handler)await handler(req,res,next);}await next();return out;
}
(async()=>{
 for(const [i,role] of roles.entries()){
  const id=i+1;let out=await hit('/profile',{name:role+' Name',username:role+'101',phone:'+256700000000'},id);
  assert.equal(out.url,'/profile?saved=1');assert.equal(users.get(id).name,role+' Name');assert.equal(users.get(id).username,role+'101');n+=3;
  out=await hit('/account/password',{old_password:role+'-original-passphrase',new_password:role+'-New-Passphrase!',confirm_password:role+'-New-Passphrase!'},id);
  assert.equal(out.url,'/account/devices?password=changed');assert.equal(users.get(id).password,'hash:'+role+'-New-Passphrase!');n+=2;
  assert.equal(revocations.at(-1).id,id);n++;
  out=await hit('/account/password',{old_password:role+'-original-passphrase',new_password:'Something-new-2026',confirm_password:'Something-new-2026'},id);
  assert.equal(out.code,400);assert.equal(out.view,'common/devices');n+=2;
  out=await hit('/account/password',{old_password:role+'-New-Passphrase!',new_password:'Something-new-2026',confirm_password:'Different-2026'},id);
  assert.equal(out.code,400);assert.match(out.data.error,/do not match/);n+=2;
 }
 let out=await hit('/profile',{name:'Test',username:'owner101',phone:''},1);assert.equal(out.code,400);assert.match(out.data.error,/already in use/);n+=2;
 out=await hit('/profile',{name:'Test',username:'not valid!',phone:''},1);assert.equal(out.code,400);n++;
 assert.equal(users.get(5).password,'hash:owner-New-Passphrase!');n++;
 assert.notEqual(users.get(1).password,users.get(2).password);n++;
 assert.equal(auditEvents.filter(ev=>ev[1]==='PASSWORD_CHANGED').length,5);n++;
 console.log('PASS role profile/username/individual-password contracts:',n);
})().catch(e=>{console.error(e);process.exitCode=1;});
