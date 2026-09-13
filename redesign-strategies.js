/* Shared rendering for the private detail view and the public allowlisted view. */
(() => {
  const style = document.createElement('style');
  style.textContent = `.strategy-fleet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.strategy-node{min-width:0;border:1px solid #354c62;border-radius:12px;padding:20px;background:#111c28}.strategy-node h3{font-size:20px;margin:0 0 5px}.strategy-node h4{font-size:15px;margin:0}.strategy-node p{font-size:13px;line-height:1.65}.strategy-counts{display:flex;gap:22px;flex-wrap:wrap;padding:14px 0}.strategy-counts strong{font-size:26px;display:block}.strategy-counts span{font-size:12px;color:#a2b5c9}.installed-strategies{border-top:1px solid #354c62;border-bottom:1px solid #354c62;padding:16px 0;margin-bottom:18px}.strategy-list{display:grid;gap:12px}.strategy-item{background:#162433;border:1px solid #355044;border-radius:9px;padding:16px}.strategy-item.pending{border-color:#675338}.strategy-head{display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap}.strategy-tag{border:1px solid #456153;border-radius:12px;padding:3px 8px;font-size:11px;white-space:nowrap;color:#82dfb5}.strategy-id{font:11px ui-monospace,monospace;color:#9dafc3;overflow-wrap:anywhere}.strategy-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px;margin:16px 0}.strategy-stats span{display:block;color:#9dafc3;font-size:11px}.strategy-stats strong{display:block;font-size:20px;font-variant-numeric:tabular-nums}.strategy-wait{color:#f0be75;border-top:1px solid #33465a;padding-top:10px}.strategy-node details{font-size:12px}.strategy-node summary{cursor:pointer;padding:5px 0;color:#b9cbe0}.strategy-node .positive{color:#82dfb5}.strategy-node .negative{color:#ff9c9c}.strategy-note{color:#9dafc3}.strategy-none{color:#adbdd0;padding:8px 0}.strategy-legacy{padding:8px 0}.strategy-legacy strong{font-size:14px}@media(max-width:850px){.strategy-fleet{grid-template-columns:1fr}.strategy-node{padding:16px}.strategy-stats strong{font-size:19px}}`;
  document.head.append(style);
  const controlStyle=document.createElement('style');
  controlStyle.textContent='.strategy-control{padding:16px;margin:16px 0;border:1px solid #456078;border-radius:10px;background:#182838}.strategy-control-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.strategy-control-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:8px;text-decoration:none;font-weight:700;color:#0a2018;background:#82dfb5}.strategy-control-actions a.stop{color:#ffd0ce;background:#422d35;border:1px solid #92585d}.strategy-control-actions a:focus-visible{outline:3px solid #fff;outline-offset:3px}.strategy-control ul{padding-left:20px;font-size:13px;line-height:1.7}';
  document.head.append(controlStyle);
  const family = {breakout:'돌파', pullback:'눌림목', rebound:'반등', utbot:'UT Bot',chandelier:'EMA 회복·ATR 추적',keltner:'켈트너 돌파',supertrend:'슈퍼트렌드 전환',keltner_reentry:'켈트너 되돌림'};
  const reason = {execution_integration_pending:'실전 실행기 연결 대기',execution_adapter_pending:'실제 주문 실행기 미완료',historical_transition_pending:'보유분 포함 전환 백테스트 미완료',candidate_delivery_stale:'후보 수신 갱신 지연',ledger_transition_pending:'기존 잔고·손익 장부 전환 대기',source_clock_calendar_pending:'자료의 봉 시각·거래일 확인 대기',same_window_results_differ:'같은 검증 구간의 결과 차이 확인 필요',combination_validation_pending:'조합 검증 대기',latest_revalidation_not_passed:'최근 재검증 미통과',trade_details_unavailable:'거래 상세 기록 확인 필요'};
  const symbols = {'KRW-BTC':'BTC','KRW-ETH':'ETH','KRW-XRP':'XRP','226490':'KODEX 코스피','252670':'KODEX 곱버스'};
  const el = (tag,text,cls) => {const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const pct = value => typeof value==='number'&&Number.isFinite(value)?(value>0?'+':'')+(value*100).toFixed(2)+'%':'—';
  const at = value => value?new Date(value.includes('T')&&/([+-]\d\d:\d\d|Z)$/.test(value)?value:value+'+09:00').toLocaleString('ko-KR',{hour12:false}):'기록 없음';
  const markets = values => (values||[]).map(x=>symbols[x]||x).join(' · ');
  const freshAt = value => {const age=(Date.now()-Date.parse(value))/1000;return Number.isFinite(age)&&age>=0&&age<900;};
  const attachment = runtime => {
    const ids=runtime?.new_attached;
    return Array.isArray(ids)&&ids.length<=3&&ids.every(id=>typeof id==='string'&&/^[0-9a-f]{64}$/.test(id))&&new Set(ids).size===ids.length
      &&runtime.attachment_stale!==true&&freshAt(runtime.attachment_observed_at)?ids:null;
  };
  const attachedLabel = runtime => {
    const c=runtime?.control;
    if(!freshAt(c?.observed_at))return '장착 · 실행 상태 확인 대기';
    return {observer:'장착 · 시작 대기',active:'운용 중',exit_only:'장착 · 신규 진입 중지'}[c.mode]||'장착 · 실행 상태 확인 대기';
  };
  function metric(label,value,cls){const item=el('div');item.append(el('span',label),el('strong',value,cls));return item;}
  function strategyName(c){const s=c.spec||c;return (s.timeframe===1440?'일봉':s.timeframe+'분봉')+' '+(family[s.family]||'전략')+(s.volume?' · 거래량':'');}
  function controls(node,runtime){
    const box=el('section',null,'strategy-control'),c=runtime?.control;
    const fresh=freshAt(c?.observed_at);
    const modes={observer:attachment(runtime)?.length?'장착 · 시작 대기':'대기 · 새 전략 거래 전',active:'새 전략 운용 중',exit_only:'신규 진입 중지 · 보유분 관리'};
    box.append(el('h4',fresh?(modes[c.mode]||'실행 상태 확인 필요'):'실행 상태 갱신 확인 필요'));
    const actions=el('div',null,'strategy-control-actions');
    for(const [action,label] of [['start','Start · 시작'],['stop','Stop · 신규 진입 중지']]){
      const link=el('a',label,action);link.href='https://t.me/Oracleinvest_bot?start='+action+'_'+node;
      link.target='_blank';link.rel='noopener noreferrer';link.title=node+' '+label+' · 텔레그램에서 확인';actions.append(link);
    }
    box.append(actions,el('p','버튼 → 내 텔레그램에서 준비 검사 → 시작 확인. 이 화면은 조회용이며, 버튼을 눌렀다는 이유만으로 운용 중으로 표시하지 않습니다.','strategy-note'));
    if(fresh){
      box.append(el('p',c.ready===true?'마지막 준비 검사 통과 · 시작할 때 다시 확인합니다.':'시작 준비 중 · 아래 항목을 먼저 완료해야 합니다.',c.ready===true?'positive':'strategy-wait'));
      const reasons={approval_not_ready:'검증된 전략의 실행 승인',ledger_not_ready:'기존 잔고·손익 장부 이전',reconciliation_not_ready:'실제 계좌와 전략별 보유량 대사',risk_not_ready:'손실 한도와 운용 가능 잔고 확인',costs_not_ready:'수수료·거래 비용 확인',source_not_ready:'실행에 필요한 시장 데이터 확인',single_writer_not_ready:'기존 UT Bot과 새 실행기의 주문 충돌 방지'};
      const list=el('ul');for(const code of new Set(c.reasons||[])){if(reasons[code])list.append(el('li',reasons[code]));}if(list.children.length)box.append(list);
      box.append(el('p','서버 검사 '+at(c.observed_at)+' · 공개 화면 갱신에는 수분이 걸릴 수 있습니다.','strategy-note'));
    }
    box.append(el('p','Stop은 새 진입을 중지합니다. 새 체계가 관리 중인 보유분의 청산·손실 관리는 계속합니다.','strategy-note'));
    return box;
  }
  window.renderStrategyFleet = (host,nodes,observedAt) => {
    if(!host)return;
    const opened=new Set([...host.querySelectorAll('details[open]')].map(x=>x.dataset.key));
    host.replaceChildren();host.className='strategy-fleet';
    for(const node of ['AMD1','AMD2']){
      const d=nodes?.[node], card=el('article',null,'strategy-node');card.dataset.node=node;
      card.append(el('h3',node+' · '+(node==='AMD1'?'업비트':'나무증권')));
      card.append(controls(node,d?.runtime));
      if(!d){card.append(el('p','새 전략 상태 수신 대기','strategy-none'));host.append(card);continue;}
      const runtime=d.runtime||{}, attached=attachment(runtime), counts=el('div',null,'strategy-counts');
      counts.append(metric('현재 백테스트 통과',d.passed_count+'개'),metric('새 전략 장착 확인',attached==null?'확인 대기':attached.length+'개'));
      if(runtime.staging)counts.append(metric('서버 후보 수신',runtime.stale||!runtime.staging.fresh?'갱신 대기':runtime.staging.staged.length+'개'));
      card.append(counts);
      if(d.adaptive){
        const a=d.adaptive,j=a.jobs||{};
        card.append(el('p','A1 동적 전략 연구 · EMA·ATR 추적 / 켈트너 / 슈퍼트렌드 / 되돌림','strategy-note'));
        card.append(el('p',a.fresh?'평가 작업 완료 '+(j.complete||0)+'건 · 실행 중 '+(j.running||0)+'건 · 대기 '+(j.queued||0)+'건'+(j.quarantined?' · 오류 확인 '+j.quarantined+'건':''):'새 연구 상태 갱신 확인 필요',a.fresh?'strategy-note':'strategy-wait'));
      }
      const installed=el('div',null,'installed-strategies');installed.append(el('h4','서버에 장착된 전략'));
      if(runtime.legacy_retired_at)installed.append(el('p','기존 UT Bot 자동 실행 종료 · '+at(runtime.legacy_retired_at)+' · 보유분 매도 여부는 계좌 체결로 확인합니다.','strategy-wait'));
      if(runtime.stale)installed.append(el('p','기존 실행 설정 확인이 늦어지고 있습니다. 아래 기존 전략은 마지막 수신 기록입니다.','strategy-wait'));
      for(const s of runtime.legacy||[]){
        const item=el('div',null,'strategy-legacy');
        item.append(el('strong',s.name+' · '+(s.mode==='live'?'실전 설정':'주문 없는 실행 설정')+(s.halted?' · 중단 상태':'')),el('p',markets(s.symbols)+' · '+s.schedule),el('p','마지막 실행 '+at(s.last_run),'strategy-note'));
        item.append(el('p',s.allow_new_buys===false?'신규매수 차단 · 기존 보유 관리':s.allow_new_buys===true?'신규매수 허용 설정':'신규매수 설정 확인 대기',s.allow_new_buys===false?'strategy-wait':'strategy-note'));
        if(s.account_drawdown!=null)item.append(el('p','기존 손실한도 '+pct(-s.account_drawdown)+' · 새 체계 전환 전','strategy-wait'));
        installed.append(item);
      }
      if(!(runtime.legacy||[]).length)installed.append(el('p',runtime.stale?'기존 장착 전략 확인 대기':'기존 실전 전략 없음','strategy-none'));
      for(const id of runtime.new_attached||[]){
        const candidate=(d.candidates||[]).find(c=>c.id===id), item=el('div',null,'strategy-legacy');
        item.dataset.attachedStrategy=id;
        item.append(el('strong',(candidate?strategyName(candidate):'새 전략')+' · '+(attached?attachedLabel(runtime):'장착 상태 갱신 확인 필요')),
          el('div','전략 '+id.slice(0,10),'strategy-id'));
        if(candidate)item.append(el('p',markets((candidate.spec||candidate).symbols)));
        installed.append(item);
      }
      if(runtime.attachment_observed_at)installed.append(el('p','장착 확인 '+at(runtime.attachment_observed_at)+(attached==null?' · 마지막 수신 기록':''),'strategy-note'));
      if(runtime.staging){
        const staging=runtime.staging;
        installed.append(el('p','A1 후보 전달 → '+node+' 수신·확인 → A1 결과 회신: '+(staging.fresh&&!runtime.stale&&staging.feedback_received?'왕복 확인됨':'일부 단계 갱신 확인 필요'),'strategy-note'));
        if(!attached?.length)installed.append(el('p',attached?'새 전략 후보를 수신했습니다. 현재 승인된 장착 전략은 없습니다.':'후보 수신 기록입니다. 현재 장착·실행 상태는 최신 서버 확인이 필요합니다.','strategy-wait'));
        if(staging.proposed?.length)installed.append(el('p','개별·조합 검증이 끝난 준비 구성: '+staging.proposed.map(x=>x.slice(0,10)).join(' · ')+(staging.proposed.some(id=>!attached?.includes(id))?' · 미장착 후보의 보유분 전환 검증은 별도':''),'strategy-note'));
      }else if(!attached?.length)installed.append(el('p',attached&&runtime.new_state==='executor_not_connected'?'새 통과 전략: 아직 미장착 · 실행기 연결 대기':'새 전략 장착 상태: 서버 적용 기록 확인 필요','strategy-wait'));
      installed.append(el('p','기존 실행 설정 확인 '+at(runtime.observed_at),'strategy-note'));card.append(installed);
      card.append(el('h4','검증 통과 후보'));
      card.append(el('p','같은 전략의 반복 평가를 합쳐 표시합니다. 아래 수익률은 표시된 검증 기간의 백테스트 결과입니다.','strategy-note'));
      const list=el('div',null,'strategy-list');
      for(const c of d.candidates||[]){
        const passed=c.qualification==='passed', applied=attached?.includes(c.id), item=el('article',null,'strategy-item'+(passed?'':' pending'));item.dataset.strategy=c.id;
        const head=el('div',null,'strategy-head');head.append(el('h4',strategyName(c)),el('span',applied?attachedLabel(runtime):passed?(c.delivered?'통과 · 서버 수신 · 운용 대기':'백테스트 통과 · 미장착'):'과거 통과 · 재검증 확인','strategy-tag'));item.append(head);
        if(applied&&!passed)item.append(el('p','과거 통과 · 재검증 확인','strategy-wait'));
        item.append(el('p',markets((c.spec||c).symbols)),el('div','전략 '+c.id.slice(0,10),'strategy-id'));
        const m=c.metrics||{}, stats=el('div',null,'strategy-stats');
        stats.append(metric('비용 차감 수익',pct(m.net_return),m.net_return>0?'positive':'negative'),metric('비용 2배 수익',pct(m.stress_return),m.stress_return>0?'positive':'negative'),metric('최대 낙폭',pct(m.max_drawdown)),metric('완료 거래',(m.completed_trades??'—')+'회'),metric('승률',typeof m.win_rate==='number'?(m.win_rate*100).toFixed(1)+'%':'—'),metric('조합 검증',c.combination_passed?'통과':'대기'));item.append(stats);
        item.append(el('p','검증 '+(c.window?.validation_start||'').slice(0,10)+' ~ '+(c.window?.end||'').slice(0,10)+' 미만','strategy-note'));
        const pending=new Set(['execution_integration_pending','execution_adapter_pending','ledger_transition_pending','historical_transition_pending']);
        const waiting=(c.wait_reasons||[]).filter(code=>!applied||!pending.has(code));
        if(waiting.length)item.append(el('p',waiting.map(x=>reason[x]||x).join(' · '),'strategy-wait'));
        if(c.spec){const s=c.spec, details=el('details');details.dataset.key=node+':'+c.id;details.open=opened.has(details.dataset.key);details.append(el('summary','고정된 전략 설정 보기'),el('p','최대 보유 '+s.hold_days+'일 · 매수 상한 '+pct(s.premium)+' · 기준 '+s.window+'봉 · ATR '+s.atr_period+'봉'),el('p','손절 ATR '+s.stop_atr+'배 · 목표 손익비 '+s.take_rr+(s.volume?' · 거래량 '+s.volume_ratio+'배 조건':' · 별도 거래량 조건 없음')),el('p','최종 평가 전에 고정한 설정입니다. 완결 평가 기록 '+c.completed_evaluation_records+'건을 새 독립 검증 횟수로 세지 않습니다.','strategy-note'));item.append(details);}
        list.append(item);
      }
      if(!list.children.length)list.append(el('p','아직 백테스트 통과 후보가 없습니다.','strategy-none'));
      if(d.issues?.length)list.append(el('p','일부 후보의 근거 파일 확인이 필요합니다.','strategy-wait'));
      card.append(list);host.append(card);
    }
  };
})();
