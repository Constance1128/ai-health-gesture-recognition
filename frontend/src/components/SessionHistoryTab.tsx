import React, { useMemo } from 'react';
import { Button, Empty } from 'antd';
import { TrophyOutlined, ThunderboltOutlined, BarChartOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { DBHistoryRecord } from '../types';

interface SessionHistoryTabProps {
  dbHistory: DBHistoryRecord[];
  isDarkMode: boolean;
}

// Stat card at the top
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = '#10b981' }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '20px 22px',
    flex: 1,
    minWidth: 160,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
      <span style={{ color }}>{icon}</span>
      {label}
    </div>
    <div style={{ color, fontWeight: 800, fontSize: 28, lineHeight: 1, fontFamily: 'monospace' }}>
      {value}
    </div>
    {sub && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{sub}</div>}
  </div>
);

// Mini SVG line chart for score trend
const ScoreTrendChart: React.FC<{ sessions: { date: string; score: number }[] }> = ({ sessions }) => {
  if (sessions.length < 2) return (
    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0', fontSize: 13 }}>
      Complete at least 2 sessions to see score trend
    </div>
  );

  const W = 400, H = 180;
  const padL = 30, padR = 20, padT = 20, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const scores = sessions.map(s => s.score);
  const minS = Math.max(0, Math.min(...scores) - 10);
  const maxS = Math.min(100, Math.max(...scores) + 10);

  const xOf = (i: number) => padL + (i / (sessions.length - 1)) * chartW;
  const yOf = (s: number) => padT + chartH - ((s - minS) / (maxS - minS)) * chartH;

  const points = sessions.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(' ');
  const areaPath = `M ${xOf(0)},${yOf(sessions[0].score)} ${sessions.map((s, i) => `L ${xOf(i)},${yOf(s.score)}`).join(' ')} L ${xOf(sessions.length - 1)},${H - padB} L ${xOf(0)},${H - padB} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        if (v < minS || v > maxS) return null;
        const y = yOf(v);
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={padL - 5} y={y + 4} fill="rgba(255,255,255,0.25)" fontSize="8" textAnchor="end">{v}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" opacity="0.25" />
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + X labels */}
      {sessions.map((s, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(s.score)} r="4" fill="#10b981" stroke="#0d1117" strokeWidth="2" />
          <text x={xOf(i)} y={H - padB + 14} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">
            {s.date}
          </text>
        </g>
      ))}
    </svg>
  );
};

// Condition frequency bar chart
const ConditionFreqChart: React.FC<{ conditions: { name: string; count: number; total: number }[] }> = ({ conditions }) => {
  const max = Math.max(...conditions.map(c => c.count), 1);
  const COLORS = ['#ef4444', '#f59e0b', '#f97316', '#10b981', '#60a5fa'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {conditions.map((c, i) => (
        <div key={c.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{c.name}</span>
            <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700, fontSize: 13 }}>
              {c.count} / {c.total}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${(c.count / max) * 100}%`,
              background: COLORS[i % COLORS.length],
              height: '100%',
              borderRadius: 4,
              transition: 'width 1s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────

export const SessionHistoryTab: React.FC<SessionHistoryTabProps> = ({ dbHistory }) => {
  const sessions = useMemo(() => {
    return [...dbHistory]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => ({
        id: r.id,
        date: new Date(r.timestamp * 1000).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
        fullDate: new Date(r.timestamp * 1000).toLocaleString(),
        score: Math.round((r.metric_1?.value ?? 0.5) * 100),
        mode: r.mode,
        status: r.status,
        recommendation: r.recommendation,
      }));
  }, [dbHistory]);

  const bestScore = sessions.length ? Math.max(...sessions.map(s => s.score)) : 0;
  const avgScore = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) : 0;
  const goodStreak = sessions.filter(s => s.score >= 70).length;
  const last7Avg = sessions.length >= 7
    ? Math.round(sessions.slice(-7).reduce((a, s) => a + s.score, 0) / 7)
    : avgScore;

  // Condition frequency analysis (by status keywords)
  const conditionMap: Record<string, number> = {};
  dbHistory.forEach(r => {
    if (r.status) {
      conditionMap[r.status] = (conditionMap[r.status] || 0) + 1;
    }
  });
  const conditionFreq = Object.entries(conditionMap)
    .map(([name, count]) => ({ name, count, total: dbHistory.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 20,
  };

  const sectionTitle = (title: string, sub?: string) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>{title}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  if (dbHistory.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <HistoryOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 600 }}>No sessions recorded yet</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 8 }}>
          Complete a screening session to see your history here
        </div>
      </div>
    );
  }

  return (
    <div style={{ color: '#f1f5f9', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20 }}>Session History</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded · tracking posture improvement over time
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          icon={<TrophyOutlined />}
          label="Best Session Score"
          value={`${bestScore}/100`}
          sub={bestScore >= 80 ? 'Grade A' : bestScore >= 60 ? 'Grade B' : 'Grade C'}
          color="#10b981"
        />
        <StatCard
          icon={<ThunderboltOutlined />}
          label="Good Posture Streak"
          value={goodStreak}
          sub={goodStreak > 0 ? 'sessions above 70' : 'Build your streak'}
          color="#f59e0b"
        />
        <StatCard
          icon={<BarChartOutlined />}
          label="Avg Score (Last 7)"
          value={`${last7Avg}/100`}
          sub={sessions.length > 1 ? `↑ ${Math.abs(last7Avg - avgScore)} pts vs overall` : 'Overall average'}
          color="#60a5fa"
        />
      </div>

      {/* Score Trend Chart */}
      <div style={cardStyle}>
        {sectionTitle('Posture Score Trend', `Score per session — last ${sessions.length} sessions`)}
        <ScoreTrendChart sessions={sessions.map(s => ({ date: s.date, score: s.score }))} />
      </div>

      {/* Condition Frequency */}
      {conditionFreq.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Condition Frequency', 'How often each status appeared across all sessions')}
          <ConditionFreqChart conditions={conditionFreq} />
        </div>
      )}

      {/* Session log */}
      <div style={cardStyle}>
        {sectionTitle('Session Log', 'All recorded sessions')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.slice().reverse().map(s => (
            <div key={s.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: '12px 16px',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: s.score >= 75 ? 'rgba(16,185,129,0.15)' : s.score >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  color: s.score >= 75 ? '#10b981' : s.score >= 50 ? '#f59e0b' : '#ef4444',
                  fontFamily: 'monospace',
                }}>
                  {s.score}
                </div>
                <div>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{s.fullDate}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textTransform: 'uppercase' }}>
                    {s.mode} mode
                  </div>
                </div>
              </div>
              <div style={{
                background: s.status.toLowerCase().includes('normal') ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: s.status.toLowerCase().includes('normal') ? '#10b981' : '#f59e0b',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                {s.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
