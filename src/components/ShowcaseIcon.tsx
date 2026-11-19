import React from 'react';

type IconName = 'flask' | 'camera' | 'upload' | 'projector' | 'arrow' | 'lock';
const strokes: Record<IconName, React.ReactNode> = {
  flask: <><path d="M9 3h6m-5 0v6l-6 9.5A1.6 1.6 0 0 0 5.4 21h13.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3M7.5 13.5h9"/><circle cx="10.5" cy="17" r=".8" fill="currentColor" stroke="none"/></>,
  camera: <><path d="M4 7h4l1.5-2.5h5L16 7h4a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7Z"/><circle cx="12" cy="13" r="3.5"/></>,
  upload: <><path d="M12 16V3.5m-4.5 4.8L12 3.5l4.5 4.8M4 15.5v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></>,
  projector: <><path d="M3 4h18M5 4v11h14V4M12 15v3m-4 3 4-3 4 3"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  lock: <><rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/></>,
};

export function ShowcaseIcon({ name }: { name: IconName }) {
  return <svg className="atlas-icon" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{strokes[name]}</svg>;
}
