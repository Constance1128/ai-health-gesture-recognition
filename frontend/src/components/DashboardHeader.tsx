import React, { useState } from 'react';
import { Layout, Avatar, Button, Switch, Typography, Modal, Form, Input, Popover, Badge } from 'antd';
import { HeartOutlined, UserOutlined, LogoutOutlined, LockOutlined, KeyOutlined, BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { DashboardHeaderProps } from '../types';
import { useNotifications } from '../contexts/NotificationContext';

const { Header } = Layout;
const { Text } = Typography;

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentUser,
  handleLogout,
  handleChangePassword,
  isDarkMode,
  setIsDarkMode,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  
  // Use notifications context safely, fallback if used outside provider (though we wrapped it)
  const notificationsCtx = useNotifications();
  const { notifications, markAllAsRead, clearAll, unreadCount } = notificationsCtx || { notifications: [], markAllAsRead: ()=>{}, clearAll: ()=>{}, unreadCount: 0 };

  const onChangePasswordFinish = async (values: any) => {
    if (handleChangePassword) {
      const success = await handleChangePassword(values);
      if (success) {
        setIsModalOpen(false);
        form.resetFields();
      }
    }
  };

  return (
    <Header className={`flex items-center justify-between px-6 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} h-16`}>
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500">
          <HeartOutlined className="text-xl" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100 mb-0.5">AI Health Guard</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Clinical Kinesiology Suite v4.0</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {currentUser && (
          <div className={`flex items-center space-x-3 border px-3 py-1.5 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800/25 border-slate-700/20' : 'bg-slate-100/85 border-slate-200'}`}>
            <Avatar 
              size="small" 
              style={{ backgroundColor: '#10b981' }} 
              icon={<UserOutlined />} 
            />
            <div className="text-left hidden md:block mr-2">
              <div className={`text-xs font-semibold leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{currentUser.name}</div>
              <div className={`text-[9px] mt-0.5 leading-none ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</div>
            </div>
            
            <div className="flex gap-1">
              <Popover
                content={
                  <div className="w-80 max-h-96 flex flex-col">
                    <div className="flex justify-between items-center mb-2 px-2 pb-2 border-b dark:border-slate-700">
                      <span className="font-bold text-sm">Notifications</span>
                      <div className="space-x-2">
                        <Button type="link" size="small" onClick={markAllAsRead} className="text-xs p-0 h-auto" icon={<CheckOutlined />}>Mark read</Button>
                        <Button type="link" size="small" danger onClick={clearAll} className="text-xs p-0 h-auto" icon={<DeleteOutlined />}>Clear</Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">No notifications</div>
                      ) : (
                        <div className="space-y-2">
                          {notifications.map(notif => (
                            <div key={notif.id} className={`p-3 rounded-lg border ${!notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-transparent border-slate-100 dark:border-slate-800'}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold ${notif.type === 'error' ? 'text-rose-500' : notif.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`}>{notif.title}</span>
                                <span className="text-[10px] text-slate-400">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug">{notif.message}</p>
                              {notif.score !== undefined && (
                                <div className="mt-2 text-[10px] font-semibold">
                                  Score: <span className={notif.score < 70 ? 'text-rose-500' : 'text-emerald-500'}>{notif.score.toFixed(1)}/100</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                }
                trigger="click"
                placement="bottomRight"
                overlayInnerStyle={{ padding: '12px' }}
              >
                <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                  <Button 
                    type="text" 
                    icon={<BellOutlined />} 
                    size="small"
                    className={`flex items-center justify-center ${isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'}`}
                    title="Notifications"
                  />
                </Badge>
              </Popover>

              <Button 
                type="text" 
                icon={<KeyOutlined />} 
                onClick={() => setIsModalOpen(true)}
                size="small"
                className={`flex items-center justify-center ${isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'}`}
                title="Change Password"
              />
              <Button 
                type="text" 
                danger
                icon={<LogoutOutlined />} 
                onClick={handleLogout}
                size="small"
                className="hover:bg-rose-500/10 flex items-center justify-center"
                title="Log Out"
              />
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <Text className="text-xs">Dark Mode</Text>
          <Switch 
            checked={isDarkMode} 
            onChange={(checked) => setIsDarkMode(checked)} 
            size="small" 
          />
        </div>
      </div>

      <Modal
        title={
          <div className="flex items-center space-x-2">
            <KeyOutlined className="text-emerald-500" />
            <span>Change Password</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onChangePasswordFinish}
          requiredMark={false}
          className="mt-4"
        >
          <Form.Item
            name="oldPassword"
            label={<span className="text-xs font-semibold">Current Password</span>}
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label={<span className="text-xs font-semibold">New Password</span>}
            rules={[
              { required: true, message: 'Please enter your new password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={<span className="text-xs font-semibold">Confirm New Password</span>}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" />
          </Form.Item>

          <Form.Item className="mb-0 mt-6 flex justify-end">
            <Button onClick={() => { setIsModalOpen(false); form.resetFields(); }} className="mr-2">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" className="bg-emerald-600 hover:bg-emerald-500 border-0">
              Update Password
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Header>
  );
};
