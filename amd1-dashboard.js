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
  let current = null, range = '30d', chartSymbol = 'KRW-BTC', timeframe = '1d', fetching = false;
  let priceChart = null, candleSeries, volumeSeries, stopSeries, emaSeries, overlay;
  let chartKey = '', manualView = false, markerFrame = null;
  let chartBars = [], chartIndicators = new Map(), chartMarkers = [];
  const epoch = x => Date.parse(x)/1000;
  const chartStep = () => ({'1h':3600,'6h':21600,'1d':86400}[timeframe]);
  function zoom(factor) {
    const view=priceChart?.timeScale().getVisibleLogicalRange();
    if(!view)return;
    manualView=true;
    const mid=(view.from+view.to)/2, half=Math.max(2,(view.to-view.from)*factor/2);
    priceChart.timeScale().setVisibleLogicalRange({from:mid-half,to:mid+half});
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
  function showSignal(signal) {
    const target=$('signal-explanation');
    if(!signal){target.className='signal-explanation';target.textContent=current?.signal_error?'UT 신호 자료를 확인하지 못했습니다.':'보관 구간에 확정된 UT 교차 신호가 없습니다.';return;}
    const buy=signal.side==='buy', prior=Number.isFinite(signal.previous_price)&&Number.isFinite(signal.previous_stop);
    const latest=current.latest_signals?.find(x=>x.symbol===chartSymbol);
    const action=buy?'매수':'매도', candleDate=time(signal.bar_at || new Date(epoch(signal.at)*1000-86400000).toISOString()).slice(0,10);
    target.className='signal-explanation'+(buy?'':' sell');
    target.innerHTML='<strong>'+esc(coin(chartSymbol))+' '+action+' 신호 · '+candleDate+' 일봉</strong>'+
      '<p>'+(prior?'직전 종가 <b>'+money(signal.previous_price)+'</b> '+(buy?'≤':'≥')+' 직전 추적선 <b>'+money(signal.previous_stop)+'</b><br>':'')+
      '신호봉 종가 <b>'+money(signal.price)+'</b> '+(buy?'&gt;':'&lt;')+' 전환 후 추적선 <b>'+money(signal.stop)+'</b></p>'+
      '<p>종가가 ATR 추적선을 '+(buy?'상향':'하향')+' 교차해 '+action+' 신호가 확정됐습니다. 확정 '+time(signal.at)+' KST.</p>'+
      '<p class="signal-state">'+(latest?'최근 실제 판단 '+shortTime(latest.at)+' · '+({hold:'보유 추세 유지 — 새 교차 신호 없음',cash:'현금 보유 신호 유지',buy:'새 매수 신호',sell:'새 매도 신호'}[latest.side]||'확인 대기'):'실행 기록 확인 대기')+'</p>';
  }
  function showMarker(marker) {
    if(marker.kind==='signal'){
      showSignal(marker);
      set('chart-detail','UT 일봉 '+(marker.side==='buy'?'buy 매수':'sell 매도')+' · 신호봉 '+time(marker.bar_at)+' · 확정 '+time(marker.at)+' · 종가 '+money(marker.price));
    } else if(marker.fills.length>1){
      const fills=marker.fills, volume=fills.reduce((sum,x)=>sum+x.volume,0), funds=fills.reduce((sum,x)=>sum+x.funds,0);
      $('chart-detail').innerHTML='<strong>실제 '+(marker.side==='buy'?'매수':'매도')+' '+fills.length+'건 · 같은 봉의 체결 묶음</strong>'+
        '<p>합계 '+money(funds)+' · 수량 '+qty(volume)+' '+esc(marker.symbol.replace('KRW-',''))+' · 가중 평균 '+money(volume>0?funds/volume:null)+'</p>'+
        '<ol class="fill-events">'+fills.map(x=>'<li class="fill-event"><span>'+time(x.filled_at)+' · '+owner(x.owner)+'</span><span>'+money(x.price)+' · '+qty(x.volume)+' '+esc(x.symbol.replace('KRW-',''))+'</span></li>').join('')+'</ol>';
    } else set('chart-detail','실제 체결 · '+owner(marker.owner)+' · '+(marker.side==='buy'?'BUY 매수':'SELL 매도')+' · '+time(marker.filled_at)+' · '+money(marker.price)+' · '+qty(marker.volume)+' '+marker.symbol.replace('KRW-',''));
  }
  function showBar(bar) {
    if(!bar)return;
    const ind=chartIndicators.get(bar[0]);
    set('chart-ohlc',shortTime(new Date(bar[0]*1000).toISOString())+' KST  시 '+money(bar[1])+'  고 '+money(bar[2])+'  저 '+money(bar[3])+'  종 '+money(bar[4])+'  거래량 '+qty(bar[5])+' '+chartSymbol.replace('KRW-','')+(ind?'  EMA 240 '+money(ind.ema240)+'  ATR '+money(ind.stop):''));
  }
  function scheduleMarkers(){
    if(markerFrame!==null)return;
    markerFrame=requestAnimationFrame(()=>{markerFrame=null;positionMarkers();});
  }
  function positionMarkers(){
    if(!priceChart||!chartBars.length)return;
    const view=priceChart.timeScale().getVisibleRange();
    if(!view)return;
    const visible=chartBars.filter(b=>b[0]>=view.from&&b[0]<=view.to), host=$('chart');
    host.dataset.viewFrom=String(view.from);host.dataset.viewTo=String(Number(view.to)+chartStep());
    host.dataset.visibleBars=String(visible.length);
    const paneHeight=priceChart.panes()[0].getHeight(), width=priceChart.timeScale().width();
    const placed=[];
    for(const marker of chartMarkers){
      const x=priceChart.timeScale().timeToCoordinate(marker.bar[0]);
      const y=candleSeries.priceToCoordinate(marker.side==='buy'?marker.bar[3]:marker.bar[2]);
      marker.node.hidden=false;
      const halfWidth=marker.node.offsetWidth/2, halfHeight=marker.node.offsetHeight/2, direction=marker.side==='buy'?1:-1;
      let markerY=y+direction*(12+halfHeight);
      // Keep each label in its candle's column, clearing both same-bar and adjacent-bar labels.
      for(let attempt=0;attempt<=placed.length;attempt++){
        const hit=placed.find(p=>Math.abs(p.x-x)<p.w+halfWidth+4&&Math.abs(p.y-markerY)<p.h+halfHeight+4);
        if(!hit)break;
        markerY=hit.y+direction*(hit.h+halfHeight+5);
      }
      const shown=x!==null&&y!==null&&x>=halfWidth&&x<width-halfWidth&&markerY>=halfHeight&&markerY<paneHeight-halfHeight;
      marker.node.hidden=!shown;
      if(shown){marker.node.style.left=x+'px';marker.node.style.top=markerY+'px';placed.push({x,y:markerY,w:halfWidth,h:halfHeight});}
    }
    if(visible.length){const change=visible.at(-1)[4]/visible[0][1]-1;set('btc-change',pct(change)+' · 화면 구간',sign(change));}
  }
  function createPriceChart(){
    if(priceChart)return true;
    const L=window.LightweightCharts, host=$('chart');
    if(!L){host.innerHTML='<p class="empty">차트를 불러오지 못했습니다. 새로고침해 주세요.</p>';return false;}
    host.replaceChildren();
    priceChart=L.createChart(host,{
      autoSize:true,
      layout:{background:{type:'solid',color:'#101722'},textColor:'#9aaac0',fontFamily:'Segoe UI, Malgun Gothic, sans-serif',fontSize:11,attributionLogo:true},
      grid:{vertLines:{color:'#1b2635'},horzLines:{color:'#1b2635'}},
      rightPriceScale:{borderColor:'#304057',scaleMargins:{top:.12,bottom:.16}},
      timeScale:{borderColor:'#304057',timeVisible:true,secondsVisible:false,minBarSpacing:.05,rightOffset:3,
        tickMarkFormatter:(at,type)=>new Date(Number(at)*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',...(type===0?{year:'numeric'}:type===1?{year:'2-digit',month:'short'}:type===2?{month:'2-digit',day:'2-digit'}:{hour:'2-digit',minute:'2-digit',hour12:false})})},
      localization:{locale:'ko-KR',priceFormatter:x=>Math.round(x).toLocaleString('ko-KR'),timeFormatter:at=>time(new Date(Number(at)*1000).toISOString())+' KST'},
      crosshair:{mode:L.CrosshairMode.Normal,vertLine:{color:'#8393ad',labelBackgroundColor:'#334155'},horzLine:{color:'#8393ad',labelBackgroundColor:'#334155'}},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true,axisDoubleClickReset:true}
    });
    candleSeries=priceChart.addSeries(L.CandlestickSeries,{upColor:'#089981',downColor:'#f23645',wickUpColor:'#089981',wickDownColor:'#f23645',borderVisible:false,priceFormat:{type:'price',precision:0,minMove:1},lastValueVisible:true,priceLineVisible:true});
    emaSeries=priceChart.addSeries(L.LineSeries,{color:'#dce4f0',lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,title:'EMA 240 · 일봉'});
    stopSeries=priceChart.addSeries(L.LineSeries,{color:'#f0bc60',lineWidth:1,lineStyle:L.LineStyle.Dashed,lineType:L.LineType.WithSteps,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,title:'ATR · 일봉'});
    volumeSeries=priceChart.addSeries(L.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);
    priceChart.panes()[1].setHeight(80);
    overlay=document.createElement('div');overlay.className='chart-overlay';host.append(overlay);
    priceChart.timeScale().subscribeVisibleTimeRangeChange(scheduleMarkers);
    priceChart.timeScale().subscribeVisibleLogicalRangeChange(scheduleMarkers);
    priceChart.subscribeCrosshairMove(param=>{
      const item=param.seriesData.get(candleSeries);
      if(item)showBar(chartBars.find(b=>b[0]===Number(item.time)));
      scheduleMarkers();
    });
    host.addEventListener('wheel',()=>{manualView=true;scheduleMarkers();},{passive:true});
    host.addEventListener('pointerdown',()=>{manualView=true;});
    host.addEventListener('pointermove',scheduleMarkers);
    host.addEventListener('pointerup',scheduleMarkers);
    new ResizeObserver(scheduleMarkers).observe(host);
    return true;
  }
  function selectedRange(){
    const last=chartBars.at(-1)[0]+chartStep();
    let first=last-({'1d':1,'7d':7,'30d':30}[range]||365)*86400;
    if(['3m','6m','1y'].includes(range)){
      const date=new Date(last*1000),day=date.getUTCDate();date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth()-({'3m':3,'6m':6,'1y':12}[range]));
      date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));first=date.getTime()/1000;
    }
    priceChart.timeScale().setVisibleRange({from:Math.max(chartBars[0][0],first),to:last});
  }
  function renderChart() {
    if(!current)return;
    const host=$('chart'), chart=current.charts?.[chartSymbol], all=chart?.series?.[timeframe]||[];
    $('chart-heading').innerHTML=coin(chartSymbol)+' <span class="muted small">'+chartSymbol.replace('KRW-','')+' / KRW</span>';
    host.setAttribute('aria-label',coin(chartSymbol)+' 캔들·UT 일봉 신호·실제 체결 차트');
    if(!all.length){
      if(priceChart){priceChart.remove();priceChart=null;}
      chartBars=[];host.innerHTML='<p class="empty">이 봉 주기의 가격 자료가 없습니다.</p>';
      set('btc-price','확인 대기');set('btc-change','');set('chart-note','자료 수신 대기');return;
    }
    if(!createPriceChart())return;
    const saved=priceChart.timeScale().getVisibleLogicalRange(), savedTime=priceChart.timeScale().getVisibleRange();
    const key=chartSymbol+timeframe, sameKey=key===chartKey, daily=timeframe==='1d';
    chartBars=all;chartIndicators=new Map();
    const indicators=(current.indicators||[]).filter(x=>x.symbol===chartSymbol&&[x.price,x.stop,x.ema240].every(Number.isFinite)).sort((a,b)=>epoch(a.bar_at)-epoch(b.bar_at));
    const dailyMap=new Map(indicators.map(x=>[epoch(x.bar_at),x]));
    let cursor=-1;
    const prices=[],emas=[],stops=[],volumes=[];
    for(const b of all){
      while(cursor+1<indicators.length&&epoch(indicators[cursor+1].at)<=b[0])cursor++;
      const ind=daily?dailyMap.get(b[0]):indicators[cursor];
      if(ind)chartIndicators.set(b[0],ind);
      const color=ind?(ind.price>ind.stop?'#089981':'#f23645'):'#718096';
      prices.push({time:b[0],open:b[1],high:b[2],low:b[3],close:b[4],color,wickColor:color});
      if(ind){emas.push({time:b[0],value:ind.ema240});stops.push({time:b[0],value:ind.stop});}
      volumes.push({time:b[0],value:b[5],color:b[4]>=b[1]?'#16473f':'#542b36'});
    }
    candleSeries.setData(prices);emaSeries.setData(emas);stopSeries.setData(stops);volumeSeries.setData(volumes);
    emaSeries.applyOptions({visible:$('show-ema').checked});stopSeries.applyOptions({visible:$('show-stop').checked});
    chartKey=key;
    if(manualView&&saved&&sameKey)priceChart.timeScale().setVisibleLogicalRange(saved);
    else if(manualView&&savedTime)priceChart.timeScale().setVisibleRange(savedTime);
    else selectedRange();
    overlay.replaceChildren();chartMarkers=[];
    const signals=$('show-signals').checked?(current.signals||[]).filter(x=>x.symbol===chartSymbol).map(x=>({...x,kind:'signal'})):[];
    const fills=$('show-fills').checked?(current.trades||[]).filter(x=>x.symbol===chartSymbol&&x.filled_at).map(x=>({...x,kind:'fill'})):[];
    const barMap=new Map(all.map(b=>[b[0],b])),step=chartStep();
    const fillGroups=new Map();
    for(const fill of fills){
      const key=Math.floor(epoch(fill.filled_at)/step)*step+'-'+fill.side;
      if(!fillGroups.has(key))fillGroups.set(key,[]);
      fillGroups.get(key).push(fill);
    }
    const groupedFills=[...fillGroups.values()].map(group=>{
      group.sort((a,b)=>epoch(a.filled_at)-epoch(b.filled_at));return {...group[0],fills:group};
    });
    for(const m of [...signals,...groupedFills]){
      // Pine plotshape belongs to the signal candle; execution belongs to its actual fill candle.
      const at=m.kind==='signal'?(daily?epoch(m.bar_at||m.at)-(m.bar_at?0:86400):epoch(m.at)):epoch(m.filled_at);
      const bar=barMap.get(Math.floor(at/step)*step);if(!bar)continue;
      const node=document.createElement('button'),buy=m.side==='buy';
      node.type='button';node.className='chart-marker '+m.kind+'-'+m.side;node.dataset.marker=String(chartMarkers.length);
      node.dataset.kind=m.kind;node.dataset.barTime=String(bar[0]);node.dataset.eventAt=m.kind==='signal'?m.at:m.filled_at;
      node.dataset.side=m.side;node.dataset.count=String(m.fills?.length||1);
      const multiple=m.kind==='fill'&&m.fills.length>1;
      if(multiple)node.classList.add('fill-group');
      node.textContent=m.kind==='signal'?(buy?'buy':'sell'):(buy?'B':'S')+(multiple?'×'+m.fills.length:'');
      const label=multiple?'실제 체결 · '+(buy?'매수':'매도')+' '+m.fills.length+'건 · 봉 '+time(new Date(bar[0]*1000).toISOString())+' · 누르면 개별 체결 표시':(m.kind==='signal'?'UT 일봉 신호':'실제 체결')+' · '+(buy?'매수':'매도')+' · '+time(m.kind==='signal'?m.at:m.filled_at)+' · '+money(m.price);
      node.setAttribute('aria-label',label);node.title=label;node.hidden=true;
      const marker={...m,bar,node};node.addEventListener('click',()=>showMarker(marker));node.addEventListener('focus',()=>showMarker(marker));
      overlay.append(node);chartMarkers.push(marker);
    }
    set('btc-price',money(all.at(-1)[4]));showBar(all.at(-1));
    showSignal((current.signals||[]).find(x=>x.symbol===chartSymbol));
    set('chart-note',(daily?'일봉 · buy/sell은 신호봉에 표시하며 다음날 09:00 확정':'가격 '+(timeframe==='6h'?'6시간봉':'1시간봉')+' · UT 신호·EMA 240·ATR은 실제 운용 기준인 일봉 값')+' · 봉 색상은 UT 일봉 추세, 미확정은 회색 · 마지막 분봉 '+shortTime(chart.latest_at)+(stale(chart.latest_at)?' · 시세 갱신 지연':'')+' · 실제 체결은 최근 30일. EMA 240은 참고선이며 매수·매도 조건에 포함되지 않습니다.');
    scheduleMarkers();
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
  $('chart-symbols').addEventListener('click',e=>{const button=e.target.closest('[data-symbol]');if(!button)return;chartSymbol=button.dataset.symbol;$('chart-symbols').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));set('chart-detail','봉이나 buy/sell, B/S 표시를 누르면 가격·시각·근거를 확인할 수 있습니다.');renderChart();});
  $('ranges').addEventListener('click',e=>{const button=e.target.closest('[data-range]');if(!button)return;range=button.dataset.range;manualView=false;$('ranges').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderChart();});
  $('timeframe').addEventListener('change',()=>{timeframe=$('timeframe').value;renderChart();});
  $('zoom-in').addEventListener('click',()=>zoom(.65));$('zoom-out').addEventListener('click',()=>zoom(1.5));
  $('chart-reset').addEventListener('click',()=>{manualView=false;renderChart();});
  for(const id of ['show-fills','show-signals','show-ema','show-stop'])$(id).addEventListener('change',renderChart);
  $('symbol-filter').addEventListener('change',renderJournal);
  function tab(selected) { for(const name of ['trades','signals']){$(name+'-tab').setAttribute('aria-selected',String(name===selected));$(name==='trades'?'trade-panel':'signal-panel').hidden=name!==selected;} }
  $('trades-tab').addEventListener('click',()=>tab('trades'));$('signals-tab').addEventListener('click',()=>tab('signals'));
  setInterval(refresh,Number(document.querySelector('meta[name="refresh-seconds"]').content)*1000);
  refresh();
})();
