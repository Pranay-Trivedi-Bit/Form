(function () {
  'use strict';

  var captchaSessionId = '';

  // ---- Init ----
  loadCaptcha();

  document.getElementById('captchaContactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    handleSubmit();
  });
  document.getElementById('btnRefreshCaptcha').addEventListener('click', loadCaptcha);
  document.getElementById('btnNewLead').addEventListener('click', resetForm);

  // ---- Load CAPTCHA ----
  function loadCaptcha() {
    var imgContainer = document.getElementById('captchaImage');
    var refreshBtn = document.getElementById('btnRefreshCaptcha');
    imgContainer.classList.add('loading');
    refreshBtn.classList.add('spinning');

    fetch('/api/captcha/generate')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        imgContainer.innerHTML = data.svg;
        captchaSessionId = data.sessionId;
        document.getElementById('captchaSessionId').value = data.sessionId;
        document.getElementById('fieldCaptcha').value = '';
        document.getElementById('errorCaptcha').textContent = '';
        imgContainer.classList.remove('loading');
        refreshBtn.classList.remove('spinning');
      })
      .catch(function () {
        imgContainer.innerHTML = '<span class="captcha-loading" style="color:var(--danger)">Failed to load CAPTCHA</span>';
        imgContainer.classList.remove('loading');
        refreshBtn.classList.remove('spinning');
      });
  }

  // ---- Helpers ----
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
    var captcha = document.getElementById('fieldCaptcha').value.trim();

    if (!name) errors.name = 'Name is required';
    if (!email) {
      errors.email = 'Email is required';
    } else {
      var at = email.indexOf('@');
      if (at < 1 || !email.substring(at + 1).includes('.')) errors.email = 'Enter a valid email';
    }
    if (!phone) {
      errors.phone = 'Phone number is required';
    } else if (phone.replace(/[^0-9]/g, '').length < 10) {
      errors.phone = 'Phone must be at least 10 digits with country code';
    }
    if (!captcha) errors.captcha = 'Please type the CAPTCHA characters';

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function showErrors(err) {
    clearErrors();
    if (err.name) { document.getElementById('errorName').textContent = err.name; document.getElementById('fieldName').classList.add('has-error'); }
    if (err.email) { document.getElementById('errorEmail').textContent = err.email; document.getElementById('fieldEmail').classList.add('has-error'); }
    if (err.phone) { document.getElementById('errorPhone').textContent = err.phone; document.getElementById('fieldPhone').classList.add('has-error'); }
    if (err.captcha) { document.getElementById('errorCaptcha').textContent = err.captcha; document.getElementById('fieldCaptcha').classList.add('has-error'); }
  }

  function clearErrors() {
    ['errorName', 'errorEmail', 'errorPhone', 'errorCaptcha'].forEach(function (id) {
      document.getElementById(id).textContent = '';
    });
    ['fieldName', 'fieldEmail', 'fieldPhone', 'fieldCaptcha'].forEach(function (id) {
      document.getElementById(id).classList.remove('has-error');
    });
  }

  // ---- Step Navigation ----
  function goToStep(step) {
    document.getElementById('step1').style.display = step === 1 ? '' : 'none';
    document.getElementById('step2').style.display = step === 2 ? '' : 'none';

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

  // ---- Submit ----
  function handleSubmit() {
    var result = validate();
    if (!result.valid) { showErrors(result.errors); return; }

    var btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Verifying...';

    var lead = {
      name: document.getElementById('fieldName').value.trim(),
      email: document.getElementById('fieldEmail').value.trim(),
      phone: document.getElementById('fieldPhone').value.trim().replace(/[^0-9]/g, ''),
      company: document.getElementById('fieldCompany').value.trim(),
      jobTitle: document.getElementById('fieldJobTitle').value.trim(),
      location: document.getElementById('fieldLocation').value.trim(),
      remarks: document.getElementById('fieldRemarks').value.trim()
    };

    fetch('/api/captcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: captchaSessionId,
        captchaAnswer: document.getElementById('fieldCaptcha').value.trim(),
        lead: lead
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        restoreSubmitBtn(btn);
        if (!res.ok) {
          if (res.data.needRefresh) loadCaptcha();
          showErrors({ captcha: res.data.error || 'Verification failed' });
          return;
        }
        // Success
        saveLead(lead);
        goToStep(2);
        showSuccessSummary(lead);
        showToast('Lead verified and submitted!', 'success');
      })
      .catch(function () {
        restoreSubmitBtn(btn);
        showErrors({ captcha: 'Network error. Please try again.' });
      });
  }

  function restoreSubmitBtn(btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Verify &amp; Submit';
  }

  // ---- Save Lead ----
  function saveLead(lead) {
    lead.captchaVerified = true;
    lead.submittedAt = new Date().toISOString();
    lead.id = 'captcha_' + Date.now();
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem('captchaLeads') || '[]'); } catch (e) { /* ignore */ }
    leads.push(lead);
    localStorage.setItem('captchaLeads', JSON.stringify(leads));
  }

  // ---- Success Summary ----
  function showSuccessSummary(lead) {
    document.getElementById('successSummary').innerHTML =
      '<div class="summary-row"><span>Name</span><strong>' + esc(lead.name) + '</strong></div>' +
      '<div class="summary-row"><span>Email</span><strong>' + esc(lead.email) + '</strong></div>' +
      '<div class="summary-row"><span>Phone</span><strong>' + esc(lead.phone) + '</strong></div>' +
      (lead.company ? '<div class="summary-row"><span>Company</span><strong>' + esc(lead.company) + '</strong></div>' : '') +
      '<div class="summary-row"><span>Status</span><strong style="color:#34d399;">CAPTCHA Verified</strong></div>';
  }

  // ---- Reset ----
  function resetForm() {
    document.getElementById('captchaContactForm').reset();
    clearErrors();
    captchaSessionId = '';
    loadCaptcha();
    goToStep(1);
  }
})();
