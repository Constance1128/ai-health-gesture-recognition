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
      <td style="padding: 8px 0; font-size: 11px; color: #475569;">${new Date(r.timestamp * 1000).toLocaleString()}</td>
      <td style="padding: 8px 0; font-size: 11px; font-weight: bold; text-transform: uppercase;">${r.mode}</td>
      <td style="padding: 8px 0; font-size: 11px;">${r.status}</td>
      <td style="padding: 8px 0; font-size: 11px; color: #64748b;">
        ${r.metrics_json ? Object.entries(r.metrics_json).map(([k,v]) => `${k.replace(/_/g, ' ')}: ${Number(v).toFixed(1)}`).join(' | ') : `${r.metric_1?.name || 'N/A'}: ${r.metric_1?.value || 0} | ${r.metric_2?.name || 'N/A'}: ${r.metric_2?.value || 0}`}
      </td>
    </tr>
  `).join('');

  let dynamicSections = '';

  if (analysisResult.mode === 'full') {
    const { neck_angle = 0, shoulder_alignment = 0, tremor_prob = 0, tremor_freq = 0 } = analysisResult.metrics;
    
    let postureRisk = 'Normal';
    if (neck_angle > 30) postureRisk = 'Kyphosis';
    else if (shoulder_alignment > 15) postureRisk = 'Scoliosis';
    else if (neck_angle > 15) postureRisk = 'Text Neck';

    let tremorRisk = 'None';
    if (tremor_prob > 0.6) tremorRisk = 'Essential (8-12Hz)';
    else if (tremor_prob > 0.25) tremorRisk = 'Parkinsonian (4-6Hz)';

    dynamicSections = `
      <div class="section-title">Section 1: Musculoskeletal Assessment</div>
      <div class="metric-box">
        <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>Neck Tilt Angle: <strong>${neck_angle.toFixed(1)}&deg;</strong></div>
          <div>Shoulder Discrepancy: <strong>${shoulder_alignment.toFixed(1)}&deg;</strong></div>
          <div style="grid-column: 1 / -1; margin-top: 5px; color: #15803d; font-weight: bold;">Flagged Risk: ${postureRisk}</div>
        </div>
      </div>

      <div class="section-title">Section 2: Neurological Motor Assessment</div>
      <div class="metric-box">
        <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>Tremor Probability: <strong>${(tremor_prob * 100).toFixed(1)}%</strong></div>
          <div>Dominant Frequency: <strong>${tremor_freq > 0 ? tremor_freq.toFixed(1) + ' Hz' : 'N/A'}</strong></div>
          <div style="grid-column: 1 / -1; margin-top: 5px; color: #15803d; font-weight: bold;">Flagged Risk: ${tremorRisk}</div>
        </div>
      </div>

      <div class="section-title">Section 3: Kinematic Gait Assessment</div>
      <div class="metric-box">
        <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="grid-column: 1 / -1; color: #64748b; font-style: italic;">Note: Gait metrics are run independently in Gait Mode. Run a Gait Analysis to populate this section.</div>
        </div>
      </div>
    `;
  } else {
    dynamicSections = `
      <div class="section-title">Current Diagnostic Assessment</div>
      <div class="metric-box">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #15803d;">Status: ${analysisResult.status}</div>
        <div style="font-size: 12px;">
          ${Object.entries(analysisResult.metrics).map(([name, val]) => `
            <span style="margin-right: 20px;">${name.replace('_', ' ').toUpperCase()}: <strong>${val}</strong></span>
          `).join('')}
        </div>
      </div>
    `;
  }

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
          .section-title { font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-top: 30px; color: #0f172a; font-weight: 600; }
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
          <div class="subtitle">Multi-Modal AI Kinesiology Platform</div>
        </div>
        
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Patient ID:</span> active_session_patient</div>
          <div class="meta-item"><span class="meta-label">Screening Date:</span> ${timestampStr}</div>
          <div class="meta-item"><span class="meta-label">Assessment Module:</span> <span style="text-transform: uppercase; font-weight: bold;">${analysisResult.mode}</span></div>
          <div class="meta-item"><span class="meta-label">Overall Health Score:</span> <span style="color: #10b981; font-weight: bold; font-size: 14px;">${Number(analysisResult.score).toFixed(1)}/100</span></div>
        </div>

        ${dynamicSections}

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
