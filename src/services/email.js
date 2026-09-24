const config = require('../config');
function mailReady(){
  const m=config.smtp;
  return Boolean(m.host && m.from && (!m.user || m.pass));
}
async function sendPasswordReset(email, name, url){
  if(!mailReady()) return false;
  // No provider delivery is claimed until the SMTP relay actually accepts the message.
  const nodemailer=require('nodemailer');
  const m=config.smtp;
  const transporter=nodemailer.createTransport({host:m.host,port:m.port,secure:m.secure,
    ...(m.user?{auth:{user:m.user,pass:m.pass}}:{}),connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  await transporter.sendMail({from:m.from,to:email,subject:'Reset your ReLoop password',
    text:`Hello ${name},\n\nA password reset was requested for your ReLoop account. Open this link within 30 minutes:\n${url}\n\nIf you did not request this, you can ignore this email.\n\nReLoop Support`,
    html:undefined});
  return true;
}
module.exports={mailReady,sendPasswordReset};
