import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, message, Button, Modal, Form, Input, Tabs, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import * as contentApi from '../../api/content.api';

const { Title } = Typography;

interface AdminContentTabProps {
  userId: number;
  isDarkMode: boolean;
}

export const AdminContentTab: React.FC<AdminContentTabProps> = ({ userId, isDarkMode }) => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  
  const [isFaqModalVisible, setIsFaqModalVisible] = useState(false);
  const [isArticleModalVisible, setIsArticleModalVisible] = useState(false);
  
  const [faqForm] = Form.useForm();
  const [articleForm] = Form.useForm();

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const fData = await contentApi.getFaqs();
      const aData = await contentApi.getArticles();
      setFaqs(fData);
      setArticles(aData);
    } catch (e: any) {
      console.error(e);
      message.error("Failed to load content");
    }
  };

  const handleCreateFaq = async (values: any) => {
    try {
      await contentApi.createFaq(values);
      message.success("FAQ created!");
      setIsFaqModalVisible(false);
      faqForm.resetFields();
      fetchContent();
    } catch (e) {
      message.error("Failed to create FAQ");
    }
  };

  const handleDeleteFaq = async (id: number) => {
    try {
      await contentApi.deleteFaq(id);
      message.success("FAQ deleted!");
      fetchContent();
    } catch (e) {
      message.error("Failed to delete FAQ");
    }
  };

  const handleCreateArticle = async (values: any) => {
    try {
      await contentApi.createArticle({ ...values, author_id: userId });
      message.success("Article created!");
      setIsArticleModalVisible(false);
      articleForm.resetFields();
      fetchContent();
    } catch (e) {
      message.error("Failed to create Article");
    }
  };

  const handleDeleteArticle = async (id: number) => {
    try {
      await contentApi.deleteArticle(id);
      message.success("Article deleted!");
      fetchContent();
    } catch (e) {
      message.error("Failed to delete Article");
    }
  };

  const faqColumns = [
    { title: 'Question', dataIndex: 'question', key: 'question' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm title="Are you sure?" onConfirm={() => handleDeleteFaq(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  const articleColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm title="Are you sure?" onConfirm={() => handleDeleteArticle(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="w-full">
      <Title level={3} className="m-0 mb-6">Content Management</Title>
      <Tabs defaultActiveKey="faqs">
        <Tabs.TabPane tab="FAQs" key="faqs">
          <Card className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-end mb-4">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFaqModalVisible(true)}>Add FAQ</Button>
            </div>
            <Table dataSource={faqs} columns={faqColumns} rowKey="id" pagination={{ pageSize: 10 }} className={isDarkMode ? 'dark-table' : ''} />
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane tab="Articles" key="articles">
          <Card className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-end mb-4">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsArticleModalVisible(true)}>Add Article</Button>
            </div>
            <Table dataSource={articles} columns={articleColumns} rowKey="id" pagination={{ pageSize: 10 }} className={isDarkMode ? 'dark-table' : ''} />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      <Modal title="Create FAQ" visible={isFaqModalVisible} onCancel={() => setIsFaqModalVisible(false)} onOk={() => faqForm.submit()}>
        <Form form={faqForm} layout="vertical" onFinish={handleCreateFaq}>
          <Form.Item name="question" label="Question" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="answer" label="Answer" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="category" label="Category"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Create Article" visible={isArticleModalVisible} onCancel={() => setIsArticleModalVisible(false)} onOk={() => articleForm.submit()}>
        <Form form={articleForm} layout="vertical" onFinish={handleCreateArticle}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
