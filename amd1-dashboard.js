/* Read-only presentation: no order/control endpoints are called. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = x => Number.isFinite(x) ? x.toLocaleString('ko-KR', {maximumFractionDigits:Math.abs(x)>0&&Math.abs(x)<10?2:0}) + '원' : '확인 대기';
  const signed = x => Number.isFinite(x) ? (x > 0 ? '+' : '') + money(x) : '확인 대기';
  const pct = x => Number.isFinite(x) ? (x > 0 ? '+' : '') + (x * 100).toFixed(2) + '%' : '—';
  const qty = x => Number.isFinite(x) ? x.toLocaleString('ko-KR', {maximumFractionDigits:8}) : '—';
  const sign = x => x > 0 ? 'gain' : x < 0 ? 'loss' : '';
  const time = x => x && Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString('sv-SE', {timeZone:'Asia/Seoul', hour12:false}) : '확인 대기';
  const shortTime = x => time(x).replace(/^20\d\d-/, '');
  const stale = (at, max = 900000) => !at || !Number.isFinite(Date.parse(at)) || Date.now()-Date.parse(at) > max || Date.parse(at)-Date.now() > 60000;
  const coin = symbol => ({'KRW-BTC':'비트코인','KRW-ETH':'이더리움','KRW-XRP':'리플'}[symbol] || symbol?.replace('KRW-', '') || '—');
  const owner = x => ({utbot:'UT Bot', redesign:'이전 연구 전략', unattributed:'귀속 미확인'}[x] || '귀속 미확인');
  const side = x => '<span class="side '+(x === 'buy' ? 'buy' : 'sell')+'">'+(x === 'buy' ? 'BUY · 매수' : 'SELL · 매도')+'</span>';
  let current = null, range = '30d', chartSymbol = 'KRW-BTC', timeframe = '1h', view = null, bounds = null, fetching = false;
  let drag = null, frame = null, manualView = false;
  function requestChart() { if(frame===null)frame=requestAnimationFrame(()=>{frame=null;renderChart();}); }
  function clampView(from,to) {
    if(!bounds)return;
    const span=Math.min(bounds.to-bounds.from,Math.max(bounds.step,to-from));
    from=Math.max(bounds.from,Math.min(from,bounds.to-span));
    view={from,to:from+span};
  }
  function zoom(factor,anchor=.5) {
    if(!view||!bounds)return;
    manualView=true;
    const span=view.to-view.from, at=view.from+span*anchor;
    clampView(at-span*factor*anchor,at+span*factor*(1-anchor));requestChart();
  }
  function set(id, value, cls) { $(id).textContent = value; if (cls !== undefined) $(id).className = cls; }
  function notice(message, level='') { set('notice', message, 'notice '+level); }
  function render(data) {
    current = data;
    const p = data.portfolio, a = p?.account || {}, r = data.runtime || {}, positions = p?.positions || [];
    const old = stale(data.observed_at) || stale(p?.observed_at);
    set('equity', money(a.equity));
    const holding = p && positions.every(x => Number.isFinite(x.unrealized_gross)) ? positions.reduce((s,x)=>s+x.unrealized_gross,0) : null;
    set('holding-pnl', signed(holding), sign(holding));
    set('account-pnl', signed(a.deposit_comparison_pnl), sign(a.deposit_comparison_pnl));
    set('cash-note', '사용 가능 원화 '+money(a.cash_available)+' · 주문 잠금 '+money(a.cash_locked));
    set('deposit-note', '누적 순입금 '+money(a.net_deposits)+' · 전략 수익률 아님');
    const last = data.trades?.[0];
    set('last-trade', last ? (last.symbol.replace('KRW-','')+' '+(last.side==='buy'?'매수':'매도')) : data.trade_complete ? '최근 30일 체결 없음' : '확인 대기', 'compact '+(last?sign(last.side==='buy'?1:-1):''));
    set('last-trade-at', last ? shortTime(last.filled_at || last.ordered_at)+(last.filled_at?'':' · 주문 시각') : '체결 영수증 기준');
    const delayed = stale(r.last_run, 25*3600000);
    const status = old ? '상태 갱신 지연' : r.halted ? '위험 조건으로 중단' : !r.scheduled ? '자동 실행 예약 없음' : delayed ? '최근 실행 확인 필요' : r.dry_run ? '모의 실행 예약' : 'UT Bot · 실전 운용';
    set('runtime-badge', status, 'badge '+(old||r.halted||!r.scheduled||delayed?'stopped':''));
    set('strategy-name','UT Bot · 일봉');
    set('strategy-settings','ATR '+(r.atr_period??'—')+' · 감도 '+(r.key??'—')+' · '+(r.allow_new_buys?'매수·매도 허용':'신규 매수 중지'));
    set('last-run',shortTime(r.last_run));set('next-run',r.scheduled?shortTime(r.next_run):'예약 없음');
    set('schedule',r.daily_schedule?'매일 09:05 · 마감 일봉':'예약 시각 확인 필요');set('account-at',shortTime(p?.observed_at));
    set('holding-count',p?positions.length+'종목':'확인 대기');
    $('holdings').innerHTML = positions.map(x=>'<tr><td><span class="coin">'+esc(coin(x.symbol))+'</span><small>'+esc(x.symbol.replace('KRW-',''))+'</small></td><td>'+qty(x.quantity)+'</td><td>'+money(x.avg_buy_price)+'</td><td>'+money(x.current_price)+'</td><td>'+money(x.valuation)+'</td><td class="'+sign(x.unrealized_gross)+'">'+signed(x.unrealized_gross)+'<small class="'+sign(x.return_gross)+'">'+pct(x.return_gross)+'</small></td><td>'+money(x.stop_price)+'<small>마지막 일봉 판단값</small></td></tr>').join('') || '<tr><td colspan="7" class="empty">'+(p?'보유 코인이 없습니다.':'계좌 조회 자료를 기다리고 있습니다.')+'</td></tr>';
    const stateLabel = {buy:'BUY · 새 매수 신호',sell:'SELL · 새 매도 신호',hold:'보유 추세 유지',cash:'현금 보유 신호'};
    $('latest-signals').innerHTML = (data.latest_signals||[]).map(x=>'<div class="signal-card"><div><strong>'+esc(x.symbol.replace('KRW-',''))+'</strong><span class="'+(x.side==='buy'?'gain':x.side==='sell'?'loss':'muted')+'">'+esc(stateLabel[x.side]||'확인 대기')+'</span></div><p>판단 '+shortTime(x.at)+'<br>ATR 기준선 '+money(x.stop)+'</p></div>').join('');
    if (old) notice('갱신 지연 · 아래 금액과 운용 상태는 마지막 수신 기록입니다. 계좌 조회 '+time(p?.observed_at), 'warn');
    else if (r.halted || !r.scheduled || delayed) notice(status+' · 마지막 판단 '+time(r.last_run)+' · 현재 보유분은 아래 실제 잔고에서 확인하세요.', 'warn');
    else notice('UT Bot '+(r.dry_run?'모의 실행':'실전 운용')+' · '+positions.length+'종목 보유 · 마지막 판단 '+shortTime(r.last_run)+' · 다음 예약 '+shortTime(r.next_run));
    if (!data.trade_complete) notice($('notice').textContent+' / 체결 내역 조회 지연: 이전 기록 또는 확인 대기', 'warn');
    renderJournal(); renderChart();
  }
  function renderJournal() {
    if (!current) return;
    const symbol=$('symbol-filter').value, filter=x=>symbol==='all'||x.symbol===symbol;
    const trades=(current.trades||[]).filter(filter), signals=(current.signals||[]).filter(filter);
    set('trade-count', trades.length+'건');set('signal-count',signals.length+'건');
    set('trade-note','최근 30일 · '+(current.trade_complete?'거래소 체결 영수증 확인':'조회 미완료 · 이전 기록일 수 있음')+' · 확인 '+time(current.trade_observed_at)+'. 부분 체결은 주문별 합산합니다. 귀속 미확인은 수동 거래 등 출처를 확정하지 못한 거래입니다.');
    $('trades').innerHTML=trades.map(x=>'<tr><td>'+time(x.filled_at)+'<small>주문 '+time(x.ordered_at)+'</small></td><td>'+esc(coin(x.symbol))+'</td><td>'+side(x.side)+'</td><td>'+money(x.price)+'</td><td>'+money(x.funds)+'<small>'+qty(x.volume)+' '+esc(x.symbol.replace('KRW-',''))+'</small></td><td>'+money(x.fee)+'</td><td>'+owner(x.owner)+'</td></tr>').join('') || '<tr><td colspan="7" class="empty">'+(current.trade_complete?'최근 30일에 해당 종목의 체결 내역이 없습니다.':'체결 내역을 확인하지 못했습니다. 거래 0건을 뜻하지 않습니다.')+'</td></tr>';
    $('signals').innerHTML=signals.map(x=>'<tr><td>'+time(x.at)+'</td><td>'+esc(coin(x.symbol))+'</td><td>'+side(x.side)+'</td><td>'+money(x.price)+'</td><td>'+money(x.stop)+'</td><td>일봉 지표 재계산</td></tr>').join('') || '<tr><td colspan="6" class="empty">'+(current.signal_error?'지표 자료 확인이 필요합니다.':'차트 보관 구간에 교차 신호가 없습니다.')+'</td></tr>';
  }
  function renderChart() {
    if (!current) return;
    const host=$('chart'), chart=current.charts?.[chartSymbol], all=chart?.series?.[timeframe]||[];
    const ticker=chartSymbol.replace('KRW-','');
    $('chart-heading').innerHTML=coin(chartSymbol)+' <span class="muted small">'+ticker+' / KRW</span>';
    host.setAttribute('aria-label',coin(chartSymbol)+' 가격과 매매 시점 그래프');
    if (!all.length) { bounds=null;host.innerHTML='<p class="empty">이 봉 주기의 '+coin(chartSymbol)+' 가격 자료가 없습니다.</p>';set('btc-price','확인 대기');set('btc-change','');set('chart-note','자료 수신 대기');set('chart-detail','다른 종목 또는 봉 주기를 선택해 주세요.');return; }
    const daily=timeframe==='1d', step=({'1h':3600,'6h':21600,'1d':86400}[timeframe]);
    bounds={from:all[0][0],to:all.at(-1)[0]+step,step};
    if(!view||!manualView){
      let from=bounds.to-({'1d':1,'7d':7,'30d':30}[range]||365)*86400;
      if(['3m','6m','1y'].includes(range)){
        const date=new Date(bounds.to*1000), day=date.getUTCDate();
        date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-({'3m':3,'6m':6,'1y':12}[range]));
        const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
        date.setUTCDate(Math.min(day,lastDay));from=date.getTime()/1000;
      }
      view={from:Math.max(bounds.from,from),to:bounds.to};
    } else clampView(view.from,view.to);
    const first=view.from,end=view.to,bars=all.filter(b=>b[0]+step>first&&b[0]<end);
    if(!bars.length){host.innerHTML='<p class="empty">이 구간에는 저장된 봉이 없습니다. 드래그하거나 다른 기간을 선택하세요.</p>';return;}
    host.dataset.visibleBars=String(bars.length);host.dataset.viewFrom=String(first);host.dataset.viewTo=String(end);
    const fills=$('show-fills').checked?(current.trades||[]).filter(x=>x.symbol===chartSymbol&&x.filled_at).map(x=>({...x,kind:'fill',t:Date.parse(x.filled_at)/1000})):[];
    const signals=$('show-signals').checked?(current.signals||[]).filter(x=>x.symbol===chartSymbol).map(x=>({...x,kind:'signal',t:Date.parse(x.at)/1000})):[];
    const markers=[...fills,...signals].filter(x=>x.t>=first&&x.t<end&&Number.isFinite(x.price));
    const width=Math.max(host.clientWidth,260), height=host.clientHeight, left=6, right=64, top=20, bottom=height-62, plotWidth=width-left-right;
    let low=Math.min(...bars.map(x=>x[3]),...markers.map(x=>x.price)), high=Math.max(...bars.map(x=>x[2]),...markers.map(x=>x.price));
    const pad=Math.max((high-low)*.12,high*.001);low-=pad;high+=pad;
    const x=t=>left+(t-first)/(end-first)*plotWidth, y=p=>top+(high-p)/(high-low)*(bottom-top), color=p=>p?'#65deb0':'#ff8394';
    const f=n=>Number(n).toFixed(2), candleWidth=Math.max(.8,Math.min(12,plotWidth*step/(end-first)*.65));
    let svg='<svg viewBox="0 0 '+width+' '+height+'" xmlns="http://www.w3.org/2000/svg" aria-label="'+ticker+' 캔들 차트, 원화 가격, 아래 막대는 거래량"><g font-family="system-ui" font-size="10" fill="#94a3b5">';
    for(let i=0;i<=4;i++){const price=low+(high-low)*i/4, yy=y(price);svg+='<path d="M'+left+' '+f(yy)+' H'+(width-right)+'" stroke="#25303c" stroke-dasharray="3 4"/><text x="'+(width-right+7)+'" y="'+f(yy+3)+'">'+(price/10000).toFixed(0)+'만</text>';}
    for(let i=0;i<4;i++){const at=first+(end-first)*i/3, label=new Date(at*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',...(end-first<=2*86400?{hour:'2-digit',minute:'2-digit',hour12:false}:{...(end-first>90*86400?{year:'2-digit'}:{}),month:'2-digit',day:'2-digit'})});svg+='<text x="'+f(x(at))+'" y="'+(height-6)+'" text-anchor="'+(i===0?'start':i===3?'end':'middle')+'">'+esc(label)+'</text>';}
    const maxVolume=Math.max(...bars.map(b=>b[5]),1), paths=[{wick:'',body:'',volume:''},{wick:'',body:'',volume:''}];
    for(const b of bars){const xx=x(b[0]+step/2), p=paths[b[4]>=b[1]?1:0], volume=b[5]/maxVolume*24;
      p.wick+='M'+f(xx)+' '+f(y(b[2]))+'V'+f(y(b[3]));
      p.body+='M'+f(xx-candleWidth/2)+' '+f(Math.min(y(b[1]),y(b[4])))+'h'+f(candleWidth)+'v'+f(Math.max(1,Math.abs(y(b[1])-y(b[4]))))+'h-'+f(candleWidth)+'Z';
      p.volume+='M'+f(xx-candleWidth/2)+' '+f(height-27-volume)+'h'+f(candleWidth)+'v'+f(volume)+'h-'+f(candleWidth)+'Z';
    }
    svg+='<defs><clipPath id="price-clip"><rect x="'+left+'" y="0" width="'+plotWidth+'" height="'+height+'"/></clipPath></defs><g clip-path="url(#price-clip)">';
    paths.forEach((p,i)=>{const c=color(i);svg+='<path d="'+p.wick+'" stroke="'+c+'" opacity=".65"/><path d="'+p.body+'" fill="'+c+'"/><path d="'+p.volume+'" fill="'+c+'" opacity=".28"/>';});svg+='</g>';
    svg+='</g><path id="crosshair" stroke="#94a3b5" stroke-dasharray="3 3" style="display:none"/>';
    markers.forEach((m,i)=>{const xx=x(m.t), yy=y(m.price), c=color(m.side==='buy'), offset=m.kind==='fill'?17:42, markerY=yy+(m.side==='buy'?offset:-offset);
      const label=(m.kind==='fill'?'실제 체결':'UT 일봉 신호')+' · '+(m.side==='buy'?'매수':'매도')+' · '+time(m.kind==='fill'?m.filled_at:m.at)+' · '+money(m.price);
      svg+='<g class="selected-marker" data-marker="'+i+'" tabindex="0" role="button" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title><path d="M'+f(xx)+' '+f(yy)+' V'+f(markerY)+'" stroke="'+c+'" pointer-events="none"/>';
      svg+=m.kind==='fill'?'<circle cx="'+f(xx)+'" cy="'+f(markerY)+'" r="9" fill="'+c+'" stroke="#0b1015" stroke-width="1.5"/><text x="'+f(xx)+'" y="'+f(markerY+3.4)+'" text-anchor="middle" fill="#0b1015" font-size="9" font-weight="800">'+(m.side==='buy'?'B':'S')+'</text>':'<path d="M'+f(xx)+' '+f(markerY-7)+' l7 7 -7 7 -7 -7Z" fill="#121a22" stroke="'+c+'" stroke-width="2"/>';
      svg+='</g>';});
    host.innerHTML=svg+'</svg>';
    const last=all.at(-1)[4];set('btc-price',money(last));set('btc-change',pct(bars.at(-1)[4]/bars[0][1]-1)+' · 화면 구간',sign(bars.at(-1)[4]/bars[0][1]-1));
    set('chart-note',(daily?'일봉 · 업비트 마감 일봉 + 당일 수집 분봉':(timeframe==='6h'?'6시간':'1시간')+'봉 · 수집된 1분봉 집계')+' · '+bars.length+'개 봉 · 마지막 분봉 '+shortTime(chart.latest_at)+(stale(chart.latest_at)?' · 시세 갱신 지연':'')+' · 일부 봉은 진행 중이거나 원천 분봉이 비어 있을 수 있습니다. UT 일봉 신호는 차트 전체 구간, 실제 체결은 최근 30일 기준입니다.');
    host.querySelector('svg').addEventListener('pointermove',event=>{
      if(drag||event.target.closest('[data-marker]'))return;
      const px=event.clientX-host.getBoundingClientRect().left;
      const at=first+(px-left)/plotWidth*(end-first);
      const b=bars.reduce((best,item)=>Math.abs(item[0]-at)<Math.abs(best[0]-at)?item:best,bars[0]);
      const line=$('crosshair');line.setAttribute('d','M'+f(x(b[0]+step/2))+' '+top+' V'+(height-25));line.style.display='';
      set('chart-detail',(daily||end-first>90*86400?time:shortTime)(new Date(b[0]*1000).toISOString())+' · 시가 '+money(b[1])+' / 고가 '+money(b[2])+' / 저가 '+money(b[3])+' / 종가 '+money(b[4])+' · 거래량 '+qty(b[5])+' '+ticker+(daily?' · 일봉 (09:00 시작)':' · 원천 '+b[6]+'/'+step/60+'분'));
    });
    host.querySelectorAll('[data-marker]').forEach(node=>{
      const show=()=>{const m=markers[Number(node.dataset.marker)];set('chart-detail',(m.kind==='fill'?'실제 체결 · '+owner(m.owner):'UT 일봉 신호 · 일봉 재계산')+' · '+(m.side==='buy'?'BUY 매수':'SELL 매도')+' · '+time(m.kind==='fill'?m.filled_at:m.at)+' · '+money(m.price)+(m.kind==='fill'?' · 수량 '+qty(m.volume)+' '+ticker:''));};
      node.addEventListener('click',show);node.addEventListener('focus',show);node.addEventListener('pointerenter',show);
      node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
    });
  }
  async function refresh() {
    if(fetching)return;fetching=true;$('refresh').disabled=true;set('connection','조회 중…');
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const source=document.querySelector('meta[name="status-source"]').content;
      const response=await fetch(source+(source.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const status=await response.json();
      if(status.amd1_dashboard?.schema!=='amd1_dashboard_v1')throw new Error('AMD1 자료 수신 대기');
      render(status.amd1_dashboard);set('published-at','게시 '+shortTime(status.updated_at));
      set('connection',new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' 재조회 완료');
    } catch(error) {
      notice(current?'새 자료를 받지 못했습니다. 아래는 마지막 수신 기록입니다. 계좌 조회 '+time(current.portfolio?.observed_at):'AMD1 자료를 아직 받지 못했습니다. 잠시 후 새로고침해 주세요.', 'error');
      set('connection','조회 실패 · 자동 재시도');
    } finally { clearTimeout(timeout);fetching=false;$('refresh').disabled=false; }
  }
  $('refresh').addEventListener('click',refresh);
  $('chart-symbols').addEventListener('click',e=>{const button=e.target.closest('[data-symbol]');if(!button)return;chartSymbol=button.dataset.symbol;$('chart-symbols').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));set('chart-detail','봉이나 B/S 표시를 누르면 가격과 시각을 확인할 수 있습니다.');renderChart();});
  $('ranges').addEventListener('click',e=>{const button=e.target.closest('[data-range]');if(!button)return;range=button.dataset.range;view=null;manualView=false;$('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderChart();});
  $('timeframe').addEventListener('change',()=>{timeframe=$('timeframe').value;renderChart();});
  $('zoom-in').addEventListener('click',()=>zoom(.65));$('zoom-out').addEventListener('click',()=>zoom(1.5));
  $('chart-reset').addEventListener('click',()=>{view=null;manualView=false;renderChart();});
  $('chart').addEventListener('wheel',e=>{
    if(!bounds)return;e.preventDefault();
    const rect=$('chart').getBoundingClientRect(), anchor=Math.max(0,Math.min(1,(e.clientX-rect.left-6)/(rect.width-70)));
    zoom(Math.exp(Math.max(-300,Math.min(300,e.deltaY))*.002),anchor);
  },{passive:false});
  $('chart').addEventListener('pointerdown',e=>{
    if(!view||e.button!==0||e.target.closest('[data-marker]'))return;
    drag={x:e.clientX,from:view.from,to:view.to};$('chart').setPointerCapture(e.pointerId);$('chart').classList.add('dragging');
  });
  $('chart').addEventListener('pointermove',e=>{
    if(!drag)return;
    manualView=true;
    const shift=(e.clientX-drag.x)/($('chart').clientWidth-70)*(drag.to-drag.from);
    clampView(drag.from-shift,drag.to-shift);requestChart();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('chart').addEventListener(event,e=>{
    drag=null;$('chart').classList.remove('dragging');if($('chart').hasPointerCapture(e.pointerId))$('chart').releasePointerCapture(e.pointerId);
  });
  $('show-fills').addEventListener('change',renderChart);$('show-signals').addEventListener('change',renderChart);$('symbol-filter').addEventListener('change',renderJournal);
  function tab(selected) { for(const name of ['trades','signals']){$(name+'-tab').setAttribute('aria-selected',String(name===selected));$(name==='trades'?'trade-panel':'signal-panel').hidden=name!==selected;} }
  $('trades-tab').addEventListener('click',()=>tab('trades'));$('signals-tab').addEventListener('click',()=>tab('signals'));
  new ResizeObserver(()=>renderChart()).observe($('chart'));
  setInterval(refresh,Number(document.querySelector('meta[name="refresh-seconds"]').content)*1000);
  refresh();
})();
