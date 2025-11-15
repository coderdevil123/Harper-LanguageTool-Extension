import React, { useEffect, useState } from "react";
import "./Popup.css";

export default function Popup() {
  const [grammar, setGrammar] = useState([]);
  const [tone, setTone] = useState([]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_LATEST_RESULTS" }, (res) => {
      if (res) {
        setGrammar(res.grammar || []);
        setTone(res.tone || []);
      }
    });
  }, []);

  return (
    <div className="popup-container">
      <h2>Harper + LanguageTool</h2>

      <section>
        <h3>Grammar (LanguageTool)</h3>
        {grammar.length === 0 && <p>No grammar issues 🎉</p>}
        {grammar.map((g, i) => (
          <div key={i} className="item">
            <strong>{g.text}</strong> → {g.suggestion}
          </div>
        ))}
      </section>

      <section>
        <h3>Tonality / Terminology (Harper)</h3>
        {tone.length === 0 && <p>No tone issues 👍</p>}
        {tone.map((t, i) => (
          <div key={i} className="item">
            <strong>{t.text}</strong> → {t.suggestion}
          </div>
        ))}
      </section>
    </div>
  );
}
