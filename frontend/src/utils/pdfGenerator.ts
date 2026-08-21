import { AnalysisResult, DBHistoryRecord } from '../types';

/**
 * Generates and downloads a formatted clinical report in PDF format via the browser print dialog.
 */
export const downloadPDFReport = (
  analysisResult: AnalysisResult | null,
  dbHistory: DBHistoryRecord[]
) => {
  if (!analysisResult) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const timestampStr = new Date().toLocaleString();
  const historyRows = dbHistory.slice(0, 8).map(r => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 0; font-size: 11px; color: #475569;">${new Date(r.timestamp * 1000).toLocaleTimeString()}</td>
      <td style="padding: 8px 0; font-size: 11px; font-weight: bold; text-transform: uppercase;">${r.mode}</td>
      <td style="padding: 8px 0; font-size: 11px;">${r.status}</td>
      <td style="padding: 8px 0; font-size: 11px; color: #64748b;">${r.metric_1.name}: ${r.metric_1.value} | ${r.metric_2.name}: ${r.metric_2.value}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Clinical Health Screening Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
          .header { border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
          .title { margin: 0; font-size: 24px; color: #0f172a; }
          .subtitle { margin: 5px 0 0 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .meta-item { font-size: 12px; }
          .meta-label { color: #64748b; font-weight: 600; }
          .section-title { font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-top: 30px; color: #0f172a; }
          .metric-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin-top: 15px; }
          .rec-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin-top: 15px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table th { text-align: left; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 11px; color: #64748b; }
          .footer { margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Clinical Movement & Kinesiology Report</h1>
          <div class="subtitle">AI-Based Health Condition Detection System</div>
        </div>
        
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Patient ID:</span> active_session_patient</div>
          <div class="meta-item"><span class="meta-label">Screening Date:</span> ${timestampStr}</div>
          <div class="meta-item"><span class="meta-label">Assessment Module:</span> <span style="text-transform: uppercase; font-weight: bold;">${analysisResult.mode}</span></div>
          <div class="meta-item"><span class="meta-label">Overall Health Score:</span> <span style="color: #10b981; font-weight: bold; font-size: 14px;">${analysisResult.score}/100</span></div>
        </div>

        <div class="section-title">Current Diagnostic Assessment</div>
        <div class="metric-box">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #15803d;">Status: ${analysisResult.status}</div>
          <div style="font-size: 12px;">
            ${Object.entries(analysisResult.metrics).map(([name, val]) => `
              <span style="margin-right: 20px;">${name.replace('_', ' ').toUpperCase()}: <strong>${val}</strong></span>
            `).join('')}
          </div>
        </div>

        <div class="section-title">Clinical Recommendation</div>
        <div class="rec-box">
          <div style="font-size: 12px; color: #1e40af;">${analysisResult.recommendation}</div>
        </div>

        <div class="section-title">Recent Session History (SQLite Database Logs)</div>
        <table class="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Assessment</th>
              <th>Status</th>
              <th>Diagnostic Metrics</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows || '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">No history records found.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          This report was generated locally using Edge-AI processing. No private video files were uploaded to the cloud.
          <br>
          <em>Note: This is an automated screening assessment and should be verified by a licensed medical practitioner.</em>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
