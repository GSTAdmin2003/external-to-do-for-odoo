import React from 'react'

type Props = {
  active: boolean
  onClick: () => void
}

export default function StarToggle({ active, onClick }: Props): React.ReactElement {
  return (
    <button
      className={`star-toggle ${active ? 'star-toggle--active' : ''}`}
      onClick={onClick}
      title={active ? 'Remove priority' : 'Mark as priority'}
      aria-label={active ? 'Priority: starred' : 'Priority: none'}
    >
      {active ? '★' : '☆'}

      <style>{`
        .star-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          font-size: 17px;
          opacity: 0.28;
          transition: opacity 0.15s, transform 0.12s;
          flex-shrink: 0;
        }
        .star-toggle:hover {
          opacity: 0.7;
          transform: scale(1.2);
        }
        .star-toggle--active {
          opacity: 0.9;
          color: #f5c842;
        }
        .star-toggle--active:hover {
          opacity: 1;
        }
      `}</style>
    </button>
  )
}
