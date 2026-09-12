/* Display only: prices and stops never place orders from this page. */
(() => {
  const style = document.createElement('style');
  style.textContent = `.asset-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.asset-metric{padding:17px;background:#0e1722;border:1px solid #2a3545;border-radius:10px;min-width:0}.asset-metric>span{display:block;color:#a4b2c5;font-size:12px}.asset-metric>strong{display:block;font-size:25px;margin:6px 0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.asset-metric small{display:block;font-size:11px}.holding-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0}.holding-card{border:1px solid #35506a;border-radius:12px;padding:20px;background:#0e1722;min-width:0}.holding-card h3{font-size:21px;margin:0}.holding-card .holding-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.holding-prices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.holding-prices .asset-metric{padding:12px}.holding-prices .asset-metric>strong{font-size:19px}.exit-explanation{border-left:3px solid #e2b65d;padding:10px 14px;background:#242017;border-radius:0 8px 8px 0;font-size:13px;line-height:1.8}.performance-card{padding:20px;border:1px solid #396853;border-radius:12px;margin:20px 0;background:#10221f}.performance-card h3{margin:0 0 8px;font-size:19px}.performance-card .asset-summary{margin-bottom:12px}.portfolio-note{font-size:12px;color:#a4b2c5;line-height:1.8}.portfolio-stale{color:#ffc978}.holding-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px}.portfolio-trades{margin-top:18px}.portfolio-trades th,.portfolio-trades td{font-size:12px}.portfolio-deposit{color:#7be3b2;font-size:14px;margin:14px 0}.portfolio-empty{padding:20px;color:#a4b2c5}.asset-summary .gain,.holding-card .gain{color:#7be3b2}.asset-summary .loss,.holding-card .loss{color:#ff8990}@media(max-width:850px){.holding-grid{grid-template-columns:1fr}.asset-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.holding-card{padding:16px}.asset-metric>strong{font-size:21px}.portfolio-trades table{white-space:normal}.portfolio-trades td,.portfolio-trades th{padding:10px 6px}}@media(max-width:450px){.asset-metric{padding:12px}.holding-prices{gap:8px}.holding-prices .asset-metric>strong{font-size:17px}.performance-card{padding:14px}}`;
  document.head.append(style);
  const money = x => Number.isFinite(x) ? x.toLocaleString('ko-KR', {maximumFractionDigits: x !== 0 && Math.abs(x) < 10 ? 2 : 0}) + '원' : '확인 대기';
  const percent = x => Number.isFinite(x) ? (x > 0 ? '+' : '') + (x * 100).toFixed(2) + '%' : '—';
  const time = x => x ? new Date(x).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) : '확인 대기';
  const sign = x => x > 0 ? 'gain' : x < 0 ? 'loss' : '';
  function el(tag, text, cls) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; }
  function metric(label, text, note = '', cls = '') {
    const node = el('div', null, 'asset-metric'); node.append(el('span', label), el('strong', text, cls));
    if (note) node.append(el('small', note, 'muted')); return node;
  }
  window.renderPortfolio = (host, data) => {
    const tradesOpen = host.querySelector('.portfolio-trades')?.open || false;
    host.replaceChildren();
    if (!data) { host.append(el('p', '업비트 자산 조회 기록을 기다리고 있습니다.', 'portfolio-empty')); return; }
    const age = Date.now() - Date.parse(data.observed_at);
    const stale = data.stale || !Number.isFinite(age) || age < -60000 || age >= 900000;
    host.append(el('p', '업비트 조회 ' + time(data.observed_at) + (stale ? ' · 갱신 지연: 아래는 이전 조회 기록입니다.' : ' · 5분 간격 수집·게시'), stale ? 'portfolio-note portfolio-stale' : 'portfolio-note'));
    const a = data.account || {}, strategy = data.strategies?.find(x => x.id === 'legacy-utbot');
    const summary = el('div', null, 'asset-summary');
    summary.append(metric('총 평가자산', money(a.equity), '원화 + 보유 코인 평가액'),
      metric('사용 가능한 원화', money(a.cash_available), '주문에 묶인 원화 ' + money(a.cash_locked)),
      metric('코인 평가액', money(a.holdings_value), '현재 보유분 전체'),
      metric('누적 순입금', money(a.net_deposits), '원화 입금 합계 − 출금 합계'),
      metric('순입금 대비 계좌 손익', money(a.deposit_comparison_pnl), '기존 MED를 포함한 계좌 전체', sign(a.deposit_comparison_pnl)),
      metric('다음 매매 판단', strategy?.halted ? '중단 상태' : strategy?.next_run ? new Date(strategy.next_run).toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) : '확인 대기', 'UT Bot · 매일 오전 9시 5분'));
    host.append(summary);
    if (a.last_deposit) host.append(el('p', '최근 입금 ' + money(a.last_deposit.amount) + ' · ' + time(a.last_deposit.at), 'portfolio-deposit'));
    const flowDetail = el('p', '원화 누적 입금 ' + money(a.deposits) + ' / 누적 출금 ' + money(a.withdrawals) + '. 입금은 전략 수익에 포함하지 않습니다.', 'portfolio-note');
    host.append(flowDetail, el('h3', '보유 자산 · 매수가와 매도 조건'));
    const holdings = el('div', null, 'holding-grid');
    for (const p of data.positions || []) {
      const card = el('article', null, 'holding-card'); card.dataset.symbol = p.symbol;
      const heading = el('div', null, 'holding-heading');
      heading.append(el('h3', p.symbol.replace('KRW-', '')), el('span', p.strategy_id === 'legacy-utbot' ? '기존 UT Bot · 실체결 확인' : p.symbol === 'KRW-MED' ? '기존 잔량 · 정리 대상' : '전략 귀속 확인 필요', 'pill'));
      const meta = el('div', null, 'holding-meta');
      meta.append(el('p', '보유 ' + p.quantity?.toLocaleString('ko-KR', {maximumFractionDigits:8})), el('p', '평가손익 ' + money(p.unrealized_gross) + ' (' + percent(p.return_gross) + ')', sign(p.unrealized_gross)));
      card.append(heading, meta);
      const prices = el('div', null, 'holding-prices');
      prices.append(metric('평균 매수가', money(p.avg_buy_price), p.avg_price_modified ? '업비트에서 수정된 매수평균' : '업비트 보유 평균 · 수수료 전'),
        metric('조회 현재가', money(p.current_price), '보유 평가액 ' + money(p.valuation)),
        metric('보유 중 관측 최고가', p.peak_observed_through ? money(p.peak_price) : '기록 없음', p.entry_at ? '보유 시작 ' + time(p.entry_at) : '귀속 거래 확인 필요'),
        metric('마지막 매도 기준선', p.stop_price == null ? '적용 전략 없음' : money(p.stop_price), p.stop_price == null ? '최소 매도금액 등 확인 필요' : '현재가가 기준선 대비 ' + percent(p.distance_to_stop)));
      card.append(prices);
      if (p.stop_price != null) {
        const message = strategy?.halted ? '봇 중단 상태입니다. 다음 실행의 청산 결과를 확인해야 합니다.' : p.signal_long === false ? '마지막 일봉 판단은 현금 보유입니다. 남은 보유분의 매도 결과를 확인해야 합니다.' : '상승 흐름이 이어지면 ATR 기준선도 올라갑니다. 매일 09:05에 마감 일봉의 매도 신호를 확인하고 매도합니다.';
        card.append(el('p', message + ' 기준선에 닿는 즉시 매도하는 예약 주문은 아닙니다.', 'exit-explanation'));
        card.append(el('p', '기준봉 시작일 ' + (p.signal_bar_date?.slice(0,10) || '확인 대기') + ' · 마지막 판단 ' + time(strategy?.last_run) + ' · 고정 익절 목표가 없음', 'portfolio-note'));
      } else if (p.symbol === 'KRW-MED') card.append(el('p', '매도 가능한 최소금액을 충족하면 정리할 기존 잔량입니다. UT Bot 수익률에는 포함하지 않습니다.', 'portfolio-note'));
      holdings.append(card);
    }
    if (!holdings.children.length) holdings.append(el('p', '보유 코인이 없습니다.', 'portfolio-empty'));
    host.append(holdings, el('p', '관측 최고가는 매수 다음 분부터 수집된 분봉과 조회 현재가 기준입니다. 매도 기준선은 마지막 실제 봇 실행 값이며 다음 판단에서 달라질 수 있습니다.', 'portfolio-note'));
    const performance = el('section', null, 'performance-card');
    performance.append(el('h3', '전략별 실전 성과 · 기존 UT Bot'));
    if (!strategy?.ready) performance.append(el('p', '체결 기록과 현재 보유 수량·매수원가를 대조 중입니다. 확인되지 않은 전략 수익률은 표시하지 않습니다.', 'portfolio-stale'));
    const scores = el('div', null, 'asset-summary');
    scores.append(metric('매수원가 대비 순손익률', percent(strategy?.return_on_buys), '실현 + 예상 청산손익 / 누적 매수원가', sign(strategy?.return_on_buys)),
      metric('순손익 합계 · 추정', money(strategy?.net_pnl_estimate), '매수 수수료·예상 매도 수수료 반영', sign(strategy?.net_pnl_estimate)),
      metric('실현손익', money(strategy?.realized_pnl), '실제 매도 체결과 수수료 기준', sign(strategy?.realized_pnl)),
      metric('보유분 예상 청산손익', money(strategy?.unrealized_net_estimate), '현재가로 매도한다고 가정', sign(strategy?.unrealized_net_estimate)),
      metric('누적 매수원가', money(strategy?.invested), '확인된 UT Bot 체결 · 매수 수수료 포함'),
      metric('완료 거래 · 승률', (strategy?.completed_trades ?? '—') + '회 / ' + percent(strategy?.win_rate), '한 보유 구간을 모두 청산하면 1회'));
    performance.append(scores, el('p', '실체결 기록 시작 ' + time(strategy?.first_trade_at) + '. 위 수익률은 매수원가 대비 손익률이며 계좌 전체의 기간 수익률과 다릅니다. 예상 청산손익은 실제 매도 가격에 따라 달라집니다. 새 연구 후보는 실전 장착 후 별도 성과를 표시합니다.', 'portfolio-note'));
    host.append(performance);
    const tradeBox = el('details', null, 'portfolio-trades'); tradeBox.open = tradesOpen; tradeBox.append(el('summary', '실제 매수·매도 내역 (' + (data.trades?.length || 0) + '건 · 최근 20건)'));
    const wrap = el('div', null, 'tablewrap'), table = el('table'), head = el('thead'), title = el('tr');
    for (const text of ['체결 주문 시각', '코인', '매매', '평균 체결가', '수량', '체결금액', '수수료']) title.append(el('th', text));
    head.append(title); table.append(head); const body = el('tbody');
    for (const t of data.trades || []) {
      const row = el('tr');
      for (const text of [time(t.at), t.symbol.replace('KRW-', ''), t.side === 'bid' ? '매수' : '매도', money(t.price), t.volume?.toLocaleString('ko-KR', {maximumFractionDigits:8}), money(t.funds), money(t.fee)]) row.append(el('td', text));
      body.append(row);
    }
    table.append(body); wrap.append(table); tradeBox.append(wrap); host.append(tradeBox);
  };
})();
