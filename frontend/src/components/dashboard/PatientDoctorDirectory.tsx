import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, List, Avatar, Typography, Input, Button, Switch, message, Upload, Spin, Tag, Badge, Divider, Tabs, Form, DatePicker, TimePicker, Modal, Space, Empty, Popover, Image, Timeline, Radio, Alert, Segmented, Popconfirm } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined, UserOutlined, SearchOutlined, CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, SmileOutlined, CheckOutlined, InfoCircleOutlined, ExclamationCircleOutlined, HistoryOutlined, StopOutlined, FilterOutlined, CheckCircleOutlined, VideoCameraOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';


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
import { AppointmentNotesDisplay, LinkifiedText, ConsultationTypeTag } from '../../utils/appointmentFormatter';

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
  const [selectedTimelineSlotModal, setSelectedTimelineSlotModal] = useState<any | null>(null);
  const [selectedApptDetailsModal, setSelectedApptDetailsModal] = useState<Appointment | null>(null);
  const [activeTab, setActiveTabState] = useState<string>(() => sessionStorage.getItem('patient_doctor_active_tab') || 'overview');
  const setActiveTab = (tab: string) => {
    sessionStorage.setItem('patient_doctor_active_tab', tab);
    setActiveTabState(tab);
  };
  const [bookingForm] = Form.useForm();
  
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [overrides, setOverrides] = useState<any[]>([]);
  const [doctorSchedule, setDoctorSchedule] = useState<any[]>([]);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [patientConsultationNotes, setPatientConsultationNotes] = useState<any[]>([]);
  const [loadingConsultationNotes, setLoadingConsultationNotes] = useState(false);
  const [consultationNotesSearch, setConsultationNotesSearch] = useState('');
  const [consultationNotesDate, setConsultationNotesDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedPatientNoteModal, setSelectedPatientNoteModal] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState<string>('Schedule conflict / Personal commitment');
  const [isLateReschedule, setIsLateReschedule] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const [patientApptCategory, setPatientApptCategoryState] = useState<'upcoming' | 'history' | 'cancelled'>(() => {
    return (sessionStorage.getItem('patient_appt_category') as any) || 'upcoming';
  });
  const setPatientApptCategory = (cat: 'upcoming' | 'history' | 'cancelled') => {
    sessionStorage.setItem('patient_appt_category', cat);
    setPatientApptCategoryState(cat);
  };
  const [patientApptFilterDate, setPatientApptFilterDate] = useState<dayjs.Dayjs | null>(null);
  const [seenPatientCategories, setSeenPatientCategories] = useState<Set<string>>(new Set(['upcoming']));

  const handlePatientCategoryChange = (cat: 'upcoming' | 'history' | 'cancelled') => {
    setPatientApptCategory(cat);
    setSeenPatientCategories(prev => {
      const next = new Set(prev);
      next.add(cat);
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);


  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const data = await patientApi.getDoctorsDirectory(currentUser.email);
      setDoctors(data);
      const savedDocId = sessionStorage.getItem('patient_selected_doctor_id');
      if (savedDocId) {
        const match = data.find((d: any) => d.id === Number(savedDocId));
        if (match) {
          setSelectedDoctor(match);
        }
      }
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

  const fetchPatientConsultationNotes = async () => {
    if (!currentUser.email || !selectedDoctor) return;
    try {
      setLoadingConsultationNotes(true);
      const data = await patientApi.getPatientConsultationNotes(currentUser.email, selectedDoctor.id);
      setPatientConsultationNotes(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConsultationNotes(false);
    }
  };

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

      fetchPatientConsultationNotes();
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
        email: currentUser.email,
        patient_email: currentUser.email,
        doctor_id: selectedDoctor.id,
        date: selectedDate.format('YYYY-MM-DD'),
        time: selectedTimeSlot,
        notes: values.notes || '',
        consultation_type: values.consultation_type || 'online'
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

  const handleOpenReschedule = (appt: Appointment) => {
    const apptDay = dayjs(appt.date).startOf('day');
    const today = dayjs().startOf('day');
    // Rule: You can only reschedule appointments at least before the appointment day in advance
    const isAdvance = apptDay.isAfter(today);
    
    setReschedulingAppt(appt);
    setIsLateReschedule(!isAdvance);
    setRescheduleReason('Schedule conflict / Personal commitment');
    setIsRescheduleModalOpen(true);
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingAppt) return;
    if (!rescheduleReason) {
      message.warning("Please select a reason.");
      return;
    }

    try {
      setRescheduleSubmitting(true);
      await patientApi.cancelAppointment({
        email: currentUser.email,
        appointment_id: reschedulingAppt.id,
        reason: rescheduleReason
      });

      message.success("Previous appointment cancelled. Please select a new date and time slot to complete your booking.");
      setIsRescheduleModalOpen(false);
      const prevDate = reschedulingAppt.date;
      setReschedulingAppt(null);

      // Refresh appointments and schedule
      await fetchDoctorData();
      
      // Guide patient to booking tab and reset selected slot
      setActiveTab('book');
      setSelectedTimeSlot('');
      if (prevDate && dayjs(prevDate).isAfter(dayjs().startOf('day'))) {
        setSelectedDate(dayjs(prevDate));
        bookingForm.setFieldsValue({ date: dayjs(prevDate) });
      }
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to process reschedule");
    } finally {
      setRescheduleSubmitting(false);
    }
  };


  const generateTimelineEvents = () => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const dayOfWeek = selectedDate.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Find doctor's weekly timetable configuration for this day
    const scheduleForDay = doctorSchedule.find(s => {
      if (s.day_of_week !== dayOfWeek) return false;
      if (s.effective_start_date && selectedDate.isBefore(dayjs(s.effective_start_date), 'day')) return false;
      if (s.effective_end_date && selectedDate.isSameOrAfter(dayjs(s.effective_end_date), 'day')) return false;
      return true;
    });

    const dayOverrides = overrides.filter(o => o.date === dateStr);
    const events: any[] = [];
    const nowMs = Date.now();

    // If the doctor does NOT work on this day (Rest Day / Not in Weekly Timetable)
    if (!scheduleForDay) {
      // Display any special notices like whole-day outstation / conference
      dayOverrides.forEach(ovr => {
        const reasonText = ovr.reason || (ovr.type === 'surgery' ? 'Surgery' : 'Outstation / Blocked');
        events.push({
          type: 'override',
          time: ovr.start_time,
          endTime: ovr.end_time,
          title: reasonText,
          reason: reasonText,
          timestamp: new Date(`${dateStr}T${ovr.start_time}:00`).getTime(),
          color: 'red'
        });
      });
      return events.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Generate 1-hour slots strictly within the doctor's weekly practice hours [start_time, end_time]
    let currentSlot = dayjs(`${dateStr}T${scheduleForDay.start_time}:00`);
    const endTime = dayjs(`${dateStr}T${scheduleForDay.end_time}:00`);

    while (currentSlot.isBefore(endTime) && currentSlot.add(1, 'hour').valueOf() <= endTime.valueOf()) {
      const slotStartStr = currentSlot.format('HH:mm');
      const slotEndStr = currentSlot.add(1, 'hour').format('HH:mm');
      const slotStartMs = currentSlot.valueOf();
      const slotEndMs = currentSlot.add(1, 'hour').valueOf();

      // 1. Check if doctor is on Surgery, Outstation, or Break during this time
      const matchingOverride = dayOverrides.find(o => {
        const ovrStartMs = new Date(`${dateStr}T${o.start_time}:00`).getTime();
        const ovrEndMs = new Date(`${dateStr}T${o.end_time}:00`).getTime();
        return slotStartMs < ovrEndMs && slotEndMs > ovrStartMs;
      });

      // 2. Check if current patient booked this slot
      const myBooking = appointments.find(a => 
        a.doctor_id === selectedDoctor?.id && 
        a.date === dateStr && 
        a.time === slotStartStr && 
        a.status !== 'cancelled'
      );

      // 3. Check if any other patient booked this slot
      const isBooked = !!myBooking || appointments.some(a => 
        a.doctor_id === selectedDoctor?.id && 
        a.date === dateStr && 
        a.time === slotStartStr && 
        a.status !== 'cancelled'
      );

      // 4. Check if the time slot has already passed
      const isPast = slotEndMs <= nowMs;

      if (myBooking) {
        const isConf = (myBooking.status || '').toLowerCase() === 'confirmed';
        events.push({
          type: 'my_booking',
          time: slotStartStr,
          endTime: slotEndStr,
          title: `Your Booking (${(myBooking.status || 'Pending').toUpperCase()})`,
          reason: myBooking.notes || 'Your active appointment slot',
          timestamp: slotStartMs,
          color: isConf ? 'blue' : 'gold',
          data: myBooking,
          override: matchingOverride
        });
      } else if (matchingOverride) {
        const reasonText = matchingOverride.reason || (matchingOverride.type === 'surgery' ? 'Surgery' : 'Doctor Outstation');
        events.push({
          type: 'override',
          time: slotStartStr,
          endTime: slotEndStr,
          title: reasonText,
          reason: reasonText,
          timestamp: slotStartMs,
          color: 'red',
          data: matchingOverride
        });
      } else if (isBooked) {
        events.push({
          type: 'booked',
          time: slotStartStr,
          endTime: slotEndStr,
          title: 'Already Booked',
          reason: 'Slot is reserved by another patient',
          timestamp: slotStartMs,
          color: 'gray'
        });
      } else if (isPast) {
        events.push({
          type: 'past',
          time: slotStartStr,
          endTime: slotEndStr,
          title: 'Past Time Slot',
          reason: 'Time passed',
          timestamp: slotStartMs,
          color: 'gray'
        });
      } else {
        events.push({
          type: 'available',
          time: slotStartStr,
          endTime: slotEndStr,
          title: 'Available for Booking',
          reason: 'Click to select this slot',
          timestamp: slotStartMs,
          color: 'green'
        });
      }

      currentSlot = currentSlot.add(1, 'hour');
    }

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
      await chatApi.deleteMessage({ message_id: msgId, sender_email: currentUser.email, email: currentUser.email });
      setChatHistory(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: 1, content: null, file_name: null, file_type: null } : m));
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
                    onClick={() => {
                      sessionStorage.setItem('patient_selected_doctor_id', String(doctor.id));
                      setSelectedDoctor(doctor);
                    }}
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
                <Tabs.TabPane tab="Consultation Notes" key="consultation_notes" />
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
                          {selectedDoctor.consultation_hours ? (
                            <LinkifiedText text={selectedDoctor.consultation_hours} className="text-sm font-medium" />
                          ) : (
                            <Text className="text-slate-400 italic text-sm">Not set</Text>
                          )}
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
                  </div>
                )}

                {activeTab === 'book' && (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="Request Appointment" size="small" className="shadow-sm">
                      <Form form={bookingForm} layout="vertical" onFinish={handleBookAppointment}>
                        <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                          <DatePicker 
                            className="w-full" 
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                            onChange={(date) => { setSelectedDate(date); setSelectedTimeSlot(''); }}
                            cellRender={(current, info) => {
                              if (info.type !== 'date') return info.originNode;
                              const dateStr = dayjs(current).format('YYYY-MM-DD');
                              const dayAppts = appointments.filter(a => a.doctor_id === selectedDoctor.id && a.date === dateStr && a.status !== 'cancelled');
                              if (dayAppts.length > 0) {
                                return (
                                  <div className="ant-picker-cell-inner relative flex flex-col items-center justify-center">
                                    <span>{dayjs(current).date()}</span>
                                    <span 
                                      className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute bottom-0.5" 
                                      title={`You have ${dayAppts.length} active booking(s)`}
                                    />
                                  </div>
                                );
                              }
                              return info.originNode;
                            }}
                          />
                        </Form.Item>
                        {selectedDate && (
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-3">
                              <Text className="font-semibold text-slate-700 dark:text-slate-200">Daily Schedule Timeline</Text>
                              {selectedTimeSlot && (
                                <Button 
                                  size="small" 
                                  danger 
                                  type="link" 
                                  className="p-0 text-xs"
                                  onClick={() => setSelectedTimeSlot('')}
                                >
                                  Clear Selection
                                </Button>
                              )}
                            </div>

                            {selectedTimeSlot && (
                              <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex justify-between items-center animate-fadeIn">
                                <div>
                                  <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">Selected Time Slot:</Text>
                                  <Text className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{selectedTimeSlot} on {selectedDate?.format('YYYY-MM-DD')}</Text>
                                </div>
                                <Tag color="green">Ready to Book</Tag>
                              </div>
                            )}

                            <div className="max-h-[320px] overflow-y-auto pr-4 custom-scrollbar">
                              <Timeline 
                                items={generateTimelineEvents().map(ev => ({
                                  color: ev.color,
                                  children: (
                                    <div 
                                      className={`p-3 rounded-lg border flex justify-between items-center transition-all cursor-pointer ${
                                        selectedTimeSlot === ev.time ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm ring-1 ring-emerald-400' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                      }`}
                                      onClick={() => setSelectedTimelineSlotModal(ev)}
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <Text className="font-semibold block">{ev.time} - {ev.endTime}</Text>
                                          {ev.type === 'my_booking' && (
                                            <Tag color="blue" className="m-0 text-[10px] font-bold uppercase border-0">
                                              Your Booking
                                            </Tag>
                                          )}
                                        </div>
                                        <Text className={`text-xs ${ev.color === 'red' ? 'text-red-500 font-medium' : ev.color === 'blue' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-500'}`}>
                                          {ev.title}
                                        </Text>
                                      </div>
                                      
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {ev.type === 'available' && (
                                          <Button 
                                            type={selectedTimeSlot === ev.time ? 'primary' : 'default'} 
                                            size="small"
                                            className={selectedTimeSlot === ev.time ? 'bg-emerald-600 hover:bg-emerald-500 border-0' : ''}
                                            onClick={() => setSelectedTimeSlot(prev => prev === ev.time ? '' : ev.time)}
                                          >
                                            {selectedTimeSlot === ev.time ? 'Selected ✓' : 'Select'}
                                          </Button>
                                        )}
                                        {ev.type === 'override' && (
                                          <Tag color="red" className="m-0 border-0 font-semibold">{ev.title || 'Blocked'}</Tag>
                                        )}
                                        {ev.type === 'booked' && (
                                          <Tag color="default" className="m-0 border-0">Already Booked</Tag>
                                        )}
                                        {ev.type === 'past' && (
                                          <Tag color="default" className="m-0 border-0">Past Slot</Tag>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }))}
                              />
                            </div>
                            {generateTimelineEvents().length === 0 && (
                              <Empty description="No practicing hours configured for this day (Doctor's Rest Day)." />
                            )}
                          </div>
                        )}

                        <Form.Item 
                          label={<span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Consultation Format</span>} 
                          name="consultation_type" 
                          initialValue="online"
                        >
                          <Radio.Group className="w-full grid grid-cols-2 gap-3" buttonStyle="solid">
                            <Radio.Button value="online" className="text-center h-auto py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
                              <VideoCameraOutlined className="text-purple-500 text-base" />
                              <div className="text-left leading-tight">
                                <div className="font-bold text-xs">Online Video</div>
                                <div className="text-[10px] text-slate-400">Zoom / Meeting Link</div>
                              </div>
                            </Radio.Button>
                            <Radio.Button value="physical" className="text-center h-auto py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
                              <EnvironmentOutlined className="text-cyan-500 text-base" />
                              <div className="text-left leading-tight">
                                <div className="font-bold text-xs">Physical In-Clinic</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[110px]">{selectedDoctor.clinic_name || 'Clinic Visit'}</div>
                              </div>
                            </Radio.Button>
                          </Radio.Group>
                        </Form.Item>

                        <Form.Item label="Notes / Reason for visit" name="notes">
                          <Input.TextArea rows={3} placeholder="Optional notes for the doctor (e.g. symptoms)..." />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block size="large" className="bg-emerald-600 hover:bg-emerald-500 border-0" disabled={!selectedTimeSlot}>
                          {selectedTimeSlot ? `Request Booking for ${selectedTimeSlot}` : 'Select a Time Slot to Book'}
                        </Button>
                      </Form>
                    </Card>
                    
                    <div className="w-full space-y-3">
                      {(() => {
                        const doctorAppointments = appointments.filter(a => a.doctor_id === selectedDoctor.id);
                        const todayStart = dayjs().startOf('day');
                        const allUpcoming = doctorAppointments.filter(a => a.status !== 'cancelled' && !dayjs(a.date).startOf('day').isBefore(todayStart));
                        const allHistory = doctorAppointments.filter(a => a.status !== 'cancelled' && dayjs(a.date).startOf('day').isBefore(todayStart));
                        const allCancelled = doctorAppointments.filter(a => a.status === 'cancelled');

                        const filterDateStr = patientApptFilterDate ? patientApptFilterDate.format('YYYY-MM-DD') : null;
                        const upcoming = filterDateStr ? allUpcoming.filter(a => a.date === filterDateStr) : allUpcoming;
                        const history = filterDateStr ? allHistory.filter(a => a.date === filterDateStr) : allHistory;
                        const cancelled = filterDateStr ? allCancelled.filter(a => a.date === filterDateStr) : allCancelled;

                        const displayed = patientApptCategory === 'upcoming' ? upcoming : patientApptCategory === 'history' ? history : cancelled;

                        return (
                          <>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Title level={5} className="!mb-0 text-slate-700 dark:text-slate-200">
                                Your Appointments with {selectedDoctor.name}
                              </Title>
                              <div className="flex items-center gap-2 flex-wrap">
                                <DatePicker 
                                  placeholder="Filter by Date" 
                                  size="small" 
                                  className="w-36 text-xs" 
                                  value={patientApptFilterDate}
                                  onChange={(d) => setPatientApptFilterDate(d)}
                                  allowClear
                                  cellRender={(current, info) => {
                                    if (info.type !== 'date') return info.originNode;
                                    const dateStr = dayjs(current).format('YYYY-MM-DD');
                                    const dayAppts = doctorAppointments.filter(a => a.date === dateStr);
                                    if (dayAppts.length > 0) {
                                      const hasUpcoming = dayAppts.some(a => a.status !== 'cancelled');
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
                                {patientApptFilterDate && (
                                  <Tag color="cyan" className="rounded-full text-xs m-0">
                                    {displayed.length} on {patientApptFilterDate.format('YYYY-MM-DD')}
                                  </Tag>
                                )}
                              </div>
                            </div>

                            <Segmented
                              block
                              value={patientApptCategory}
                              onChange={(val) => setPatientApptCategory(val as any)}
                              options={[
                                {
                                  label: (
                                    <div className="flex items-center justify-center gap-1.5 py-0.5">
                                      <CalendarOutlined />
                                      <span>Upcoming</span>
                                    </div>
                                  ),
                                  value: 'upcoming',
                                },
                                {
                                  label: (
                                    <div className="flex items-center justify-center gap-1.5 py-0.5">
                                      <HistoryOutlined />
                                      <span>History</span>
                                    </div>
                                  ),
                                  value: 'history',
                                },
                                {
                                  label: (
                                    <div className="flex items-center justify-center gap-1.5 py-0.5">
                                      <StopOutlined />
                                      <span>Cancelled</span>
                                    </div>
                                  ),
                                  value: 'cancelled',
                                },
                              ]}
                            />

                            {displayed.length === 0 ? (
                              <div className="p-6 text-center border rounded-xl border-dashed border-slate-200 dark:border-slate-700">
                                <Text className="text-slate-400">
                                  {patientApptFilterDate 
                                    ? `No ${patientApptCategory} appointments found for ${patientApptFilterDate.format('YYYY-MM-DD')}.`
                                    : `No ${patientApptCategory} appointments with this doctor.`}
                                </Text>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                                {displayed.map(appt => {
                                  const isConfirmed = appt.status?.toLowerCase() === 'confirmed';
                                  const isCancelled = appt.status?.toLowerCase() === 'cancelled';
                                  return (
                                    <div 
                                      key={appt.id} 
                                      onClick={() => setSelectedApptDetailsModal(appt)}
                                      className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer duration-150 hover:shadow-md hover:border-blue-400 active:scale-[0.99] ${
                                        isDarkMode ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-blue-50/20 shadow-xs'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Tag color="blue" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                                            <CalendarOutlined className="mr-1" /> {appt.date}
                                          </Tag>
                                          <Tag color="cyan" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                                            <ClockCircleOutlined className="mr-1" /> {appt.time}
                                          </Tag>
                                          <ConsultationTypeTag type={appt.consultation_type} />
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                          <Tag 
                                            color={isConfirmed ? 'green' : isCancelled ? 'red' : 'gold'} 
                                            className="font-bold text-xs px-2.5 py-0.5 rounded-full border-0 m-0 uppercase"
                                          >
                                            {appt.status}
                                          </Tag>
                                          {!isCancelled && patientApptCategory === 'upcoming' && (
                                            <Button 
                                              size="small" 
                                              type="dashed" 
                                              className="text-xs h-7 px-2.5" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenReschedule(appt);
                                              }}
                                            >
                                              Reschedule
                                            </Button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Compact note & reason preview */}
                                      <AppointmentNotesDisplay 
                                        notes={appt.notes} 
                                        status={appt.status} 
                                        reason={appt.reason} 
                                        consultationType={appt.consultation_type}
                                        doctorNotes={appt.consultation_hours || selectedDoctor.consultation_hours}
                                        clinicName={appt.clinic_name || selectedDoctor.clinic_name}
                                        isDarkMode={isDarkMode} 
                                        compact={true}
                                        className="mt-1"
                                      />

                                      <div className="text-[10px] text-blue-500/80 hover:text-blue-500 font-medium flex items-center justify-end gap-1 mt-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <EyeOutlined /> Click card for full details
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
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
                          <div className={`max-w-[70%] rounded-2xl p-3 relative group transition-all ${
                            msg.is_deleted
                              ? (isDarkMode 
                                  ? 'bg-slate-900/70 border border-slate-800 text-slate-400 rounded-2xl shadow-none' 
                                  : 'bg-slate-100/90 border border-slate-200 text-slate-500 rounded-2xl shadow-none')
                              : isMe 
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-xs' 
                                : (isDarkMode ? 'bg-slate-800 text-white rounded-tl-none shadow-xs' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs')
                          }`}>
                            {msg.is_deleted ? (
                              <div className="flex items-center gap-2 text-xs select-none">
                                <StopOutlined className="text-slate-400 flex-shrink-0 text-sm" />
                                <span className="italic">
                                  {isMe ? "You deleted this message" : "This message was deleted"}
                                </span>
                                <span className="text-[10px] ml-1.5 opacity-60 not-italic">
                                  {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
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
                                  <div className="absolute top-2 -left-9 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Popconfirm
                                      title="Delete message?"
                                      description="Are you sure you want to delete this message?"
                                      onConfirm={() => handleDeleteMessage(msg.id)}
                                      okText="Delete"
                                      cancelText="Cancel"
                                      okButtonProps={{ danger: true, size: 'small' }}
                                      cancelButtonProps={{ size: 'small' }}
                                      placement="left"
                                    >
                                      <Button 
                                        type="text" 
                                        size="small" 
                                        danger 
                                        className="hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full w-7 h-7 flex items-center justify-center p-0"
                                        icon={<DeleteOutlined />} 
                                      />
                                    </Popconfirm>
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

              {activeTab === 'consultation_notes' && (
                <div className="p-6 max-w-4xl space-y-5 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                  {/* Header Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <div>
                      <Title level={5} className={`!m-0 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Consultation Notes & Records
                      </Title>
                      <Text className="text-xs text-slate-400">
                        Official clinical observations, diagnosis, and treatment suggestions recorded by Dr. {selectedDoctor.name}.
                      </Text>
                    </div>
                    <Tag color="blue" className="rounded-full text-xs font-semibold m-0">
                      {patientConsultationNotes.length} notes
                    </Tag>
                  </div>

                  {/* Filter bar */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Input
                      prefix={<SearchOutlined className="text-slate-400 mr-1" />}
                      placeholder="Search diagnosis or treatment..."
                      value={consultationNotesSearch}
                      onChange={(e) => setConsultationNotesSearch(e.target.value)}
                      allowClear
                      className={`flex-1 rounded-xl min-w-[200px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                    />
                    <DatePicker
                      value={consultationNotesDate}
                      onChange={(d) => setConsultationNotesDate(d)}
                      placeholder="Filter by date..."
                      className="rounded-xl w-44"
                      allowClear
                    />
                    {(consultationNotesSearch || consultationNotesDate) && (
                      <Button 
                        onClick={() => {
                          setConsultationNotesSearch('');
                          setConsultationNotesDate(null);
                        }}
                        className="rounded-xl text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* Notes List */}
                  {loadingConsultationNotes ? (
                    <div className="py-12 flex justify-center"><Spin /></div>
                  ) : (() => {
                    const filtered = patientConsultationNotes.filter(n => {
                      const q = consultationNotesSearch.toLowerCase();
                      const matchSearch = !q || (n.diagnosis || '').toLowerCase().includes(q) || (n.treatment || '').toLowerCase().includes(q);
                      const matchDate = !consultationNotesDate || n.date === consultationNotesDate.format('YYYY-MM-DD');
                      return matchSearch && matchDate;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className={`p-10 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                          <Empty 
                            description={
                              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                                {consultationNotesSearch || consultationNotesDate
                                  ? 'No consultation notes matching your filters.'
                                  : `No consultation notes recorded by Dr. ${selectedDoctor.name} yet.`}
                              </span>
                            } 
                          />
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filtered.map(note => (
                          <div
                            key={note.id}
                            onClick={() => setSelectedPatientNoteModal(note)}
                            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 cursor-pointer hover:shadow-md hover:border-blue-400 active:scale-[0.99] ${
                              isDarkMode ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200/80 hover:bg-blue-50/20 shadow-xs'
                            }`}
                          >
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Tag color="blue" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                                  <CalendarOutlined className="mr-1" /> {note.date}
                                </Tag>
                                <Tag color="cyan" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                                  <ClockCircleOutlined className="mr-1" /> {note.time}
                                </Tag>
                                <span className="text-xs text-slate-400">
                                  Dr. {selectedDoctor.name}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5">
                                {note.diagnosis && (
                                  <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                                    <strong className="text-slate-500 dark:text-slate-400">Diagnosis:</strong> {note.diagnosis}
                                  </div>
                                )}
                                {note.treatment && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    <strong className="text-emerald-600 dark:text-emerald-400">Treatment / Advice:</strong> {note.treatment}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="link"
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => setSelectedPatientNoteModal(note)}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400"
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
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

      {/* Reschedule / Cancellation Reason Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {isLateReschedule ? (
              <ExclamationCircleOutlined className="text-amber-500 text-lg" />
            ) : (
              <CalendarOutlined className="text-blue-500 text-lg" />
            )}
            <span>{isLateReschedule ? "Appointment Cancellation Notice" : "Reschedule Appointment"}</span>
          </div>
        }
        open={isRescheduleModalOpen}
        onCancel={() => {
          if (!rescheduleSubmitting) {
            setIsRescheduleModalOpen(false);
            setReschedulingAppt(null);
          }
        }}
        footer={[
          <Button key="back" onClick={() => setIsRescheduleModalOpen(false)} disabled={rescheduleSubmitting}>
            Keep Current Booking
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            danger={isLateReschedule}
            className={isLateReschedule ? "" : "bg-emerald-600 hover:bg-emerald-500 border-0"} 
            loading={rescheduleSubmitting} 
            onClick={handleConfirmReschedule}
          >
            {isLateReschedule ? "Cancel & Make New Booking" : "Submit & Select New Slot"}
          </Button>
        ]}
      >
        <div className="space-y-4 py-2">
          {isLateReschedule ? (
            <Alert
              type="warning"
              showIcon
              message="Advance Reschedule Policy"
              description="You can only reschedule appointments at least before the appointment day in advance. Same-day or past appointments cannot be rescheduled directly; your current booking will be cancelled and you will need to make a new booking."
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="Reschedule Notice"
              description={`To reschedule your appointment on ${reschedulingAppt?.date} at ${reschedulingAppt?.time}, your current booking will be cancelled and you can select a new date and time from the schedule.`}
            />
          )}

          <div>
            <Text className="font-semibold block mb-2 text-slate-700 dark:text-slate-200">
              Please select a reason (tick only one):
            </Text>
            <Radio.Group 
              onChange={(e) => setRescheduleReason(e.target.value)} 
              value={rescheduleReason}
              className="flex flex-col gap-2.5 w-full"
            >
              <Radio value="Schedule conflict / Personal commitment" className="text-sm">
                Schedule conflict / Personal commitment
              </Radio>
              <Radio value="Feeling unwell / Medical reasons" className="text-sm">
                Feeling unwell / Medical reasons
              </Radio>
              <Radio value="Unexpected work or travel conflict" className="text-sm">
                Unexpected work or travel conflict
              </Radio>
              <Radio value="Need an earlier or later time slot" className="text-sm">
                Need an earlier or later time slot
              </Radio>
              <Radio value="Other personal reason" className="text-sm">
                Other personal reason
              </Radio>
            </Radio.Group>
          </div>
        </div>
      </Modal>

      {/* Pop-up Modal for Timeline Slot Details */}
      <Modal
        open={!!selectedTimelineSlotModal}
        onCancel={() => setSelectedTimelineSlotModal(null)}
        footer={[
          selectedTimelineSlotModal?.type === 'available' ? (
            <Button 
              key="select" 
              type="primary" 
              className="bg-emerald-600 hover:bg-emerald-500 border-0 rounded-lg"
              onClick={() => {
                setSelectedTimeSlot(selectedTimelineSlotModal.time);
                setSelectedTimelineSlotModal(null);
              }}
            >
              Select This Slot
            </Button>
          ) : null,
          <Button key="close" onClick={() => setSelectedTimelineSlotModal(null)} className="rounded-lg">
            Close
          </Button>
        ].filter(Boolean)}
        title={
          <div className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-500" />
            <span>Schedule Slot Details</span>
          </div>
        }
        destroyOnClose
        centered
        width={540}
      >
        {selectedTimelineSlotModal && (
          <div className="space-y-4 py-2">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-xs text-slate-400 font-medium">Time Slot</div>
                <div className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mt-0.5">
                  <ClockCircleOutlined className="text-blue-500" />
                  {selectedTimelineSlotModal.time} - {selectedTimelineSlotModal.endTime}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Date</div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                  {selectedDate?.format('YYYY-MM-DD')}
                </div>
              </div>
            </div>

            {selectedTimelineSlotModal.type === 'my_booking' && selectedTimelineSlotModal.data && (
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-blue-900 dark:text-blue-200">Your Appointment</span>
                  <Tag color="blue" className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full border-0 m-0">
                    {selectedTimelineSlotModal.data.status}
                  </Tag>
                </div>
                <AppointmentNotesDisplay 
                  notes={selectedTimelineSlotModal.data.notes} 
                  status={selectedTimelineSlotModal.data.status} 
                  reason={selectedTimelineSlotModal.data.reason} 
                  consultationType={selectedTimelineSlotModal.data.consultation_type}
                  doctorNotes={selectedDoctor?.consultation_hours}
                  clinicName={selectedDoctor?.clinic_name}
                  isDarkMode={isDarkMode} 
                />
              </div>
            )}

            {selectedTimelineSlotModal.type === 'override' && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1 text-center">
                <StopOutlined className="text-2xl text-rose-500" />
                <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  Doctor Block: {selectedTimelineSlotModal.title}
                </div>
                <div className="text-xs text-rose-600 dark:text-rose-400">
                  Doctor is outstation or on leave during this period.
                </div>
              </div>
            )}

            {selectedTimelineSlotModal.type === 'available' && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1 text-center">
                <CheckCircleOutlined className="text-2xl text-emerald-500" />
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Slot Available</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  This 1-hour consultation slot is open. You can click "Select This Slot" to proceed with booking.
                </div>
              </div>
            )}

            {selectedTimelineSlotModal.type === 'booked' && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                This slot is reserved by another patient.
              </div>
            )}

            {selectedTimelineSlotModal.type === 'past' && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                This time slot has already passed.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pop-up Modal for Full Appointment Details */}
      <Modal
        open={!!selectedApptDetailsModal}
        onCancel={() => setSelectedApptDetailsModal(null)}
        footer={[
          selectedApptDetailsModal && (selectedApptDetailsModal.status?.toLowerCase() === 'pending' || selectedApptDetailsModal.status?.toLowerCase() === 'confirmed') ? (
            <Button 
              key="resched" 
              type="primary" 
              className="bg-emerald-600 hover:bg-emerald-500 border-0 rounded-lg"
              onClick={() => {
                const appt = selectedApptDetailsModal;
                setSelectedApptDetailsModal(null);
                handleOpenReschedule(appt);
              }}
            >
              Reschedule Appointment
            </Button>
          ) : null,
          <Button key="close" onClick={() => setSelectedApptDetailsModal(null)} className="rounded-lg">
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
        {selectedApptDetailsModal && (
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-xs text-slate-400 font-medium">Doctor</div>
                <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5">
                  {selectedDoctor?.name || selectedApptDetailsModal.doctor_name || 'Doctor'}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {selectedDoctor?.specialization || selectedApptDetailsModal.specialization || 'Consultant'}
                </div>
              </div>
              <div className="text-right">
                <Tag 
                  color={
                    selectedApptDetailsModal.status === 'confirmed' ? 'green' : 
                    selectedApptDetailsModal.status === 'cancelled' ? 'red' : 'gold'
                  } 
                  className="font-bold text-xs uppercase px-3 py-1 rounded-full border-0 m-0"
                >
                  {selectedApptDetailsModal.status}
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
                  {selectedApptDetailsModal.date}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <ClockCircleOutlined className="text-cyan-500" /> Scheduled Time
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                  {selectedApptDetailsModal.time}
                </div>
              </div>
            </div>

            {/* Full Formatted Notes, Reschedule info, Cancelled by who, and Zoom Link */}
            <AppointmentNotesDisplay 
              notes={selectedApptDetailsModal.notes} 
              status={selectedApptDetailsModal.status} 
              reason={selectedApptDetailsModal.reason} 
              consultationType={selectedApptDetailsModal.consultation_type}
              doctorNotes={selectedApptDetailsModal.consultation_hours || selectedDoctor?.consultation_hours}
              clinicName={selectedApptDetailsModal.clinic_name || selectedDoctor?.clinic_name}
              isDarkMode={isDarkMode} 
              compact={false}
            />
          </div>
        )}
      </Modal>

      {/* Pop-up Modal for Patient Consultation Note Details */}
      <Modal
        open={!!selectedPatientNoteModal}
        onCancel={() => setSelectedPatientNoteModal(null)}
        footer={[
          <Button
            key="close"
            type="primary"
            className="bg-blue-600 rounded-lg"
            onClick={() => setSelectedPatientNoteModal(null)}
          >
            Close
          </Button>
        ]}
        title={
          <div className="flex items-center gap-2 text-base font-bold">
            <FileTextOutlined className="text-blue-500" />
            <span>Consultation Note Details</span>
          </div>
        }
        centered
        width={560}
      >
        {selectedPatientNoteModal && (
          <div className="space-y-4 py-2 text-xs">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-xs text-slate-400 font-medium">Attending Doctor</div>
                <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                  Dr. {selectedPatientNoteModal.doctor_name || selectedDoctor?.name}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {selectedPatientNoteModal.clinic_name || selectedDoctor?.clinic_name || 'Clinic Consultation'}
                </div>
              </div>

              <div className="text-right">
                <Tag color="blue" className="rounded-md font-semibold px-2 py-0.5 m-0 mb-1 block">
                  <CalendarOutlined className="mr-1" /> {selectedPatientNoteModal.date}
                </Tag>
                <Tag color="cyan" className="rounded-md font-semibold px-2 py-0.5 m-0 block">
                  <ClockCircleOutlined className="mr-1" /> {selectedPatientNoteModal.time}
                </Tag>
              </div>
            </div>

            {/* Diagnosis */}
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircleOutlined className="text-blue-500" /> Diagnosis & Findings
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 text-xs">
                {selectedPatientNoteModal.diagnosis || <span className="text-slate-400 italic">No diagnosis recorded</span>}
              </div>
            </div>

            {/* Treatment */}
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileTextOutlined className="text-emerald-500" /> Treatment Recommendations & Advice
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 text-xs">
                {selectedPatientNoteModal.treatment || <span className="text-slate-400 italic">No treatment instructions recorded</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Row>
  );
};

