const { db, token } = require('../db');
const config = require('../config');
const { notify, notifyRole } = require('./notifications');

const transitions={
  pending:['approved','cancelled'],
  approved:['assigned','accepted','cancelled'],
  assigned:['accepted','cancelled'],
  accepted:['en_route','cancelled'],
  en_route:['arrived','cancelled'],
  arrived:['collected','cancelled'],
  collected:['delivered'],
  delivered:['verified'],
  verified:['completed'],
  completed:[], cancelled:[]
};
function makeReference(){ return `RL-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${token(4).toUpperCase()}`; }
function getPickup(id){
  return db.prepare(`SELECT p.*, c.name customer_name,c.phone customer_phone,mc.name material_name,mc.unit,
      col.name collector_name,pp.business_name partner_name
    FROM pickup_requests p
    JOIN users c ON c.id=p.customer_id
    LEFT JOIN material_categories mc ON mc.id=p.category_id
    LEFT JOIN users col ON col.id=p.assigned_collector_id
    LEFT JOIN partner_profiles pp ON pp.user_id=p.partner_id
    WHERE p.id=?`).get(id);
}
function transitionPickup({pickupId,toStatus,userId,notes='',force=false,extra={}}){
  const tx=db.transaction(()=>{
    const p=db.prepare('SELECT * FROM pickup_requests WHERE id=?').get(pickupId);
    if(!p) throw new Error('Pickup not found');
    if(!config.pickupStatuses.includes(toStatus)) throw new Error('Invalid pickup status');
    if(!force && !(transitions[p.status]||[]).includes(toStatus)) throw new Error(`Cannot move pickup from ${p.status} to ${toStatus}`);
    const fields=['status=?','updated_at=CURRENT_TIMESTAMP']; const values=[toStatus];
    const timestampField={accepted:'accepted_at',collected:'collected_at',delivered:'delivered_at',verified:'verified_at',completed:'completed_at',cancelled:'cancelled_at'}[toStatus];
    if(timestampField) fields.push(`${timestampField}=CURRENT_TIMESTAMP`);
    Object.entries(extra).forEach(([k,v])=>{ const allowed=['assigned_collector_id','partner_id','collected_weight','verified_weight','verifier_id','verification_notes']; if(allowed.includes(k)){ fields.push(`${k}=?`); values.push(v); } });
    values.push(pickupId);
    db.prepare(`UPDATE pickup_requests SET ${fields.join(',')} WHERE id=?`).run(...values);
    db.prepare('INSERT INTO pickup_status_history(pickup_id,previous_status,new_status,changed_by,notes) VALUES(?,?,?,?,?)').run(pickupId,p.status,toStatus,userId,notes||null);
    return db.prepare('SELECT * FROM pickup_requests WHERE id=?').get(pickupId);
  });
  const updated=tx();
  const customerId=updated.customer_id, collectorId=updated.assigned_collector_id, partnerId=updated.partner_id;
  notify(customerId,'Pickup updated',`Your pickup ${updated.reference} is now ${toStatus.replaceAll('_',' ')}.`,`/customer/pickups/${pickupId}`);
  if(collectorId && collectorId!==userId) notify(collectorId,'Pickup updated',`${updated.reference} is now ${toStatus.replaceAll('_',' ')}.`,`/collector/pickups/${pickupId}`);
  if(partnerId && partnerId!==userId) notify(partnerId,'Delivery updated',`${updated.reference} is now ${toStatus.replaceAll('_',' ')}.`,`/partner`);
  return updated;
}
function claimPickup(pickupId, collectorId){
  const tx=db.transaction(()=>{
    const profile=db.prepare("SELECT * FROM collector_profiles WHERE user_id=? AND verification_status='verified' AND availability='available'").get(collectorId);
    if(!profile) throw new Error('Collector must be verified and available to accept jobs.');
    const p=db.prepare("SELECT * FROM pickup_requests WHERE id=? AND status='approved' AND assigned_collector_id IS NULL").get(pickupId);
    if(!p) throw new Error('This pickup is no longer available.');
    const result=db.prepare("UPDATE pickup_requests SET assigned_collector_id=?,status='accepted',accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='approved' AND assigned_collector_id IS NULL").run(collectorId,pickupId);
    if(result.changes!==1) throw new Error('Another collector already accepted this pickup.');
    db.prepare("INSERT INTO pickup_status_history(pickup_id,previous_status,new_status,changed_by,notes) VALUES(?,?,?,?,?)").run(pickupId,'approved','accepted',collectorId,'Collector accepted available job');
    return db.prepare('SELECT * FROM pickup_requests WHERE id=?').get(pickupId);
  });
  const p=tx();
  notify(p.customer_id,'Collector assigned',`A collector accepted pickup ${p.reference}.`,`/customer/pickups/${pickupId}`);
  notifyRole('admin','Pickup claimed',`${p.reference} was accepted by a collector.`,`/admin/pickups/${pickupId}`);
  notifyRole('owner','Pickup claimed',`${p.reference} was accepted by a collector.`,`/admin/pickups/${pickupId}`);
  return p;
}
function recalcCollectorRating(collectorId){
  const r=db.prepare('SELECT AVG(stars) rating, COUNT(*) count FROM ratings WHERE collector_id=?').get(collectorId);
  db.prepare('UPDATE collector_profiles SET rating=?,completed_pickups=(SELECT COUNT(*) FROM pickup_requests WHERE assigned_collector_id=? AND status=\'completed\') WHERE user_id=?')
    .run(Number(r.rating||0).toFixed(2),collectorId,collectorId);
}
module.exports={makeReference,getPickup,transitionPickup,claimPickup,recalcCollectorRating};
