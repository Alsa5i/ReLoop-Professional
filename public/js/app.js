// ReLoop UI behavior. No private data is placed in localStorage or the service-worker cache.
(()=>{
 'use strict';
 const $=(selector,root=document)=>root.querySelector(selector);
 const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
 const sidebar=$('#appSidebar');
 const open=$('[data-sidebar-open]');
 const backdrop=$('[data-sidebar-close]');
 const layout=$('.app-layout');
 let previousFocus=null;
 const compactKey='reloop.nav.compact';
 const isMobile=()=>window.matchMedia('(max-width:860px)').matches;
 function closeSidebar(){
   if(!sidebar)return;
   sidebar.classList.remove('open');document.body.classList.remove('nav-open');
   open?.setAttribute('aria-expanded','false');
   if(previousFocus&&isMobile())previousFocus.focus({preventScroll:true});
   previousFocus=null;
 }
 function showSidebar(){
   if(!sidebar)return;
   previousFocus=document.activeElement;
   sidebar.classList.add('open');document.body.classList.add('nav-open');
   open?.setAttribute('aria-expanded','true');
   const current=$('.nav-link.active',sidebar)||$('.nav-link',sidebar);
   if(current)current.focus({preventScroll:true});
 }
 open?.addEventListener('click',()=>sidebar?.classList.contains('open')?closeSidebar():showSidebar());
 backdrop?.addEventListener('click',closeSidebar);
 window.addEventListener('resize',()=>{if(!isMobile())closeSidebar();});
 if(layout&&!isMobile()&&localStorage.getItem(compactKey)==='1')layout.classList.add('nav-compact');
 $('[data-sidebar-collapse]')?.addEventListener('click',()=>{
   if(!layout)return;
   const collapsed=layout.classList.toggle('nav-compact');
   localStorage.setItem(compactKey,collapsed?'1':'0');
   $('[data-sidebar-collapse]')?.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
 });
 $$('.app-sidebar a[data-nav-link]').forEach(a=>a.addEventListener('click',closeSidebar));
 const publicToggle=$('[data-nav-toggle]');
 const publicMenu=$('[data-public-nav]');
 function closePublic(){publicMenu?.classList.remove('open');publicToggle?.setAttribute('aria-expanded','false');}
 publicToggle?.addEventListener('click',()=>{const expanded=publicMenu?.classList.toggle('open');publicToggle.setAttribute('aria-expanded',expanded?'true':'false');});
 $$('[data-public-nav] a').forEach(a=>a.addEventListener('click',closePublic));
 document.addEventListener('click',e=>{
   const confirmTarget=e.target.closest('[data-confirm]');
   if(confirmTarget&&!window.confirm(confirmTarget.dataset.confirm||'Are you sure?')){e.preventDefault();return;}
   if(publicMenu?.classList.contains('open')&&!e.target.closest('[data-public-nav],[data-nav-toggle]'))closePublic();
   const dismiss=e.target.closest('[data-dismiss-alert]');if(dismiss)dismiss.closest('.alert')?.remove();
 });
 // Native modal provides Escape and keyboard focus management.
 const finder=$('#pageFinder'),search=$('[data-page-search]'),results=$('[data-page-results]');
 let filtered=[],selection=0;
 const navigation=$$('.app-sidebar a[data-nav-link]').map(el=>({label:el.querySelector('.nav-label')?.textContent?.trim()||'',href:el.getAttribute('href')||''}));
 function drawResults(){
   if(!results)return;
   const query=(search?.value||'').trim().toLocaleLowerCase();
   filtered=navigation.filter(x=>x.label.toLocaleLowerCase().includes(query)).slice(0,12);
   selection=Math.min(selection,Math.max(filtered.length-1,0));
   results.replaceChildren();
   if(!filtered.length){const empty=document.createElement('p');empty.className='finder-empty';empty.textContent='No matching pages. Try “pickup”, “support”, or “payments”.';results.append(empty);return;}
   filtered.forEach((item,i)=>{
     const a=document.createElement('a');a.href=item.href;a.className='finder-result'+(i===selection?' selected':'');
     const name=document.createElement('span');name.textContent=item.label;
     const route=document.createElement('small');route.textContent=item.href;
     a.append(name,route);a.addEventListener('mouseenter',()=>{selection=i;$$('.finder-result',results).forEach((x,j)=>x.classList.toggle('selected',j===i));});results.append(a);
   });
 }
 function openFinder(){if(!finder||!navigation.length)return;selection=0;search.value='';drawResults();finder.showModal();search.focus();}
 $('[data-open-search]')?.addEventListener('click',openFinder);
 $('[data-close-search]')?.addEventListener('click',()=>finder?.close());
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'){closeSidebar();closePublic();}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&finder){e.preventDefault();finder.open?finder.close():openFinder();}
 });
 finder?.addEventListener('click',e=>{if(e.target===finder)finder.close();});
 search?.addEventListener('input',()=>{selection=0;drawResults();});
 search?.addEventListener('keydown',e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
     e.preventDefault();selection=Math.max(0,Math.min(filtered.length-1,selection+(e.key==='ArrowDown'?1:-1)));drawResults();
   }
   if(e.key==='Enter'&&filtered[selection]){e.preventDefault();location.assign(filtered[selection].href);}
 });
 $$('.badge').forEach(b=>{
   const value=(b.textContent||'').trim().toLowerCase();
   if(!b.children.length)b.textContent=value.replaceAll('_',' ');
   if(/completed|verified|delivered|received|paid|resolved|available|approved|active/.test(value))b.classList.add('success');
   else if(/cancelled|failed|rejected|suspended|fraud/.test(value))b.classList.add('danger');
   else if(/pending|investigating|assigned|busy|open|collected|requested|processing/.test(value))b.classList.add('warning');
 });
 // ReLoop shared sign-in and registration: show/hide password without transmitting it anywhere.
 $$('[data-password-toggle]').forEach(button=>{
   const field=document.getElementById(button.dataset.passwordToggle);if(!field)return;
   button.addEventListener('click',()=>{const shown=field.type==='password';field.type=shown?'text':'password';button.textContent=shown?'Hide':'Show';button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-label',(shown?'Hide':'Show')+' password');field.focus({preventScroll:true});});
 });
 const register=$('[data-register-form]');
 if(register){
   const chooseRole=()=>{const role=$('input[name="role"]:checked',register)?.value||'customer';
     $$('[data-role-extra]',register).forEach(section=>{const active=section.dataset.roleExtra===role;section.hidden=!active;$$('input',section).forEach(input=>{input.disabled=!active;input.required=active&&((role==='partner'&&input.name==='business_name')||(role==='business'&&input.name==='business_name'));});});
   };
   $$('input[name="role"]',register).forEach(input=>input.addEventListener('change',chooseRole));chooseRole();
 }
 // Feedback is indeterminate: we never display a made-up percentage or claim saving has succeeded.
 const feedback=$('[data-action-feedback]');
 function showFeedback(message='Opening page…'){
   if(!feedback)return;
   const span=$('[data-action-text]',feedback);if(span)span.textContent=message;
   feedback.hidden=false;
 }
 window.addEventListener('pageshow',()=>{if(feedback)feedback.hidden=true;$$('form').forEach(form=>{delete form.dataset.submitting;});$$('button[data-working]').forEach(b=>{b.disabled=false;b.removeAttribute('data-working');if(b.dataset.originalLabel)b.textContent=b.dataset.originalLabel;b.removeAttribute('data-original-label');});});
 $$('form').forEach(form=>{
   // A native submit event fires only once browser form validation succeeds.
   form.addEventListener('submit',e=>{
     if(e.defaultPrevented)return;
     if(form.dataset.submitting==='1'){e.preventDefault();return;}
     const selected=$('[data-proof-file]',form);
     const status=$('[data-proof-status]',form);
     if(selected?.files?.length){
       if(form.dataset.proofPending==='1'||!form.querySelector('[name="file_data"]')?.value){
         e.preventDefault();if(status)status.textContent='Your file is still being prepared. Try again when it says ready.';return;
       }
     }
     form.dataset.submitting='1';
     const submitter=e.submitter;
     if(submitter){submitter.dataset.working='1';const label=submitter.textContent.trim();submitter.dataset.originalLabel=label;submitter.textContent='Please wait…';}
     const pathname=form.getAttribute('action')||'';
     const verb=form.getAttribute('method')?.toLowerCase()==='post';
     if(verb&&pathname!=='/logout')showFeedback(pathname.includes('verify')?'Recording verification…':pathname.includes('payment')?'Submitting payment review…':pathname.includes('pickup')?'Updating pickup…':'Saving your changes…');
   });
 });
 $$('[data-proof-form]').forEach(form=>{
   const input=$('[data-proof-file]',form),data=$('input[name="file_data"]',form),name=$('input[name="file_name"]',form),status=$('[data-proof-status]',form);
   if(!input||!data||!name)return;
   input.addEventListener('change',()=>{
     data.value='';name.value='';if(status)status.textContent='';
     const f=input.files?.[0];if(!f){form.dataset.proofPending='0';return;}
     if(f.size>2*1024*1024){if(status)status.textContent='File too large. The maximum size is 2 MB.';input.value='';return;}
     if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)){if(status)status.textContent='Use a JPG, PNG, WebP or PDF file.';input.value='';return;}
     form.dataset.proofPending='1';if(status)status.textContent='Preparing private proof…';
     const reader=new FileReader();
     reader.onload=()=>{data.value=String(reader.result||'');name.value=f.name;form.dataset.proofPending='0';if(status)status.textContent='Ready to save.';};
     reader.onerror=()=>{form.dataset.proofPending='0';if(status)status.textContent='Could not read file. Choose another file.';};
     reader.readAsDataURL(f);
   });
 });
 $$('a[href^="/"]').forEach(a=>a.addEventListener('click',e=>{
   if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download')||a.target==='_blank'||a.pathname===location.pathname&&a.search===location.search)return;
   if(!a.closest('.app-sidebar,.app-topbar,.app-main,.public-nav,.site-footer'))return;
   setTimeout(()=>showFeedback('Opening page…'),180);
 }));
 // PWA install: direct browser prompt when supported; clear manual instructions otherwise.
 const installButtons=$$('[data-install-pwa]');
 const installStatus=$('[data-install-status]');
 const setInstallStatus=message=>{if(installStatus)installStatus.textContent=message;};
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 let installPrompt=null;
 if('serviceWorker' in navigator&&window.isSecureContext){
   window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{setInstallStatus('App installation needs a secure connection and a supported browser.');}));
 }
 window.addEventListener('beforeinstallprompt',event=>{
   event.preventDefault();installPrompt=event;
   if(!standalone())installButtons.forEach(button=>button.hidden=false);
   setInstallStatus('This device can install ReLoop directly. Tap the install button.');
 });
 installButtons.forEach(button=>button.addEventListener('click',async()=>{
   if(!installPrompt){location.assign('/install');return;}
   const pending=installPrompt;installPrompt=null;button.disabled=true;
   try{await pending.prompt();const result=await pending.userChoice;
     setInstallStatus(result?.outcome==='accepted'?'Follow your device prompt to finish installing.':'You can install later from the browser menu.');
   }catch{setInstallStatus('Use your browser menu to add ReLoop to your home screen.');}
   finally{button.disabled=false;installButtons.forEach(el=>el.hidden=true);}
 }));
 window.addEventListener('appinstalled',()=>{installPrompt=null;installButtons.forEach(button=>button.hidden=true);setInstallStatus('ReLoop was installed on this device.');});
 if(standalone())setInstallStatus('You are using ReLoop as an installed app.');
 const connectivity=$('[data-connection-status]');
 const updateConnectivity=()=>{if(connectivity)connectivity.textContent=navigator.onLine?'Connected · pickup actions need an active connection.':'Offline · Internet is required to update pickup status.';};
 window.addEventListener('online',updateConnectivity);window.addEventListener('offline',updateConnectivity);updateConnectivity();
})();
