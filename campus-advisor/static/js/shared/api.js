/* ── API 请求封装（自动处理会话过期重连） ── */

function api(method, path, body) {
  return sessionReady.then(function() {
    return _apiWithRetry(method, path, body, 0);
  });
}

function _apiWithRetry(method, path, body, retryCount) {
  var opts = {method: method, headers: {}};
  if (sessionToken) {
    opts.headers['X-Session-Token'] = sessionToken;
  }
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(API + path, opts).then(function(r) {
    var ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return r;  // 流式响应（SSE）
    return r.json().then(function(j) {
      // 401 → 会话过期，重新初始化并重试（仅一次）
      if (r.status === 401 && retryCount === 0) {
        var oldSessionId = sessionId;
        return _reinitSession().then(function() {
          var retryPath = path;
          if (oldSessionId && sessionId) {
            retryPath = retryPath.split(encodeURIComponent(oldSessionId)).join(encodeURIComponent(sessionId));
          }
          var retryBody = body;
          if (body && body.session_id === oldSessionId) {
            retryBody = Object.assign({}, body, {session_id: sessionId});
          }
          return _apiWithRetry(method, retryPath, retryBody, 1);
        });
      }
      if (!r.ok && j && j.ok === false) {
        throw new Error(j.error || ('请求失败 (' + r.status + ')'));
      }
      if (!r.ok) {
        throw new Error(j.error || j.detail || ('请求失败 (' + r.status + ')'));
      }
      return j;
    });
  });
}

function _reinitSession() {
  return fetch(API + '/api/session/init', {method:'POST'}).then(function(r){
    if (!r.ok) throw new Error('Session initialization failed');
    return r.json();
  }).then(function(d){
    sessionId = d.session_id;
    sessionToken = d.token;
    localStorage.setItem('qna_sessionId', sessionId);
    localStorage.setItem('qna_sessionToken', sessionToken);
    return d;
  });
}
