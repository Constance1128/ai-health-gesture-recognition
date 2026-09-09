import React, { useState, useEffect } from 'react';
import { Card, Typography, Input, Button, message, Space, DatePicker, TimePicker } from 'antd';
import { 
  FileTextOutlined, 
  SaveOutlined, 
  CalendarOutlined, 
  ClearOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { User } from '../../types';
import * as doctorApi from '../../api/doctor.api';

const { Text } = Typography;

interface ConsultationNotesPanelProps {
  currentUser: User;
  selectedPatient: User;
  isDarkMode: boolean;
}

export const ConsultationNotesPanel: React.FC<ConsultationNotesPanelProps> = ({
  currentUser,
  selectedPatient,
  isDarkMode
}) => {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedTime, setSelectedTime] = useState<Dayjs>(dayjs());
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatment, setTreatment] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Reset editor whenever selected patient changes
  useEffect(() => {
    handleClearEditor();
  }, [selectedPatient.id]);

  const handleSave = async () => {
    if (!diagnosis.trim() && !treatment.trim()) {
      message.warning('Please enter diagnosis findings or treatment suggestions before saving.');
      return;
    }

    try {
      setSaving(true);
      const dateStr = selectedDate ? selectedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const timeStr = selectedTime ? selectedTime.format('HH:mm') : dayjs().format('HH:mm');

      await doctorApi.saveConsultationNote({
        email: currentUser.email,
        patient_id: selectedPatient.id,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim(),
        date: dateStr,
        time: timeStr
      });

      message.success('Consultation record saved successfully!');
      
      // Clear editor form after save & reset to live now time
      handleClearEditor();
    } catch (e: any) {
      console.error(e);
      message.error(e.message || 'Failed to save consultation record');
    } finally {
      setSaving(false);
    }
  };

  const handleClearEditor = () => {
    setDiagnosis('');
    setTreatment('');
    setSelectedDate(dayjs());
    setSelectedTime(dayjs());
  };

  return (
    <Card 
      title={
        <div className="flex items-center justify-between gap-2">
          <Space>
            <FileTextOutlined className="text-blue-600" />
            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Consultation Notes
            </span>
          </Space>
        </div>
      }
      className={`h-full flex flex-col border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px', overflow: 'hidden' }}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Scrollable inputs area */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar">
          {/* Date & Time Trigger Picker */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <CalendarOutlined className="text-blue-500" /> Record Date & Time
              </span>
              <Button 
                type="link" 
                size="small" 
                className="p-0 h-auto text-[11px] text-blue-500 hover:text-blue-600 font-semibold"
                onClick={() => {
                  setSelectedDate(dayjs());
                  setSelectedTime(dayjs());
                }}
              >
                Set to Now
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                value={selectedDate}
                onChange={(d) => setSelectedDate(d || dayjs())}
                format="YYYY-MM-DD"
                allowClear={false}
                size="small"
                className="w-full rounded-lg"
              />
              <TimePicker
                value={selectedTime}
                onChange={(t) => setSelectedTime(t || dayjs())}
                format="HH:mm"
                allowClear={false}
                size="small"
                className="w-full rounded-lg"
              />
            </div>
          </div>

          {/* Diagnosis & Findings */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Diagnosis / Findings
            </div>
            <Input.TextArea
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Enter clinical observations, symptoms, diagnosis..."
              className={`rounded-xl border text-xs leading-relaxed ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'
              }`}
            />
          </div>

          {/* Treatment Suggestions */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Treatment Suggestions
            </div>
            <Input.TextArea
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              rows={3}
              placeholder="Enter recommendations, exercises, prescriptions, follow-up..."
              className={`rounded-xl border text-xs leading-relaxed resize-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'
              }`}
            />
          </div>
        </div>

        {/* Sticky Bottom Action Buttons */}
        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <Button 
            type="primary" 
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 border-0 rounded-xl font-bold h-9 shadow-xs text-xs"
          >
            Save Appointment Record
          </Button>
          <Button 
            icon={<ClearOutlined />}
            onClick={handleClearEditor}
            className="rounded-xl text-xs h-9 px-3"
            title="Clear form"
          >
            Clear
          </Button>
        </div>
      </div>
    </Card>
  );
};
