import React from 'react';
import { Typography, Tag, Empty } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const { Text } = Typography;

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
  const hours = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00

  const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday
  const daySchedule = weeklySchedule.find(s => {
    if (s.day_of_week !== dayOfWeek) return false;
    if (s.effective_start_date && date.isBefore(dayjs(s.effective_start_date), 'day')) return false;
    if (s.effective_end_date && date.isSameOrAfter(dayjs(s.effective_end_date), 'day')) return false;
    return true;
  });

  // Compute Now and Next
  const now = dayjs();
  let allEvents: any[] = [];
  
  appointments.forEach(appt => {
    if (appt.appointment_date === date.format('YYYY-MM-DD') && appt.status !== 'CANCELLED') {
      allEvents.push({
        type: 'appointment',
        title: `Appt: ${appt.patient_name || appt.patient_email}`,
        start: dayjs(`${appt.appointment_date} ${appt.start_time}`),
        end: dayjs(`${appt.appointment_date} ${appt.end_time}`)
      });
    }
  });
  
  overrides.forEach(ovr => {
    if (ovr.date === date.format('YYYY-MM-DD')) {
      allEvents.push({
        type: 'override',
        title: ovr.reason || 'Blocked',
        start: dayjs(`${ovr.date} ${ovr.start_time}`),
        end: dayjs(`${ovr.date} ${ovr.end_time}`)
      });
    }
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
    const slotStart = dayjs(`${date.format('YYYY-MM-DD')} ${slotStartStr}`);
    const slotEnd = dayjs(`${date.format('YYYY-MM-DD')} ${slotEndStr}`);
    const now = dayjs();

    let isPast = false;
    if (slotEnd.isSameOrBefore(now)) {
      isPast = true;
    }

    // 1. Check Overrides (Blocked)
    for (const ovr of overrides) {
      if (ovr.date === date.format('YYYY-MM-DD')) {
        const ovrStart = dayjs(`${ovr.date} ${ovr.start_time}`);
        const ovrEnd = dayjs(`${ovr.date} ${ovr.end_time}`);
        if (slotStart.isBefore(ovrEnd) && slotEnd.isAfter(ovrStart)) {
          return { type: 'blocked', reason: ovr.reason || 'Blocked', isPast };
        }
      }
    }

    // 2. Check Appointments
    const slotAppts = appointments.filter(appt => {
      if (appt.appointment_date === date.format('YYYY-MM-DD') && appt.status !== 'CANCELLED') {
        const apptStart = dayjs(`${appt.appointment_date} ${appt.start_time}`);
        const apptEnd = dayjs(`${appt.appointment_date} ${appt.end_time}`);
        if (slotStart.isBefore(apptEnd) && slotEnd.isAfter(apptStart)) {
          return true;
        }
      }
      return false;
    });

    if (slotAppts.length > 0) {
      return { type: 'appointment', appts: slotAppts, isPast };
    }

    // 3. Check Working Hours
    if (!daySchedule) {
      return { type: 'unavailable', reason: 'Not Working', isPast };
    }

    const workStart = dayjs(`${date.format('YYYY-MM-DD')} ${daySchedule.start_time}`);
    const workEnd = dayjs(`${date.format('YYYY-MM-DD')} ${daySchedule.end_time}`);
    
    // If the slot is outside working hours
    if (slotStart.isSameOrBefore(workStart) && slotEnd.isSameOrBefore(workStart)) return { type: 'unavailable', reason: 'Outside Hours', isPast };
    if (slotStart.isSameOrAfter(workEnd)) return { type: 'unavailable', reason: 'Outside Hours', isPast };

    return { type: 'available', isPast };
  };

  return (
    <div className="w-full">
      <style>{SHINE_STYLE}</style>
      {/* Date header */}
      <div className={`px-4 py-3 rounded-xl border-l-4 mb-5 ${isDarkMode ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-500'}`}>
        <div className="flex items-center gap-2">
          <CalendarOutlined className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
          <Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {date.format('dddd, MMMM D, YYYY')}
          </Text>
        </div>
      </div>

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

      {/* Grab/Foodpanda-style vertical step tracker */}
      <div className="relative">
        {/* Vertical line */}
        <div className={`absolute left-5 top-0 bottom-0 w-0.5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} style={{ marginLeft: -1 }} />

        <div className="space-y-1">
          {hours.map((hour, idx) => {
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
                <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{status.reason}</span>
              );
            } else if (status.type === 'appointment') {
              dotColor = '#2563eb';
              dotBorder = '#bfdbfe';
              cardBg = isDarkMode ? 'rgba(37,99,235,0.12)' : '#eff6ff';
              cardBorder = isDarkMode ? '#1d4ed8' : '#bfdbfe';
              labelColor = '#2563eb';
              statusText = (
                <div>
                  {status.appts?.map((appt: any, i: number) => (
                    <div key={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#93c5fd' : '#1d4ed8' }}>
                        {appt.patient_name || appt.patient_email}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                        {appt.start_time}–{appt.end_time} • {appt.status}
                      </span>
                    </div>
                  ))}
                </div>
              );
            } else if (status.type === 'available') {
              dotColor = '#10b981';
              dotBorder = '#a7f3d0';
              labelColor = '#10b981';
              statusText = <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Available for Booking</span>;
            } else {
              statusText = <span style={{ fontSize: 12, color: isDarkMode ? '#475569' : '#94a3b8', fontStyle: 'italic' }}>Outside Working Hours</span>;
            }

            return (
              <div key={hour} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', paddingBottom: 4, opacity: status.isPast && !isNow ? 0.45 : 1 }}>
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
                  {/* Core dot — glow matches dot color via CSS vars */}
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
                    // Pass dot color to CSS keyframes via custom properties
                    ['--dot-c' as any]: dotColor,
                    ['--glow-a' as any]: hexToRgba(dotColor, 0.7),
                    ['--glow-b' as any]: hexToRgba(dotColor, 0.45),
                  }} />
                </div>

                {/* Card */}
                <div style={{
                  flex: 1,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: statusText ? 4 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: timeColor }}>{timeLabel}</span>
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
    </div>
  );
};
