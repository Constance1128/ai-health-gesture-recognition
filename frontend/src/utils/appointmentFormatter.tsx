import React from 'react';
import { Tag, Typography, Button } from 'antd';
import { 
  SyncOutlined, 
  FileTextOutlined, 
  InfoCircleOutlined, 
  CloseCircleOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  LinkOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export interface ParsedAppointmentNotes {
  isRescheduled: boolean;
  rescheduledFrom?: string;
  rescheduleReason?: string;
  cancelledBy?: 'Patient' | 'Doctor';
  cancelReason?: string;
  patientSymptoms: string;
  rawNotes: string;
}

export function parseAppointmentNotes(notes?: string | null): ParsedAppointmentNotes {
  if (!notes || !notes.trim()) {
    return {
      isRescheduled: false,
      patientSymptoms: '',
      rawNotes: ''
    };
  }

  let raw = notes.trim();
  let isRescheduled = false;
  let rescheduledFrom: string | undefined;
  let rescheduleReason: string | undefined;
  let cancelledBy: 'Patient' | 'Doctor' | undefined;
  let cancelReason: string | undefined;

  // 1. Match Rescheduled patterns
  const reschedMatch = raw.match(/\[Rescheduled(?:\s+by\s+Doctor)?\s+from\s+([^\]]+?)(?:\s+due\s+to:?|\s*:)\s*([^\]]+?)\]/i);
  if (reschedMatch) {
    isRescheduled = true;
    rescheduledFrom = reschedMatch[1].trim();
    rescheduleReason = reschedMatch[2].trim();
    raw = raw.replace(reschedMatch[0], '').trim();
  }

  // 2. Match Patient Cancel patterns
  const patientCancelMatch = raw.match(/\[(?:Cancelled\s+by\s+Patient|Patient\s+Cancel\s+Reason|Reason):\s*([^\]]+?)\]/i);
  if (patientCancelMatch) {
    cancelledBy = 'Patient';
    cancelReason = patientCancelMatch[1].trim();
    raw = raw.replace(patientCancelMatch[0], '').trim();
  }

  // 3. Match Doctor Decline/Cancel patterns
  const docCancelMatch = raw.match(/\[(?:Declined\s+by\s+Doctor|Doctor\s+Decline\s+Reason|Cancelled\s+by\s+Doctor(?:\s+due\s+to)?|Cancelled\s+due\s+to\s+Doctor):\s*([^\]]+?)\]/i);
  if (docCancelMatch) {
    cancelledBy = 'Doctor';
    cancelReason = docCancelMatch[1].trim();
    raw = raw.replace(docCancelMatch[0], '').trim();
  }

  // Clean remaining text
  const cleanSymptoms = raw.replace(/^\[.*?\]\s*/g, '').trim();

  return {
    isRescheduled,
    rescheduledFrom,
    rescheduleReason,
    cancelledBy,
    cancelReason,
    patientSymptoms: cleanSymptoms,
    rawNotes: notes
  };
}

/**
 * LinkifiedText: Parses any plain text and renders URLs as clickable interactive elements.
 */
export const LinkifiedText: React.FC<{ text?: string | null; className?: string; showMeetingButton?: boolean }> = ({
  text,
  className = '',
  showMeetingButton = true
}) => {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  const meetingMatch = text.match(/(https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com)[^\s)]+)/i);
  const meetingUrl = meetingMatch ? meetingMatch[0] : null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="whitespace-pre-wrap break-words leading-relaxed">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            const isZoom = part.toLowerCase().includes('zoom.us');
            const isMeet = part.toLowerCase().includes('meet.google');

            return (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold underline break-all mx-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <LinkOutlined className="text-xs" />
                {isZoom ? 'Zoom Meeting Link' : isMeet ? 'Google Meet Link' : part}
              </a>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>

      {showMeetingButton && meetingUrl && (
        <div className="pt-1">
          <Button
            type="primary"
            size="small"
            icon={<VideoCameraOutlined />}
            className="bg-blue-600 hover:bg-blue-500 border-0 text-xs font-semibold rounded-lg flex items-center shadow-xs"
            onClick={(e) => {
              e.stopPropagation();
              window.open(meetingUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            Launch Online Video Consultation
          </Button>
        </div>
      )}
    </div>
  );
};

export const ConsultationTypeTag: React.FC<{ type?: string; className?: string }> = ({
  type = 'online',
  className = ''
}) => {
  const isPhysical = (type || '').toLowerCase() === 'physical';

  if (isPhysical) {
    return (
      <Tag 
        color="cyan" 
        icon={<EnvironmentOutlined className="mr-1" />}
        className={`font-semibold text-xs px-2.5 py-0.5 rounded-full border-0 ${className}`}
      >
        Physical In-Clinic
      </Tag>
    );
  }

  return (
    <Tag 
      color="purple" 
      icon={<VideoCameraOutlined className="mr-1" />}
      className={`font-semibold text-xs px-2.5 py-0.5 rounded-full border-0 ${className}`}
    >
      Online Video Call
    </Tag>
  );
};

interface AppointmentNotesDisplayProps {
  notes?: string | null;
  status?: string;
  reason?: string;
  consultationType?: string;
  doctorNotes?: string;
  clinicName?: string;
  isDarkMode?: boolean;
  compact?: boolean;
  className?: string;
}

export const AppointmentNotesDisplay: React.FC<AppointmentNotesDisplayProps> = ({
  notes,
  status,
  reason,
  consultationType,
  doctorNotes,
  clinicName,
  isDarkMode,
  compact = false,
  className = ''
}) => {
  const parsed = parseAppointmentNotes(notes);
  const isCancelled = (status || '').toLowerCase() === 'cancelled';
  const isPhysical = (consultationType || '').toLowerCase() === 'physical';

  // Determine who cancelled and what reason to show
  const cancelByWho = parsed.cancelledBy || (isCancelled ? 'Doctor / System' : undefined);
  const effectiveCancelReason = parsed.cancelReason || reason;

  // COMPACT VIEW (for cards in list views - short, neat, no overflow)
  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {/* Reschedule Badge */}
        {parsed.isRescheduled && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <SyncOutlined />
            <span>Rescheduled from {parsed.rescheduledFrom} ({parsed.rescheduleReason || 'Doctor Outstation'})</span>
          </div>
        )}

        {/* Cancellation Notice with WHO cancelled */}
        {isCancelled && effectiveCancelReason && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900">
            <CloseCircleOutlined className="text-rose-500" />
            <span>
              <strong>Cancelled by {cancelByWho}:</strong> {effectiveCancelReason}
            </span>
          </div>
        )}

        {/* Symptoms / Note summary preview */}
        {parsed.patientSymptoms && (
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
            <FileTextOutlined className="text-slate-400 flex-shrink-0" />
            <span className="truncate">
              <strong>Symptoms:</strong> {parsed.patientSymptoms}
            </span>
          </div>
        )}

        {/* Short meeting indicator */}
        {!isPhysical && doctorNotes && (
          <div className="text-[11px] text-blue-500 font-medium flex items-center gap-1">
            <VideoCameraOutlined /> Zoom / Meeting Link attached (click card for details)
          </div>
        )}
      </div>
    );
  }

  // FULL VIEW (for Pop-up Modals / Full Details)
  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Consultation Type Info */}
      {consultationType && (
        <div className="flex items-center gap-2 flex-wrap">
          <ConsultationTypeTag type={consultationType} />
          {isPhysical && clinicName && (
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              📍 Clinic Location: {clinicName}
            </span>
          )}
        </div>
      )}

      {/* Reschedule Banner */}
      {parsed.isRescheduled && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
          isDarkMode 
            ? 'bg-amber-950/30 border-amber-800 text-amber-300' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <SyncOutlined className="mt-0.5 text-amber-500 flex-shrink-0" />
          <div className="leading-snug">
            <div className="font-bold">Auto-Rescheduled by Doctor</div>
            <div className="mt-0.5">
              Moved from {parsed.rescheduledFrom}
              {parsed.rescheduleReason && (
                <Tag color="orange" className="ml-1.5 text-[10px] font-bold uppercase border-0 rounded-full px-2 py-0">
                  {parsed.rescheduleReason}
                </Tag>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Banner with WHO cancelled */}
      {isCancelled && effectiveCancelReason && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
          isDarkMode 
            ? 'bg-rose-950/30 border-rose-900 text-rose-300' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <CloseCircleOutlined className="mt-0.5 text-rose-500 flex-shrink-0" />
          <div className="leading-snug">
            <div className="font-bold">Cancelled by {cancelByWho}</div>
            <div className="mt-0.5"><strong>Reason:</strong> {effectiveCancelReason}</div>
          </div>
        </div>
      )}

      {/* Patient's Symptoms / Notes */}
      {parsed.patientSymptoms && (
        <div className={`p-3 rounded-xl border text-xs ${
          isDarkMode 
            ? 'bg-slate-900/60 border-slate-700 text-slate-300' 
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <FileTextOutlined /> Symptoms & Visit Notes:
          </div>
          <LinkifiedText text={parsed.patientSymptoms} />
        </div>
      )}

      {/* Online Consultation Meeting Link */}
      {!isPhysical && doctorNotes && (
        <div className={`p-3 rounded-xl border text-xs ${
          isDarkMode 
            ? 'bg-blue-950/30 border-blue-900 text-blue-300' 
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="font-bold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
            <VideoCameraOutlined /> Consultation Video Call & Meeting Link:
          </div>
          <LinkifiedText text={doctorNotes} showMeetingButton={true} />
        </div>
      )}
    </div>
  );
};
