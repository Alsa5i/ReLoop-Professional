const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');const source=f=>fs.readFileSync(path.join(root,f),'utf8');
let checks=0;const has=(f,pattern)=>{assert.match(source(f),pattern,f+' missing '+pattern);checks++};
const match=[['src/db.js',/CREATE TABLE IF NOT EXISTS app_sessions/],['src/db.js',/CREATE TABLE IF NOT EXISTS recurring_pickups/],['src/db.js',/CREATE TABLE IF NOT EXISTS recycling_campaigns/],['src/db.js',/CREATE TABLE IF NOT EXISTS support_events/],['src/db.js',/gross_minor/],['src/security.js',/customer:3,collector:2,partner:3,admin:3,owner:2/],['src/security.js',/DELETE FROM app_sessions WHERE user_id=\? AND sid<>\?/],['src/config.js',/unique SESSION_SECRET/],['src/routes/common.js',/account\/devices/],['src/routes/common.js',/PASSWORD_CHANGED/],['src/routes/customer.js',/INSERT INTO recurring_pickups/],['src/services/recurring.js',/pickup_status_history/],['src/routes/collector.js',/File content does not match declared file type/],['src/routes/public.js',/campaigns/],['src/routes/admin.js',/campaign_pickups/],['src/routes/owner.js',/BACKUP_CREATED/],['public/sw.js',/ASSETS.includes/],['public/offline.html',/Internet connection is required to update pickup status/],['server.js',/\/health/],['src/routes/auth.js',/LOGIN_FAILED/]];
match.forEach(([f,p])=>has(f,p));
assert(!/caches\.open.*\/customer/.test(source('public/sw.js')));checks++;
const refs=[...fs.readdirSync(path.join(root,'src/routes')),'__server__'];
for(const ref of refs){const js=ref==='__server__'?'server.js':`src/routes/${ref}`;for(const m of source(js).matchAll(/res\.render\(['"]([^'"]+)['"]/g)){assert(fs.existsSync(path.join(root,'views',m[1]+'.ejs')),`Missing view ${js} -> ${m[1]}`);checks++;}}
const money=require('../src/services/money');
assert.strictEqual(money.toMinor('1000',0),1000);checks++;
assert.strictEqual(money.toMinor('24.50',2),2450);checks++;
assert.strictEqual(money.commissionMinor(10000,'5','10','0',0),510);checks++;
assert.strictEqual(money.validateAllocation(10000,510,500,3000,2000),true);checks++;
assert.strictEqual(money.validateAllocation(10000,9000,500,3000,2000),false);checks++;
console.log('PASS static/security/view/financial checks:',checks);
