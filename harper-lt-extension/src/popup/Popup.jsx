import React, { useEffect, useState } from "react";

/**
 * Popup UI
 * - requests last results from background via chrome.runtime.sendMessage
 * - displays grammar and harper sections
 * - clicking a suggestion triggers "APPLY_SUGGESTION" message forwarded to the active tab
 */

function useChromeMessage() {
  // helper to send messages and receive responses as Promise
  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          resolve(resp);
        });
      } catch (err) {
        resolve({ success: false, error: String(err) });
      }
    });
  }
  return { send };
}

export default function Popup() {
  const { send } = useChromeMessage();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({ grammar: [], harper: { tone: [], terminology: [] } });
  const [error, setError] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [isEnabled, setIsEnabled] = useState(true);
  const [stats, setStats] = useState({ issuesFound: 0, pageUrl: "" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Ask background for last stored results for this active tab
      const resp = await send({ type: "GET_LAST_RESULTS" }); // background should implement this or we fallback to requesting fresh analysis
      if (resp && resp.success && resp.data) {
        setResults(resp.data);
      } else {
        // If background doesn't implement GET_LAST_RESULTS, request active tab text analysis (safe fallback)
        // Ask background to analyze the currently focused field maybe not available; we'll just request a quick ping
        const fallback = await send({ type: "REQUEST_REFRESH" });
        if (fallback && fallback.success && fallback.data) {
          setResults(fallback.data);
        } else {
          setError("No analysis available. Click into a page textbox and start typing to trigger analysis.");
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    // Check if extension is working
    chrome.runtime.sendMessage({ type: "PING" }, (response) => {
      if (response?.status) {
        setStatus("Extension is active");
      }
    });
  }, []);

  useEffect(() => {
    // Load extension state from storage
    chrome.storage.local.get(['enabled', 'stats'], (result) => {
      if (result.enabled !== undefined) {
        setIsEnabled(result.enabled);
      }
      if (result.stats) {
        setStats(result.stats);
      }
    });

    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setStats(prev => ({ ...prev, pageUrl: tabs[0].url }));
      }
    });
  }, []);

  // Prepare unified flattened list for UI mapping (with origin info)
  const flattened = [];
  (results.grammar || []).forEach((g, i) => flattened.push({ origin: "grammar", item: g, idx: i }));
  (results.harper?.tone || []).forEach((t, i) => flattened.push({ origin: "harper-tone", item: t, idx: i }));
  (results.harper?.terminology || []).forEach((t, i) => flattened.push({ origin: "harper-term", item: t, idx: i }));

  function getIssueText(issue) {
    // LanguageTool match objects have "message" and "context.text" etc
    return issue.context?.text || issue.message || issue.text || "(unknown)";
  }

  function getSuggestions(issue) {
    // languageTool uses replacements array; your harper rules may use suggestions or replacements
    if (issue.replacements && Array.isArray(issue.replacements)) {
      return issue.replacements.map((r) => r.value ?? r);
    }
    if (issue.suggestions && Array.isArray(issue.suggestions)) {
      return issue.suggestions.map((s) => (typeof s === "string" ? s : s.value ?? s));
    }
    return [];
  }

  async function applySuggestion(issue, suggestionIndex) {
    // We send the payload to background, which will forward to the content script to replace the highlighted span
    try {
      const raw = issue._raw || encodeURIComponent(JSON.stringify(issue)); // prefer stored raw payload
      await send({ type: "APPLY_SUGGESTION", payload: { suggestionIndex, raw } });
      // Close popup after applying
      window.close();
    } catch (err) {
      console.error(err);
    }
  }

  const toggleExtension = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.local.set({ enabled: newState });
    
    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'TOGGLE_EXTENSION', 
          enabled: newState 
        });
      }
    });
  };

  return (
    <div className="hlt-popup">
      <header className="hlt-header">
        <h3>Harper + LanguageTool</h3>
        <small>Grammar · Tone · Terminology</small>
      </header>

      <main className="hlt-body">
        {loading && <div className="hlt-loading">Loading…</div>}
        {error && <div className="hlt-error">{error}</div>}

        {!loading && !error && flattened.length === 0 && (
          <div className="hlt-empty">No issues found — type in any text field to run checks.</div>
        )}

        {!loading && flattened.length > 0 && (
          <div className="hlt-list">
            {flattened.map((f, i) => {
              const issue = f.item;
              const text = getIssueText(issue);
              const suggestions = getSuggestions(issue);
              const color =
                f.origin === "grammar" ? "var(--red)" : f.origin === "harper-tone" ? "var(--blue)" : "var(--purple)";
              return (
                <div className="hlt-issue" key={i}>
                  <div className="hlt-issue-head">
                    <div className="hlt-issue-tag" style={{ borderColor: color }}>
                      {f.origin === "grammar" ? "Grammar" : f.origin === "harper-tone" ? "Tone" : "Terminology"}
                    </div>
                    <div className="hlt-issue-text">{text}</div>
                  </div>

                  <div className="hlt-suggestions">
                    {suggestions.length === 0 && <div className="hlt-no-sug">No suggestions</div>}
                    {suggestions.map((sug, si) => (
                      <button
                        key={si}
                        className="hlt-sug-btn"
                        onClick={() => applySuggestion(issue, si)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="hlt-footer">
        <button
          className="hlt-refresh"
          onClick={async () => {
            setLoading(true);
            const resp = await send({ type: "REQUEST_REFRESH" });
            setLoading(false);
            if (resp?.success && resp.data) setResults(resp.data);
          }}
        >
          Refresh
        </button>
        <a className="hlt-link" href="#" onClick={() => chrome.tabs.create({ url: "about:blank" })}>
          Settings
        </a>
      </footer>

      <div className="popup-container">
        <div className="header">
          <h1>Harper + LanguageTool</h1>
          <p className="subtitle">Grammar & Spell Checker</p>
        </div>

        <div className="status-section">
          <div className="status-indicator">
            <div className={`status-dot ${isEnabled ? 'active' : 'inactive'}`}></div>
            <span className="status-text">
              {isEnabled ? 'Extension Active' : 'Extension Disabled'}
            </span>
          </div>
        </div>

        <div className="toggle-section">
          <button 
            className={`toggle-btn ${isEnabled ? 'enabled' : 'disabled'}`}
            onClick={toggleExtension}
          >
            {isEnabled ? 'Disable Extension' : 'Enable Extension'}
          </button>
        </div>

        <div className="stats-section">
          <h3>Statistics</h3>
          <div className="stat-item">
            <span className="stat-label">Issues Found:</span>
            <span className="stat-value">{stats.issuesFound}</span>
          </div>
        </div>

        <div className="info-section">
          <p>✓ Click on highlighted text to see suggestions</p>
          <p>✓ Works on text inputs and editable content</p>
        </div>

        <div className="footer">
          <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }}>
            Settings
          </a>
        </div>
      </div>
    </div>
  );
}
