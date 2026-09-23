const { db } = require('../db');
function notify(userId,title,message,link=null){
  if(!userId) return;
  db.prepare('INSERT INTO notifications(user_id,title,message,link) VALUES(?,?,?,?)').run(userId,title,message,link);
}
function notifyRole(role,title,message,link=null){
  const users=db.prepare("SELECT id FROM users WHERE role=? AND status='active'").all(role);
  users.forEach(u=>notify(u.id,title,message,link));
}
module.exports={notify,notifyRole};
