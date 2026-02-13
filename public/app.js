(function () {
  'use strict';

  var countdownInterval = null;
  var currentPhone = '';

  // ---- Init ----
  document.getElementById('contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    handleSendOtp();
  });
  document.getElementById('btnVerify').addEventListener('click', handleVerifyOtp);
  document.getElementById('btnResend').addEventListener('click', handleResendOtp);
  document.getElementById('btnBack').addEventListener('click', function () { stopCountdown(); goToStep(1); });
  document.getElementById('btnNewLead').addEventListener('click', resetForm);

  // OTP digit auto-advance
  var digits = document.querySelectorAll('.otp-digit');
  for (var i = 0; i < digits.length; i++) {
    (function (idx) {
      digits[idx].addEventListener('input', function () {
        var val = this.value.replace(/[^0-9]/g, '');
        this.value = val;
        if (val && idx < digits.length - 1) digits[idx + 1].focus();
      });
      digits[idx].addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && idx > 0) digits[idx - 1].focus();
      });
      digits[idx].addEventListener('paste', function (e) {
        e.preventDefault();
        var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        for (var j = 0; j < Math.min(pasted.length, digits.length); j++) digits[j].value = pasted[j];
        var focusIdx = Math.min(pasted.length, digits.length) - 1;
        if (focusIdx >= 0) digits[focusIdx].focus();
      });
    })(i);
  }

  // ---- Helpers ----
  function cleanPhone(p) { return p.replace(/[^0-9]/g, ''); }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showToast(msg, type) {
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast toast--' + (type || 'success');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () {
      t.classList.add('removing');
      t.addEventListener('animationend', function () { t.remove(); });
    }, 3000);
  }

  // ---- Validation ----
  function validate() {
    var errors = {};
    var name = document.getElementById('fieldName').value.trim();
    var email = document.getElementById('fieldEmail').value.trim();
    var phone = document.getElementById('fieldPhone').value.trim();

    if (!name) errors.name = 'Name is required';
    if (!email) {
      errors.email = 'Email is required';
    } else {
      var at = email.indexOf('@');
      if (at < 1 || !email.substring(at + 1).includes('.')) errors.email = 'Enter a valid email';
    }
    if (!phone) {
      errors.phone = 'WhatsApp phone is required';
    } else if (cleanPhone(phone).length < 10) {
      errors.phone = 'Phone must be at least 10 digits with country code';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function showErrors(err) {
    clearErrors();
    if (err.name) { document.getElementById('errorName').textContent = err.name; document.getElementById('fieldName').classList.add('has-error'); }
    if (err.email) { document.getElementById('errorEmail').textContent = err.email; document.getElementById('fieldEmail').classList.add('has-error'); }
    if (err.phone) { document.getElementById('errorPhone').textContent = err.phone; document.getElementById('fieldPhone').classList.add('has-error'); }
  }

  function clearErrors() {
    ['errorName', 'errorEmail', 'errorPhone'].forEach(function (id) { document.getElementById(id).textContent = ''; });
    ['fieldName', 'fieldEmail', 'fieldPhone'].forEach(function (id) { document.getElementById(id).classList.remove('has-error'); });
    document.getElementById('verifyError').textContent = '';
  }

  // ---- Step Navigation ----
  function goToStep(step) {
    document.getElementById('step1').style.display = step === 1 ? '' : 'none';
    document.getElementById('step2').style.display = step === 2 ? '' : 'none';
    document.getElementById('step3').style.display = step === 3 ? '' : 'none';

    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length; i++) {
      var n = parseInt(steps[i].dataset.step);
      steps[i].classList.remove('step--active', 'step--done');
      if (n < step) steps[i].classList.add('step--done');
      if (n === step) steps[i].classList.add('step--active');
    }

    var lines = document.querySelectorAll('.step__line');
    for (var j = 0; j < lines.length; j++) {
      lines[j].classList.toggle('step__line--done', j < step - 1);
    }
  }

  // ---- Send OTP ----
  function handleSendOtp() {
    var result = validate();
    if (!result.valid) { showErrors(result.errors); return; }

    currentPhone = cleanPhone(document.getElementById('fieldPhone').value.trim());
    var btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending OTP...';

    fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        restoreSendBtn(btn);
        if (!res.ok) { showErrors({ phone: res.data.error || 'Failed to send OTP' }); return; }
        goToStep(2);
        document.getElementById('sentPhone').textContent = currentPhone;
        startCountdown();

        // Demo mode: if WhatsApp couldn't deliver, auto-fill OTP and show banner
        if (res.data.demo && res.data.otp) {
          var digits = document.querySelectorAll('.otp-digit');
          for (var i = 0; i < res.data.otp.length && i < digits.length; i++) {
            digits[i].value = res.data.otp[i];
          }
          showDemoBanner(res.data.otp);
        } else {
          document.querySelectorAll('.otp-digit')[0].focus();
        }
      })
      .catch(function () {
        restoreSendBtn(btn);
        showErrors({ phone: 'Network error. Please try again.' });
      });
  }

  function restoreSendBtn(btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send OTP via WhatsApp';
  }

  // ---- Verify OTP ----
  function handleVerifyOtp() {
    var code = '';
    document.querySelectorAll('.otp-digit').forEach(function (d) { code += d.value; });

    if (code.length !== 6) {
      document.getElementById('verifyError').textContent = 'Please enter all 6 digits';
      return;
    }

    var btn = document.getElementById('btnVerify');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Verifying...';

    fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, code: code })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        restoreVerifyBtn(btn);
        if (!res.ok) { document.getElementById('verifyError').textContent = res.data.error || 'Invalid OTP'; return; }
        submitLead();
      })
      .catch(function () {
        restoreVerifyBtn(btn);
        document.getElementById('verifyError').textContent = 'Network error. Please try again.';
      });
  }

  function restoreVerifyBtn(btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Verify &amp; Submit';
  }

  // ---- Submit Lead ----
  function submitLead() {
    var lead = {
      name: document.getElementById('fieldName').value.trim(),
      email: document.getElementById('fieldEmail').value.trim(),
      phone: currentPhone,
      company: document.getElementById('fieldCompany').value.trim(),
      jobTitle: document.getElementById('fieldJobTitle').value.trim(),
      location: document.getElementById('fieldLocation').value.trim(),
      remarks: document.getElementById('fieldRemarks').value.trim(),
      otpVerified: true,
      submittedAt: new Date().toISOString()
    };

    // Store in localStorage
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem('otpLeads') || '[]'); } catch (e) { /* ignore */ }
    lead.id = 'otp_' + Date.now();
    leads.push(lead);
    localStorage.setItem('otpLeads', JSON.stringify(leads));

    stopCountdown();
    goToStep(3);

    document.getElementById('successSummary').innerHTML =
      '<div class="summary-row"><span>Name</span><strong>' + esc(lead.name) + '</strong></div>' +
      '<div class="summary-row"><span>Email</span><strong>' + esc(lead.email) + '</strong></div>' +
      '<div class="summary-row"><span>Phone</span><strong>' + esc(lead.phone) + '</strong></div>' +
      (lead.company ? '<div class="summary-row"><span>Company</span><strong>' + esc(lead.company) + '</strong></div>' : '') +
      '<div class="summary-row"><span>Status</span><strong style="color:#34d399;">OTP Verified</strong></div>';

    showToast('Lead verified and submitted!', 'success');
  }

  // ---- Resend OTP ----
  function handleResendOtp() {
    var btn = document.getElementById('btnResend');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        btn.textContent = 'Resend OTP';
        if (res.ok) {
          startCountdown();
          document.getElementById('verifyError').textContent = '';
          document.querySelectorAll('.otp-digit').forEach(function (d) { d.value = ''; });
          document.querySelectorAll('.otp-digit')[0].focus();
        } else {
          document.getElementById('verifyError').textContent = res.data.error || 'Failed to resend';
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Resend OTP';
      });
  }

  // ---- Countdown Timer ----
  function startCountdown() {
    var seconds = 300;
    var el = document.getElementById('countdown');
    var resendBtn = document.getElementById('btnResend');
    resendBtn.disabled = true;
    stopCountdown();
    updateDisplay(seconds, el);
    countdownInterval = setInterval(function () {
      seconds--;
      updateDisplay(seconds, el);
      if (seconds <= 0) { stopCountdown(); el.textContent = 'Expired'; resendBtn.disabled = false; }
    }, 1000);
  }

  function updateDisplay(sec, el) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }

  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  // ---- Demo Banner ----
  function showDemoBanner(otp) {
    var existing = document.getElementById('demoBanner');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'demoBanner';
    banner.className = 'demo-banner';
    banner.innerHTML = '<strong>Demo Mode:</strong> WhatsApp delivery pending. OTP auto-filled: <code>' + otp + '</code><br><small>To receive on WhatsApp, first send "Hi" to +91 98407 22417 from this number.</small>';
    var verifySection = document.querySelector('.verify-section');
    if (verifySection) verifySection.insertBefore(banner, verifySection.firstChild);
  }

  // ---- Reset ----
  function resetForm() {
    document.getElementById('contactForm').reset();
    document.querySelectorAll('.otp-digit').forEach(function (d) { d.value = ''; });
    clearErrors();
    stopCountdown();
    currentPhone = '';
    goToStep(1);
  }
})();
