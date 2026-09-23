document.addEventListener('click',e=>{
  const c=e.target.closest('[data-confirm]');
  if(c&&!confirm(c.dataset.confirm||'Are you sure?')) e.preventDefault();
  const toggle=e.target.closest('[data-nav-toggle]');
  if(toggle){ const nav=document.querySelector('[data-public-nav]'); if(nav)nav.classList.toggle('open'); }
});

document.querySelectorAll('[data-proof-form]').forEach(form=>{
  const file=form.querySelector('[data-proof-file]');
  const data=form.querySelector('input[name="file_data"]');
  const name=form.querySelector('input[name="file_name"]');
  const status=form.querySelector('[data-proof-status]');
  if(!file)return;
  file.addEventListener('change',()=>{
    data.value=''; name.value=''; status.textContent='';
    const f=file.files&&file.files[0]; if(!f)return;
    if(f.size>2*1024*1024){ status.textContent='File is too large. Maximum 2 MB.'; file.value=''; return; }
    const allowed=['image/jpeg','image/png','image/webp','application/pdf'];
    if(!allowed.includes(f.type)){ status.textContent='Unsupported file type.'; file.value=''; return; }
    const reader=new FileReader(); status.textContent='Preparing private proof…';
    reader.onload=()=>{ data.value=String(reader.result||''); name.value=f.name; status.textContent='Proof ready to save.'; };
    reader.onerror=()=>{status.textContent='Could not read file.'};
    reader.readAsDataURL(f);
  });
});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
let reloopInstallPrompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();reloopInstallPrompt=event;const btn=document.querySelector('[data-install-pwa]');if(btn)btn.hidden=false;});
document.querySelector('[data-install-pwa]')?.addEventListener('click',async()=>{if(reloopInstallPrompt){reloopInstallPrompt.prompt();await reloopInstallPrompt.userChoice;reloopInstallPrompt=null;}});
