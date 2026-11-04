import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../config';

// covers: portadas propias de la pantalla (p. ej. Sagas); vacío o null usa las aleatorias.
function SidePanels({ consoleId, covers: override = null }) {
  const [covers, setCovers] = useState([]);
  const cacheRef = useRef({});

  useEffect(() => {
    const key = consoleId ?? '';
    let cancelled = false;

    if (cacheRef.current[key]) {
      setCovers(cacheRef.current[key]);
    }

    const params = consoleId ? `?console_id=${consoleId}` : '';
    fetch(`${API_URL}/covers/random${params}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          const c = data.covers || [];
          cacheRef.current[key] = c;
          setCovers(c);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [consoleId]);

  const shown = override?.length ? override : covers;
  if (shown.length === 0) return null;

  const perSide = 8;
  const sides = [
    { covers: shown.slice(0, perSide), side: 'left' },
    { covers: shown.slice(perSide, perSide * 2), side: 'right' },
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
