import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, List, Avatar, Typography, Input, Button, Switch, message, Upload, Spin, Tag, Badge, Divider, Tabs, Form, DatePicker, TimePicker, Modal, Space, Empty } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined, UserOutlined, SearchOutlined, CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, BellOutlined } from '@ant-design/icons';
import { Doctor, Message, User, Appointment } from '../../types';
import dayjs from 'dayjs';
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
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [bookingForm] = Form.useForm();
  
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [overrides, setOverrides] = useState<any[]>([]);
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

  useEffect(() => {
    fetchDoctors();
  }, [currentUser.email]);

  const fetchChat = async (doctorId: number) => {
    try {
      setChatLoading(true);
      const data = await chatApi.getChatHistory(currentUser.email, doctorId);
      setChatHistory(data);
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (e) {
      console.error(e);
      message.error("Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) {
      fetchChat(selectedDoctor.id);
      fetchDoctorData();
      const interval = setInterval(() => fetchChat(selectedDoctor.id), 5000); // Polling every 5s
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

  const generateTimeSlots = () => {
    const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    if (!selectedDate) return [];
    const dateStr = selectedDate.format('YYYY-MM-DD');
    return slots.map(slot => {
      const isBooked = appointments.some(a => a.doctor_id === selectedDoctor?.id && a.date === dateStr && a.time === slot && a.status !== 'cancelled');
      const isBlocked = overrides.some(o => o.date === dateStr && o.start_time <= slot && o.end_time > slot);
      return { time: slot, available: !isBooked && !isBlocked };
    });
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
              renderItem={doctor => (
                <List.Item
                  className={`px-4 py-4 cursor-pointer transition-colors border-b ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'} ${selectedDoctor?.id === doctor.id ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot status={doctor.is_online ? 'success' : 'default'} offset={[-5, 35]}>
                        <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-600" size="large" />
                      </Badge>
                    }
                    title={<Text className={`font-semibold ${isDarkMode ? 'text-white' : ''}`}>{doctor.name}</Text>}
                    description={<Text className="text-xs text-slate-400">{doctor.specialization || 'General Practitioner'}</Text>}
                  />
                </List.Item>
              )}
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
              <div className={`p-6 flex items-start gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                <Badge dot status={selectedDoctor.is_online ? 'success' : 'default'} offset={[-5, 50]}>
                  <Avatar className="bg-blue-100 text-blue-600" icon={<UserOutlined />} size={64} />
                </Badge>
                <div className="flex-1">
                  <Text className={`text-xl font-bold block ${isDarkMode ? 'text-white' : ''}`}>{selectedDoctor.name}</Text>
                  <Text className="text-sm text-slate-400 font-semibold">{selectedDoctor.specialization || 'General Practitioner'}</Text>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    {selectedDoctor.clinic_name && <span><EnvironmentOutlined /> {selectedDoctor.clinic_name}</span>}
                    {selectedDoctor.consultation_hours && <span><ClockCircleOutlined /> {selectedDoctor.consultation_hours}</span>}
                  </div>
                </div>
              </div>
              
              <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab} 
                className="px-6 border-b border-slate-100 dark:border-slate-800"
              >
                <Tabs.TabPane tab="Overview" key="overview" />
                <Tabs.TabPane tab="Book Appointment" key="book" />
                <Tabs.TabPane tab="Consultation Chat" key="chat" />
              </Tabs>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col">
                {activeTab === 'overview' && (
                  <div className="p-6 max-w-3xl space-y-6">
                    <div>
                      <Title level={5} className="!mb-4 text-slate-500">About Doctor</Title>
                      <Text className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {selectedDoctor.bio || 'No description provided by the doctor yet.'}
                      </Text>
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
                      <Form form={bookingForm} layout="vertical" onFinish={handleBookAppointment}>
                        <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                          <DatePicker 
                            className="w-full" 
                            disabledDate={(current) => current && current < dayjs().endOf('day')}
                            onChange={(date) => { setSelectedDate(date); setSelectedTimeSlot(''); }}
                          />
                        </Form.Item>
                        {selectedDate && (
                          <div className="mb-4">
                            <Text className="block mb-2">Available Time Slots</Text>
                            <div className="grid grid-cols-3 gap-2">
                              {generateTimeSlots().map(slot => (
                                <Button 
                                  key={slot.time} 
                                  type={selectedTimeSlot === slot.time ? 'primary' : 'default'}
                                  disabled={!slot.available}
                                  onClick={() => setSelectedTimeSlot(slot.time)}
                                >
                                  {slot.time}
                                </Button>
                              ))}
                            </div>
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
                                    <img src={`http://localhost:8000/api/chat/file/${msg.id}`} alt="attachment" className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                                  ) : msg.file_type?.startsWith('video/') ? (
                                    <video src={`http://localhost:8000/api/chat/file/${msg.id}`} controls className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                                  ) : (
                                    <a href={`http://localhost:8000/api/chat/file/${msg.id}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                                      <PaperClipOutlined /> {msg.file_name}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className={`text-[10px] mt-1 text-right opacity-70`}>
                                {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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

      {/* Notifications Button */}
      <div className="absolute top-6 right-6 z-10">
        <Badge count={notifications.filter(n => !n.is_read).length}>
          <Button shape="circle" icon={<BellOutlined />} onClick={() => setIsNotificationsModalOpen(true)} />
        </Badge>
      </div>

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
