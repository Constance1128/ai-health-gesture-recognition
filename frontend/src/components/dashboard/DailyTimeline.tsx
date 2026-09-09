import React, { useState } from 'react';
import { Typography, Tag, Modal, Button, Divider, Badge } from 'antd';
import { 
  ClockCircleOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  UserOutlined, 
  MailOutlined,
  StopOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { AppointmentNotesDisplay, parseAppointmentNotes } from '../../utils/appointmentFormatter';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const { Text, Title } = Typography;

const SHINE_STYLE = `
@keyframes nowPing {
  0%   { transform: scale(1);   opacity: 0.75; }
  70%  { transform: scale(2.6); opacity: 0; }
  100% { transform: scale(2.6); opacity: 0; }
}
@keyframes nowGlow {
  0%   { box-shadow: 0 0 0 0 var(--glow-a), 0 0 6px 2px var(--glow-b); }
  50%  { box-shadow: 0 0 0 10px transparent, 0 0 22px 8px var(--glow-b); }
  100% { box-shadow: 0 0 0 0 transparent, 0 0 6px 2px var(--glow-a); }
}
@keyframes nowStar {
  0%,100% { filter: brightness(1)   drop-shadow(0 0 3px var(--dot-c)); }
  25%      { filter: brightness(1.6) drop-shadow(0 0 10px var(--dot-c)); }
  50%      { filter: brightness(1.3) drop-shadow(0 0 18px var(--dot-c)); }
  75%      { filter: brightness(1.7) drop-shadow(0 0 10px var(--dot-c)); }
}
`;

// Helper: hex color → rgba string
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

interface DailyTimelineProps {
  date: dayjs.Dayjs;
  appointments: any[];
  weeklySchedule: any[];
  overrides: any[];
  isDarkMode: boolean;
}

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ date, appointments, weeklySchedule, overrides, isDarkMode }) => {
  const [selectedSlotModal, setSelectedSlotModal] = useState<any | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00

  const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday
  const daySchedule = weeklySchedule.find(s => {
    if (s.day_of_week !== dayOfWeek) return false;
    if (s.effective_start_date && date.isBefore(dayjs(s.effective_start_date), 'day')) return false;
    if (s.effective_end_date && date.isSameOrAfter(dayjs(s.effective_end_date), 'day')) return false;
    return true;
  });

  const dateStr = date.format('YYYY-MM-DD');
  const dayOverrides = overrides.filter(o => o.date === dateStr);

  // Compute Now and Next
  const now = dayjs();
  let allEvents: any[] = [];
  
  appointments.forEach(appt => {
    const apptDate = appt.date || appt.appointment_date;
    const apptTime = appt.time || appt.start_time;
    const apptEndTime = appt.end_time || (apptTime ? dayjs(`${apptDate} ${apptTime}`).add(1, 'hour').format('HH:mm') : '');
    const apptStatus = (appt.status || '').toLowerCase();

    if (apptDate === dateStr && apptStatus !== 'cancelled') {
      allEvents.push({
        type: 'appointment',
        title: `Appt: ${appt.patient_name || appt.patient_email} (${apptStatus.toUpperCase()})`,
        start: dayjs(`${apptDate} ${apptTime}`),
        end: dayjs(`${apptDate} ${apptEndTime}`),
        status: apptStatus,
        data: appt
      });
    }
  });
  
  dayOverrides.forEach(ovr => {
    allEvents.push({
      type: 'override',
      title: ovr.reason || 'Doctor Blocked / Outstation',
      start: dayjs(`${ovr.date} ${ovr.start_time}`),
      end: dayjs(`${ovr.date} ${ovr.end_time}`),
      data: ovr
    });
  });
  
  allEvents.sort((a, b) => a.start.valueOf() - b.start.valueOf());
  
  let currentEvent = null;
  let nextEvent = null;
  
  if (date.isSame(now, 'day')) {
    for (const ev of allEvents) {
      if (now.isBetween(ev.start, ev.end, null, '[)')) {
        currentEvent = ev;
      } else if (ev.start.isAfter(now) && !nextEvent) {
        nextEvent = ev;
      }
    }
  }

  const getSlotStatus = (hour: number) => {
    const slotStartStr = `${hour.toString().padStart(2, '0')}:00`;
    const slotEndStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
    const slotStart = dayjs(`${dateStr} ${slotStartStr}`);
    const slotEnd = dayjs(`${dateStr} ${slotEndStr}`);
    const now = dayjs();

    let isPast = false;
    if (slotEnd.isSameOrBefore(now)) {
      isPast = true;
    }

    // 1. Check Overrides matching this hour slot
    const slotOverrides: any[] = [];
    for (const ovr of dayOverrides) {
      const ovrStart = dayjs(`${ovr.date} ${ovr.start_time}`);
      const ovrEnd = dayjs(`${ovr.date} ${ovr.end_time}`);
      if (slotStart.isBefore(ovrEnd) && slotEnd.isAfter(ovrStart)) {
        slotOverrides.push(ovr);
      }
    }

    // 2. Check Appointments matching this hour slot
    const slotAppts = appointments.filter(appt => {
      const apptDate = appt.date || appt.appointment_date;
      const apptTime = appt.time || appt.start_time;
      const apptEndTime = appt.end_time || (apptTime ? dayjs(`${apptDate} ${apptTime}`).add(1, 'hour').format('HH:mm') : '');
      const apptStatus = (appt.status || '').toLowerCase();

      if (apptDate === dateStr && apptStatus !== 'cancelled') {
        const apptStart = dayjs(`${apptDate} ${apptTime}`);
        const apptEnd = dayjs(`${apptDate} ${apptEndTime}`);
        if (slotStart.isBefore(apptEnd) && slotEnd.isAfter(apptStart)) {
          return true;
        }
      }
      return false;
    });

    // Case A: Appointments exist (with or without override)
    if (slotAppts.length > 0) {
      return { 
        type: 'appointment', 
        appts: slotAppts, 
        overrides: slotOverrides,
        isPast, 
        slotStartStr, 
        slotEndStr 
      };
    }

    // Case B: No appointments, but doctor has set an override/block
    if (slotOverrides.length > 0) {
      return { 
        type: 'blocked', 
        reason: slotOverrides.map(o => o.reason || 'Doctor Outstation / Blocked').join(', '), 
        overrides: slotOverrides,
        isPast,
        slotStartStr,
        slotEndStr
      };
    }

    // Case C: Working Hours Check
    if (!daySchedule) {
      return { type: 'unavailable', reason: 'Not In Practice Schedule', isPast, slotStartStr, slotEndStr };
    }

    const workStart = dayjs(`${dateStr} ${daySchedule.start_time}`);
    const workEnd = dayjs(`${dateStr} ${daySchedule.end_time}`);
    
    // If the slot is outside working hours
    if (slotStart.isSameOrBefore(workStart) && slotEnd.isSameOrBefore(workStart)) {
      return { type: 'unavailable', reason: 'Outside Working Hours', isPast, slotStartStr, slotEndStr };
    }
    if (slotStart.isSameOrAfter(workEnd)) {
      return { type: 'unavailable', reason: 'Outside Working Hours', isPast, slotStartStr, slotEndStr };
    }

    return { type: 'available', isPast, slotStartStr, slotEndStr };
  };

  return (
    <div className="w-full">
      <style>{SHINE_STYLE}</style>
      
      {/* Date header */}
      <div className={`px-4 py-3 rounded-xl border-l-4 mb-3 flex items-center justify-between flex-wrap gap-2 ${isDarkMode ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-500'}`}>
        <div className="flex items-center gap-2">
          <CalendarOutlined className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
          <Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {date.format('dddd, MMMM D, YYYY')}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {allEvents.filter(e => e.type === 'appointment').length} booking(s)
          </span>
          {dayOverrides.length > 0 && (
            <Tag color="error" className="m-0 border-0 font-semibold text-xs">
              {dayOverrides.map(o => o.reason || 'Outstation').join(' • ')}
            </Tag>
          )}
        </div>
      </div>

      {/* Outstation / Schedule Alert if day is blocked */}
      {dayOverrides.length > 0 && (
        <div className={`p-3 rounded-xl border mb-4 flex items-start gap-3 ${
          isDarkMode ? 'bg-rose-950/20 border-rose-900/40 text-rose-300' : 'bg-rose-50/70 border-rose-200 text-rose-800'
        }`}>
          <StopOutlined className="mt-0.5 text-rose-500 flex-shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold">Doctor Notice for {date.format('MMMM D')}: </span>
            {dayOverrides.map((ovr, i) => (
              <span key={i} className="inline-block mr-2">
                <strong>[{ovr.reason || 'Outstation'}]</strong> {ovr.start_time} - {ovr.end_time}
              </span>
            ))}
            <span className="block mt-0.5 text-slate-500 dark:text-slate-400">
              * Any active appointments on this day are shown below. Click any card for full details.
            </span>
          </div>
        </div>
      )}

      {/* Now / Next banner (today only) */}
      {date.isSame(dayjs(), 'day') && (
        <div className="flex gap-3 mb-5">
          <div className={`flex-1 p-3 rounded-xl border ${isDarkMode ? 'bg-blue-900/30 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Happening Now</Text>
            </div>
            {currentEvent ? (
              <>
                <Text className={`font-semibold block ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>{currentEvent.title}</Text>
                <Text className="text-xs text-blue-500">Until {currentEvent.end.format('HH:mm')}</Text>
              </>
            ) : (
              <Text className="text-slate-400 italic text-sm">No active events</Text>
            )}
          </div>
          <div className={`flex-1 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Up Next</Text>
            {nextEvent ? (
              <>
                <Text className="font-semibold block">{nextEvent.title}</Text>
                <Text className="text-xs text-slate-500">Starts at {nextEvent.start.format('HH:mm')}</Text>
              </>
            ) : (
              <Text className="text-slate-400 italic text-sm">No upcoming events</Text>
            )}
          </div>
        </div>
      )}

      {/* Vertical Step Tracker */}
      <div className="relative">
        {/* Vertical line */}
        <div className={`absolute left-5 top-0 bottom-0 w-0.5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} style={{ marginLeft: -1 }} />

        <div className="space-y-1">
          {hours.map((hour) => {
            const status = getSlotStatus(hour);
            const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
            const isNow = date.isSame(dayjs(), 'day') && dayjs().hour() === hour;

            // Skip unavailable/outside-hours slots to keep the list clean
            if (status.type === 'unavailable' && !isNow) return null;

            let dotColor = isDarkMode ? '#475569' : '#cbd5e1';
            let dotBorder = isDarkMode ? '#334155' : '#e2e8f0';
            let cardBg = isDarkMode ? '#1e293b' : '#f8fafc';
            let cardBorder = isDarkMode ? '#334155' : '#e2e8f0';
            let statusText: React.ReactNode = null;
            let labelColor = isDarkMode ? '#94a3b8' : '#64748b';
            let timeColor = isDarkMode ? '#64748b' : '#94a3b8';

            if (isNow) {
              dotColor = '#3b82f6';
              dotBorder = '#bfdbfe';
              cardBg = isDarkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff';
              cardBorder = isDarkMode ? '#1d4ed8' : '#bfdbfe';
              labelColor = '#3b82f6';
            }

            if (status.type === 'blocked') {
              dotColor = '#f87171';
              dotBorder = '#fecaca';
              cardBg = isDarkMode ? 'rgba(239,68,68,0.1)' : '#fff1f2';
              cardBorder = isDarkMode ? '#7f1d1d' : '#fecdd3';
              labelColor = '#ef4444';
              statusText = (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                    ⛔ {status.reason}
                  </span>
                  <span className="text-[10px] text-slate-400">Click for details</span>
                </div>
              );
            } else if (status.type === 'appointment') {
              dotColor = '#2563eb';
              dotBorder = '#bfdbfe';
              cardBg = isDarkMode ? 'rgba(37,99,235,0.12)' : '#eff6ff';
              cardBorder = isDarkMode ? '#1d4ed8' : '#bfdbfe';
              labelColor = '#2563eb';
              
              const hasOverride = status.overrides && status.overrides.length > 0;

              statusText = (
                <div className="space-y-2">
                  {hasOverride && (
                    <div className="flex items-center gap-1.5">
                      <Tag color="red" className="m-0 text-[10px] font-bold uppercase border-0">
                        Doctor: {status.overrides.map((o: any) => o.reason || 'Outstation').join(', ')}
                      </Tag>
                    </div>
                  )}

                  {status.appts?.map((appt: any, i: number) => {
                    const timeStr = appt.time || appt.start_time || '';
                    const isConf = (appt.status || '').toLowerCase() === 'confirmed';
                    const isCanc = (appt.status || '').toLowerCase() === 'cancelled';
                    return (
                      <div key={i} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#93c5fd' : '#1d4ed8' }}>
                            {appt.patient_name || appt.patient_email}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {timeStr}
                            </span>
                            <Tag 
                              color={isConf ? 'green' : isCanc ? 'red' : 'gold'} 
                              className="m-0 text-[10px] uppercase font-bold px-1.5 py-0 border-0 rounded-full"
                            >
                              {appt.status}
                            </Tag>
                          </div>
                        </div>

                        {/* Clean formatted appointment notes display */}
                        <AppointmentNotesDisplay 
                          notes={appt.notes} 
                          status={appt.status} 
                          reason={appt.reason} 
                          consultationType={appt.consultation_type}
                          isDarkMode={isDarkMode} 
                        />
                      </div>
                    );
                  })}
                </div>
              );

            } else if (status.type === 'available') {
              dotColor = '#10b981';
              dotBorder = '#a7f3d0';
              labelColor = '#10b981';
              statusText = (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Available for Booking</span>
                  <span className="text-[10px] text-slate-400">Click to view</span>
                </div>
              );
            } else {
              statusText = <span style={{ fontSize: 12, color: isDarkMode ? '#475569' : '#94a3b8', fontStyle: 'italic' }}>Outside Working Hours</span>;
            }

            return (
              <div 
                key={hour} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 12, 
                  position: 'relative', 
                  paddingBottom: 4, 
                  opacity: status.isPast && !isNow ? 0.6 : 1 
                }}
              >
                {/* Dot with shine effect for NOW */}
                <div style={{ flexShrink: 0, width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, position: 'relative' }}>
                  {/* Ping ring 1 */}
                  {isNow && (
                    <div style={{
                      position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)',
                      width: 22, height: 22, borderRadius: '50%',
                      background: hexToRgba(dotColor, 0.4),
                      animation: 'nowPing 1.4s cubic-bezier(0,0,0.2,1) infinite',
                      zIndex: 1
                    }} />
                  )}
                  {/* Ping ring 2 (offset) */}
                  {isNow && (
                    <div style={{
                      position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)',
                      width: 22, height: 22, borderRadius: '50%',
                      background: hexToRgba(dotColor, 0.25),
                      animation: 'nowPing 1.4s cubic-bezier(0,0,0.2,1) 0.6s infinite',
                      zIndex: 1
                    }} />
                  )}
                  {/* Core dot */}
                  <div style={{
                    width: isNow ? 16 : 11,
                    height: isNow ? 16 : 11,
                    borderRadius: '50%',
                    background: dotColor,
                    border: `3px solid ${dotBorder}`,
                    animation: isNow ? 'nowGlow 1.6s ease-in-out infinite, nowStar 2s ease-in-out infinite' : 'none',
                    zIndex: 3,
                    position: 'relative',
                    transition: 'all 0.2s',
                    marginTop: isNow ? 0 : 2,
                    ['--dot-c' as any]: dotColor,
                    ['--glow-a' as any]: hexToRgba(dotColor, 0.7),
                    ['--glow-b' as any]: hexToRgba(dotColor, 0.45),
                  }} />
                </div>

                {/* Interactive Clickable Card */}
                <div 
                  onClick={() => setSelectedSlotModal({ ...status, hour, dateStr })}
                  className="flex-1 cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.005] active:scale-[0.99]"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: statusText ? 6 : 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, fontWeight: 700, color: timeColor }}>{timeLabel} - {status.slotEndStr}</span>
                      {status.isPast && <Tag color="default" className="m-0 text-[10px] border-0">Past</Tag>}
                    </div>
                    {isNow && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: '#fff',
                        background: '#3b82f6', borderRadius: 6,
                        padding: '1px 7px', letterSpacing: 1, textTransform: 'uppercase'
                      }}>NOW</span>
                    )}
                  </div>
                  {statusText && <div style={{ color: labelColor }}>{statusText}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pop-up Modal for Details */}
      <Modal
        open={!!selectedSlotModal}
        onCancel={() => setSelectedSlotModal(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedSlotModal(null)} className="rounded-lg">
            Close
          </Button>
        ]}
        title={
          <div className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-500" />
            <span>Time Slot & Booking Details</span>
          </div>
        }
        destroyOnClose
        centered
        width={560}
      >
        {selectedSlotModal && (
          <div className="space-y-4 py-2">
            {/* Time and Date header banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-xs text-slate-400 font-medium">Scheduled Time</div>
                <div className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mt-0.5">
                  <ClockCircleOutlined className="text-blue-500" />
                  {selectedSlotModal.slotStartStr} - {selectedSlotModal.slotEndStr}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Date</div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                  {selectedSlotModal.dateStr}
                </div>
              </div>
            </div>

            {/* Overrides / Doctor block notice */}
            {selectedSlotModal.overrides && selectedSlotModal.overrides.length > 0 && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <StopOutlined /> Doctor Block / Outstation
                </div>
                {selectedSlotModal.overrides.map((ovr: any, idx: number) => (
                  <div key={idx} className="text-xs text-rose-600 dark:text-rose-400">
                    <strong>Reason:</strong> {ovr.reason || 'Doctor unavailable'} ({ovr.start_time} - {ovr.end_time})
                  </div>
                ))}
              </div>
            )}

            {/* If appointments exist */}
            {selectedSlotModal.appts && selectedSlotModal.appts.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Appointments ({selectedSlotModal.appts.length})
                </div>
                {selectedSlotModal.appts.map((appt: any, idx: number) => {
                  const isConf = (appt.status || '').toLowerCase() === 'confirmed';
                  const isCanc = (appt.status || '').toLowerCase() === 'cancelled';
                  return (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                            <UserOutlined className="text-blue-500" />
                            {appt.patient_name || appt.patient_email}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                            <MailOutlined /> {appt.patient_email}
                          </div>
                        </div>
                        <Tag 
                          color={isConf ? 'green' : isCanc ? 'red' : 'gold'} 
                          className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 m-0"
                        >
                          {appt.status}
                        </Tag>
                      </div>

                      <Divider className="my-2" />

                      {/* Clean Notes / Reschedule Details */}
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1.5">Visit Information & Notes:</div>
                        <AppointmentNotesDisplay 
                          notes={appt.notes} 
                          status={appt.status} 
                          reason={appt.reason} 
                          consultationType={appt.consultation_type}
                          isDarkMode={isDarkMode} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : selectedSlotModal.type === 'available' ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                <CheckCircleOutlined className="text-2xl text-emerald-500" />
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Slot Available</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  This 1-hour slot is open and available in the doctor's weekly practice schedule.
                </div>
              </div>
            ) : selectedSlotModal.type === 'blocked' ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center space-y-1">
                <StopOutlined className="text-2xl text-rose-500" />
                <div className="text-sm font-bold text-rose-800 dark:text-rose-200">Slot Blocked</div>
                <div className="text-xs text-rose-600 dark:text-rose-400">
                  {selectedSlotModal.reason || 'Doctor is outstation or on leave during this time.'}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-500">
                Outside practicing hours.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
