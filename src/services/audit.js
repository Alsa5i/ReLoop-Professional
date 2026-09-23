const { db } = require('../db');
function audit(req, action, entityType='', entityId='', metadata={}){
  try{
    db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,ip,metadata) VALUES(?,?,?,?,?,?)')
      .run(req.session.user?.id||null, action, entityType||null, entityId?String(entityId):null, req.ip||null, JSON.stringify(metadata||{}));
  }catch(e){ console.error('Audit log error:',e.message); }
}
module.exports={audit};
