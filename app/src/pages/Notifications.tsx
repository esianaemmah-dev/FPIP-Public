import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { useNotifications } from '@/context/NotificationContext';
import { formatDate } from '@/lib/format';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Notifications() {
  const navigate = useNavigate();
  const { notifications, activity, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">Inbox</div>
            <h1>Notifications & activity</h1>
            <p>
              Approvals, compliance gates, HOD submissions, and finance exceptions in one place —
              with a full activity timeline for audit.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{unreadCount}</b>
              <span>Unread</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
        </div>
      </header>

      <div className="notif-layout">
        <Card className="polish-section">
          <SectionHead title="Notifications" />
          <div className="notif-list">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-item${n.read ? '' : ' unread'}`}
                onClick={() => {
                  markRead(n.id);
                  if (n.href) navigate(n.href);
                }}
              >
                <span className="notif-dot" aria-hidden />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
                <time dateTime={n.createdAt}>{relativeTime(n.createdAt)}</time>
              </button>
            ))}
          </div>
        </Card>

        <Card className="polish-section">
          <SectionHead title="Activity timeline" />
          <div className="activity-timeline">
            {activity.map((a) => (
              <button
                key={a.id}
                type="button"
                className="activity-row"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: a.href ? 'pointer' : 'default',
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  padding: '12px 0',
                }}
                onClick={() => a.href && navigate(a.href)}
              >
                <span className="act-node" aria-hidden />
                <div>
                  <strong>
                    {a.actor} · {a.action}
                  </strong>
                  <span>{a.detail}</span>
                  <time dateTime={a.at}>{formatDate(a.at)}</time>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
