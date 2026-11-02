import React, { useEffect, useState } from 'react';
import { FRONTEND_VERSION, fetchBackendVersion } from '../config';

function VersionBadge() {
  const [backendVersion, setBackendVersion] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchBackendVersion().then((v) => {
      if (mounted) setBackendVersion(v);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="version-badge">
      <span className="version-item">
        <span className="version-label">Frontend</span>
        <span className="version-value">v{FRONTEND_VERSION}</span>
      </span>
      <span className="version-sep" />
      <span className="version-item">
        <span className="version-label">Backend</span>
        <span className="version-value">
          {backendVersion ? `v${backendVersion}` : '...'}
        </span>
      </span>
    </div>
  );
}

export default VersionBadge;
