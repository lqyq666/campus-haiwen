/* admin.js — admin.html 管理后台逻辑 */

var TOKEN = sessionStorage.getItem('admin_token') || '';

var API = window.__API_BASE__ || '';

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function api(method, path, body) {
  var opts = {method:method, headers:{}};
  if (TOKEN) { opts.headers['Authorization'] = 'Bearer ' + TOKEN; }
  if (body) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  return fetch(API+path, opts).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); });
}

function $(id){return document.getElementById(id);}

function doLogin(){
  var t = $('adminToken').value.trim();
  if(!t) return;
  TOKEN = t;
  sessionStorage.setItem('admin_token', t);
  loadApp();
}
function doLogout(){
  TOKEN=''; sessionStorage.removeItem('admin_token');
  $('app').classList.remove('open'); $('loginBox').style.display='block';
}

function switchPage(name){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-link').forEach(function(l){l.classList.remove('active');});
  $('page-'+name).classList.add('active');
  event.target.classList.add('active');
  if(name==='dashboard') loadDashboard();
  if(name==='recharge') loadRechargeCodes();
  if(name==='users') loadUsers();
}

function loadApp(){
  api('GET','/api/admin/users').then(function(){
    $('loginBox').style.display='none';
    $('app').classList.add('open');
    loadDashboard();
  }).catch(function(){
    $('loginErr').textContent='密码错误';
  });
}

// ── 概览 ──
function loadDashboard(){
  api('GET','/api/admin/users').then(function(d){
    $('statUsers').textContent = (d.users||[]).length;
  });
}

// ── 充值码 ──
function genRechargeCodes(){
  var count = parseInt($('rcCount').value)||5;
  var value = parseInt($('rcValue').value)||1000;
  api('POST','/api/admin/generate-recharge-codes',{count:count,value:value}).then(function(d){
    var html='<span class="msg-success">已生成 ' + count + ' 个充值码（每个 ' + value + ' 积分）：</span><br>';
    d.codes.forEach(function(c){ html+='<br><span class="code-display">'+esc(c.code)+'</span>'; });
    $('rcMsg').innerHTML=html;
    loadRechargeCodes();
  }).catch(function(){ $('rcMsg').innerHTML='<span class="msg-error">生成失败</span>'; });
}
function loadRechargeCodes(){
  api('GET','/api/admin/recharge-codes').then(function(d){
    if(d.codes.length===0){ $('rcList').textContent='暂无充值码'; return; }
    var html='<table><tr><th>充值码</th><th>面值</th><th>状态</th><th>使用人</th><th>时间</th></tr>';
    d.codes.slice().reverse().slice(0,100).forEach(function(c){
      var tag = c.used ? '<span class="tag tag-red">已使用</span>' : '<span class="tag tag-green">可用</span>';
      html+='<tr><td class="code-display">'+esc(c.code)+'</td><td>'+c.value+' 积分</td><td>'+tag+'</td><td style="font-size:0.8rem;">'+esc(c.used_by||'-')+'</td><td style="font-size:0.8rem;">'+esc(c.created_at||'').slice(0,16)+ '</td></tr>';
    });
    html+='</table><div style="margin-top:8px;font-size:0.82rem;color:var(--text2);">总计：'+d.total+'，已使用：'+d.used+'</div>';
    $('rcList').innerHTML=html;
  });
}

// ── 通知 ──
function sendAnnouncement(){
  var title = $('annTitle').value.trim() || '系统通知';
  var content = $('annContent').value.trim();
  if(!content){ $('annMsg').innerHTML='<span class="msg-error">内容不能为空</span>'; return; }
  var target = $('annTarget').value;
  api('POST','/api/admin/announcements',{title:title,content:content,target:target}).then(function(){
    $('annMsg').innerHTML='<span class="msg-success">已发送！</span>';
    $('annContent').value='';
    loadAnnouncements();
  }).catch(function(){ $('annMsg').innerHTML='<span class="msg-error">发送失败</span>'; });
}

function loadAnnouncements(){
  api('GET','/api/admin/announcements').then(function(d){
    var anns = d.announcements || [];
    if(anns.length===0){ $('annList').innerHTML='<div style="color:var(--text2);font-size:0.85rem;">暂无通知</div>'; return; }
    var html='<table><tr><th>标题</th><th>内容</th><th>目标</th><th>状态</th><th>时间</th><th></th></tr>';
    anns.slice().reverse().forEach(function(a){
      var active = a.active !== false;
      var statusHtml = active ? '<span class="tag tag-green">启用</span>' : '<span class="tag tag-red">停用</span>';
      var btnHtml = active
        ? '<button class="btn-small" onclick="toggleAnn(\''+a.id+'\')">停用</button>'
        : '<button class="btn-small" onclick="toggleAnn(\''+a.id+'\')">启用</button>';
      html+='<tr><td style="font-weight:600;">'+esc(a.title)+'</td><td style="font-size:0.82rem;max-width:300px;">'+esc(a.content)+'</td><td>'+esc(a.target)+'</td><td>'+statusHtml+'</td><td style="font-size:0.78rem;">'+(a.created_at||'').slice(0,16)+'</td><td>'+btnHtml+'</td></tr>';
    });
    html+='</table>';
    $('annList').innerHTML=html;
  });
}

function toggleAnn(id){
  api('POST','/api/admin/announcements/toggle',{id:id}).then(function(){ loadAnnouncements(); });
}

// ── 用户 ──
var _allUsers = [];

function loadUsers(){
  api('GET','/api/admin/users').then(function(d){
    _allUsers = d.users || [];
    renderUsers(_allUsers);
    $('userTotal').textContent = _allUsers.length;
  });
}

function filterUsers(){
  var q = $('userSearch').value.toLowerCase();
  if(!q){ renderUsers(_allUsers); return; }
  var filtered = _allUsers.filter(function(u){
    return (u.session_id && u.session_id.toLowerCase().indexOf(q)!==-1)
        || (u.school && u.school.toLowerCase().indexOf(q)!==-1)
        || (u.major && u.major.toLowerCase().indexOf(q)!==-1)
        || (u.goal && u.goal.toLowerCase().indexOf(q)!==-1);
  });
  renderUsers(filtered);
}

function renderUsers(users){
  if(users.length===0){ $('userList').innerHTML = '<div style="color:var(--text2);font-size:0.85rem;">暂无用户</div>'; return; }
  var html = '<table><tr><th>Session</th><th>学校</th><th>专业</th><th>年级</th><th>目标</th><th>消息数</th></tr>';
  users.forEach(function(u){
    html += '<tr>'
      + '<td style="font-size:0.78rem;max-width:120px;word-break:break-all;">'+esc(u.session_id||'-')+'</td>'
      + '<td style="font-size:0.85rem;">'+esc(u.school||'-')+'</td>'
      + '<td style="font-size:0.85rem;">'+esc(u.major||'-')+'</td>'
      + '<td style="font-size:0.85rem;">'+esc(u.grade||'-')+'</td>'
      + '<td style="font-size:0.85rem;">'+esc(u.goal||'-')+'</td>'
      + '<td style="font-size:0.82rem;">'+(u.messages||0)+'</td>'
      + '</tr>';
  });
  html += '</table>';
  $('userList').innerHTML = html;
}

// Init
if(TOKEN){ loadApp(); }
