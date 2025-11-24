document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(['enabled', 'checkGrammar', 'checkTone', 'checkTerminology'], (data) => {
    document.getElementById('enabled').checked = data.enabled !== false;
    document.getElementById('checkGrammar').checked = data.checkGrammar !== false;
    document.getElementById('checkTone').checked = data.checkTone !== false;
    document.getElementById('checkTerminology').checked = data.checkTerminology !== false;
  });

  // Save settings
  document.getElementById('saveBtn').addEventListener('click', () => {
    const settings = {
      enabled: document.getElementById('enabled').checked,
      checkGrammar: document.getElementById('checkGrammar').checked,
      checkTone: document.getElementById('checkTone').checked,
      checkTerminology: document.getElementById('checkTerminology').checked
    };

    chrome.storage.local.set(settings, () => {
      const status = document.getElementById('status');
      status.classList.add('success');
      setTimeout(() => {
        status.classList.remove('success');
      }, 2000);
    });
  });
});
