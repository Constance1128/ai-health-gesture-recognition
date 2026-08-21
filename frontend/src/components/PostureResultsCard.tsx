import React from 'react';
import { Button, Tag } from 'antd';
import {
  CheckCircleOutlined, WarningOutlined, FilePdfOutlined, ReloadOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, MedicineBoxOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { DiagnosisReport, PostureFinding, PossibleCondition, JointAngleMeasurement } from '../utils/postureDiagnosis';
import { AnalysisResult } from '../types';
import { downloadPDFReport } from '../utils/pdfGenerator';
import { DBHistoryRecord } from '../types';

interface PostureResultsCardProps {
  report: DiagnosisReport;
  analysisResult?: AnalysisResult | null;
  dbHistory?: DBHistoryRecord[];
  onNewScreening: () => void;
  isDarkMode: boolean;
}

// ── Severity helpers ──────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  normal: '#10b981',
  mild: '#f59e0b',
  moderate: '#f97316',
  severe: '#ef4444',
};

const SEVERITY_BG: Record<string, string> = {
  normal: 'rgba(16,185,129,0.08)',
  mild: 'rgba(245,158,11,0.10)',
  moderate: 'rgba(249,115,22,0.10)',
  severe: 'rgba(239,68,68,0.10)',
};

const RISK_COLOR: Record<string, string> = {
  low: '#10b981',
  moderate: '#f59e0b',
  high: '#ef4444',
};

const GRADE_COLOR: Record<string, string> = {
  'A+': '#10b981', 'A': '#34d399',
  'B+': '#60a5fa', 'B': '#93c5fd',
  'C+': '#f59e0b', 'C': '#fbbf24',
  'D': '#ef4444',
};

// ── Sub-components ────────────────────────────────────

const ScoreGauge: React.FC<{ score: number; grade: string; status: string }> = ({ score, grade, status }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        {/* Track */}
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Progress */}
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
          strokeDashoffset={circumference * 0.25}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 1s ease' }}
        />
        {/* Score text */}
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="26" fontWeight="bold" fontFamily="monospace">
          {Math.round(score)}
        </text>
        <text x="65" y="76" textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">
          {grade}
        </text>
      </svg>
      <p style={{ color, margin: 0, fontWeight: 700, fontSize: 14 }}>{status}</p>
      <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 11 }}>Posture Health Score</p>
    </div>
  );
};

const FindingCard: React.FC<{ finding: PostureFinding }> = ({ finding }) => {
  const color = SEVERITY_COLOR[finding.severity];
  const bg = SEVERITY_BG[finding.severity];
  const Icon = finding.severity === 'normal' ? CheckCircleOutlined
    : finding.severity === 'severe' ? AlertOutlined
    : WarningOutlined;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}22`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <Icon style={{ color, fontSize: 16, marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>{finding.label}</span>
          <span style={{
            background: `${color}22`,
            color,
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>{finding.severity}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{finding.affectedArea}</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          {finding.description}
        </p>
      </div>
    </div>
  );
};

const ConditionCard: React.FC<{ condition: PossibleCondition }> = ({ condition }) => {
  const color = RISK_COLOR[condition.risk];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>{condition.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color, fontWeight: 700, fontSize: 12 }}>{condition.probability}%</span>
          <span style={{
            background: `${color}22`,
            color,
            borderRadius: 4,
            padding: '1px 8px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>{condition.risk} risk</span>
        </div>
      </div>
      {/* Probability bar */}
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          width: `${condition.probability}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          height: '100%',
          borderRadius: 4,
          transition: 'width 1s ease',
        }} />
      </div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        {condition.description}
      </p>
    </div>
  );
};

const MeasurementRow: React.FC<{ m: JointAngleMeasurement; isLast: boolean }> = ({ m, isLast }) => {
  const color = SEVERITY_COLOR[m.status];
  const inRange = m.status === 'normal';
  const barPct = Math.min(100, Math.max(0, (m.measured / (m.normalMax * 1.5)) * 100));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 100px 70px',
      gap: 8,
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{m.joint}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{m.description}</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
          {m.measured.toFixed(1)}{m.unit}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
          Norm: {m.normalMin}–{m.normalMax}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${barPct}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            height: '100%',
            borderRadius: 4,
          }} />
        </div>
        {/* Normal range markers */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${(m.normalMin / (m.normalMax * 1.5)) * 100}%`,
          width: `${((m.normalMax - m.normalMin) / (m.normalMax * 1.5)) * 100}%`,
          height: 6,
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 4,
          pointerEvents: 'none',
        }} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          background: `${color}18`,
          color,
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {inRange ? '✓ OK' : m.status}
        </span>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────

export const PostureResultsCard: React.FC<PostureResultsCardProps> = ({
  report,
  analysisResult,
  dbHistory = [],
  onNewScreening,
  isDarkMode,
}) => {
  const cardBg = '#0d1117';
  const cardBorder = 'rgba(255,255,255,0.08)';

  const section = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ color: '#10b981', fontSize: 14 }}>{icon}</span>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 16,
      overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #10b98118 0%, #06b6d418 100%)',
        borderBottom: `1px solid ${cardBorder}`,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {report.score >= 70
              ? <CheckCircleOutlined style={{ color: '#10b981', fontSize: 20 }} />
              : <ExclamationCircleOutlined style={{ color: '#f59e0b', fontSize: 20 }} />
            }
            <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 18 }}>
              AI Posture Screening — Complete
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', margin: '4px 0 0', fontSize: 12 }}>
            Based on 15-second real-time joint angle analysis
          </p>
        </div>
        <Tag
          color={report.score >= 75 ? 'success' : report.score >= 50 ? 'warning' : 'error'}
          style={{ fontWeight: 700, fontSize: 13, padding: '4px 14px', borderRadius: 20, border: 'none' }}
        >
          {report.status.toUpperCase()}
        </Tag>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Score + Summary row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          gap: 20,
          marginBottom: 24,
          alignItems: 'center',
        }}>
          <ScoreGauge score={report.score} grade={report.grade} status={report.status} />
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                AI Summary
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                {report.summary}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
                {report.findings.filter(f => f.id !== 'normal-posture').length} abnormalities detected
              </span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
                {report.conditions.length} conditions flagged
              </span>
              <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
                {report.measurements.length} measurements
              </span>
            </div>
          </div>
        </div>

        {/* Findings */}
        {section('AI Detected Findings', <MedicineBoxOutlined />,
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.findings.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        )}

        {/* Conditions */}
        {report.conditions.length > 0 && section('Possible Conditions', <InfoCircleOutlined />,
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.conditions.map((c, i) => <ConditionCard key={i} condition={c} />)}
          </div>
        )}

        {/* Measurements table */}
        {report.measurements.length > 0 && section('Joint Angle Measurements', <CheckCircleOutlined />,
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '0 12px' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 100px 70px',
              gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {['Joint', 'Measured', 'Normal Range', 'Status'].map(h => (
                <div key={h} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Status' ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>
            {report.measurements.map((m, i) => (
              <MeasurementRow key={m.joint} m={m} isLast={i === report.measurements.length - 1} />
            ))}
          </div>
        )}

        {/* Recommendation */}
        {section('Clinical Recommendation', <MedicineBoxOutlined />,
          <div style={{
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 10,
            padding: '14px 16px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              {report.recommendation}
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <ExclamationCircleOutlined style={{ color: '#f59e0b', fontSize: 16, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
              ⚠️ AI Estimate Only — Not a Medical Diagnosis
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              This screening is an AI-based estimate for informational purposes only. The results should not be used
              as a substitute for professional medical advice, diagnosis, or treatment. Please consult a qualified
              healthcare professional, orthopaedic specialist, or physiotherapist for a thorough evaluation at a hospital or clinic.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={() => downloadPDFReport(analysisResult ?? null, dbHistory)}
            style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              height: 40,
              paddingInline: 20,
              flex: 1,
            }}
          >
            Download PDF Report
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={onNewScreening}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 10,
              fontWeight: 700,
              height: 40,
              paddingInline: 20,
              flex: 1,
            }}
          >
            New Screening
          </Button>
        </div>
      </div>
    </div>
  );
};
