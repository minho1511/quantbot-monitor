/* Public KRW input; the existing owner-only Telegram channel saves the setting. */
(() => {
  const parent = document.getElementById('strategy-deployment');
  if (!parent) return;
  const style = document.createElement('style');
  style.textContent = '.capital-budget{margin:20px 0;padding:20px;border:1px solid #456078;border-radius:12px;background:#111c28}.capital-budget h3{margin:0 0 12px}.capital-budget label{display:block;font-size:14px;margin-bottom:8px}.capital-budget-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.capital-budget input{box-sizing:border-box;max-width:100%;width:230px;min-height:44px;border:1px solid #637b92;border-radius:7px;background:#0b1520;color:#eef5fc;padding:10px;font-size:18px}.capital-budget a{display:inline-flex;min-height:44px;align-items:center;padding:0 16px;background:#82dfb5;color:#0a2018;border-radius:7px;font-weight:700;text-decoration:none}.capital-budget a[aria-disabled=true]{opacity:.45;cursor:default}.capital-budget input:focus-visible,.capital-budget a:focus-visible{outline:3px solid #fff;outline-offset:3px}.capital-budget p{font-size:13px;line-height:1.7;color:#a9bbcf}.capital-budget .budget-status{color:#f0be75}.capital-budget .budget-error{color:#ff9c9c}.capital-budget code{overflow-wrap:anywhere;user-select:all}';
  document.head.append(style);
  const el = (tag, text, cls) => {const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const box=el('section',null,'capital-budget');box.id='capital-budget';
  box.append(el('h3','AMD2 · 토스 봇 운용 한도'));
  const label=el('label','운용 한도(원)');label.htmlFor='capital-budget-amount';
  const input=el('input');input.id='capital-budget-amount';input.type='text';input.inputMode='numeric';input.autocomplete='off';input.placeholder='금액 직접 입력';input.maxLength=15;input.setAttribute('aria-describedby','capital-budget-help capital-budget-error');
  const save=el('a','금액 저장 · 텔레그램');save.target='_blank';save.rel='noopener noreferrer';
  const row=el('div',null,'capital-budget-row');row.append(input,el('span','원'),save);
  const error=el('p',null,'budget-error');error.id='capital-budget-error';error.setAttribute('aria-live','polite');
  const help=el('p','봇에 배정할 원화 금액을 입력하고 본인 텔레그램으로 저장해 주세요. 현재 이 한도는 토스 주문에 아직 적용되지 않습니다. 저장만으로 기존 보유 종목이나 자금이 이동하지 않습니다.');help.id='capital-budget-help';
  const state=el('p','저장 상태 확인 중','budget-status');state.setAttribute('aria-live','polite');
  const command=el('code');const fallback=el('p','텔레그램이 열려도 응답이 없으면 아래 명령을 직접 보내세요. ');fallback.append(command);fallback.hidden=true;
  box.append(label,row,error,help,state,fallback);
  parent.insertBefore(box,document.getElementById('strategy-fleet'));
  let dirty=false;
  function validate(){
    const raw=input.value.trim();
    const format=/^(0|[1-9][0-9]{0,11}|[1-9][0-9]{0,2}(,[0-9]{3}){1,3})$/.test(raw);
    const amount=format?Number(raw.replaceAll(',','')):NaN;
    const valid=Number.isSafeInteger(amount)&&amount>=0&&amount<=999999999999;
    save.setAttribute('aria-disabled',String(!valid));
    if(valid){save.href='https://t.me/Oracleinvest_bot?start=budget_AMD2_'+amount;command.textContent='/start budget_AMD2_'+amount;}
    else save.removeAttribute('href');
    fallback.hidden=!valid;
    error.textContent=raw&&!valid?'원 단위의 0 이상 정수를 입력해 주세요.':valid?amount.toLocaleString('ko-KR')+'원':'';
    error.className=raw&&!valid?'budget-error':'budget-hint';
    input.setAttribute('aria-invalid',String(Boolean(raw)&&!valid));
    return valid;
  }
  input.addEventListener('input',()=>{dirty=true;validate();});
  save.addEventListener('click',event=>{if(!validate())event.preventDefault();});
  validate();
  window.renderCapitalBudget = value => {
    const valid=value&&value.currency==='KRW'&&value.broker==='toss'&&Number.isSafeInteger(value.amount)&&value.amount>=0&&value.amount<=999999999999;
    if(!valid){state.textContent=value?.error?'한도 저장 상태를 확인하지 못했습니다. 다음 갱신을 기다려 주세요.':value?.state==='not_configured'?'아직 저장된 운용 한도가 없습니다. 토스 주문 연결 준비 중입니다.':'한도 저장 상태 수신 대기 · 토스 주문 연결 준비 중';return;}
    if(!dirty&&document.activeElement!==input){input.value=String(value.amount);validate();}
    const names={delivery_pending:'AMD2 전달 대기',delivery_expired:'요청 유효시간 만료 · AMD2 저장 확인 필요',saved_pending_toss_connection:'AMD2 저장 확인 · 토스 주문 연결 대기'};
    const ago=(Date.now()-Date.parse(value.observed_at))/1000;
    const stale=value.state==='saved_pending_toss_connection'&&!(Number.isFinite(ago)&&ago>-180&&ago<900);
    const expired=value.state==='delivery_pending'&&Date.now()-Date.parse(value.requested_at)>=900000;
    state.textContent='요청 한도 '+value.amount.toLocaleString('ko-KR')+'원 · '+(stale?'서버 수신 상태 갱신 대기':expired?names.delivery_expired:names[value.state]||'적용 상태 확인 중')+(value.error?' · 새 요청 수신 확인 필요':'');
  };
})();
