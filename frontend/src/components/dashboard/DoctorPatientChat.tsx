import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Input, Button, message, Upload, Spin, Popover, Avatar, Image, Popconfirm } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined, SmileOutlined, ArrowLeftOutlined, ClockCircleOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Message, User } from '../../types';
import * as chatApi from '../../api/chat.api';

const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '❤️', '🔥', '🎉', '😢', '😡', '🤔', '🙌', '💊', '🏥', '⚕️', '📅'];

const { Text } = Typography;

interface DoctorPatientChatProps {
  currentUser: User;
  selectedPatient: User & { is_online?: number };
  isDarkMode: boolean;
  onBack?: () => void;
}

export const DoctorPatientChat: React.FC<DoctorPatientChatProps> = ({ currentUser, selectedPatient, isDarkMode, onBack }) => {
    const [chatHistory, setChatHistory] = useState<(Message & { is_sending?: boolean })[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFirstUnreadMessageId(null);
  }, [selectedPatient.id]);

  const fetchChat = async (shouldScroll = false) => {
    try {
      const data = await chatApi.getChatHistory(currentUser.email, selectedPatient.id);
      
      setFirstUnreadMessageId(prev => {
        if (prev === null) {
          const unreadMsg = data.find(m => m.sender_id !== currentUser.id && m.is_read === 0);
          return unreadMsg ? unreadMsg.id : null;
        }
        return prev;
      });

      setChatHistory(data);
      if (shouldScroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      
      // Mark messages as read
      await chatApi.markMessagesRead({ email: currentUser.email, sender_id: selectedPatient.id });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setChatLoading(true);
    fetchChat(true).finally(() => setChatLoading(false));
    const interval = setInterval(() => fetchChat(false), 3000);
    return () => clearInterval(interval);
  }, [selectedPatient.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (file?: any) => {
    if (!messageInput.trim() && !file) return;

    const tempContent = messageInput;
    setMessageInput('');

    const optimisticId = Date.now();
    const optimisticMsg: Message & { is_sending?: boolean } = {
      id: optimisticId,
      sender_id: currentUser.id,
      receiver_id: selectedPatient.id,
      content: tempContent,
      file_name: file ? file.name : null,
      file_type: file ? file.type : null,
      timestamp: Math.floor(Date.now() / 1000),
      is_deleted: 0,
      is_read: 0,
      is_sending: true
    };
    
    setChatHistory(prev => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const formData = new FormData();
      formData.append('email', currentUser.email);
      formData.append('receiver_id', selectedPatient.id.toString());
      if (tempContent) formData.append('content', tempContent);
      if (file) formData.append('file', file);

      await chatApi.sendMessage(formData);
      fetchChat(true);
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to send message");
      setChatHistory(prev => prev.filter(m => m.id !== optimisticId));
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
    <Card 
      className={`flex-1 min-h-0 h-full flex flex-col border border-slate-100 shadow-sm rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
      bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header */}
      <div className={`p-4 flex items-center gap-3 shrink-0 shadow-sm z-10 ${isDarkMode ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-100'}`}>
        {onBack && (
          <Button 
            type="text" 
            shape="circle" 
            icon={<ArrowLeftOutlined className="text-lg" />} 
            onClick={onBack}
            className={`mr-2 ${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          />
        )}
        <Avatar size={40} className="bg-blue-100 text-blue-600 font-bold shrink-0">
          {selectedPatient.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </Avatar>
        <div className="flex flex-col min-w-0">
          <Text className={`font-bold text-base leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {selectedPatient.name}
          </Text>
          <Text className="text-[11px] text-slate-400 leading-tight truncate">
            ID: #P-2026-{String(selectedPatient.id).padStart(4, '0')}
          </Text>
        </div>
      </div>
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
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
                              <Image src={msg.is_sending ? undefined : `http://localhost:8000/api/chat/file/${msg.id}`} alt="attachment" className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                            ) : msg.file_type?.startsWith('video/') ? (
                              <video src={msg.is_sending ? undefined : `http://localhost:8000/api/chat/file/${msg.id}`} controls className="max-w-full rounded-lg" style={{ maxHeight: 200 }} />
                            ) : (
                              <a href={msg.is_sending ? '#' : `http://localhost:8000/api/chat/file/${msg.id}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                                <PaperClipOutlined /> {msg.file_name}
                              </a>
                            )}
                          </div>
                        )}
                        <div className={`text-[10px] mt-1 text-right opacity-70 flex items-center justify-end gap-1`}>
                          {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {isMe && (
                            msg.is_sending ? (
                              <ClockCircleOutlined className="text-blue-200" style={{ fontSize: '10px' }} />
                            ) : msg.is_read ? (
                              <div className="flex" style={{ marginLeft: 2, marginRight: -2 }}>
                                <CheckOutlined className="text-blue-200" style={{ fontSize: '10px' }} />
                                <CheckOutlined className="text-blue-200" style={{ fontSize: '10px', marginLeft: -4 }} />
                              </div>
                            ) : (
                              <CheckOutlined className="text-slate-300" style={{ fontSize: '10px', marginLeft: 2 }} />
                            )
                          )}
                        </div>
                        {isMe && !msg.is_sending && (
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
      <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
        <div className="flex gap-2 items-center">
          <Popover 
            content={
              <div className="grid grid-cols-4 gap-2">
                {EMOJIS.map(emoji => (
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
    </Card>
  );
};
