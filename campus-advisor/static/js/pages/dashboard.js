/* dashboard.js — dashboard.html page logic */

var API = window.__API_BASE__ || '';
var sessionId = localStorage.getItem('qna_sessionId');
var sessionToken = localStorage.getItem('qna_sessionToken');

if (!sessionId) {}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function $(id){return document.getElementById(id);}

function loadAnnouncementsBanner() {
  api('GET', '/api/user/announcements/' + encodeURIComponent(sessionId)).then(function(d) {
    var anns = d.announcements || [];
    var container = $('announcementsBanner');
    if (anns.length === 0) { container.style.display = 'none'; return; }
    var html = '';
    anns.forEach(function(a) {
      html += '<div class="ann-banner">'
        + '<div class="ann-banner-content"><strong>' + esc(a.title) + '</strong>: ' + esc(a.content) + '</div>'
        + '<button class="ann-dismiss" onclick="dismissAnn(\'' + a.id + '\', this)">✕</button>'
        + '</div>';
    });
    container.innerHTML = html;
    container.style.display = 'block';
  }).catch(function(){});
}

function dismissAnn(id, btn) {
  api('POST', '/api/user/announcements/dismiss', {session_id: sessionId, ann_id: id}).then(function() {
    var banner = btn.closest('.ann-banner');
    if (banner) banner.remove();
    var container = $('announcementsBanner');
    if (container && container.children.length === 0) container.style.display = 'none';
  }).catch(function(){});
}

function loadProgress() {
  api('GET', '/api/progress/' + encodeURIComponent(sessionId)).then(function(d) {
    $('progressCard').style.display = 'block';
    $('progressIcon').textContent = d.icon || '🌱';
    $('progressLabel').textContent = d.label || '新手探索';
    $('progressDesc').textContent = d.desc || '';
    $('progressConvs').textContent = d.conversations || 0;
    $('progressMsgs').textContent = d.messages || 0;
    // Calculate progress bar width based on stage
    var stages = ['new', 'exploring', 'engaged', 'regular'];
    var idx = stages.indexOf(d.stage);
    var pct = Math.max(5, ((idx + 1) / stages.length) * 100);
    $('progressBarFill').style.width = pct + '%';
  }).catch(function(){});
}

function loadDashboard() {
  api('GET', '/api/user/dashboard/' + encodeURIComponent(sessionId)).then(function(d) {
    // Balance
    var bal = d.balance || 0;
    $('balanceAmount').textContent = bal;
    var tokens = Math.round(bal / 8 * 1000 / 100) / 10;
    var msgs = Math.round(bal / 12);
    $('balanceTokens').textContent = tokens;
    $('balanceMsgs').textContent = Math.max(0, msgs);
    var pct = Math.min(100, Math.round(bal / 5000 * 100));
    $('balanceBar').style.width = pct + '%';
    if (bal <= 100) { $('balanceBar').style.background = 'linear-gradient(90deg, #e74c3c, #e67e22)'; }

    // Stats
    $('statConvs').textContent = d.conversations.total;
    $('statMsgs').textContent = d.conversations.total_messages;
    var profile = d.profile || {};
    if (profile.updated_at) {
      var days = Math.floor((Date.now() - new Date(profile.updated_at).getTime()) / 86400000);
      $('statDays').textContent = Math.max(1, days) + ' 天';
    }

    // Profile
    $('pSchool').innerHTML = profile.school ? esc(profile.school) : '<span class="empty">未设置</span>';
    $('pMajor').innerHTML = profile.major ? esc(profile.major) : '<span class="empty">未设置</span>';
    $('pGrade').innerHTML = profile.grade ? esc(profile.grade) : '<span class="empty">未设置</span>';
    $('pGoal').innerHTML = profile.goal ? esc(profile.goal) : '<span class="empty">未设置</span>';
    var skillsEl = $('pSkills');
    var expEl = $('pExperience');
    var intEl = $('pInterests');
    var achEl = $('pAchievements');
    if (skillsEl) skillsEl.innerHTML = profile.skills ? esc(profile.skills) : '<span class="empty">未设置</span>';
    if (expEl) expEl.innerHTML = profile.experience ? esc(profile.experience) : '<span class="empty">未设置</span>';
    if (intEl) intEl.innerHTML = profile.interests ? esc(profile.interests) : '<span class="empty">未设置</span>';
    if (achEl) achEl.innerHTML = profile.achievements ? esc(profile.achievements) : '<span class="empty">未设置</span>';

    // Conversations
    var recent = d.conversations.recent || [];
    $('convTotal').textContent = '总计：' + d.conversations.total;
    if (recent.length === 0) {
      $('convList').innerHTML = '<div class="empty-state">暂无对话记录，开始你的第一次咨询吧！</div>';
    } else {
      var html = '';
      recent.forEach(function(c) {
        var modeTag = c.mode ? ' · ' + esc(c.mode) : '';
        html += '<div class="conv-item">';
        html += '<div class="conv-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>';
        html += '<div class="conv-info" onclick="openConv(\''+esc(c.id)+'\')"><div class="conv-title">' + esc(c.title) + '</div>';
        html += '<div class="conv-meta">' + c.message_count + ' 条消息' + modeTag + '</div></div>';
        html += '<div class="conv-actions"><button class="conv-action-btn" onclick="event.stopPropagation();exportConv(\''+esc(c.id)+'\')" title="导出">↓</button></div>';
        html += '<div class="conv-arrow" onclick="openConv(\''+esc(c.id)+'\')">→</div></div>';
      });
      $('convList').innerHTML = html;
    }

    // Continue last conversation button
    if (recent.length > 0) {
      var last = recent[0];
      $('continueBtn').style.display = 'inline-flex';
      $('continueBtn').href = 'qna.html?conv=' + encodeURIComponent(last.id);
    }

    // Last conversation summary
    if (recent.length > 0 && recent[0].summary) {
      $('summaryCard').style.display = 'block';
      $('lastSummary').textContent = recent[0].summary;
    }

    // Show content
    $('loading').style.display = 'none';
    $('app').style.display = 'block';
    // Load progress and announcements after main content
    loadProgress();
    loadAnnouncementsBanner();
  }).catch(function(e) {
    $('loading').innerHTML = '<span style="color:var(--red)">加载失败：' + e.message + '</span>';
  });
}

function exportConv(convId) {
  var url = API + '/api/conversations/' + encodeURIComponent(sessionId) + '/' + encodeURIComponent(convId) + '/export';
  // Use token header via fetch
  var opts = {method:'GET', headers:{}};
  if (sessionToken) opts.headers['X-Session-Token'] = sessionToken;
  fetch(url, opts).then(function(r) {
    if (!r.ok) throw new Error('导出失败');
    return r.blob();
  }).then(function(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'conversation.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }).catch(function(e) { alert('导出失败：' + e.message); });
}

function openConv(convId) {
  localStorage.setItem('qna_convId', convId);
  location.href = 'qna.html';
}

function autoResize(el) {
  if (!el || el.offsetHeight === 0) return; // skip if element is hidden (no layout)
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 76) + 'px';
}

function openEditProfile() {
  api('GET', '/api/user/dashboard/' + encodeURIComponent(sessionId)).then(function(d) {
    var p = d.profile || {};
    $('editSchool').value = p.school || '';
    $('editMajor').value = p.major || '';
    $('editGrade').value = p.grade || '';
    $('editGoal').value = p.goal || '';
    $('editSkills').value = p.skills || '';
    $('editExperience').value = p.experience || '';
    $('editInterests').value = p.interests || '';
    $('editAchievements').value = p.achievements || '';
    $('profileMsg').textContent = '';
    $('profileModal').classList.add('open');
    // Only autoResize is effective when modal is visible — min-height:76px prevents collapse if not
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        autoResize($('editGoal'));
        autoResize($('editSkills'));
        autoResize($('editExperience'));
        autoResize($('editInterests'));
        autoResize($('editAchievements'));
      });
    });
  });
}

function saveProfile() {
  var data = {
    session_id: sessionId,
    school: $('editSchool').value.trim(),
    major: $('editMajor').value.trim(),
    grade: $('editGrade').value,
    goal: $('editGoal').value.trim(),
    skills: $('editSkills').value.trim(),
    experience: $('editExperience').value.trim(),
    interests: $('editInterests').value.trim(),
    achievements: $('editAchievements').value.trim()
  };
  api('POST', '/api/profile/update', data).then(function() {
    $('profileMsg').innerHTML = '<span class="msg-success">已保存</span>';
    setTimeout(function() {
      $('profileModal').classList.remove('open');
      loadDashboard();
    }, 600);
  }).catch(function(e) {
    $('profileMsg').innerHTML = '<span class="msg-error">保存失败：' + esc(e.message) + '</span>';
  });
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openRecharge() {
  $('rechargeInput').value = '';
  $('rechargeMsg').textContent = '';
  $('rechargeModal').classList.add('open');
}

function doRecharge() {
  var code = $('rechargeInput').value.trim();
  if (!code) return;
  api('POST', '/api/recharge/redeem', {session_id: sessionId, code: code}).then(function(d) {
    if (d.ok) {
      $('rechargeMsg').innerHTML = '<span class="msg-success">' + esc(d.message) + '</span>';
      setTimeout(function() {
        $('rechargeModal').classList.remove('open');
        loadDashboard();
      }, 1000);
    } else {
      $('rechargeMsg').innerHTML = '<span class="msg-error">' + esc(d.message) + '</span>';
    }
  }).catch(function() {
    $('rechargeMsg').innerHTML = '<span class="msg-error">兑换失败</span>';
  });
}

// Handle modal overlay click to close
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Init
if (sessionId) {
  // If still using temp ID (session not yet initialized from server), wait for it
  if (sessionId && sessionId.startsWith('user_')) {
    // Already queued an async /api/session/init call in session.js — poll until ready
    var pollTimer = setInterval(function() {
      var sid = localStorage.getItem('qna_sessionId');
      var st = localStorage.getItem('qna_sessionToken');
      if (sid && !sid.startsWith('user_')) {
        sessionId = sid;
        sessionToken = st;
        clearInterval(pollTimer);
        loadDashboard();
      }
    }, 300);
    // Fallback: timeout after 10s and load with whatever we have
    setTimeout(function() { clearInterval(pollTimer); loadDashboard(); }, 10000);
  } else {
    loadDashboard();
  }
} else {
  document.querySelector('.loading').innerHTML = '<span>请先打开问答页面初始化会话</span><br><a class="nav-btn" href="qna.html" style="margin-top:12px;display:inline-block;">前往问答</a>';
}