import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, message, Tag } from 'antd';
import * as adminApi from '../../api/admin.api';

const { Title } = Typography;

interface AdminAuditLogsTabProps {
  email: string;
  isDarkMode: boolean;
}

export const AdminAuditLogsTab: React.FC<AdminAuditLogsTabProps> = ({ email, isDarkMode }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAuditLogs(email);
      setLogs(data);
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Time',
      key: 'timestamp',
      render: (_: any, record: any) => new Date(record.timestamp * 1000).toLocaleString()
    },
    {
      title: 'Admin ID',
      dataIndex: 'admin_id',
      key: 'admin_id'
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag color="blue">{action}</Tag>
    },
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target'
    }
  ];

  return (
    <div className="w-full">
      <Title level={3} className="m-0 mb-6">System Audit Logs</Title>
      <Card className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <Table 
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          className={isDarkMode ? 'dark-table' : ''}
        />
      </Card>
    </div>
  );
};
