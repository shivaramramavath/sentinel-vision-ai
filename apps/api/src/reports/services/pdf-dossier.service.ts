import { Injectable, Logger } from '@nestjs/common';
const PDFDocument = require('pdfkit');

export interface DossierData {
  caseId: string;
  caseNumber: string;
  title: string;
  personName: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  priority: string;
  status: string;
  journeyNodes: Array<{
    order: number;
    cameraId: string;
    cameraLocation: string;
    timestamp: string;
    fusedScore: number;
    status: string;
  }>;
  evidenceItems: Array<{
    id: string;
    cameraId: string;
    sha256Hash: string;
    sha256Crop: string;
    capturedAt: string;
    fusedScore: number;
    isRedacted: boolean;
    chainOfCustody: Array<{
      action: string;
      actor: string;
      timestamp: string;
      hash: string;
    }>;
  }>;
  generatedBy: string;
  generatedAt: string;
}

@Injectable()
export class PdfDossierService {
  private readonly logger = new Logger(PdfDossierService.name);

  /**
   * Generates a forensic Case Dossier & Journey Report PDF as a Buffer.
   */
  async generateDossierPdf(data: DossierData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: any) => reject(err));

        // 1. Header & Mandatory Human-Verification Compliance Notice
        doc.rect(40, 40, 515, 60).fill('#09090B');
        doc.fillColor('#FFFFFF').fontSize(16).text('SENTINEL VISION AI', 55, 52, { bold: true } as any);
        doc.fontSize(10).text('FORENSIC CASE DOSSIER & RECONSTRUCTED JOURNEY REPORT', 55, 72);

        doc.moveDown(3);
        doc.fillColor('#D97706').fontSize(9).text(
          'COMPLIANCE NOTICE: ALL OUTPUTS ARE POSSIBLE SIGHTINGS FOR HUMAN VERIFICATION. NEVER AUTO-CONFIRMS IDENTITY.',
          40,
          115,
          { underline: true, bold: true } as any,
        );

        // 2. Case Details Card
        doc.moveDown(1.5);
        doc.fillColor('#18181B').fontSize(13).text('1. Case Overview & Missing Subject Profile', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(9).fillColor('#27272A');
        const col1 = 45;
        const col2 = 280;
        let y = doc.y;

        doc.text(`Case Number: ${data.caseNumber}`, col1, y);
        doc.text(`Priority Level: ${data.priority.toUpperCase()}`, col2, y);
        y += 15;
        doc.text(`Subject Name: ${data.personName}`, col1, y);
        doc.text(`Age / Gender: ${data.age} yrs / ${data.gender}`, col2, y);
        y += 15;
        doc.text(`Case Title: ${data.title}`, col1, y);
        doc.text(`Current Status: ${data.status.toUpperCase()}`, col2, y);
        y += 15;
        doc.text(`Last Seen Location: ${data.lastSeenLocation}`, col1, y);
        doc.text(`Report Generated At: ${data.generatedAt}`, col2, y);

        // 3. Chronological Cross-Camera Journey Sequence
        doc.y = y + 25;
        doc.fillColor('#18181B').fontSize(13).text('2. Reconstructed Cross-Camera Journey Timeline', { underline: true });
        doc.moveDown(0.5);

        if (data.journeyNodes && data.journeyNodes.length > 0) {
          doc.fontSize(8).fillColor('#71717A');
          doc.text('Sequence | Camera ID | Camera Location | Timestamp | Match Plausibility | Verification', 45, doc.y);
          doc.moveDown(0.3);
          doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke('#E4E4E7');
          doc.moveDown(0.5);

          data.journeyNodes.forEach((node, idx) => {
            doc.fillColor('#18181B').fontSize(8.5);
            const scorePercent = `${Math.round(node.fusedScore * 100)}%`;
            doc.text(
              `Hop #${idx + 1}  |  ${node.cameraId}  |  ${node.cameraLocation || 'N/A'}  |  ${node.timestamp}  |  ${scorePercent} (Possible match)  |  ${node.status.toUpperCase()}`,
              45,
              doc.y,
            );
            doc.moveDown(0.4);
          });
        } else {
          doc.fontSize(9).fillColor('#71717A').text('No cross-camera sightings recorded for this case yet.', 45, doc.y);
        }

        // 4. Forensic Evidence Appendix (SHA-256 Hashes)
        doc.moveDown(1.5);
        doc.fillColor('#18181B').fontSize(13).text('3. Forensic Evidence Appendix & Cryptographic Checksums', { underline: true });
        doc.moveDown(0.5);

        if (data.evidenceItems && data.evidenceItems.length > 0) {
          data.evidenceItems.slice(0, 5).forEach((ev, idx) => {
            doc.fontSize(8.5).fillColor('#09090B').text(`Evidence Item #${idx + 1} (${ev.id})`, 45, doc.y, { bold: true } as any);
            doc.fontSize(7.5).fillColor('#3F3F46');
            doc.text(`Captured: ${ev.capturedAt} on Camera ${ev.cameraId} | Redacted: ${ev.isRedacted ? 'YES' : 'NO'}`);
            doc.text(`SHA-256 (Frame): ${ev.sha256Hash || 'N/A'}`);
            doc.text(`SHA-256 (Crop):  ${ev.sha256Crop || 'N/A'}`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(9).fillColor('#71717A').text('No forensic evidence artifacts cataloged yet.', 45, doc.y);
        }

        // 5. Chain of Custody & Audit Trail
        doc.moveDown(1.5);
        doc.fillColor('#18181B').fontSize(13).text('4. Chain of Custody & Audit Log', { underline: true });
        doc.moveDown(0.5);

        const allCustody = data.evidenceItems.flatMap((e) => e.chainOfCustody || []);
        if (allCustody.length > 0) {
          allCustody.slice(0, 8).forEach((entry) => {
            doc.fontSize(7.5).fillColor('#27272A');
            doc.text(
              `[${entry.timestamp}] ACTION: ${entry.action.toUpperCase()} | ACTOR: ${entry.actor} | HASH: ${entry.hash.substring(0, 24)}...`,
              45,
              doc.y,
            );
            doc.moveDown(0.3);
          });
        } else {
          doc.fontSize(9).fillColor('#71717A').text('No chain of custody log entries available.', 45, doc.y);
        }

        // Footer
        doc.fontSize(7).fillColor('#A1A1AA').text(
          `Generated by ${data.generatedBy} via Sentinel Vision AI Engine | Document Expiry: 60 minutes from issue`,
          40,
          780,
          { align: 'center' },
        );

        doc.end();
      } catch (err) {
        this.logger.error('Failed generating PDF dossier:', err);
        reject(err);
      }
    });
  }
}
