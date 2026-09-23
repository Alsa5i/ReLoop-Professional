function paginate(req,db,sql,params=[],size=50){
 const raw=Number(req.query.page||1),page=Number.isSafeInteger(raw)?Math.max(1,Math.min(raw,100000)):1;
 const rows=db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...params,size+1,(page-1)*size);
 const hasNext=rows.length>size;rows.length=Math.min(size,rows.length);
 const paramsOut=new URLSearchParams();for(const [k,v] of Object.entries(req.query)){if(k!=='page'&&typeof v==='string')paramsOut.set(k,v);}
 const link=p=>{paramsOut.set('page',String(p));return req.path+'?'+paramsOut.toString();};
 return {rows,page,prev:page>1?link(page-1):null,next:hasNext?link(page+1):null};
}
module.exports={paginate};
