/**
 * EdgeFallSys 子女端 App - 公共交互逻辑
 */

document.addEventListener('DOMContentLoaded', function () {

  // ===== 全屏预警模式 =====
  // showEmergencyOverlay / hideEmergencyOverlay 已在 emergency.html 中内联调用

  // ===== 按钮点击反馈 =====
  document.querySelectorAll('.btn, .call-btn, .header__btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // CSS :active 已处理 scale 反馈，此处可扩展其他交互
    });
  });

  // ===== 告警条目点击效果 =====
  document.querySelectorAll('.alert-item').forEach(function (item) {
    item.addEventListener('click', function () {
      // 点击告警条目时的高亮反馈
      document.querySelectorAll('.alert-item').forEach(function (el) {
        el.style.opacity = '1';
      });
      this.style.opacity = '0.7';
      setTimeout(function () {
        item.style.opacity = '1';
      }, 200);
    });
  });

  // ===== 页面滚动时导航栏阴影 =====
  var header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        header.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)';
      } else {
        header.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
      }
    });
  }

  // ===== 离家模式切换（演示用） =====
  // 在首页可通过控制台调用 toggleOutdoorMode() 来切换离家模式
  var outdoorMode = document.getElementById('outdoorMode');

  // ===== 通知铃铛点击 =====
  document.querySelectorAll('.header__badge').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // 移除红点
      this.classList.remove('header__badge');
    });
  });

});

// ===== 全屏预警模式控制函数 =====
function showEmergencyOverlay() {
  var overlay = document.getElementById('emergencyOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function hideEmergencyOverlay() {
  var overlay = document.getElementById('emergencyOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ===== 离家模式切换（演示用） =====
function toggleOutdoorMode() {
  var el = document.getElementById('outdoorMode');
  if (el) {
    el.classList.toggle('active');
  }
}
