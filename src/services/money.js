function currencyDigits(){const {setting}=require('../db');return ['UGX','JPY','RWF'].includes(setting('payment_currency','UGX'))?0:2;}
function toMinor(value,digits=currencyDigits()){
 const s=String(value).trim();if(!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(s))throw Error('Invalid monetary amount');
 const [major,decimal='']=s.split('.');if(decimal.length>digits)throw Error('Too many fractional currency units');
 const n=BigInt(major)*10n**BigInt(digits)+BigInt((decimal.padEnd(digits,'0'))||'0');
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Monetary amount is too large');return Number(n);
}
function fromMinor(amount,digits=currencyDigits()){return amount/(10**digits);}
function commissionMinor(gross,percent,fixed,minimum,digits=currencyDigits()){
 const pct=toMinor(percent,2);// basis points: 5%=500 bp
 const fixedMinor=toMinor(fixed,digits),minMinor=toMinor(minimum,digits);
 const percentage=(BigInt(gross)*BigInt(pct)+5000n)/10000n;
 const fee=percentage+BigInt(fixedMinor);
 return Number([BigInt(gross),fee>BigInt(minMinor)?fee:BigInt(minMinor)].reduce((a,b)=>a<b?a:b));
}
function validateAllocation(gross,commission,provider,collector,partner){
 const all=[gross,commission,provider,collector,partner];
 return all.every(n=>Number.isSafeInteger(n)&&n>=0)&&commission+provider+collector+partner<=gross;
}
module.exports={currencyDigits,toMinor,fromMinor,commissionMinor,validateAllocation};
