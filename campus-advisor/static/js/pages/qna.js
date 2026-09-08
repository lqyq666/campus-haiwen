function syncViewportHeight() {
  var viewport = window.visualViewport;
  var height = viewport ? viewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', Math.round(height) + 'px');
}

syncViewportHeight();
window.addEventListener('resize', syncViewportHeight, {passive: true});
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewportHeight, {passive: true});

var sessionId = '';
var sessionToken = '';
var waiting = false;
var messages = document.getElementById('chatMessages');
var input = document.getElementById('chatInput');
var form = document.getElementById('intakeForm');
var quickActions = document.getElementById('quickActions');
var reportElement = document.getElementById('report');

function element(tag, text, className) {
  var node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function addMessage(text, type) {
  var item = element('article', '', 'msg ' + type);
  item.appendChild(element('div', text, 'msg-content'));
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

async function ensureSession(forceNew) {
  if (forceNew) {
    sessionId = '';
    sessionToken = '';
    localStorage.removeItem('assessment-session');
  }
  if (sessionId) return;
  var saved = localStorage.getItem('assessment-session');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      sessionId = parsed.sessionId;
      sessionToken = parsed.sessionToken;
      return;
    } catch (_) { localStorage.removeItem('assessment-session'); }
  }
  var response = await fetch('/api/session/init', {method: 'POST'});
  var data = await response.json();
  sessionId = data.session_id;
  sessionToken = data.token;
  localStorage.setItem('assessment-session', JSON.stringify({sessionId: sessionId, sessionToken: sessionToken}));
}

async function requestIntake(message) {
  var response = await fetch('/api/assessment/intake', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Session-Token': sessionToken},
    body: JSON.stringify({session_id: sessionId, message: message})
  });
  var data = await response.json();
  return {response: response, data: data};
}

function showServiceError(text) {
  messages.querySelectorAll('[data-service-error]').forEach(function(item) { item.remove(); });
  var item = addMessage(text || '测评服务暂时不可用，请稍后重新尝试。', 'bot');
  item.setAttribute('data-service-error', 'true');
}

function trackBrowserEvent(eventType, suffix, metadata, programId) {
  if (!sessionId || !sessionToken) return;
  var eventId = [sessionId, eventType, suffix || 'once'].join(':').slice(0, 128);
  fetch('/api/assessment/event', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Session-Token': sessionToken},
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      metadata: metadata || {},
      program_id: programId || null,
      session_id: sessionId
    })
  }).catch(function() {});
}

function setLoading(loading) {
  waiting = loading;
  input.disabled = loading;
  document.getElementById('sendBtn').disabled = loading;
  if (loading) input.placeholder = '正在分析你的升学路径、匹配目标院校并核对官方政策…';
  else input.placeholder = '按提示回答，或使用上方快捷选项';
}

function renderInputSpec(spec) {
  quickActions.innerHTML = '';
  if (!spec || !spec.type || spec.type === 'text') return;
  function appendCustomButton(label) {
    var custom = element('button', label || '其他（自行填写）', 'quick-button quick-custom');
    custom.type = 'button';
    custom.addEventListener('click', function() {
      input.placeholder = label || '请在这里补充填写';
      input.focus();
    });
    quickActions.appendChild(custom);
  }
  if (spec.type === 'rank') {
    var rank = document.createElement('input');
    rank.type = 'number'; rank.min = '1'; rank.placeholder = '当前排名'; rank.setAttribute('aria-label', '当前排名');
    var total = document.createElement('input');
    total.type = 'number'; total.min = '1'; total.placeholder = '专业总人数'; total.setAttribute('aria-label', '专业总人数');
    var submit = element('button', '确认排名', 'quick-button');
    submit.type = 'button';
    submit.addEventListener('click', function() {
      if (!rank.value) return;
      send(total.value ? rank.value + '/' + total.value : rank.value);
    });
    quickActions.append(rank, total, submit);
    return;
  }
  if (spec.type === 'english_scores') {
    var cet4 = document.createElement('input');
    cet4.type = 'number'; cet4.min = '0'; cet4.max = '710'; cet4.placeholder = 'CET4 分数'; cet4.setAttribute('aria-label', 'CET4 分数，未考留空');
    var cet6 = document.createElement('input');
    cet6.type = 'number'; cet6.min = '0'; cet6.max = '710'; cet6.placeholder = 'CET6 分数'; cet6.setAttribute('aria-label', 'CET6 分数，未考留空');
    var scoreSubmit = element('button', '提交成绩', 'quick-button quick-confirm'); scoreSubmit.type = 'button';
    var scoreError = element('small', '', 'quick-error'); scoreError.setAttribute('role', 'status');
    scoreSubmit.addEventListener('click', function() {
      var values = [];
      if (cet4.value !== '') values.push('CET4 ' + cet4.value);
      if (cet6.value !== '') values.push('CET6 ' + cet6.value);
      if (!values.length) { scoreError.textContent = '请填写至少一项成绩，或选择“四六级都未考”。'; cet4.focus(); return; }
      send(values.join('；'));
    });
    var notTaken = element('button', '四六级都未考', 'quick-button quick-custom'); notTaken.type = 'button';
    notTaken.addEventListener('click', function() { send('四六级都未考'); });
    quickActions.append(cet4, cet6, scoreSubmit, notTaken, scoreError);
    return;
  }
  if (spec.type === 'multi_choice') {
    var selected = [];
    (spec.options || []).forEach(function(option) {
      var choice = element('button', option, 'quick-button'); choice.type = 'button'; choice.setAttribute('aria-pressed', 'false');
      choice.addEventListener('click', function() {
        var index = selected.indexOf(option);
        if (index >= 0) selected.splice(index, 1); else selected.push(option);
        choice.setAttribute('aria-pressed', index < 0 ? 'true' : 'false');
      });
      quickActions.appendChild(choice);
    });
    var supplement = document.createElement('input'); supplement.type = 'text'; supplement.maxLength = 100; supplement.placeholder = spec.custom_label || '其他（可选）'; supplement.setAttribute('aria-label', spec.custom_label || '其他选项');
    var multiSubmit = element('button', '确认选择', 'quick-button quick-confirm'); multiSubmit.type = 'button';
    var multiError = element('small', '', 'quick-error'); multiError.setAttribute('role', 'status');
    multiSubmit.addEventListener('click', function() {
      var values = selected.slice();
      if (supplement.value.trim()) values.push(supplement.value.trim());
      if (!values.length) { multiError.textContent = '请至少选择或填写一项。'; return; }
      send(values.join('、'));
    });
    quickActions.append(supplement, multiSubmit, multiError);
    return;
  }
  (spec.options || []).forEach(function(option) {
    var button = element('button', option, 'quick-button');
    button.type = 'button';
    button.addEventListener('click', function() { send(option); });
    quickActions.appendChild(button);
  });
  if (spec.type === 'choice_or_text') appendCustomButton(spec.custom_label);
}

async function send(message) {
  if (waiting) return;
  setLoading(true);
  quickActions.innerHTML = '';
  try {
    await ensureSession();
    if (message !== '重新尝试') addMessage(message, 'user');
    var result = await requestIntake(message);
    if (result.response.status === 401) {
      await ensureSession(true);
      messages.innerHTML = '';
      reportElement.innerHTML = '';
      reportElement.hidden = true;
      addMessage('原测评会话已失效，已自动恢复并重新开始。', 'bot');
      result = await requestIntake('开始升学测评');
    }
    var response = result.response;
    var data = result.data;
    if (!response.ok) throw new Error(data.detail || '请求失败');
    if (data.retry_available) showServiceError(data.reply);
    else addMessage(data.reply, 'bot');
    renderInputSpec(data.input_spec);
    messages.scrollTop = messages.scrollHeight;
    if (data.assessment) renderReport(data.assessment);
    if (data.retry_available) renderRetry();
  } catch (_) {
    showServiceError('测评服务暂时不可用，请稍后重新尝试。');
    renderRetry();
  } finally {
    setLoading(false);
    input.focus();
  }
}

function renderRetry() {
  var button = element('button', '重新尝试', 'quick-button');
  button.type = 'button';
  button.addEventListener('click', function() { send('重新尝试'); });
  quickActions.appendChild(button);
}

function pathName(path) {
  return {RECOMMENDATION: '保研为主', POSTGRAD_EXAM: '考研为主', DUAL_TRACK: '保研 + 考研双轨', INSUFFICIENT_DATA: '信息不足'}[path] || '综合规划';
}
function appendText(parent, tag, text, className) { parent.appendChild(element(tag, text, className)); }

function concernAnswer(concern, report) {
  var route = pathName(report.pathDecision.path);
  var reason = report.pathDecision.reasons[0] ? report.pathDecision.reasons[0].message : '还需要补齐关键数据后再下结论。';
  var answers = {
    '不知道走保研还是考研': '当前更适合按“' + route + '”配置时间。' + reason,
    '排名不够有把握': '先用排名区间判断资格窗口，再结合英语和经历决定投入方向。' + reason,
    '英语拖后腿': '先核对目标项目的英语硬门槛，再区分需要先过线还是继续提分。' + reason,
    '科研竞赛太少': '先做成一项与目标专业相关、能说明个人贡献的代表成果，不按经历数量下结论。',
    '不会选学校': '先只比较同专业项目，不用学校名气代替专业匹配；院校层级用于缩小选择范围。',
    '时间安排混乱': '先只确定一项当前最重要的行动，用完成结果再调整后续投入。',
    '背景经历不够': '先处理最影响结果的短板，不要同时堆很多低相关经历。',
    '不知道现在该做什么': '先完成报告中的第一项行动，再根据结果调整保研或考研投入。'
  };
  return answers[concern] || ('当前建议按“' + route + '”推进。' + reason);
}

function positiveSummary(assessment) {
  var profile = assessment.profile || {};
  var positives = [];
  if (profile.rank && profile.cohortSize && profile.rank / profile.cohortSize <= 0.2) positives.push('目前的专业排名具备较好的竞争基础');
  if ((profile.researchExperiences || []).length) positives.push('已有科研或项目经历可以继续深化');
  if ((profile.competitionExperiences || []).length) positives.push('已有竞赛或获奖经历可以支撑个人展示');
  if (!positives.length) positives.push('你已经明确了目标和当前困难，这是做出有效判断的重要起点');
  return positives.slice(0, 2).join('；') + '。';
}

function personalNarrative(assessment) {
  var profile = assessment.profile || {};
  var report = assessment.report || {};
  var context = assessment.campusContext || {};
  var concern = context.currentConcern || '升学方向';
  var blocker = context.specificBlocker || '';
  var majors = ((report.studentSummary || {}).targetMajors || profile.targetMajors || []).filter(Boolean);
  var target = majors.length ? '你已经把目标聚焦到“' + majors.slice(0, 2).join('、') + '”' : '你正在认真寻找适合自己的升学方向';
  var opening = {
    '不知道走保研还是考研': '你不是没有打算，而是不愿意在信息不足时仓促押注一条路。',
    '排名不够有把握': '你对排名的在意，说明你正在认真评估机会，而不是凭感觉做决定。',
    '英语拖后腿': '你能主动指出英语这个影响因素，说明你已经开始正视目标与现状之间的距离。',
    '科研竞赛太少': '你关注科研和竞赛经历，说明你希望靠真实积累增强选择权。',
    '不会选学校': '你不是简单追逐学校名气，而是希望找到与自身条件和专业方向真正匹配的选择。',
    '时间安排混乱': '你想把时间用在真正影响结果的事情上，只是目前还缺少清晰的优先顺序。',
    '背景经历不够': '你已经意识到经历需要围绕目标形成积累，这比盲目参加活动更重要。',
    '不知道现在该做什么': '你并不缺少努力的意愿，真正困扰你的是怎样把努力落到正确方向。'
  }[concern] || '你愿意花时间完整梳理自己的情况，说明你正在认真对待这次升学选择。';
  var evidence = positiveSummary(assessment).replace(/。$/, '');
  var middle = target + '，同时也清楚自己卡在“' + (blocker || concern) + '”。' + evidence + '，这些都不是可以忽略的起点。';
  var close = '接下来更重要的不是给自己贴上“行”或“不行”的标签，而是把个人条件、目标要求和时间投入校准到同一条线上。专业老师可以帮助你减少试错，让已有的努力更有方向。';
  return [opening, middle, close];
}

function renderReport(assessment) {
  var report = assessment.report;
  var campusContext = assessment.campusContext || {};
  messages.hidden = true;
  quickActions.hidden = true;
  form.hidden = true;
  document.body.classList.add('report-mode');
  reportElement.innerHTML = '';
  reportElement.hidden = false;

  var toolbar = element('section', '', 'report-toolbar');
  appendText(toolbar, 'strong', '你的升学诊断');
  var restart = element('button', '重新测评', 'report-restart'); restart.type = 'button';
  restart.addEventListener('click', function() {
    reportElement.hidden = true;
    document.body.classList.remove('report-mode');
    messages.hidden = false;
    quickActions.hidden = false;
    form.hidden = false;
    messages.innerHTML = '';
    send('开始升学测评');
  });
  toolbar.appendChild(restart);
  reportElement.appendChild(toolbar);

  var concern = campusContext.currentConcern || '你的升学选择';
  var overall = element('section', '', 'overall-report');
  var overallHead = element('header', '', 'overall-report-head');
  appendText(overallHead, 'p', '总体报告');
  appendText(overallHead, 'h1', pathName(report.pathDecision.path));
  appendText(overallHead, 'strong', concernAnswer(concern, report));
  var narrative = element('div', '', 'overall-narrative');
  personalNarrative(assessment).forEach(function(paragraph) { appendText(narrative, 'p', paragraph); });
  overallHead.appendChild(narrative);
  overall.appendChild(overallHead);

  var summary = element('dl', '', 'overall-report-summary');
  [
    ['当前优势', positiveSummary(assessment)],
    ['核心问题', campusContext.specificBlocker || concern]
  ].forEach(function(item) {
    var row = element('div'); appendText(row, 'dt', item[0]); appendText(row, 'dd', item[1]); summary.appendChild(row);
  });
  overall.appendChild(summary);
  reportElement.appendChild(renderLeadForm());
  reportElement.appendChild(overall);
  var guidance = element('section', '', 'report-guidance');
  appendText(guidance, 'strong', '自动报告完成的是初步判断。');
  appendText(guidance, 'p', '如果希望进一步提升，仍需要专业老师结合目标院校的最新要求，帮助核对路径选择、同专业院校范围和关键短板。');
  appendText(guidance, 'small', '以上结论依据你本次填写的信息和 Haiwen 已收录的官方资料生成，不代表录取结果。');
  reportElement.appendChild(guidance);

  trackBrowserEvent('REPORT_VIEWED', report.reportVersion || 'v02');
  reportElement.scrollTop = 0;
}

function renderLeadForm() {
  var section = element('section', '', 'lead-card');
  section.setAttribute('aria-label', '申请老师人工复核');
  var leadHeader = element('header', '', 'lead-summary');
  var leadLabel = element('span'); appendText(leadLabel, 'strong', '请老师结合本次测评进一步核对'); appendText(leadLabel, 'small', '老师会结合本次回答，帮你确认当前判断有没有偏差');
  leadHeader.appendChild(leadLabel); section.appendChild(leadHeader);
  var benefits = element('ul', '', 'lead-benefits');
  appendText(benefits, 'li', '核对保研 / 考研方向是否适合你');
  appendText(benefits, 'li', '围绕你最担心的问题给出针对性反馈');
  section.appendChild(benefits);
  var leadForm = element('form');
  appendText(leadForm, 'p', '微信号必填；姓名、手机号和 QQ 可以选填。', 'lead-instruction');
  var contactGrid = element('div', '', 'lead-contact-grid');
  [['wechat', '微信号（必填）'], ['name', '姓名（选填）'], ['phone', '手机号（选填）'], ['qq', 'QQ 号（选填）']].forEach(function(field) { var inputNode = document.createElement('input'); inputNode.name = field[0]; inputNode.placeholder = field[1]; inputNode.maxLength = 64; contactGrid.appendChild(inputNode); });
  leadForm.appendChild(contactGrid);
  var contactStarted = false;
  leadForm.addEventListener('focusin', function() {
    if (!contactStarted) { contactStarted = true; trackBrowserEvent('CONTACT_FORM_STARTED', 'primary'); }
  });
  var consentField = element('div', '', 'lead-consent-field');
  var consent = document.createElement('label'); var consentBox = document.createElement('input'); consentBox.id = 'leadConsent'; consentBox.name = 'consent'; consentBox.type = 'checkbox'; consentBox.setAttribute('aria-describedby', 'leadConsentError'); consent.append(consentBox, document.createTextNode(' 我同意规划老师通过以上方式联系我')); consentField.appendChild(consent);
  var consentError = element('small', '请勾选此项后再提交。', 'lead-field-error'); consentError.id = 'leadConsentError'; consentError.hidden = true; consentField.appendChild(consentError); leadForm.appendChild(consentField);
  var consultationField = element('div', '', 'lead-consent-field');
  var consultation = document.createElement('label'); var consultationBox = document.createElement('input'); consultationBox.id = 'leadConsultation'; consultationBox.name = 'consultation'; consultationBox.type = 'checkbox'; consultationBox.setAttribute('aria-describedby', 'leadConsultationError'); consultation.append(consultationBox, document.createTextNode(' 我确认希望老师复核本次测评')); consultationField.appendChild(consultation);
  var consultationError = element('small', '请勾选此项后再提交。', 'lead-field-error'); consultationError.id = 'leadConsultationError'; consultationError.hidden = true; consultationField.appendChild(consultationError); leadForm.appendChild(consultationField);
  var actions = element('div', '', 'lead-actions');
  var submit = element('button', '提交并申请人工复核', 'lead-submit'); submit.type = 'submit'; submit.addEventListener('click', function() { trackBrowserEvent('REVIEW_CTA_CLICKED', 'primary'); }); actions.appendChild(submit);
  var edit = element('button', '修改信息', 'lead-edit'); edit.type = 'button'; edit.hidden = true; actions.appendChild(edit); leadForm.appendChild(actions);
  appendText(leadForm, 'small', '联系方式会安全提交到咨询系统，不会显示在测评报告或对话记录中；提交后仍可修改。', 'lead-privacy');
  var status = element('p', '', 'lead-status'); status.setAttribute('role', 'status'); leadForm.appendChild(status);
  function setLeadFormDisabled(disabled) {
    leadForm.querySelectorAll('input').forEach(function(control) { control.disabled = disabled; });
    submit.disabled = disabled;
  }
  function setCheckboxError(checkbox, error, show) {
    checkbox.setAttribute('aria-invalid', show ? 'true' : 'false');
    error.hidden = !show;
  }
  consentBox.addEventListener('change', function() { if (consentBox.checked) setCheckboxError(consentBox, consentError, false); });
  consultationBox.addEventListener('change', function() { if (consultationBox.checked) setCheckboxError(consultationBox, consultationError, false); });
  edit.addEventListener('click', function() {
    section.classList.remove('is-submitted');
    setLeadFormDisabled(false);
    setCheckboxError(consentBox, consentError, false);
    setCheckboxError(consultationBox, consultationError, false);
    submit.textContent = '重新提交';
    submit.classList.remove('is-submitted');
    edit.hidden = true;
    status.textContent = '请修改信息后重新提交。';
    var firstInput = leadForm.querySelector('input');
    if (firstInput) firstInput.focus();
  });
  leadForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    var fd = new FormData(leadForm);
    var hasContact = Boolean(fd.get('wechat'));
    setCheckboxError(consentBox, consentError, !consentBox.checked);
    setCheckboxError(consultationBox, consultationError, !consultationBox.checked);
    if (!hasContact || !consentBox.checked || !consultationBox.checked) {
      status.textContent = !hasContact ? '请填写微信号后再提交。' : '请勾选两个必选项后再提交。';
      return;
    }
    setLeadFormDisabled(true);
    leadForm.setAttribute('aria-busy', 'true');
    submit.textContent = '正在提交…';
    status.textContent = '正在安全提交你的资料，请稍候。';
    try {
      var response = await fetch('/api/assessment/lead', {method:'POST', headers:{'Content-Type':'application/json', 'X-Session-Token':sessionToken}, body:JSON.stringify({session_id:sessionId, consent:fd.get('consent') === 'on', request_consultation:fd.get('consultation') === 'on', contact:{name:fd.get('name') || '', phone:fd.get('phone') || '', wechat:fd.get('wechat') || '', qq:fd.get('qq') || ''}})});
      var data = await response.json(); if (!response.ok) throw new Error(data.detail || '提交失败');
      section.classList.add('is-submitted');
      submit.textContent = '已提交';
      submit.classList.add('is-submitted');
      edit.hidden = false;
      status.textContent = '已提交。老师会在 24 小时内联系你，请留意电话或微信消息。';
    } catch (error) {
      setLeadFormDisabled(false);
      submit.textContent = '重新提交';
      status.textContent = error.message || '资料暂时未提交成功，请稍后重试。';
    } finally {
      leadForm.removeAttribute('aria-busy');
    }
  });
  section.appendChild(leadForm);
  return section;
}

document.getElementById('startBtn').addEventListener('click', function() {
  var welcome = document.getElementById('welcome'); if (welcome) welcome.remove(); send('开始升学测评');
});
document.getElementById('historyBtn').addEventListener('click', async function() {
  var welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  try {
    await ensureSession();
    var response = await fetch('/api/assessment/history?session_id=' + encodeURIComponent(sessionId), {headers:{'X-Session-Token':sessionToken}});
    var data = await response.json();
    if (!response.ok) throw new Error();
    messages.innerHTML = '';
    if (!data.messages.length) {
      addMessage('暂时没有历史记录，你可以直接开始新的升学测评。', 'bot');
      return;
    }
    data.messages.forEach(function(message) { addMessage(message.content, message.role === 'user' ? 'user' : 'bot'); });
  } catch (_) {
    addMessage('暂时无法读取历史记录。', 'bot');
  }
});
form.addEventListener('submit', function(event) { event.preventDefault(); var message = input.value.trim(); if (!message) return; input.value = ''; send(message); });
