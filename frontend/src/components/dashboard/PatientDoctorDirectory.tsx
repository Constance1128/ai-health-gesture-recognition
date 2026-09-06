import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, List, Avatar, Typography, Input, Button, Switch, message, Upload, Spin, Tag, Badge, Divider, Tabs, Form, DatePicker, TimePicker, Modal, Space, Empty, Popover, Image, Timeline } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined, UserOutlined, SearchOutlined, CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, SmileOutlined, CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Doctor, Message, User, Appointment } from '../../types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import * as patientApi from '../../api/patient.api';
import * as chatApi from '../../api/chat.api';
import * as doctorApi from '../../api/doctor.api';
import * as sharedApi from '../../api/shared.api';

const { Title, Text } = Typography;

interface PatientDoctorDirectoryProps {
  currentUser: User;
  isDarkMode: boolean;
}

export const PatientDoctorDirectory: React.FC<PatientDoctorDirectoryProps> = ({ currentUser, isDarkMode }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<number | null>(null);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [bookingForm] = Form.useForm();
  
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [overrides, setOverrides] = useState<any[]>([]);
  const [doctorSchedule, setDoctorSchedule] = useState<any[]>([]);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const data = await patientApi.getDoctorsDirectory(currentUser.email);
      setDoctors(data);
    } catch (err) {
      console.error("Failed to load doctors", err);
      message.error("Failed to fetch doctors");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const counts = await chatApi.getUnreadCounts(currentUser.email);
      setUnreadCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchUnreadCounts();
    const interval = setInterval(() => {
      fetchDoctors();
      fetchUnreadCounts();
    }, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [currentUser.email]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  const fetchChat = async (doctorId: number, shouldScroll = false) => {
    try {
      setChatLoading(true);
      const data = await chatApi.getChatHistory(currentUser.email, doctorId);
      
      setFirstUnreadMessageId(prev => {
        if (prev === null) {
          const unreadMsg = data.find(m => m.sender_id !== currentUser.id && m.is_read === 0);
          return unreadMsg ? unreadMsg.id : null;
        }
        return prev;
      });

      setChatHistory(data);
      if (shouldScroll) {
        scrollToBottom();
      }
      
      // Mark messages as read
      await chatApi.markMessagesRead({ email: currentUser.email, sender_id: doctorId });
    } catch (e) {
      console.error(e);
      message.error("Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) {
      setFirstUnreadMessageId(null);
      fetchChat(selectedDoctor.id, true);
      fetchDoctorData();
      const interval = setInterval(() => fetchChat(selectedDoctor.id, false), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedDoctor, currentUser.email]);

  const fetchDoctorData = async () => {
    if (!selectedDoctor) return;
    try {
      const notificationsData = await sharedApi.getNotifications(currentUser.email);
      setNotifications(notificationsData);

      const overridesData = await doctorApi.getScheduleOverrides(selectedDoctor.email || '');
      setOverrides(overridesData);

      if (selectedDoctor.email) {
         const schedData = await doctorApi.getDoctorSchedule(selectedDoctor.email);
         setDoctorSchedule(schedData);
      }

      const appointmentsData = await patientApi.getPatientAppointments(currentUser.email);
      setAppointments(appointmentsData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookAppointment = async (values: any) => {
    if (!selectedDoctor || !selectedDate || !selectedTimeSlot) {
      message.warning("Please select a date and time slot");
      return;
    }
    try {
      await patientApi.bookAppointment({
        patient_email: currentUser.email,
        doctor_id: selectedDoctor.id,
        date: selectedDate.format('YYYY-MM-DD'),
        time: selectedTimeSlot,
        notes: values.notes || ''
      });
      message.success("Appointment request sent successfully!");
      bookingForm.resetFields();
      setSelectedTimeSlot('');
      setSelectedDate(null);
      setActiveTab('overview');
      fetchDoctorData();
    } catch (e: any) {
      message.error(e.message || "Failed to book appointment");
    }
  };

  const handleReschedule = async (apptId: number, currentDateStr: string) => {
    const daysDiff = dayjs(currentDateStr).diff(dayjs(), 'day');
    if (daysDiff < 3) {
      message.error("You can only reschedule appointments at least 3 days in advance. Otherwise, it will be cancelled.");
      return;
    }
    message.info("Please cancel this appointment and book a new one.");
  };

  const generateTimelineEvents = () => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const events: any[] = [];
    
    // 1. Add Overrides (Surgery/Break)
    overrides.filter(o => o.date === dateStr).forEach(o => {
        events.push({
            type: 'override',
            time: o.start_time,
            endTime: o.end_time,
            title: o.type === 'surgery' ? 'Surgery / Procedure' : 'Doctor Break',
            reason: o.reason,
            timestamp: new Date(`${dateStr}T${o.start_time}:00`).getTime(),
            color: 'red'
        });
    });

    // 2. Add Standard Slots based on Weekly Schedule
    const dayOfWeek = selectedDate.day();
    const scheduleForDay = doctorSchedule.find(s => {
      if (s.day_of_week !== dayOfWeek) return false;
      if (s.effective_start_date && selectedDate.isBefore(dayjs(s.effective_start_date), 'day')) return false;
      if (s.effective_end_date && selectedDate.isSameOrAfter(dayjs(s.effective_end_date), 'day')) return false;
      return true;
    });
    
    let standardSlots: string[] = [];
    if (doctorSchedule.length === 0) {
      // Fallback for doctors without a custom schedule
      standardSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    } else if (scheduleForDay) {
      let currentSlot = dayjs(`${dateStr}T${scheduleForDay.start_time}:00`);
      const endTime = dayjs(`${dateStr}T${scheduleForDay.end_time}:00`);
      
      while (currentSlot.isBefore(endTime) && currentSlot.add(1, 'hour').valueOf() <= endTime.valueOf()) {
          standardSlots.push(currentSlot.format('HH:mm'));
          currentSlot = currentSlot.add(1, 'hour');
      }
    }

    // Remove slots that have already passed
    const nowMs = Date.now();
    standardSlots = standardSlots.filter(slot => {
       const slotStartMs = new Date(`${dateStr}T${slot}:00`).getTime();
       return slotStartMs > nowMs;
    });

    standardSlots.forEach(slot => {
      const slotStartMs = new Date(`${dateStr}T${slot}:00`).getTime();
      const slotEndMs = slotStartMs + (60 * 60 * 1000);
      
      const isBooked = appointments.some(a => a.doctor_id === selectedDoctor?.id && a.date === dateStr && a.time === slot && a.status !== 'cancelled');
      
      const blockingOverride = overrides.find(o => {
        if (o.date !== dateStr) return false;
        const surgeryStartMs = new Date(`${dateStr}T${o.start_time}`).getTime();
        const surgeryEndMs = new Date(`${dateStr}T${o.end_time}`).getTime() + (30 * 60 * 1000);
        return slotStartMs < surgeryEndMs && slotEndMs > surgeryStartMs;
      });

      if (isBooked) {
          events.push({
            type: 'booked',
            time: slot,
            endTime: dayjs(`${dateStr}T${slot}:00`).add(1, 'hour').format('HH:mm'),
            title: 'Slot Booked',
            timestamp: slotStartMs,
            color: 'gray'
          });
      } else if (!blockingOverride) {
          events.push({
            type: 'available',
            time: slot,
            endTime: dayjs(`${dateStr}T${slot}:00`).add(1, 'hour').format('HH:mm'),
            title: 'Available for Booking',
            timestamp: slotStartMs,
            color: 'green'
          });
      }
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  };

  const handleTogglePermission = async (doctorId: number, checked: boolean) => {
    try {
      await patientApi.toggleDoctorPermission({ email: currentUser.email, doctor_id: doctorId, grant: checked });
      message.success(checked ? "Permission granted" : "Permission revoked");
      setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, has_permission: checked } : d));
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to update permission");
    }
  };

  const handleSendMessage = async (file?: File) => {
    if (!selectedDoctor) return;
    if (!messageInput.trim() && !file) return;

    if (file && file.size > 5 * 1024 * 1024) {
      message.error("File size exceeds the 5MB limit. Please upload a smaller file.");
      return;
    }

    const formData = new FormData();
    formData.append('email', currentUser.email);
    formData.append('receiver_id', selectedDoctor.id.toString());
    if (messageInput.trim()) formData.append('content', messageInput.trim());
    if (file) formData.append('file', file);

    try {
      await chatApi.sendMessage(formData);
      setMessageInput('');
      fetchChat(selectedDoctor.id, true);
      scrollToBottom();
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to send message");
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      await chatApi.deleteMessage({ message_id: msgId, sender_email: currentUser.email });
      setChatHistory(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: 1, content: null, file_name: null } : m));
      message.success("Message deleted");
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to delete message");
    }
  };

  return (
    <Row gutter={[24, 24]} className="h-full">
      {/* Directory Column */}
      <Col xs={24} md={8} className="h-full flex flex-col">
        <Card 
          title="Doctor Directory"
          className={`h-full flex-1 flex flex-col border border-slate-100 shadow-sm rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
          bodyStyle={{ padding: 0, overflowY: 'auto', flex: 1 }}
        >
          {loading ? (
            <div className="flex justify-center p-8"><Spin /></div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={doctors}
              renderItem={doctor => {
                const unread = unreadCounts[doctor.id] || 0;
                return (
                  <List.Item
                    className={`cursor-pointer transition-colors border-b ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'} ${selectedDoctor?.id === doctor.id ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                    style={{ padding: '16px 24px' }}
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <List.Item.Meta
                      className="items-center"
                      avatar={
                        <Badge dot color={doctor.is_online ? 'green' : 'gray'} offset={[-4, 34]}>
                          <Avatar size={40} src={`http://localhost:8000/api/profile/picture/${doctor.id}`} className="bg-blue-100 text-blue-600 font-bold text-base">
                            {doctor.name ? doctor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'DR'}
                          </Avatar>
                        </Badge>
                      }
                      title={<span className={`font-bold text-base block mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{doctor.name}</span>}
                      description={
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{doctor.specialization || 'General Practitioner'}</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <InfoCircleOutlined className="text-slate-400" />
                            <span className="truncate max-w-[160px]">{doctor.bio || 'Medical Consultant'}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <ClockCircleOutlined className="text-slate-400" />
                            <span className="truncate max-w-[160px]">{doctor.consultation_hours || 'Consultation hours not set'}</span>
                          </span>
                        </div>
                      }
                    />
                    {unread > 0 && (
                      <Badge count={unread} />
                    )}
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </Col>
      
      {/* Chat Column */}
      <Col xs={24} md={16} className="h-full flex flex-col">
        <Card 
          className={`h-full flex-1 flex flex-col border border-slate-100 shadow-sm rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
          bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          {selectedDoctor ? (
            <>
              {/* Detail Header */}
              <div className={`px-4 py-3 flex items-start gap-3 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                <Badge dot color={selectedDoctor.is_online ? 'green' : 'gray'} offset={[-4, 30]}>
                  <Avatar size={36} src={`http://localhost:8000/api/profile/picture/${selectedDoctor.id}`} className="bg-blue-100 text-blue-600 font-bold text-sm mt-0.5">
                    {selectedDoctor.name ? selectedDoctor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'DR'}
                  </Avatar>
                </Badge>
                <div className="flex-1 min-w-0 flex flex-col justify-start">
                  <Text className={`font-bold text-sm block leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedDoctor.name}</Text>
                  <Text className="text-[11px] text-slate-500 leading-tight mt-0.5">{selectedDoctor.specialization || 'General Practitioner'}</Text>
                </div>
              </div>
              
              <Tabs 
                activeKey={activeTab} 
                onChange={(key) => {
                  setActiveTab(key);
                  if (key === 'chat') {
                    scrollToBottom();
                  }
                }} 
                className="px-4 border-b border-slate-100 dark:border-slate-800"
              >
                <Tabs.TabPane tab="Overview" key="overview" />
                <Tabs.TabPane tab="Book Appointment" key="book" />
                <Tabs.TabPane 
                  tab={
                    <Badge count={unreadCounts[selectedDoctor.id] || 0} offset={[10, 0]} size="small">
                      <span className="mr-2">Consultation Chat</span>
                    </Badge>
                  } 
                  key="chat" 
                />
              </Tabs>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col">
                {activeTab === 'overview' && (
                  <div className="p-6 max-w-3xl space-y-6">
                    <div>
                      <Title level={5} className="!mb-4 text-slate-500">About Doctor</Title>
                      <Text className="text-slate-600 dark:text-slate-300 leading-relaxed block mb-4">
                        {selectedDoctor.bio || 'No description provided by the doctor yet.'}
                      </Text>
                      <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <Text className="text-xs text-slate-400 block mb-1">Clinic</Text>
                          <Text className="font-medium">{selectedDoctor.clinic_name || 'Not assigned'}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-slate-400 block mb-1">Consultation Notes (e.g. Links)</Text>
                          <Text className="font-medium whitespace-pre-wrap">{selectedDoctor.consultation_hours || 'Not set'}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-slate-400 block mb-2">Weekly Timetable</Text>
                          {doctorSchedule.length === 0 ? (
                            <Text className="text-sm font-medium text-slate-500 italic">Not configured</Text>
                          ) : (
                            <div className="space-y-1">
                              {[...doctorSchedule]
                                .filter(s => !s.effective_end_date)
                                .sort((a, b) => a.day_of_week - b.day_of_week)
                                .map(s => (
                                <div key={s.day_of_week} className="flex justify-between text-sm border-b border-slate-50 dark:border-slate-800 pb-1">
                                  <span className="font-medium text-slate-600 dark:text-slate-300">
                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.day_of_week]}
                                  </span>
                                  <span className="text-slate-500">{s.start_time} - {s.end_time}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Divider />
                    
                    <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                      <div>
                        <Title level={5} className="!m-0 text-blue-800 dark:text-blue-300">Share Health Records</Title>
                        <Text className="text-xs text-blue-600 dark:text-blue-400">
                          Grant this doctor permission to view your clinical diagnostics and screening history.
                        </Text>
                      </div>
                      <Switch 
                        checked={selectedDoctor.has_permission} 
                        onChange={(checked) => handleTogglePermission(selectedDoctor.id, checked)}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'book' && (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="Request Appointment" size="small" className="shadow-sm">
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <Text className="text-xs text-blue-600 dark:text-blue-400 font-semibold block mb-1"><ClockCircleOutlined /> Doctor's Timetable</Text>
                        <Text className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{selectedDoctor.consultation_hours || 'Not set'}</Text>
                      </div>
                      <Form form={bookingForm} layout="vertical" onFinish={handleBookAppointment}>
                        <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                          <DatePicker 
                            className="w-full" 
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                            onChange={(date) => { setSelectedDate(date); setSelectedTimeSlot(''); }}
                          />
                        </Form.Item>
                        {selectedDate && (
                          <div className="mb-4">
                            <Text className="block mb-4 font-semibold text-slate-600">Daily Schedule Timeline</Text>
                            <div className="max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                              <Timeline 
                                items={generateTimelineEvents().map(ev => ({
                                  color: ev.color,
                                  children: (
                                    <div className={`p-3 rounded-lg border flex justify-between items-center transition-all ${
                                      selectedTimeSlot === ev.time ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'
                                    }`}>
                                      <div>
                                        <Text className="font-semibold block">{ev.time} - {ev.endTime}</Text>
                                        <Text className={`text-xs ${ev.color === 'red' ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                          {ev.title} {ev.reason && `(${ev.reason})`}
                                        </Text>
                                      </div>
                                      {ev.type === 'available' && (
                                        <Button 
                                          type={selectedTimeSlot === ev.time ? 'primary' : 'default'} 
                                          size="small"
                                          onClick={() => setSelectedTimeSlot(ev.time)}
                                        >
                                          {selectedTimeSlot === ev.time ? 'Selected' : 'Select'}
                                        </Button>
                                      )}
                                      {ev.type === 'override' && (
                                        <Tag color="red" className="m-0 border-0">Blocked</Tag>
                                      )}
                                      {ev.type === 'booked' && (
                                        <Tag color="default" className="m-0 border-0">Unavailable</Tag>
                                      )}
                                    </div>
                                  )
                                }))}
                              />
                            </div>
                            {generateTimelineEvents().length === 0 && (
                              <Empty description="No schedule available for this date" />
                            )}
                          </div>
                        )}
                        <Form.Item label="Notes / Reason for visit" name="notes">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block disabled={!selectedTimeSlot}>Request Booking</Button>
                      </Form>
                    </Card>
                    
                    <div>
                      <Title level={5} className="!mb-4 text-slate-500">Your Appointments with {selectedDoctor.name}</Title>
                      {appointments.filter(a => a.doctor_id === selectedDoctor.id).length === 0 ? (
                        <Text className="text-slate-400">No appointments found.</Text>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {appointments.filter(a => a.doctor_id === selectedDoctor.id).map(appt => (
                            <Card key={appt.id} size="small" className="border-slate-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <Text className="font-semibold block"><CalendarOutlined /> {appt.date}</Text>
                                  <Text className="text-xs text-slate-500"><ClockCircleOutlined /> {appt.time}</Text>
                                </div>
                                <div className="text-right">
                                  <Tag color={appt.status === 'confirmed' ? 'green' : appt.status === 'cancelled' ? 'red' : 'default'} className="block mb-2">
                                    {appt.status.toUpperCase()}
                                  </Tag>
                                  {appt.status !== 'cancelled' && (
                                    <Button size="small" onClick={() => handleReschedule(appt.id, appt.date)}>
                                      Reschedule
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'chat' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatLoading && chatHistory.length === 0 ? (
                  <div className="flex justify-center"><Spin /></div>
                ) : chatHistory.length === 0 ? (
                  <div className="text-center text-slate-400 mt-10">No messages yet. Send a message to start consulting.</div>
                ) : (
                  chatHistory.map((msg, index) => {
                    const isMe = msg.sender_id === currentUser.id;
                    const msgDate = dayjs(msg.timestamp * 1000).startOf('day');
                    const prevMsgDate = index > 0 ? dayjs(chatHistory[index - 1].timestamp * 1000).startOf('day') : null;
                    const showDateDivider = !prevMsgDate || !msgDate.isSame(prevMsgDate, 'day');

                    let dateLabel = msgDate.format('MMMM D, YYYY');
                    if (msgDate.isSame(dayjs().startOf('day'), 'day')) {
                        dateLabel = 'Today';
                    } else if (msgDate.isSame(dayjs().subtract(1, 'day').startOf('day'), 'day')) {
                        dateLabel = 'Yesterday';
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-4">
                            <div className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                              {dateLabel}
                            </div>
                          </div>
                        )}
                        {firstUnreadMessageId === msg.id && (
                          <div className="flex items-center my-4">
                            <div className="flex-1 border-t border-dashed border-red-400"></div>
                            <div className="mx-4 text-xs font-bold text-red-500 uppercase tracking-widest">Unread Messages</div>
                            <div className="flex-1 border-t border-dashed border-red-400"></div>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl p-3 relative group ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : (isDarkMode ? 'bg-slate-800 text-white rounded-tl-none' : 'bg-white border text-slate-800 rounded-tl-none')}`}>
                            {msg.is_deleted ? (
                            <Text className="italic text-slate-300">This message was deleted</Text>
                          ) : (
                            <>
                              {msg.content && <div>{msg.content}</div>}
                              {msg.file_name && (
                                <div className="mt-2">
                                  {msg.file_type?.startsWith('image/') ? (
                                    <Image src={`http://localhost:8000/api/chat/file/${msg.id}`} alt="attachment" className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                                  ) : msg.file_type?.startsWith('video/') ? (
                                    <video src={`http://localhost:8000/api/chat/file/${msg.id}`} controls className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                                  ) : (
                                    <a href={`http://localhost:8000/api/chat/file/${msg.id}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                                      <PaperClipOutlined /> {msg.file_name}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className={`text-[10px] mt-1 text-right opacity-70 flex items-center justify-end gap-1`}>
                                {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                {isMe && (
                                  msg.is_read ? (
                                    <div className="flex" style={{ marginLeft: 2, marginRight: -2 }}>
                                      <CheckOutlined className="text-blue-200" style={{ fontSize: '10px' }} />
                                      <CheckOutlined className="text-blue-200" style={{ fontSize: '10px', marginLeft: -4 }} />
                                    </div>
                                  ) : (
                                    <CheckOutlined className="text-slate-300" style={{ fontSize: '10px', marginLeft: 2 }} />
                                  )
                                )}
                              </div>
                              {isMe && (
                                <div className="absolute top-2 -left-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMessage(msg.id)} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })
                )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Chat Input */}
                  <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'} shrink-0`}>
                    <div className="flex gap-2 items-center">
                      <Popover 
                        content={
                          <div className="grid grid-cols-4 gap-2">
                            {['😀', '😂', '😍', '👍', '🙏', '❤️', '🔥', '🎉', '😢', '😡', '🤔', '🙌', '💊', '🏥', '⚕️', '📅'].map(emoji => (
                              <div 
                                key={emoji} 
                                className="cursor-pointer text-xl hover:bg-slate-100 p-2 rounded flex items-center justify-center dark:hover:bg-slate-700"
                                onClick={() => setMessageInput(prev => prev + emoji)}
                              >
                                {emoji}
                              </div>
                            ))}
                          </div>
                        } 
                        trigger="click"
                        placement="topLeft"
                      >
                        <Button type="text" icon={<SmileOutlined className="text-xl text-slate-400" />} />
                      </Popover>
                      <Upload
                        beforeUpload={(file) => {
                          handleSendMessage(file);
                          return false; // Prevent default upload
                        }}
                        showUploadList={false}
                      >
                        <Button type="text" icon={<PaperClipOutlined className="text-xl text-slate-400" />} />
                      </Upload>
                      <Input 
                        placeholder="Type a message..." 
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        onPressEnter={() => handleSendMessage()}
                        className={`rounded-full ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : ''}`}
                      />
                      <Button 
                        type="primary" 
                        shape="circle" 
                        icon={<SendOutlined />} 
                        onClick={() => handleSendMessage()}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a doctor to view their profile, book an appointment, and start chatting.
            </div>
          )}
        </Card>
      </Col>

      <Modal
        title="Notifications"
        open={isNotificationsModalOpen}
        onCancel={() => setIsNotificationsModalOpen(false)}
        footer={null}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <Empty description="No notifications." />
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className={`p-3 border-b ${notif.is_read ? 'opacity-60' : 'bg-blue-50'}`}>
                <Typography.Text className="font-bold block">{notif.title}</Typography.Text>
                <Typography.Text className="text-sm">{notif.message}</Typography.Text>
                <Typography.Text className="text-xs text-slate-400 block mt-1">
                  {new Date(notif.timestamp * 1000).toLocaleString()}
                </Typography.Text>
              </div>
            ))
          )}
        </div>
      </Modal>
    </Row>
  );
};
