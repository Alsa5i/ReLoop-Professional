/* ReLoop v1.0.1: progressive async operations and private-to-tab, non-secret form drafts. */
(()=>{
  'use strict';
  const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
  const app=$('.app-layout');
  const PREFIX='reloop.v101.draft.';
  const emailKey='reloop.v101.login.email';
  const rememberKey='reloop.v101.remember.email';
  const storage={
    read(store,key){try{return store.getItem(key);}catch{return null;}},
    write(store,key,value){try{store.setItem(key,value);}catch{}},
    del(store,key){try{store.removeItem(key);}catch{}}
  };
  const isSecret=el=>{
    const type=(el.type||'').toLowerCase(),name=(el.name||'').toLowerCase();
    if(!el.name||el.disabled||['password','hidden','file','submit','button','image','reset'].includes(type))return true;
    // Never retain passwords, payment identifiers, account verification, proofs or coordinates.
    return /password|secret|token|_csrf|card|bank|pin|provider_reference|verification|file_data|file_name|latitude|longitude|payout|commission|payment_provider_fee|amount|gross_value|id_reference|emergency_contact/i.test(name);
  };
  const draftKey=form=>{
    const identifier=app?.dataset.user||'guest';
    const action=new URL(form.getAttribute('action')||location.pathname,location.href).pathname;
    const forms=$$('form',form.closest('.app-main')||document).filter(f=>(f.getAttribute('action')||location.pathname) === (form.getAttribute('action')||location.pathname));
    return PREFIX+identifier+'.'+location.pathname+'.'+action+'.'+forms.indexOf(form);
  };
  const clearDraft=form=>storage.del(sessionStorage,draftKey(form));
  function saveDraft(form){
    if(form.dataset.noDraft!==undefined||form.method.toLowerCase()!=='post'||(!app&&!form.matches('[data-register-form]')))return;
    if(form.action.endsWith('/logout')||form.action.includes('/account/password'))return;
    const data={};
    for(const input of [...form.elements]){
      if(isSecret(input))continue;
      if(input.type==='radio'){if(input.checked)data[input.name]=input.value;}
      else if(input.type==='checkbox')data[input.name]=input.checked;
      else data[input.name]=input.value;
    }
    try{storage.write(sessionStorage,draftKey(form),JSON.stringify(data));}catch{}
  }
  function restoreDraft(form){
    if(form.dataset.noDraft!==undefined||form.method.toLowerCase()!=='post'||(!app&&!form.matches('[data-register-form]')))return;
    const raw=storage.read(sessionStorage,draftKey(form));if(!raw)return;
    let values;try{values=JSON.parse(raw);}catch{return;}
    for(const input of [...form.elements]){
      if(isSecret(input)||!Object.hasOwn(values,input.name))continue;
      if(input.type==='radio')input.checked=input.value===values[input.name];
      else if(input.type==='checkbox')input.checked=!!values[input.name];
      else input.value=values[input.name];
    }
  }
  // Session storage survives reloads in this tab. Persistent email requires an explicit checkbox.
  const loginEmail=$('#loginEmail'),remember=$('[data-remember-email]');
  if(loginEmail){
    const saved=storage.read(localStorage,rememberKey)||storage.read(sessionStorage,emailKey);
    if(saved&&!loginEmail.value)loginEmail.value=saved;
    if(remember)remember.checked=!!storage.read(localStorage,rememberKey);
    const updateEmail=()=>{
      storage.write(sessionStorage,emailKey,loginEmail.value.trim().slice(0,200));
      if(remember?.checked)storage.write(localStorage,rememberKey,loginEmail.value.trim().slice(0,200));
      else storage.del(localStorage,rememberKey);
    };
    loginEmail.addEventListener('input',updateEmail);
    remember?.addEventListener('change',updateEmail);
    $('#loginForm')?.addEventListener('submit',updateEmail);
  }
  function showInline(form,message,kind='error'){
    if(!form)return;
    let output=$('[data-form-message]',form);
    if(!output){
      output=document.createElement('div');output.dataset.formMessage='1';
      form.insertBefore(output,form.firstChild);
    }
    output.className='alert '+(kind==='success'?'success':kind==='loading'?'info':'danger')+' form-inline-message';
    output.setAttribute('role',kind==='success'||kind==='loading'?'status':'alert');
    output.textContent=String(message||'Could not complete the request. Please try again.').slice(0,800);
    output.hidden=false;
    if(kind==='error')output.focus?.({preventScroll:true});
  }
  function busy(form,active,submitter){
    form.dataset.submitting=active?'1':'0';
    if(submitter){
      if(active){submitter.dataset.oldLabel=submitter.textContent;submitter.disabled=true;submitter.textContent='Saving…';}
      else{submitter.disabled=false;if(submitter.dataset.oldLabel)submitter.textContent=submitter.dataset.oldLabel;delete submitter.dataset.oldLabel;}
    }
  }
  function rebindFragment(root){
    $$('[data-password-toggle]',root).forEach(button=>{
      const input=document.getElementById(button.dataset.passwordToggle);if(!input)return;
      button.addEventListener('click',()=>{const shown=input.type==='password';input.type=shown?'text':'password';button.textContent=shown?'Hide':'Show';button.setAttribute('aria-pressed',String(shown));});
    });
    $$('[data-proof-form]',root).forEach(form=>{
      const input=$('[data-proof-file]',form),data=$('[name="file_data"]',form),name=$('[name="file_name"]',form),status=$('[data-proof-status]',form);
      if(!input||!data||!name)return;
      input.addEventListener('change',()=>{
        data.value='';name.value='';const file=input.files?.[0];
        if(!file)return;
        if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){showInline(form,'Select a JPG, PNG, WebP or PDF up to 2 MB.');input.value='';return;}
        form.dataset.proofPending='1';if(status)status.textContent='Preparing file…';
        const reader=new FileReader();
        reader.onload=()=>{data.value=String(reader.result||'');name.value=file.name;form.dataset.proofPending='0';if(status)status.textContent='Ready to submit.';};
        reader.onerror=()=>{form.dataset.proofPending='0';showInline(form,'Could not read your file. Select it again.');};
        reader.readAsDataURL(file);
      });
    });
    $$('.badge',root).forEach(b=>{
      const s=(b.textContent||'').trim().toLowerCase();
      if(!b.children.length)b.textContent=s.replaceAll('_',' ');
      if(/completed|verified|paid|resolved|available|approved|active/.test(s))b.classList.add('success');
      else if(/cancelled|failed|rejected|suspended/.test(s))b.classList.add('danger');
      else if(/pending|assigned|busy|open|collected|requested/.test(s))b.classList.add('warning');
    });
  }
  if(app){$$('form',app).forEach(restoreDraft);try{Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX+'guest.')).forEach(k=>sessionStorage.removeItem(k));}catch{}}
  const registration=$('[data-register-form]');if(registration){restoreDraft(registration);registration.querySelector('input[name="role"]:checked')?.dispatchEvent(new Event('change',{bubbles:true}));}
  document.addEventListener('input',e=>{const form=e.target.closest('form');if(form)saveDraft(form);});
  document.addEventListener('change',e=>{const form=e.target.closest('form');if(form)saveDraft(form);});
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement))return;
    const action=new URL(form.getAttribute('action')||location.href,location.href);
    if(action.pathname==='/logout'){
      try{Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX)).forEach(k=>sessionStorage.removeItem(k));}catch{}
      return;
    }
    // Authentication redirects intentionally establish a NEW authenticated session.
    if(!app||form.method.toLowerCase()!=='post'||form.target||form.dataset.noAsync!==undefined||action.pathname==='/owner/backup')return;
    event.preventDefault();
    if(form.dataset.submitting==='1')return;
    const file=$('[data-proof-file]',form);
    if(file?.files?.length&&(form.dataset.proofPending==='1'||!$('[name="file_data"]',form)?.value)){
      showInline(form,'Your proof file is still being prepared. Please try again when it says ready.');return;
    }
    const submitter=event.submitter;
    const data=new FormData(form);
    if(submitter?.name)data.append(submitter.name,submitter.value);
    showInline(form,'Saving your changes…','loading');
    busy(form,true,submitter);
    try{
      const response=await fetch(action.href,{method:'POST',headers:{'X-ReLoop-Async':'1','Accept':'application/json, text/html'},body:new URLSearchParams(data),credentials:'same-origin',cache:'no-store'});
      if(response.redirected&&new URL(response.url).pathname==='/login'){location.assign('/login');return;}
      const contentType=response.headers.get('content-type')||'';
      let result,html='';
      if(contentType.includes('application/json'))result=await response.json();
      else html=await response.text();
      if(!response.ok || result?.ok===false){
        let message=result?.message||'';
        if(!message&&html){
          const doc=new DOMParser().parseFromString(html,'text/html');
          message=doc.querySelector('[role="alert"],.access-error,.error-screen .muted,.alert.danger')?.textContent?.trim()||'';
          if(!message&&!html.trim().startsWith('<'))message=html.trim().slice(0,500);
        }
        showInline(form,message||('Unable to save ('+response.status+'). Check your details and try again.'));
        return;
      }
      if(!result?.ok||!result.redirect){showInline(form,'Request completed.');return;}
      const dest=new URL(result.redirect,location.href);
      if(dest.origin!==location.origin)throw Error('Unsafe redirect rejected.');
      // Fetch the successful page, then replace only the dashboard content. No page reload.
      const view=await fetch(dest.href,{credentials:'same-origin',cache:'no-store',headers:{'Accept':'text/html'}});
      if(new URL(view.url).pathname==='/login'){
        location.assign('/login');return;
      }
      if(!view.ok)throw Error('Saved, but could not refresh this section. Open the destination page from the navigation.');
      const markup=await view.text();
      const doc=new DOMParser().parseFromString(markup,'text/html');
      const fresh=$('.app-main',doc),main=$('.app-main',document);
      if(!fresh||!main)throw Error('Saved, but this view needs a manual refresh.');
      const oldKey=draftKey(form);storage.del(sessionStorage,oldKey);
      main.replaceChildren(...[...fresh.childNodes].map(n=>document.importNode(n,true)));
      const nextUser=$('.topbar-user-label',doc),currentUser=$('.topbar-user-label',document);
      if(nextUser&&currentUser)currentUser.replaceChildren(...[...nextUser.childNodes].map(n=>document.importNode(n,true)));
      const heading=$('.topbar-titles',doc),title=$('.topbar-titles',document);
      if(heading&&title)title.replaceChildren(...[...heading.childNodes].map(n=>document.importNode(n,true)));
      document.title=doc.title||document.title;
      history.pushState({reloopAsync:true},'',dest.pathname+dest.search+dest.hash);
      $$('.app-sidebar a[data-nav-link]').forEach(link=>{
        const active=link.getAttribute('href')===dest.pathname;
        link.classList.toggle('active',active);
        if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      });
      rebindFragment(main);
      $$('form',main).forEach(restoreDraft);
      $('.app-main')?.focus({preventScroll:true});
    }catch(error){
      showInline(form,error?.message==='Failed to fetch'?'Internet connection required. No changes were confirmed; your fields are preserved.':error.message||'Could not complete your request. Try again.');
    }finally{busy(form,false,submitter);}
  },true);
  window.addEventListener('popstate',()=>{if(history.state?.reloopAsync)location.reload();});
})();
