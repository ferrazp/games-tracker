import React, { useState, useEffect } from 'react';
import API_URL from '../config';

function SidePanels() {
  const [covers, setCovers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/covers/random`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setCovers(data.covers || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (covers.length === 0) return null;

  const leftCovers = covers.slice(0, Math.ceil(covers.length / 2));
  const rightCovers = covers.slice(Math.ceil(covers.length / 2));

  return (
    <>
      <div className="side-panel side-panel-left">
        <div className="side-panel-grid">
          {leftCovers.map((url, i) => (
            <div key={i} className="side-panel-cell">
              <img src={url} alt="" />
            </div>
          ))}
        </div>
      </div>
      <div className="side-panel side-panel-right">
        <div className="side-panel-grid">
          {rightCovers.map((url, i) => (
            <div key={i} className="side-panel-cell">
              <img src={url} alt="" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default SidePanels;
