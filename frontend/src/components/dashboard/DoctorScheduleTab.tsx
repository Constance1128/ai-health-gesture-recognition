import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Checkbox, TimePicker, Button, message, Form, Input, DatePicker, Empty, Tag, List, Space, Avatar, Segmented, Badge, Modal, Radio } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, CheckCircleOutlined, DeleteOutlined, CloseCircleOutlined, HistoryOutlined, StopOutlined, FilterOutlined, EyeOutlined, InfoCircleOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as doctorApi from '../../api/doctor.api';
import { DailyTimeline } from './DailyTimeline';
import { AppointmentNotesDisplay, ConsultationTypeTag } from '../../utils/appointmentFormatter';

const { Title, Text } = Typography;

const DAYS_OF_WEEK = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 }
];

interface DoctorScheduleTabProps {
  currentUser: any;
  isDarkMode: boolean;
  refreshDashboard?: () => void;
}

export const DoctorScheduleTab: React.FC<DoctorScheduleTabProps> = ({ currentUser, isDarkMode, refreshDashboard }) => {
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [filterBlockDate, setFilterBlockDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [overrideForm] = Form.useForm();
  const [isAllDayBlock, setIsAllDayBlock] = useState(true);

  const [apptCategory, setApptCategoryState] = useState<'upcoming' | 'history' | 'cancelled'>(() => {
    return (sessionStorage.getItem('doctor_schedule_category') as any) || 'upcoming';
  });

  const setApptCategory = (cat: 'upcoming' | 'history' | 'cancelled') => {
    sessionStorage.setItem('doctor_schedule_category', cat);
    setApptCategoryState(cat);
  };

  const [apptFilterDate, setApptFilterDate] = useState<dayjs.Dayjs | null>(null);
  const [seenApptCategories, setSeenApptCategories] = useState<Set<string>>(new Set(['upcoming']));

  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [decliningAppt, setDecliningAppt] = useState<any | null>(null);
  const [selectedDoctorApptModal, setSelectedDoctorApptModal] = useState<any | null>(null);
  const [declineReasonType, setDeclineReasonType] = useState<string>('Doctor unavailable / Urgent surgery');
  const [declineCustomReason, setDeclineCustomReason] = useState<string>('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  const handleApptCategoryChange = (cat: 'upcoming' | 'history' | 'cancelled') => {
    setApptCategory(cat);
    setSeenApptCategories(prev => {
      const next = new Set(prev);
      next.add(cat);
      return next;
    });
  };

  const handleOpenDeclineModal = (appt: any) => {
    setDecliningAppt(appt);
    setDeclineReasonType('Doctor unavailable / Urgent surgery');
    setDeclineCustomReason('');
    setIsDeclineModalOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!decliningAppt) return;
    const reason = declineReasonType === 'Others' ? declineCustomReason.trim() : declineReasonType;
    if (declineReasonType === 'Others' && !reason) {
      message.warning("Please specify your reason for declining.");
      return;
    }

    try {
      setDeclineSubmitting(true);
      await doctorApi.updateAppointmentStatus({
        email: currentUser.email,
        appointment_id: decliningAppt.id,
        status: 'cancelled',
        reason: reason
      });
      message.success("Appointment declined and patient has been notified.");
      setIsDeclineModalOpen(false);
      setDecliningAppt(null);
      fetchData();
      if (refreshDashboard) refreshDashboard();
    } catch (e: any) {
      message.error(e.message || "Failed to decline appointment");
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const schedData = await doctorApi.getDoctorSchedule(currentUser.email);
      setWeeklySchedule(schedData);

      const overridesData = await doctorApi.getScheduleOverrides(currentUser.email);
      setOverrides(overridesData);

      const apptsData = await doctorApi.getDoctorAppointments(currentUser.email);
      setAppointments(apptsData);
    } catch (e) {
      console.error(e);
      message.error("Failed to load schedule data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser.email]);

  const handleSaveWeeklySchedule = async () => {
    try {
      const activeSchedules = weeklySchedule.filter(s => !s.effective_end_date);
      await doctorApi.updateDoctorSchedule({ email: currentUser.email, schedules: activeSchedules });
      message.success('Weekly schedule updated!');
      fetchData();
      if (refreshDashboard) refreshDashboard();
    } catch (e) {
      message.error('Failed to update schedule');
    }
  };

  const getDisabledTime = () => {
    const dateStart = overrideForm.getFieldValue('dateStart');
    const isToday = !dateStart || dateStart.isSame(dayjs(), 'day');
    
    if (isToday) {
      return {
        disabledHours: () => Array.from({ length: dayjs().hour() }, (_, i) => i),
        disabledMinutes: (selectedHour: number) => {
          if (selectedHour === dayjs().hour()) {
            return Array.from({ length: dayjs().minute() }, (_, i) => i);
          }
          return [];
        }
      };
    }
    return {};
  };

  const handleAddOverride = async (values: any) => {
    try {
      if (!values.dateStart) {
        message.error("Please specify at least a start date.");
        return;
      }

      const dateStartStr = values.dateStart.format('YYYY-MM-DD');
      const dateEndStr = values.dateEnd ? values.dateEnd.format('YYYY-MM-DD') : dateStartStr;
      
      const isAllDay = isAllDayBlock || (!values.timeStart && !values.timeEnd);
      const timeStartStr = isAllDay ? '00:00' : (values.timeStart ? values.timeStart.format('HH:mm') : '00:00');
      const timeEndStr = isAllDay ? '23:59' : (values.timeEnd ? values.timeEnd.format('HH:mm') : '23:59');
      
      let current = dayjs(dateStartStr);
      const end = dayjs(dateEndStr);

      // Overlap check
      let hasOverlap = false;
      let checkCurrent = dayjs(dateStartStr);
      while (checkCurrent.isBefore(end) || checkCurrent.isSame(end, 'day')) {
        const dateStr = checkCurrent.format('YYYY-MM-DD');
        const dayOverrides = overrides.filter(o => o.date === dateStr);
        for (const o of dayOverrides) {
          if (timeStartStr < o.end_time && timeEndStr > o.start_time) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) break;
        checkCurrent = checkCurrent.add(1, 'day');
      }

      if (hasOverlap) {
        message.error("The selected time clashes with an existing blocked time.");
        return;
      }

      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const data = {
          email: currentUser.email,
          date: current.format('YYYY-MM-DD'),
          start_time: timeStartStr,
          end_time: timeEndStr,
          reason: values.reason || (isAllDay ? 'Outstation / Full Day Block' : 'Surgery / Blocked Slot')
        };
        await doctorApi.addScheduleOverride(data);
        current = current.add(1, 'day');
      }
      
      message.success("Blocked time added successfully");
      overrideForm.resetFields();
      setIsAllDayBlock(true);
      fetchData();
      if (refreshDashboard) refreshDashboard();
    } catch (e) {
      console.error(e);
      message.error("Failed to add blocked time");
    }
  };

  const handleDeleteOverride = async (id: number) => {
    try {
      await doctorApi.deleteScheduleOverride(currentUser.email, id);
      message.success("Blocked time removed");
      fetchData();
      if (refreshDashboard) refreshDashboard();
    } catch (e) {
      console.error(e);
      message.error("Failed to remove blocked time");
    }
  };

  const handleApptStatus = async (apptId: number, status: string) => {
    try {
      await doctorApi.updateAppointmentStatus({ email: currentUser.email, appointment_id: apptId, status });
      message.success(`Appointment status updated to ${status}`);
      fetchData();
      if (refreshDashboard) refreshDashboard();
    } catch (e) {
      message.error("Failed to update status");
    }
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className={`!m-0 ${isDarkMode ? 'text-white' : ''}`}>Schedule & Bookings</Title>
          <Text className="text-slate-500">Manage your weekly timetable, surgery blocks, and upcoming patient appointments.</Text>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Top: Timeline */}
        <Col span={24}>
          <Card 
            title={
              <div className="flex justify-between items-center">
                <span className={isDarkMode ? 'text-white' : ''}>Daily Agenda</span>
                <DatePicker 
                  value={selectedDate} 
                  onChange={(d) => setSelectedDate(d || dayjs())} 
                  allowClear={false}
                  className={`rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : ''}`}
                />
              </div>
            }
            className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <DailyTimeline 
              date={selectedDate} 
              appointments={appointments} 
              weeklySchedule={weeklySchedule} 
              overrides={overrides} 
              isDarkMode={isDarkMode} 
            />
          </Card>
        </Col>

        {/* Bottom Left: Timetable */}
        <Col xs={24} lg={12}>
            
            {/* Timetable */}
            <Card 
              title={
                <div className="flex items-center gap-2">
                  <ClockCircleOutlined className="text-emerald-500" />
                  <span>Weekly Timetable</span>
                </div>
              }
              className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              bodyStyle={{ padding: '24px' }}
            >
              {DAYS_OF_WEEK.map(day => {
                const activeSchedules = weeklySchedule.filter(s => !s.effective_end_date);
                const dayData = activeSchedules.find(s => s.day_of_week === day.value);
                const isActive = !!dayData;
                return (
                  <div key={day.value} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 border-b last:border-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <Checkbox 
                      checked={isActive}
                      onChange={(e) => {
                        if (e.target.checked) {
                           setWeeklySchedule([...weeklySchedule, { day_of_week: day.value, start_time: '09:00', end_time: '17:00' }]);
                        } else {
                           setWeeklySchedule(weeklySchedule.filter(s => s.day_of_week !== day.value));
                        }
                      }}
                      className="mb-2 sm:mb-0"
                    >
                      <span className={`font-semibold w-24 inline-block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{day.label}</span>
                    </Checkbox>
                    {isActive ? (
                      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 mt-2 sm:mt-0">
                        <Space size="small">
                          <TimePicker
                            format="HH:mm"
                            value={dayjs(dayData.start_time, 'HH:mm')}
                            onChange={(time) => {
                               if (!time) return;
                               setWeeklySchedule(weeklySchedule.map(s => s.day_of_week === day.value ? {
                                  ...s,
                                  start_time: time.format('HH:mm')
                               } : s));
                            }}
                            allowClear={false}
                            className={`rounded-lg w-24 ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`}
                            placeholder="Start"
                          />
                          <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>to</span>
                          <TimePicker
                            format="HH:mm"
                            value={dayjs(dayData.end_time, 'HH:mm')}
                            onChange={(time) => {
                               if (!time) return;
                               setWeeklySchedule(weeklySchedule.map(s => s.day_of_week === day.value ? {
                                  ...s,
                                  end_time: time.format('HH:mm')
                               } : s));
                            }}
                            allowClear={false}
                            className={`rounded-lg w-24 ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`}
                            placeholder="End"
                          />
                        </Space>
                        <Space size="small" className="w-full xl:w-auto">
                          <Button 
                            type="dashed" 
                            size="small"
                            className={isDarkMode ? 'text-slate-400 border-slate-700 hover:text-slate-300' : ''}
                            onClick={() => {
                               setWeeklySchedule(weeklySchedule.map(s => s.day_of_week === day.value ? {
                                  ...s,
                                  start_time: '09:00',
                                  end_time: '17:00'
                               } : s));
                            }}
                          >
                            Full Day
                          </Button>
                        </Space>
                      </div>
                    ) : (
                      <Tag color="default" className="mr-0 rounded-md border-0 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">Rest Day</Tag>
                    )}
                  </div>
                );
              })}
              <Button 
                type="primary" 
                className="mt-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 border-0" 
                size="large"
                block 
                onClick={handleSaveWeeklySchedule}
              >
                Save Weekly Schedule
              </Button>
            </Card>
        </Col>

        {/* Bottom Right: Overrides */}
        <Col xs={24} lg={12}>
            <Card 
              title={
                <div className="flex items-center gap-2">
                  <CalendarOutlined className="text-red-500" />
                  <span>Surgery / Outstation / Blocked Time</span>
                </div>
              }
              className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <Form form={overrideForm} layout="vertical" onFinish={handleAddOverride} initialValues={{ isAllDay: true }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Start Date" name="dateStart" rules={[{ required: true, message: 'Start date is required' }]}>
                      <DatePicker 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="End Date (Optional)" name="dateEnd">
                      <DatePicker 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                        placeholder="Same as start"
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <div className="mb-3 flex items-center gap-2">
                      <Checkbox 
                        checked={isAllDayBlock} 
                        onChange={(e) => setIsAllDayBlock(e.target.checked)}
                      >
                        <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          All-Day Block (Full Day - No specific time needed)
                        </span>
                      </Checkbox>
                    </div>
                  </Col>

                  {!isAllDayBlock && (
                    <>
                      <Col span={12}>
                        <Form.Item label="Start Time" name="timeStart">
                          <TimePicker 
                            format="HH:mm" 
                            className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                            disabledTime={getDisabledTime}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="End Time" name="timeEnd">
                          <TimePicker 
                            format="HH:mm" 
                            className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                            disabledTime={getDisabledTime}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  <Col span={24}>
                    <Form.Item label="Reason (e.g. Surgery, Outstation, Leave)" name="reason">
                      <Input placeholder="E.g. Outstation conference, Annual Leave, Surgery" className={`rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" className="rounded-lg bg-red-500 hover:bg-red-400 border-0 w-full mb-6">
                  {isAllDayBlock ? 'Block Date(s)' : 'Block Selected Time'}
                </Button>
              </Form>

              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Current Blocked Dates & Times</Text>
                  <DatePicker 
                    size="small"
                    placeholder="Filter Date"
                    value={filterBlockDate}
                    onChange={setFilterBlockDate}
                    className={`rounded-md w-32 ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`}
                    allowClear
                  />
                </div>
                {(() => {
                  const filteredOverrides = filterBlockDate 
                    ? overrides.filter(ovr => ovr.date === filterBlockDate.format('YYYY-MM-DD'))
                    : overrides;
                  
                  if (filteredOverrides.length === 0) {
                    return <Empty description="No blocked dates or times found." />;
                  }

                  return filteredOverrides.map(ovr => {
                    const isFullDay = (ovr.start_time === '00:00' && (ovr.end_time === '23:59' || ovr.end_time === '24:00'));
                    return (
                      <div key={ovr.id} className="flex justify-between items-center p-3 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50/50 dark:bg-red-900/20 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Typography.Text className="font-semibold text-slate-800 dark:text-slate-200">{ovr.date}</Typography.Text>
                            <Tag color="red" className="m-0 text-[10px] uppercase font-bold border-0">
                              {isFullDay ? 'All Day' : `${ovr.start_time} - ${ovr.end_time}`}
                            </Tag>
                          </div>
                          <Typography.Text className="text-xs text-slate-500 mt-0.5 block">{ovr.reason}</Typography.Text>
                        </div>
                        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleDeleteOverride(ovr.id)}>Remove</Button>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
        </Col>

        {/* Full Width: Patient Appointment Requests & Bookings with Categorized Tabs and Date Filter */}
        <Col span={24}>
          <Card
            title={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2">
                  <CalendarOutlined className="text-emerald-500" />
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Patient Appointment Requests & Bookings</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {apptFilterDate && (
                    <Button size="small" type="link" onClick={() => setApptFilterDate(null)} className="text-xs p-0">
                      Show All Dates
                    </Button>
                  )}
                  <DatePicker 
                    placeholder="Filter by Date"
                    value={apptFilterDate}
                    onChange={setApptFilterDate}
                    allowClear
                    className={`rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : ''}`}
                    cellRender={(current, info) => {
                      if (info.type !== 'date') return info.originNode;
                      const dateStr = dayjs(current).format('YYYY-MM-DD');
                      const dayAppts = appointments.filter(a => a.date === dateStr);
                      if (dayAppts.length > 0) {
                        const hasUpcoming = dayAppts.some(a => (a.status || '').toLowerCase() !== 'cancelled');
                        const dotBg = hasUpcoming ? 'bg-emerald-500' : 'bg-red-500';
                        return (
                          <div className="ant-picker-cell-inner relative flex flex-col items-center justify-center">
                            <span>{dayjs(current).date()}</span>
                            <span 
                              className={`w-1.5 h-1.5 rounded-full ${dotBg} absolute bottom-0.5`} 
                              title={`${dayAppts.length} appointment(s)`}
                            />
                          </div>
                        );
                      }
                      return info.originNode;
                    }}
                  />
                </div>
              </div>
            }
            className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            {(() => {
              const today = dayjs().startOf('day');
              const filterDateStr = apptFilterDate ? apptFilterDate.format('YYYY-MM-DD') : null;

              const allUpcomingAppts = appointments.filter(a => {
                const isCanc = (a.status || '').toLowerCase() === 'cancelled';
                const isPast = dayjs(a.date).startOf('day').isBefore(today);
                return !isCanc && !isPast;
              });

              const allHistoryAppts = appointments.filter(a => {
                const isCanc = (a.status || '').toLowerCase() === 'cancelled';
                const isPast = dayjs(a.date).startOf('day').isBefore(today);
                return !isCanc && isPast;
              });

              const allCancelledAppts = appointments.filter(a => (a.status || '').toLowerCase() === 'cancelled');

              const upcomingAppts = filterDateStr ? allUpcomingAppts.filter(a => a.date === filterDateStr) : allUpcomingAppts;
              const historyAppts = filterDateStr ? allHistoryAppts.filter(a => a.date === filterDateStr) : allHistoryAppts;
              const cancelledAppts = filterDateStr ? allCancelledAppts.filter(a => a.date === filterDateStr) : allCancelledAppts;

              const filteredList = apptCategory === 'upcoming' ? upcomingAppts : apptCategory === 'history' ? historyAppts : cancelledAppts;

              return (
                <div>
                  {/* Category Switcher Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b pb-4 dark:border-slate-800">
                    <Segmented
                      value={apptCategory}
                      onChange={(val) => setApptCategory(val as any)}
                      options={[
                        {
                          label: (
                            <div className="px-3 py-1 flex items-center gap-1.5">
                              <CalendarOutlined />
                              <span>Upcoming</span>
                            </div>
                          ),
                          value: 'upcoming'
                        },
                        {
                          label: (
                            <div className="px-3 py-1 flex items-center gap-1.5">
                              <HistoryOutlined />
                              <span>History</span>
                            </div>
                          ),
                          value: 'history'
                        },
                        {
                          label: (
                            <div className="px-3 py-1 flex items-center gap-1.5">
                              <StopOutlined />
                              <span>Cancelled</span>
                            </div>
                          ),
                          value: 'cancelled'
                        }
                      ]}
                      className="p-1"
                    />

                    {apptFilterDate && (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FilterOutlined />
                        <span>Showing <strong>{filteredList.length}</strong> {apptCategory} on {apptFilterDate.format('YYYY-MM-DD')}</span>
                      </div>
                    )}
                  </div>

                  {filteredList.length === 0 ? (
                    <Empty 
                      description={
                        apptFilterDate 
                          ? `No ${apptCategory} appointments on ${apptFilterDate.format('YYYY-MM-DD')}.`
                          : `No ${apptCategory} appointments found.`
                      } 
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredList.map((appt: any) => {
                        const initials = (appt.patient_name || appt.patient_email || 'P').slice(0, 2).toUpperCase();
                        const isPending = (appt.status || '').toLowerCase() === 'pending';
                        const isConfirmed = (appt.status || '').toLowerCase() === 'confirmed';
                        const isCancelled = (appt.status || '').toLowerCase() === 'cancelled';

                        return (
                          <div
                            key={appt.id}
                            onClick={() => setSelectedDoctorApptModal(appt)}
                            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all cursor-pointer duration-150 hover:shadow-md hover:border-blue-400 active:scale-[0.99] ${
                              isDarkMode ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-blue-50/20 shadow-xs'
                            }`}
                          >
                            {/* Left Side: Avatar + Details */}
                            <div className="flex items-start gap-3.5 flex-1 min-w-0">
                              <Avatar 
                                size={44}
                                className={`font-bold flex-shrink-0 ${
                                  isCancelled ? 'bg-red-500 text-white' : isConfirmed ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                }`}
                              >
                                {initials}
                              </Avatar>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Text className={`font-bold text-base ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                    {appt.patient_name || appt.patient_email}
                                  </Text>
                                  <Tag color="blue" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold">
                                    <CalendarOutlined className="mr-1" /> {appt.date}
                                  </Tag>
                                  <Tag color="cyan" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold">
                                    <ClockCircleOutlined className="mr-1" /> {appt.time}
                                  </Tag>
                                  <ConsultationTypeTag type={appt.consultation_type} />
                                </div>

                                <Text className="text-xs text-slate-400 block truncate">
                                  Patient Contact: {appt.patient_email}
                                </Text>

                                <AppointmentNotesDisplay 
                                  notes={appt.notes} 
                                  status={appt.status} 
                                  reason={appt.reason} 
                                  consultationType={appt.consultation_type}
                                  doctorNotes={currentUser?.consultation_hours}
                                  clinicName={currentUser?.clinic_name}
                                  isDarkMode={isDarkMode} 
                                  compact={true}
                                  className="mt-1"
                                />

                                <div className="text-[10px] text-blue-500/80 hover:text-blue-500 font-medium flex items-center gap-1 pt-1">
                                  <EyeOutlined /> Click card for patient details & meeting link
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Actions & Status */}
                            <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                              {isPending && (
                                <>
                                  <Button 
                                    type="primary" 
                                    icon={<CheckCircleOutlined />}
                                    className="bg-emerald-600 hover:bg-emerald-500 border-0 rounded-lg px-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApptStatus(appt.id, 'confirmed');
                                    }}
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    danger 
                                    icon={<CloseCircleOutlined />}
                                    className="rounded-lg px-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeclineModal(appt);
                                    }}
                                  >
                                    Decline
                                  </Button>
                                </>
                              )}

                              {isConfirmed && (
                                <div className="flex items-center gap-2">
                                  <Tag color="green" className="text-xs font-bold px-3 py-1 rounded-full border-0 uppercase">
                                    CONFIRMED
                                  </Tag>
                                  <Button 
                                    size="small" 
                                    danger 
                                    type="text"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeclineModal(appt);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}

                              {isCancelled && (
                                <Tag color="red" className="text-xs font-bold px-3 py-1 rounded-full border-0 uppercase">
                                  CANCELLED
                                </Tag>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* Doctor Decline / Cancel Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600 font-semibold">
            <CloseCircleOutlined />
            <span>Decline / Cancel Appointment</span>
          </div>
        }
        open={isDeclineModalOpen}
        onCancel={() => {
          if (!declineSubmitting) {
            setIsDeclineModalOpen(false);
            setDecliningAppt(null);
          }
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setIsDeclineModalOpen(false);
              setDecliningAppt(null);
            }}
            disabled={declineSubmitting}
          >
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            danger 
            loading={declineSubmitting}
            onClick={handleConfirmDecline}
          >
            Confirm Decline
          </Button>
        ]}
        destroyOnClose
      >
        {decliningAppt && (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs space-y-1 border dark:border-slate-700">
              <div><strong>Patient:</strong> {decliningAppt.patient_name || decliningAppt.patient_email}</div>
              <div><strong>Appointment:</strong> {decliningAppt.date} at {decliningAppt.time}</div>
              {decliningAppt.notes && <div><strong>Patient Note:</strong> "{decliningAppt.notes}"</div>}
            </div>

            <div>
              <Text className="font-semibold text-xs text-slate-700 dark:text-slate-300 block mb-2">
                Select reason for declining (tick one):
              </Text>
              <Radio.Group 
                value={declineReasonType} 
                onChange={(e) => setDeclineReasonType(e.target.value)}
                className="flex flex-col gap-2.5 w-full"
              >
                <Radio value="Doctor unavailable / Urgent surgery">Doctor unavailable / Urgent surgery</Radio>
                <Radio value="Emergency hospital commitments">Emergency hospital commitments</Radio>
                <Radio value="Outstation / Medical conference">Outstation / Medical conference</Radio>
                <Radio value="Clinic closed / Non-operating hours">Clinic closed / Non-operating hours</Radio>
                <Radio value="Schedule conflict / Overbooked">Schedule conflict / Overbooked</Radio>
                <Radio value="Others">Others (Please specify)</Radio>
              </Radio.Group>
            </div>

            {declineReasonType === 'Others' && (
              <div className="space-y-1">
                <Text className="text-xs text-slate-500 block">Specific reason for patient:</Text>
                <Input.TextArea 
                  rows={2} 
                  placeholder="Type reason here..." 
                  value={declineCustomReason}
                  onChange={(e) => setDeclineCustomReason(e.target.value)}
                  allowClear
                />
              </div>
            )}

            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              Note: The patient will receive a notification with this reason and can submit a new booking request.
            </div>
          </div>
        )}
      </Modal>

      {/* Pop-up Modal for Doctor Appointment Details */}
      <Modal
        open={!!selectedDoctorApptModal}
        onCancel={() => setSelectedDoctorApptModal(null)}
        footer={[
          selectedDoctorApptModal && (selectedDoctorApptModal.status?.toLowerCase() === 'pending') ? (
            <Button 
              key="approve" 
              type="primary" 
              className="bg-emerald-600 hover:bg-emerald-500 border-0 rounded-lg"
              onClick={() => {
                const id = selectedDoctorApptModal.id;
                setSelectedDoctorApptModal(null);
                handleApptStatus(id, 'confirmed');
              }}
            >
              Approve Appointment
            </Button>
          ) : null,
          selectedDoctorApptModal && (selectedDoctorApptModal.status?.toLowerCase() === 'pending' || selectedDoctorApptModal.status?.toLowerCase() === 'confirmed') ? (
            <Button 
              key="decline" 
              danger 
              className="rounded-lg"
              onClick={() => {
                const appt = selectedDoctorApptModal;
                setSelectedDoctorApptModal(null);
                handleOpenDeclineModal(appt);
              }}
            >
              {selectedDoctorApptModal.status?.toLowerCase() === 'confirmed' ? 'Cancel Booking' : 'Decline Booking'}
            </Button>
          ) : null,
          <Button key="close" onClick={() => setSelectedDoctorApptModal(null)} className="rounded-lg">
            Close
          </Button>
        ].filter(Boolean)}
        title={
          <div className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-500" />
            <span>Appointment Details</span>
          </div>
        }
        destroyOnClose
        centered
        width={580}
      >
        {selectedDoctorApptModal && (
          <div className="space-y-4 py-2">
            {/* Patient Header */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-xs text-slate-400 font-medium">Patient Information</div>
                <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5 flex items-center gap-2">
                  <UserOutlined className="text-blue-500" />
                  {selectedDoctorApptModal.patient_name || selectedDoctorApptModal.patient_email}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MailOutlined /> {selectedDoctorApptModal.patient_email}
                </div>
              </div>
              <div className="text-right">
                <Tag 
                  color={
                    selectedDoctorApptModal.status === 'confirmed' ? 'green' : 
                    selectedDoctorApptModal.status === 'cancelled' ? 'red' : 'gold'
                  } 
                  className="font-bold text-xs uppercase px-3 py-1 rounded-full border-0 m-0"
                >
                  {selectedDoctorApptModal.status}
                </Tag>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <CalendarOutlined className="text-blue-500" /> Appointment Date
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                  {selectedDoctorApptModal.date}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <ClockCircleOutlined className="text-cyan-500" /> Scheduled Time
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                  {selectedDoctorApptModal.time}
                </div>
              </div>
            </div>

            {/* Full Formatted Notes, Reschedule info, Cancelled by who, and Zoom Link */}
            <AppointmentNotesDisplay 
              notes={selectedDoctorApptModal.notes} 
              status={selectedDoctorApptModal.status} 
              reason={selectedDoctorApptModal.reason} 
              consultationType={selectedDoctorApptModal.consultation_type}
              doctorNotes={currentUser?.consultation_hours}
              clinicName={currentUser?.clinic_name}
              isDarkMode={isDarkMode} 
              compact={false}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

