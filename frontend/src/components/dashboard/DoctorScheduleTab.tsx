import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Checkbox, TimePicker, Button, message, Form, Input, DatePicker, Empty, Tag, List, Space } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as doctorApi from '../../api/doctor.api';
import { DailyTimeline } from './DailyTimeline';

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
      await doctorApi.updateDoctorSchedule({ email: currentUser.email, schedules: weeklySchedule });
      message.success('Weekly schedule updated!');
      fetchData();
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
      if (!values.dateStart || !values.timeStart || !values.timeEnd) {
        message.error("Please specify date and time completely.");
        return;
      }

      const dateStartStr = values.dateStart.format('YYYY-MM-DD');
      const dateEndStr = values.dateEnd ? values.dateEnd.format('YYYY-MM-DD') : dateStartStr;
      const timeStartStr = values.timeStart.format('HH:mm');
      const timeEndStr = values.timeEnd.format('HH:mm');
      
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
          reason: values.reason || 'Surgery/Break'
        };
        await doctorApi.addScheduleOverride(data);
        current = current.add(1, 'day');
      }
      
      message.success("Blocked time added successfully");
      overrideForm.resetFields();
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
      await doctorApi.updateAppointmentStatus({ appointment_id: apptId, status });
      message.success(`Appointment ${status}`);
      fetchData();
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
                const dayData = weeklySchedule.find(s => s.day_of_week === day.value);
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
                  <span>Surgery / Blocked Time</span>
                </div>
              }
              className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <Form form={overrideForm} layout="vertical" onFinish={handleAddOverride}>
                <Row gutter={16}>
                  <Col span={12} xl={6}>
                    <Form.Item label="Start Date" name="dateStart">
                      <DatePicker 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12} xl={6}>
                    <Form.Item label="End Date" name="dateEnd">
                      <DatePicker 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12} xl={6}>
                    <Form.Item label="Start Time" name="timeStart">
                      <TimePicker 
                        format="HH:mm" 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledTime={getDisabledTime}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12} xl={6}>
                    <Form.Item label="End Time" name="timeEnd">
                      <TimePicker 
                        format="HH:mm" 
                        className={`w-full rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} 
                        disabledTime={getDisabledTime}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24} xl={24}>
                    <Form.Item label="Reason" name="reason">
                      <Input placeholder="E.g. Surgery" className={`rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : ''}`} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" className="rounded-lg bg-red-500 hover:bg-red-400 border-0 w-full mb-6">Block Time</Button>
              </Form>

              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Current Blocked Times</Text>
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
                    return <Empty description="No blocked times found." />;
                  }

                  return filteredOverrides.map(ovr => (
                    <div key={ovr.id} className="flex justify-between items-center p-3 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50/50 dark:bg-red-900/20 mb-2">
                      <div>
                        <Typography.Text className="font-semibold text-slate-800 dark:text-slate-200">{ovr.date}</Typography.Text>
                        <br />
                        <Typography.Text className="text-xs text-slate-500">{ovr.start_time} - {ovr.end_time} ({ovr.reason})</Typography.Text>
                      </div>
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleDeleteOverride(ovr.id)}>Remove</Button>
                    </div>
                  ));
                })()}
              </div>
            </Card>
        </Col>
      </Row>
    </div>
  );
};
