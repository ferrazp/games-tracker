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

  const perSide = 8;
  const sides = [
    { covers: covers.slice(0, perSide), side: 'left' },
    { covers: covers.slice(perSide, perSide * 2), side: 'right' },
  ];

  return (
    <>
      {sides.map(({ covers: sideCovers, side }) => (
        <div key={side} className={`side-panel side-panel-${side}`}>
          <div className={`side-panel-stack side-panel-stack-${side}`}>
            {sideCovers.map((url, i) => {
              const total = sideCovers.length;
              const top = i * 12;
              const deg = side === 'left'
                ? -(3 + (i % 4) * 2)
                : 3 + (i % 4) * 2;
              return (
                <div
                  key={i}
                  className="side-panel-card"
                  style={{
                    top: `${top}%`,
                    transform: `rotate(${deg}deg)`,
                    zIndex: total - i,
                  }}
                >
                  <img src={url} alt="" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export default SidePanels;
