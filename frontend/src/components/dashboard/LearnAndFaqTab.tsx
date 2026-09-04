import React, { useEffect, useState } from 'react';
import { Card, Input, Typography, Collapse, message, Tag, Button, Spin, List } from 'antd';
import { SearchOutlined, ReadOutlined, QuestionCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import * as contentApi from '../../api/content.api';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface LearnAndFaqTabProps {
  isDarkMode: boolean;
}

export const LearnAndFaqTab: React.FC<LearnAndFaqTabProps> = ({ isDarkMode }) => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [webResults, setWebResults] = useState<any[]>([]);
  const [webSearching, setWebSearching] = useState(false);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const fData = await contentApi.getFaqs();
      const aData = await contentApi.getArticles();
      setFaqs(fData);
      setArticles(aData);
    } catch (e) {
      message.error("Failed to load educational content");
    }
  };

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setWebResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchWebResults(searchQuery);
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchWebResults = async (query: string) => {
    try {
      setWebSearching(true);
      // Using Wikipedia's open API as a free alternative to Google Search API
      const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' health medical')}&utf8=&format=json&origin=*`);
      const data = await response.json();
      if (data.query && data.query.search) {
        setWebResults(data.query.search.slice(0, 5));
      }
    } catch (e) {
      console.error("Web search failed", e);
    } finally {
      setWebSearching(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
      <div className="text-center mb-8">
        <Title level={2} className="!mb-2">Educational Resource Center</Title>
        <Text className="text-slate-500">Read health articles and browse frequently asked questions.</Text>
      </div>

      <div className="flex justify-center w-full">
        <Input
          size="large"
          placeholder="Search FAQs and Articles..."
          prefix={<SearchOutlined className="text-slate-400 mr-2" />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="rounded-full shadow-sm max-w-2xl w-full flex items-center"
          style={{ padding: '12px 24px', fontSize: '16px' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Articles Section */}
        <div className="space-y-4">
          <Title level={4} className="flex items-center gap-2 m-0 text-blue-600">
            <ReadOutlined /> Health Articles
          </Title>
          <div className="space-y-4">
            {filteredArticles.length === 0 ? (
              <Text className="text-slate-400 italic">No articles found.</Text>
            ) : (
              filteredArticles.map(article => (
                <Card 
                  key={article.id} 
                  className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                >
                  <Title level={5} className="!m-0 !mb-2">{article.title}</Title>
                  <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }} className="text-slate-500 m-0 whitespace-pre-wrap">
                    {article.content}
                  </Paragraph>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* FAQs Section */}
        <div className="space-y-4">
          <Title level={4} className="flex items-center gap-2 m-0 text-emerald-600">
            <QuestionCircleOutlined /> Frequently Asked Questions
          </Title>
          {filteredFaqs.length === 0 ? (
            <Text className="text-slate-400 italic">No FAQs found.</Text>
          ) : (
            <Collapse 
              ghost 
              className={isDarkMode ? 'dark-collapse' : ''}
              expandIconPosition="end"
            >
              {filteredFaqs.map(faq => (
                <Panel 
                  key={faq.id} 
                  header={<span className="font-semibold">{faq.question}</span>} 
                  extra={<Tag color="blue" className="border-0">{faq.category}</Tag>}
                  className="mb-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <Text className="text-slate-500 whitespace-pre-wrap">{faq.answer}</Text>
                </Panel>
              ))}
            </Collapse>
          )}
        </div>
      </div>

      {searchQuery.trim().length > 0 && (
        <div className="mt-12 space-y-4">
          <Title level={4} className="flex items-center gap-2 m-0 text-blue-500">
            <GlobalOutlined /> External Web Results
          </Title>
          <Card className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {webSearching ? (
              <div className="flex justify-center p-8"><Spin /></div>
            ) : webResults.length === 0 ? (
              <Text className="text-slate-400 italic">No external web results found.</Text>
            ) : (
              <List
                itemLayout="vertical"
                dataSource={webResults}
                renderItem={(item: any) => (
                  <List.Item className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <List.Item.Meta
                      title={
                        <a 
                          href={`https://en.wikipedia.org/?curid=${item.pageid}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-600 font-bold text-lg hover:underline"
                        >
                          {item.title}
                        </a>
                      }
                      description={
                        <div 
                          className="text-slate-500 text-sm mt-1" 
                          dangerouslySetInnerHTML={{ __html: item.snippet + '...' }} 
                        />
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
