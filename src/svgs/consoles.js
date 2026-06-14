export function generateSvg(consoleName) {
  const config = SVG_CONFIG[consoleName];
  if (!config) return null;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="12" fill="${config.bg}"/>
  <text x="12" y="16" font-family="Arial,sans-serif" font-size="${config.fontSize || 8}" font-weight="bold" fill="${config.fg || '#fff'}" text-anchor="middle">${config.label}</text>
</svg>`;
}

export const SVG_CONFIG = {
  'PlayStation 1': { bg: '#003791', fg: '#fff', label: 'PS1', fontSize: 7 },
  'PlayStation 2': { bg: '#003791', fg: '#fff', label: 'PS2', fontSize: 7 },
  'PlayStation 3': { bg: '#003791', fg: '#fff', label: 'PS3', fontSize: 7 },
  'PlayStation 4': { bg: '#003791', fg: '#fff', label: 'PS4', fontSize: 7 },
  'PlayStation 5': { bg: '#003791', fg: '#fff', label: 'PS5', fontSize: 7 },
  'PlayStation Portable (PSP)': { bg: '#003791', fg: '#fff', label: 'PSP', fontSize: 6 },
  'Nintendo 64': { bg: '#e6e6e6', fg: '#dc2626', label: '64', fontSize: 9 },
  'Family Game': { bg: '#c8102e', fg: '#fff', label: 'NES', fontSize: 7 },
  'Super Nintendo': { bg: '#9f1d20', fg: '#f5e6b8', label: 'SNES', fontSize: 6 },
  'GameCube': { bg: '#6b46c1', fg: '#fff', label: 'GC', fontSize: 7 },
  'Dreamcast': { bg: '#f57520', fg: '#fff', label: 'DC', fontSize: 8 },
  'Nintendo DS': { bg: '#4a5568', fg: '#fff', label: 'DS', fontSize: 8 },
  'Nintendo Wii': { bg: '#00acee', fg: '#fff', label: 'Wii', fontSize: 7 },
  'Nintendo Switch': { bg: '#e60012', fg: '#fff', label: 'NS', fontSize: 7 },
  'PC': { bg: '#2d3748', fg: '#fff', label: 'PC', fontSize: 8 }
};
