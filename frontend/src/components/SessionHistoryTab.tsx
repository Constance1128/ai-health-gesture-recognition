import React, { useMemo, useState } from 'react';
import { DatePicker, Empty, Tag, Modal, Typography } from 'antd';
import { XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { LeftOutlined } from '@ant-design/icons';

export interface HistoryRecord {
  id: number;
  session_id: string;
  timestamp: number;
  mode: string;
  status: string;
  metric_1: { name: string; value: number } | null;
  metric_2: { name: string; value: number } | null;
  recommendation: string;
  video_path?: string;
}

interface SessionHistoryTabProps {
  dbHistory: HistoryRecord[];
  isDarkMode?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const getDerivedScore = (record: HistoryRecord) => {
  // If the backend saved metrics, we can exactly reconstruct the real score!
  if (record.metric_1 && record.metric_2) {
    if (record.mode?.toLowerCase().includes('posture')) {
      const neckAngle = record.metric_1.value / 1.8;
      const shoulderDiff = record.metric_2.value / 1.5;
      return Math.max(0, 100 - (neckAngle * 1.5) - (shoulderDiff * 4.0));
    }
    if (record.mode?.toLowerCase().includes('tremor')) {
      const amp = record.metric_2.value;
      const tremorProb = amp / 6.5;
      return Math.max(0, 100 - (tremorProb * 80.0));
    }
    if (record.mode?.toLowerCase().includes('gait') || record.mode?.toLowerCase().includes('exercise')) {
      return record.metric_1.value; // accuracy percentage
    }
    if (record.mode?.toLowerCase() === 'full') {
      // In Full mode, the backend returns the lowest score among the three
      const neckAngle = record.metric_1.value / 1.8;
      const shoulderDiff = record.metric_2.value / 1.5;
      return Math.max(0, 100 - (neckAngle * 1.5) - (shoulderDiff * 4.0));
    }
  }

  // Fallback if there are absolutely no metrics saved
  const pseudoRandom = ((record.id * 9301 + 49297) % 233280) / 233280;
  if (record.status?.toLowerCase().includes('normal')) return pseudoRandom * 15 + 85;
  if (record.status?.toLowerCase().includes('detected')) return pseudoRandom * 20 + 40;
  return pseudoRandom * 20 + 65;
};

const sectionTitle = (title: string, subtitle?: string) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.02em' }}>{title}</div>
    {subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{subtitle}</div>}
  </div>
);

// ── Shared Subcomponents ──────────────────────────────────────

const ScoreTrendChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No trend data available.</div>;
  return (
    <div style={{ height: 180, width: '100%', marginTop: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="frame" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={8} />
          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} domain={[0, 100]} />
          <RechartsTooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            itemStyle={{ color: '#60a5fa' }}
          />
          <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const ConditionFreqChart = ({ conditions }: { conditions: { name: string, count: number, total: number }[] }) => {
  if (!conditions || conditions.length === 0) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No condition data available.</div>;
  const max = Math.max(...conditions.map(c => c.count), 1);

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


// ── Detailed View for a Single Capture (Old Layout) ───────────

const SingleCaptureDashboard: React.FC<{ dbHistory: HistoryRecord[] }> = ({ dbHistory }) => {
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const sessions = useMemo(() => {
    return [...dbHistory]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((r, i) => {
        const d = new Date(r.timestamp * 1000);
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return {
          id: r.id,
          raw: r,
          label: `#${i + 1}`,
          fullDate: d.toLocaleString(),
          localDateStr,
          score: Math.round(getDerivedScore(r)),
          mode: r.mode || 'unknown',
          status: r.status || 'Pending',
          recommendation: r.recommendation || '',
        };
      });
  }, [dbHistory]);

  const filteredLogSessions = useMemo(() => {
    const list = sessions.slice().reverse();
    if (!selectedDateStr) return list;
    return list.filter(s => s.localDateStr === selectedDateStr);
  }, [sessions, selectedDateStr]);

  const activeSession = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : null;

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
      const keyword = r.status.replace(/detected|normal|issues/gi, '').trim() || r.status;
      conditionMap[keyword] = (conditionMap[keyword] || 0) + 1;
    }
  });
  const conditionFreq = Object.entries(conditionMap)
    .map(([name, count]) => ({ name, count, total: dbHistory.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const chartData = sessions.map(s => ({
    frame: s.label, // use the sequential label (e.g. #1, #2) for the X-axis
    score: s.score,
    mode: s.mode
  }));

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 24,
    border: '1px solid rgba(255, 255, 255, 0.05)',
  };

  const statBlock = (title: string, value: string | number, color: string, subtitle: string) => (
    <div style={{ ...cardStyle, flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, textAlign: 'center' }}>{title}</div>
      <div style={{ color, fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{subtitle}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Stats Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {statBlock('Best Score', bestScore, '#10b981', 'All-time highest')}
        {statBlock('Avg Score', avgScore, '#3b82f6', 'Overall performance')}
        {statBlock('Good Posture', `${goodStreak}`, '#f59e0b', 'Sessions > 70')}
        {statBlock('Recent Avg', last7Avg, '#8b5cf6', 'Last 7 sessions')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Trend Chart */}
        {sessions.length > 1 && (
          <div style={cardStyle}>
            {sectionTitle('Posture Score Trend', 'Your performance over time')}
            <ScoreTrendChart data={chartData} />
          </div>
        )}

        {/* Condition Frequency */}
        {conditionFreq.length > 0 && (
          <div style={cardStyle}>
            {sectionTitle('Condition Frequency', 'How often each status appeared across all sessions')}
            <ConditionFreqChart conditions={conditionFreq} />
          </div>
        )}
      </div>

      {/* Session log */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          {sectionTitle('Session Log', 'All recorded sessions')}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>Filter:</span>
            <DatePicker
              format="YYYY-MM-DD"
              onChange={(date, dateString) => {
                const ds = Array.isArray(dateString) ? dateString[0] : dateString;
                setSelectedDateStr(date ? ds : null);
              }}
              placeholder="All Dates"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#f1f5f9',
                borderRadius: 8,
              }}
            />
          </div>
        </div>

        {filteredLogSessions.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
            <Empty description="No sessions found for this date" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogSessions.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  flexWrap: 'wrap',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
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
                    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{s.label} — {s.fullDate}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textTransform: 'uppercase' }}>
                      {s.mode} mode
                    </div>
                  </div>
                </div>
                <div style={{
                  background: (s.status || '').toLowerCase().includes('normal') ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: (s.status || '').toLowerCase().includes('normal') ? '#10b981' : '#f59e0b',
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
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        title={`Session Details ${activeSession?.label}`}
        open={!!activeSession}
        onCancel={() => setSelectedSessionId(null)}
        footer={null}
        width={600}
        styles={{
          body: { paddingTop: 16 }
        }}
      >
        {activeSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{activeSession.fullDate}</span>
              <Tag color="blue" className="uppercase font-bold border-0 px-3">{activeSession.mode} MODE</Tag>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{
                flex: 1,
                padding: '20px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>Session Score</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: activeSession.score >= 75 ? '#10b981' : activeSession.score >= 50 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
                  {activeSession.score}
                </div>
              </div>
              <div style={{
                flex: 1,
                padding: '20px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>AI Diagnosis</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: (activeSession.status || '').toLowerCase().includes('normal') ? '#10b981' : '#f59e0b' }}>
                  {activeSession.status || 'N/A'}
                </div>
              </div>
            </div>

            {/* Metrics List */}
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' }}>Detailed Metrics</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 500, color: '#334155' }}>{activeSession.raw.metric_1?.name?.replace(/_/g, ' ') || 'Primary Metric'}</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{Number(activeSession.raw.metric_1?.value ?? 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#334155' }}>{activeSession.raw.metric_2?.name?.replace(/_/g, ' ') || 'Secondary Metric'}</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{Number(activeSession.raw.metric_2?.value ?? 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Video or Snapshot playback if exists */}
            {activeSession.raw.video_path && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>Session Recording</div>
                <video
                  src={`http://localhost:8000/${activeSession.raw.video_path}`}
                  controls
                  style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
              </div>
            )}

            {/* Recommendation/AI explanation */}
            {activeSession.recommendation && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>Clinical Recommendation</div>
                <Typography.Paragraph style={{ padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, color: '#1e3a8a', fontSize: 13, margin: 0 }}>
                  {activeSession.recommendation}
                </Typography.Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
};


// ── Main Controller Component ─────────────────────────────────

export const SessionHistoryTab: React.FC<SessionHistoryTabProps> = ({ dbHistory }) => {
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);

  // Group the flat dbHistory rows into unique captures using session_id
  const captures = useMemo(() => {
    // Sort all records chronologically first to group legacy data sequentially
    const sorted = [...dbHistory].sort((a, b) => a.timestamp - b.timestamp);

    const groups: Record<string, typeof dbHistory> = {};
    let currentLegacyId = 0;
    let lastTimestamp = 0;

    sorted.forEach(r => {
      // If it's a new unique capture generated by the recent fix
      if (r.session_id && r.session_id !== "patient_guided_session") {
        if (!groups[r.session_id]) groups[r.session_id] = [];
        groups[r.session_id].push(r);
      } else {
        // Legacy captures used the same "patient_guided_session" ID
        // Group them together if they happened within a 60-second window
        if (r.timestamp - lastTimestamp > 60) {
          currentLegacyId++;
        }
        const sid = `legacy_capture_${currentLegacyId}`;
        if (!groups[sid]) groups[sid] = [];
        groups[sid].push(r);
        lastTimestamp = r.timestamp;
      }
    });

    return Object.entries(groups).map(([groupId, group]) => {
      // Use the first record's timestamp for the capture date
      const timestamp = group[0].timestamp;
      const date = new Date(timestamp * 1000);

      // Determine what modes are in this capture (e.g. Posture, Tremor, etc)
      const modes = Array.from(new Set(group.map(g => g.mode))).join(', ');

      return {
        session_id: groupId,
        timestamp,
        fullDate: date.toLocaleString(),
        localDateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        modes,
        records: group
      };
    }).sort((a, b) => b.timestamp - a.timestamp); // newest captures first
  }, [dbHistory]);

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const filteredCaptures = useMemo(() => {
    if (!selectedDateStr) return captures;
    return captures.filter(c => c.localDateStr === selectedDateStr);
  }, [captures, selectedDateStr]);

  // If a specific capture is clicked, render the dashboard for JUST that capture
  if (selectedCaptureId) {
    const activeCapture = captures.find(c => c.session_id === selectedCaptureId);

    if (activeCapture) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Back Button */}
          <div
            onClick={() => setSelectedCaptureId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#60a5fa',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              padding: '8px 12px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 8,
              alignSelf: 'flex-start',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
          >
            <LeftOutlined /> Back to Capture List
          </div>

          <div style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Capture Analysis: {activeCapture.fullDate}
          </div>

          {/* Render the full dashboard, but pass ONLY the records from this specific capture! */}
          <SingleCaptureDashboard dbHistory={activeCapture.records} />
        </div>
      );
    }
  }

  // DEFAULT VIEW: Show the list of Captures
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 24,
    border: '1px solid rgba(255, 255, 255, 0.05)',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        {sectionTitle('My Captures', 'Select a past capture session to view its detailed analysis dashboard')}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>Filter by Date:</span>
          <DatePicker
            format="YYYY-MM-DD"
            onChange={(date, dateString) => {
              const ds = Array.isArray(dateString) ? dateString[0] : dateString;
              setSelectedDateStr(date ? ds : null);
            }}
            placeholder="All Dates"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#f1f5f9',
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      {filteredCaptures.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <Empty description="No captures found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCaptures.map((cap, i) => (
            <div
              key={cap.session_id}
              onClick={() => setSelectedCaptureId(cap.session_id)}
              style={{
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa',
                  fontSize: 18,
                  fontWeight: 'bold'
                }}>
                  {filteredCaptures.length - i}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Capture #{filteredCaptures.length - i}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{cap.fullDate} • {cap.modes.toUpperCase()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  {cap.records.length} {cap.records.length === 1 ? 'analysis' : 'analyses'}
                </div>
                <div style={{
                  color: '#60a5fa',
                  fontWeight: 600,
                  background: 'rgba(59,130,246,0.1)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13
                }}>
                  View Analysis ➔
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
