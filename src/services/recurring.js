const {db,token}=require('../db');
function dateNext(date,frequency){const d=new Date(`${date}T12:00:00Z`);if(!Number.isFinite(d.getTime()))throw Error('Invalid recurrence date');if(frequency==='monthly')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+(frequency==='biweekly'?14:7));return d.toISOString().slice(0,10);}
function generateRecurring(today=new Date().toISOString().slice(0,10)){
 let made=0;
 for(const s of db.prepare(`SELECT * FROM recurring_pickups WHERE active=1 AND next_date<=? ORDER BY id LIMIT 300`).all(today)){
  const location=db.prepare('SELECT * FROM customer_locations WHERE id=? AND customer_id=? AND active=1').get(s.location_id,s.customer_id);
  const customer=db.prepare("SELECT id FROM users WHERE id=? AND status='active'").get(s.customer_id);
  if(!location||!customer)continue;
  db.transaction(()=>{
   const next=db.prepare('SELECT next_date FROM recurring_pickups WHERE id=?').get(s.id);
   if(!next||next.next_date!==s.next_date)return;
   const ref=`RL-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${token(4).toUpperCase()}`;
   const info=db.prepare(`INSERT OR IGNORE INTO pickup_requests(reference,customer_id,category_id,estimated_weight,address,area,city,landmark,preferred_time,notes,qr_token,recurring_schedule_id)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(ref,s.customer_id,s.category_id,s.estimated_weight,location.address,location.area,location.city,location.landmark,s.next_date,'Generated from recurring business pickup schedule',token(18),s.id);
   if(info.changes){db.prepare("INSERT INTO pickup_status_history(pickup_id,previous_status,new_status,changed_by,notes) VALUES(?,NULL,'pending',?,'Recurring pickup generated')").run(info.lastInsertRowid,s.customer_id);made++;}
   db.prepare('UPDATE recurring_pickups SET next_date=? WHERE id=?').run(dateNext(s.next_date,s.frequency),s.id);
  })();
 }
 return made;
}
module.exports={generateRecurring,dateNext};
