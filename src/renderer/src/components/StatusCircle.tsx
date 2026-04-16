import React from 'react'
import type { UIStatus } from '../store/useTaskStore'

type Props = {
  status: UIStatus
  onClick: () => void
}

export default function StatusCircle({ status, onClick }: Props): React.ReactElement {
  return (
    <button
      className="status-circle"
      onClick={onClick}
      title={`Status: ${status} — click to cycle`}
      aria-label={`Task status: ${status}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        {status === 'open' && (
          <circle cx="8" cy="8" r="6.5" stroke="rgba(180,180,200,0.5)" strokeWidth="1.5" fill="none" />
        )}
        {status === 'inProgress' && (
          <>
            {/* Half-filled circle — right half */}
            <path
              d="M 8 1.5 A 6.5 6.5 0 0 1 8 14.5 Z"
              fill="rgba(110,168,254,0.85)"
            />
            <circle cx="8" cy="8" r="6.5" stroke="rgba(110,168,254,0.7)" strokeWidth="1.5" fill="none" />
          </>
        )}
        {status === 'done' && (
          <>
            <circle cx="8" cy="8" r="7" fill="rgba(110,168,254,0.85)" />
            <path
              d="M 4.5 8 L 7 10.5 L 11.5 5.5"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
      </svg>

      <style>{`
        .status-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: transform 0.12s;
          opacity: 0.85;
        }
        .status-circle:hover {
          opacity: 1;
          transform: scale(1.15);
        }
      `}</style>
    </button>
  )
}
