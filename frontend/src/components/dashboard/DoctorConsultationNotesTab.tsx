import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Input, Button, DatePicker, Tag, Avatar, Space, Empty, Spin, Modal, Popconfirm, message } from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined, 
  CalendarOutlined, 
  ClockCircleOutlined, 
  UserOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  MessageOutlined, 
  ClearOutlined,
  CopyOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { User } from '../../types';
import * as doctorApi from '../../api/doctor.api';

const { Title, Text, Paragraph } = Typography;

interface DoctorConsultationNotesTabProps {
  currentUser: User;
  isDarkMode: boolean;
  onSelectPatientForChat?: (patientId: number) => void;
}

export const DoctorConsultationNotesTab: React.FC<DoctorConsultationNotesTabProps> = ({
  currentUser,
  isDarkMode,
  onSelectPatientForChat
}) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<Dayjs | null>(null);
  const [selectedNoteModal, setSelectedNoteModal] = useState<any | null>(null);

  const fetchAllNotes = async () => {
    if (!currentUser.email) return;
    try {
      setLoading(true);
      const data = await doctorApi.getConsultationNotes(currentUser.email);
      setNotes(data || []);
    } catch (e: any) {
      console.error(e);
      message.error(e.message || 'Failed to load consultation records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNotes();
  }, [currentUser.email]);

  const handleDelete = async (noteId: number) => {
    try {
      await doctorApi.deleteConsultationNote(noteId, currentUser.email);
      message.success('Consultation record deleted');
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNoteModal?.id === noteId) {
        setSelectedNoteModal(null);
      }
    } catch (e: any) {
      console.error(e);
      message.error(e.message || 'Failed to delete record');
    }
  };

  // Filtered notes
  const filteredNotes = notes.filter(n => {
    const matchesSearch = !searchQuery.trim() || 
      (n.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.patient_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.diagnosis || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.treatment || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = !filterDate || n.date === filterDate.format('YYYY-MM-DD');

    return matchesSearch && matchesDate;
  });

  const getInitials = (name?: string) => {
    if (!name) return 'P';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 w-full flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
      {/* Header Banner */}
      <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 shadow-xs ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileTextOutlined className="text-2xl" />
          </div>
          <div>
            <Title level={4} className={`!m-0 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Consultation Notes
            </Title>
            <Text className="text-xs text-slate-400">
              View and manage all saved clinical observations, diagnoses, and treatment suggestions.
            </Text>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card 
        className={`border shadow-xs rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={14} md={12}>
            <Input
              prefix={<SearchOutlined className="text-slate-400 mr-1" />}
              placeholder="Search diagnosis, treatment, or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              className={`rounded-xl ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
            />
          </Col>

          <Col xs={16} sm={7} md={8}>
            <DatePicker
              value={filterDate}
              onChange={(d) => setFilterDate(d)}
              placeholder="Filter by date..."
              className="w-full rounded-xl"
              allowClear
            />
          </Col>

          <Col xs={8} sm={3} md={4} className="flex justify-end">
            {(searchQuery || filterDate) && (
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  setSearchQuery('');
                  setFilterDate(null);
                }}
                className="rounded-xl text-xs"
              >
                Clear
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* Records List (Full Width List View) */}
      {loading ? (
        <div className="py-16 flex justify-center"><Spin size="large" /></div>
      ) : filteredNotes.length === 0 ? (
        <div className={`p-12 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <Empty 
            description={
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                {searchQuery || filterDate 
                  ? 'No consultation records matching your filter criteria.'
                  : 'No consultation records saved yet. Records created during consultations will appear here.'}
              </span>
            } 
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNoteModal(note)}
              className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 cursor-pointer hover:shadow-md hover:border-blue-400 active:scale-[0.99] ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-900' : 'bg-white border-slate-200/80 hover:bg-blue-50/20 shadow-xs'
              }`}
            >
              {/* Left: Patient Avatar & Notes Content */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <Avatar size={44} className="bg-blue-600 text-white font-bold flex-shrink-0 mt-0.5">
                  {getInitials(note.patient_name || note.patient_email)}
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {note.patient_name || note.patient_email || 'Patient'}
                    </span>
                    <span className="text-xs text-slate-400">
                      ID: #P-2026-{String(note.patient_id).padStart(4, '0')}
                    </span>
                    <Tag color="blue" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                      <CalendarOutlined className="mr-1" /> {note.date}
                    </Tag>
                    <Tag color="cyan" className="rounded-md border-0 px-2 py-0.5 text-xs font-semibold m-0 flex items-center">
                      <ClockCircleOutlined className="mr-1" /> {note.time}
                    </Tag>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5">
                    {note.diagnosis && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                        <strong className="text-slate-400">Dx:</strong> {note.diagnosis}
                      </div>
                    )}
                    {note.treatment && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        <strong className="text-slate-400">Rx:</strong> {note.treatment}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => setSelectedNoteModal(note)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  View Details
                </Button>

                {onSelectPatientForChat && (
                  <Button
                    size="small"
                    type="default"
                    icon={<MessageOutlined />}
                    onClick={() => onSelectPatientForChat(note.patient_id)}
                    className="rounded-lg text-xs"
                  >
                    Open Patient
                  </Button>
                )}

                <Popconfirm
                  title="Delete this record?"
                  onConfirm={() => handleDelete(note.id)}
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
                    icon={<DeleteOutlined />}
                    className="hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full h-8 w-8 flex items-center justify-center p-0"
                  />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pop-up Modal for Full Details */}
      <Modal
        open={!!selectedNoteModal}
        onCancel={() => setSelectedNoteModal(null)}
        footer={[
          onSelectPatientForChat && selectedNoteModal ? (
            <Button
              key="open"
              type="primary"
              icon={<MessageOutlined />}
              className="bg-blue-600 rounded-lg"
              onClick={() => {
                const pid = selectedNoteModal.patient_id;
                setSelectedNoteModal(null);
                onSelectPatientForChat(pid);
              }}
            >
              Open Patient Chat & Consultation
            </Button>
          ) : null,
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              if (selectedNoteModal) {
                const text = `Consultation Record (${selectedNoteModal.date} ${selectedNoteModal.time})\nPatient: ${selectedNoteModal.patient_name || selectedNoteModal.patient_email}\n\n[Diagnosis / Findings]\n${selectedNoteModal.diagnosis || 'None'}\n\n[Treatment Suggestions]\n${selectedNoteModal.treatment || 'None'}`;
                navigator.clipboard.writeText(text);
                message.success('Record copied to clipboard');
              }
            }}
            className="rounded-lg"
          >
            Copy Record
          </Button>,
          <Button key="close" onClick={() => setSelectedNoteModal(null)} className="rounded-lg">
            Close
          </Button>
        ].filter(Boolean)}
        title={
          <div className="flex items-center gap-2 text-base font-bold">
            <FileTextOutlined className="text-blue-500" />
            <span>Consultation Record Details</span>
          </div>
        }
        centered
        width={560}
      >
        {selectedNoteModal && (
          <div className="space-y-4 py-2 text-xs">
            {/* Patient Card */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <Avatar size={42} className="bg-blue-600 text-white font-bold">
                  {getInitials(selectedNoteModal.patient_name || selectedNoteModal.patient_email)}
                </Avatar>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                    {selectedNoteModal.patient_name || selectedNoteModal.patient_email}
                  </div>
                  <div className="text-slate-400">
                    Patient ID: #P-2026-{String(selectedNoteModal.patient_id).padStart(4, '0')}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <Tag color="blue" className="rounded-md font-semibold px-2 py-0.5 m-0 mb-1 block">
                  <CalendarOutlined className="mr-1" /> {selectedNoteModal.date}
                </Tag>
                <Tag color="cyan" className="rounded-md font-semibold px-2 py-0.5 m-0 block">
                  <ClockCircleOutlined className="mr-1" /> {selectedNoteModal.time}
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
              <Paragraph className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 m-0 text-xs">
                {selectedNoteModal.diagnosis || <span className="text-slate-400 italic">No diagnosis recorded</span>}
              </Paragraph>
            </div>

            {/* Treatment */}
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileTextOutlined className="text-emerald-500" /> Treatment Suggestions
              </div>
              <Paragraph className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 m-0 text-xs">
                {selectedNoteModal.treatment || <span className="text-slate-400 italic">No treatment suggestions recorded</span>}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
