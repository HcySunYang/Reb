import type { Session } from '@/stores/sessionStore';

function cliDisplayName(command: string): string {
  if (command.includes('copilot')) return 'Copilot';
  return 'Claude';
}

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function SessionTabs({ sessions, activeId, onSelect, onClose }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto bg-gray-900 px-4 py-1 shrink-0">
      {sessions.map((session, i) => (
        <div
          key={session.id}
          onClick={() => onSelect(session.id)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs transition-colors ${
            session.id === activeId
              ? 'bg-reb-panel text-white border border-b-0 border-reb-border'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>{cliDisplayName(session.command)} #{i + 1}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(session.id);
            }}
            className="text-gray-600 hover:text-reb-red transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
