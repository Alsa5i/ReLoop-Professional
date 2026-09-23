const fs=require('fs');
const path=require('path');
const {db}=require('../src/db');

(async()=>{
  const dir=path.join(__dirname,'..','backups');
  fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const target=path.join(dir,`reloop-${stamp}.sqlite`);
  await db.backup(target);
  console.log(`Backup created: ${target}`);
  db.close();
})().catch(err=>{console.error(err);process.exitCode=1;});
