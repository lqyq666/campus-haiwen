/* ── Session / Token / API Base ── */

var API = window.__API_BASE__ || '';
var sessionId = localStorage.getItem('qna_sessionId');
var sessionToken = localStorage.getItem('qna_sessionToken');
var sessionReady = Promise.resolve();

// 首次访问或本地凭据不完整时，先拿到服务端会话再允许 API 请求发出。
if (!sessionId || !sessionToken || !sessionId.startsWith('s_')) {
  sessionId = '';
  sessionToken = '';
  localStorage.removeItem('qna_sessionId');
  localStorage.removeItem('qna_sessionToken');
  sessionReady = fetch(API + '/api/session/init', {method:'POST'})
    .then(function(r) {
      if (!r.ok) throw new Error('Session initialization failed');
      return r.json();
    })
    .then(function(d){
    sessionId = d.session_id;
    sessionToken = d.token;
    localStorage.setItem('qna_sessionId', sessionId);
    localStorage.setItem('qna_sessionToken', sessionToken);
    return d;
  });
}

/* ── Utility Functions ── */

function getUrlParam(name) {
  var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}
