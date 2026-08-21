import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Input, Button, message, Upload, Spin } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined } from '@ant-design/icons';
import { Message, User } from '../../types';
import * as chatApi from '../../api/chat.api';

const { Text } = Typography;

interface DoctorPatientChatProps {
  currentUser: User;
  selectedPatient: User & { is_online?: number };
  isDarkMode: boolean;
}

export const DoctorPatientChat: React.FC<DoctorPatientChatProps> = ({ currentUser, selectedPatient, isDarkMode }) => {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChat = async () => {
    try {
      const data = await chatApi.getChatHistory(currentUser.email, selectedPatient.id);
      setChatHistory(data);
      scrollToBottom();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setChatLoading(true);
    fetchChat().finally(() => setChatLoading(false));
    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [selectedPatient.id, currentUser.email]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (file?: File) => {
    if (!messageInput.trim() && !file) return;

    if (file && file.size > 5 * 1024 * 1024) {
      message.error("File size exceeds the 5MB limit. Please upload a smaller file.");
      return;
    }

    const formData = new FormData();
    formData.append('email', currentUser.email);
    formData.append('receiver_id', selectedPatient.id.toString());
    if (messageInput.trim()) {
      formData.append('content', messageInput.trim());
    }
    if (file) {
      formData.append('file', file);
    }

    try {
      await chatApi.sendMessage(formData);
      setMessageInput('');
      fetchChat();
      scrollToBottom();
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to send message");
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      await chatApi.deleteMessage({ message_id: msgId, sender_email: currentUser.email });
      message.success("Message deleted");
      fetchChat();
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to delete message");
    }
  };

  return (
    <Card 
      className={`h-[600px] flex flex-col border border-slate-100 shadow-sm rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
      bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {chatLoading && chatHistory.length === 0 ? (
          <div className="flex justify-center"><Spin /></div>
        ) : chatHistory.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">No messages yet. Send a message to start consulting.</div>
        ) : (
          chatHistory.map(msg => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
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
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
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
    </Card>
  );
};
