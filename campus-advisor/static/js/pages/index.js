/* index.js — index.html page logic */

(function() {
      'use strict';

      var nav = document.querySelector('nav');
      var progress = document.getElementById('scroll-progress');
      var rafPending = false;
      var scrollY = 0;
      var docHeight = 0;
      var winHeight = 0;
      var scrollLocked = false;

      function onScroll() {
        if (scrollLocked) return;
        scrollY = window.scrollY;
        docHeight = document.documentElement.scrollHeight;
        winHeight = window.innerHeight;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(update);
        }
      }

      function update() {
        rafPending = false;
        var maxScroll = Math.max(docHeight - winHeight, 1);
        var pct = Math.min((scrollY / maxScroll) * 100, 100);
        progress.style.width = pct + '%';
        if (scrollY > 60) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
        // Background parallax: slight upward shift on scroll
        var bgShift = scrollY * 0.04;
        document.body.style.setProperty('--bg-shift', bgShift + 'px');
      }

      /* ─── Intersection Observer ─── */
      var revealEls = document.querySelectorAll('.reveal, .feature-panel, .custom-cat-panel, .step');
      if (revealEls.length && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
        revealEls.forEach(function(el) { observer.observe(el); });
      } else {
        revealEls.forEach(function(el) { el.classList.add('visible'); });
      }

      /* ─── Smooth Anchor ─── */
      document.querySelectorAll('a[href^="#"]').forEach(function(a) {
        a.addEventListener('click', function(e) {
          var target = document.querySelector(this.getAttribute('href'));
          if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
      });

      /* ─── Typewriter ─── */
      (function() {
        var words = [
          { text: 'Graduate Admissions', color: 'c-0' },
          { text: 'Competitions', color: 'c-1' },
          { text: 'Course Selection', color: 'c-2' }
        ];
        var el = document.getElementById('tw-word');
        if (!el) return;
        var wordIndex = 0, charIndex = 0, isDeleting = false, speed = 160;

        function tick() {
          var word = words[wordIndex];
          if (isDeleting) {
            charIndex--; el.textContent = word.text.substring(0, charIndex); speed = 80;
          } else {
            charIndex++; el.textContent = word.text.substring(0, charIndex); speed = 160;
          }
          el.className = 'tw-word ' + word.color;
          if (!isDeleting && charIndex === word.text.length) { speed = 2200; isDeleting = true; }
          else if (isDeleting && charIndex === 0) { isDeleting = false; wordIndex = (wordIndex + 1) % words.length; speed = 500; }
          setTimeout(tick, speed);
        }
        tick();
      })();

window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();

    })();

var _user = null;

function loadUser() {
  var s = localStorage.getItem('_u');
  if (s) { try { _user = JSON.parse(s); } catch(e) { _user = null; } }
  renderNav();
}
function saveUser() {
  if (_user) localStorage.setItem('_u', JSON.stringify(_user));
  else localStorage.removeItem('_u');
  renderNav();
}
function renderNav() {
  var a = document.getElementById('navActions');
  if (!a) return;
  if (_user) {
    a.innerHTML = '<div class="nav-user"><span></span><button class="logout" onclick="logout()">Logout</button><a href="qna.html" class="nav-cta">Get Started</a></div>';
    a.querySelector('.nav-user span').textContent = _user.email || _user.phone || '';
  } else {
    a.innerHTML = '<button class="nav-btn" onclick="openAuth(\'login\')">Login</button><button class="nav-btn reg" onclick="openAuth(\'register\')">Register</button><a href="qna.html" class="nav-cta">Get Started</a>';
  }
}
function logout() { _user = null; saveUser(); }

function openAuth(p) {
  document.getElementById('authOverlay').classList.add('open');
  switchAuth(p || 'login');
  document.body.style.overflow = 'hidden';
}
function closeAuth() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.querySelectorAll('.msg').forEach(function(m) { m.style.display = 'none'; m.textContent = ''; });
}
document.getElementById('authOverlay').addEventListener('click', function(e) { if (e.target === this) closeAuth(); });

function showPage(id) {
  ['pageLogin','pageRegister','pageForgot','pageReset'].forEach(function(p) {
    document.getElementById(p).classList.remove('show');
  });
  document.getElementById(id).classList.add('show');
}
function switchAuth(p) {
  var map = {login:'pageLogin', register:'pageRegister', forgot:'pageForgot'};
  showPage(map[p] || 'pageLogin');
  document.querySelectorAll('.auth-bar button').forEach(function(b) { b.classList.remove('on'); });
  var btns = document.querySelectorAll('.auth-bar button');
  var idx = {login:0, register:1, forgot:2}[p] || 0;
  if (btns[idx]) btns[idx].classList.add('on');
  document.querySelectorAll('.msg').forEach(function(m) { m.style.display = 'none'; m.textContent = ''; });
}
function msg(id, text, type) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + (type || 'err');
  el.style.display = 'block';
}
function switchMethod(page, method) {
  var prefix = page === 'register' ? 'reg' : 'forgot';
  document.querySelectorAll('#' + page + ' .method-tabs button').forEach(function(b) { b.classList.remove('on'); });
  var tabs = document.querySelectorAll('#' + page + ' .method-tabs button');
  if (method === 'email') { if (tabs[0]) tabs[0].classList.add('on'); } else { if (tabs[1]) tabs[1].classList.add('on'); }
  document.getElementById(prefix + 'Email').style.display = method === 'email' ? '' : 'none';
  document.getElementById(prefix + 'Phone').style.display = method === 'phone' ? '' : 'none';
}

async function api(p, d) {
  var r = await fetch(p, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d)});
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || j.detail || 'Request failed');
  return j;
}

function doLogin() {
  var id = document.getElementById('loginId').value.trim();
  var pwd = document.getElementById('loginPwd').value;
  if (!id || !pwd) { msg('loginMsg', '请输入账号和密码'); return; }
  api('/api/auth/login', {email: id.includes('@')?id:'', phone: id.includes('@')?'':id, password: pwd})
    .then(function(d) {
      _user = {user_id:d.user_id, email:d.email, phone:d.phone, session_id:d.session_id, token:d.token};
      localStorage.setItem('qna_sessionId', d.session_id);
      localStorage.setItem('qna_sessionToken', d.token);
      saveUser();
      msg('loginMsg', '登录成功！', 'ok');
      setTimeout(closeAuth, 800);
    })
    .catch(function(e) { msg('loginMsg', e.message); });
}

function doRegister() {
  var tabs = document.querySelectorAll('#pageRegister .method-tabs button');
  var isEmail = tabs[0] && tabs[0].classList.contains('on');
  var email = isEmail ? document.getElementById('regEmailInput').value.trim() : '';
  var phone = !isEmail ? document.getElementById('regPhoneInput').value.trim() : '';
  var pwd = document.getElementById('regPwd').value;
  var confirm = document.getElementById('regConfirm').value;
  if (!email && !phone) { msg('regMsg', '请输入邮箱或手机号'); return; }
  if (pwd.length < 6) { msg('regMsg', '密码至少6位字符'); return; }
  if (pwd !== confirm) { msg('regMsg', '两次密码不一致'); return; }
  api('/api/auth/register', {email:email, phone:phone, password:pwd})
    .then(function(d) {
      _user = {user_id:d.user_id, email:email, phone:phone, session_id:d.session_id, token:d.token};
      localStorage.setItem('qna_sessionId', d.session_id);
      localStorage.setItem('qna_sessionToken', d.token);
      saveUser();
      msg('regMsg', '注册成功！', 'ok');
      setTimeout(closeAuth, 800);
    })
    .catch(function(e) { msg('regMsg', e.message); });
}

function doForgot() {
  var tabs = document.querySelectorAll('#pageForgot .method-tabs button');
  var isEmail = tabs[0] && tabs[0].classList.contains('on');
  var email = isEmail ? document.getElementById('forgotEmailInput').value.trim() : '';
  var phone = !isEmail ? document.getElementById('forgotPhoneInput').value.trim() : '';
  if (!email && !phone) { msg('forgotMsg', '请输入邮箱或手机号'); return; }
  api('/api/auth/forgot-password', {email:email, phone:phone})
    .then(function(d) {
      document.getElementById('resetToken').value = d.token || '';
      msg('forgotMsg', '验证码已生成！', 'ok');
      showPage('pageReset');
    })
    .catch(function(e) { msg('forgotMsg', e.message); });
}

function doReset() {
  var token = document.getElementById('resetToken').value.trim();
  var pwd = document.getElementById('resetPwd').value;
  if (!token) { msg('resetMsg', '请输入重置验证码'); return; }
  if (pwd.length < 6) { msg('resetMsg', '密码至少6位字符'); return; }
  api('/api/auth/reset-password', {reset_token:token, new_password:pwd})
    .then(function() {
      msg('resetMsg', '密码重置成功！', 'ok');
      setTimeout(function() {
        switchAuth('login');
        document.getElementById('resetToken').value = '';
        document.getElementById('resetPwd').value = '';
      }, 1500);
    })
    .catch(function(e) { msg('resetMsg', e.message); });
}

loadUser();
