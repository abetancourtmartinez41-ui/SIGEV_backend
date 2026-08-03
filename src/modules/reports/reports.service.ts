import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateOfferPdf(eventId: string, res: Response): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { items: true, createdBy: true },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=oferta-${event.code}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text('OFERTA ECONÓMICA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Evento: ${event.name}`);
    doc.text(`Código: ${event.code}`);
    doc.text(`Municipio: ${event.municipalityName || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(10).text('Ítems:', { underline: true });
    doc.moveDown(0.5);

    const items = event.items || [];
    let total = 0;

    items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name} - Cant: ${item.quantity} - ` +
        `P/U: $${Number(item.unitPrice).toLocaleString('es-CO')} - ` +
        `Total: $${Number(item.totalValue).toLocaleString('es-CO')}`,
      );
      total += Number(item.totalValue);
    });

    doc.moveDown();
    doc.fontSize(12).text(`TOTAL: $${total.toLocaleString('es-CO')}`, { align: 'right' });

    doc.end();
  }

  async generateComunicadoAprobacionPdf(params: {
    event: {
      code: string;
      name: string;
      municipalityName: string | null;
      municipalityCategory: string | null;
    };
    quotation: {
      code: string;
      name: string;
      cliente: string | null;
      currency: string;
      amount: number;
      quotationDate: Date | null;
      validityDays: number | null;
      ally: { name: string } | null;
      items: {
        description: string;
        quantity: number;
        unitPrice: number;
        totalValue: number;
      }[];
    };
    approver: { fullName: string; email: string };
    approvedAt: Date;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const money = (value: number) =>
      `$ ${Number(value).toLocaleString('es-CO')} ${params.quotation.currency || 'COP'}`;
    const dateCO = (value: Date | null) =>
      value
        ? value.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
        : 'N/A';

    const field = (key: string, value: string) => {
      doc.font('Helvetica-Bold').text(`${key}: `, { continued: true });
      doc.font('Helvetica').text(value);
    };

    doc.fontSize(15).text('COMUNICADO DE APROBACIÓN', { align: 'center' });
    doc.moveDown(0.2);
    doc
      .fontSize(9)
      .text('SIGEV - Sistema de Información para la Gestión de Eventos', {
        align: 'center',
      });
    doc.moveDown(1.5);

    doc.fontSize(10).text(`Bogotá D.C., ${dateCO(params.approvedAt)}`, {
      align: 'right',
    });
    doc.moveDown(1);

    doc
      .fontSize(10)
      .text(
        'Por medio de la presente, se comunica que la oferta económica relacionada a continuación ha sido APROBADA para el evento:',
        { align: 'justify' },
      );
    doc.moveDown(1);

    doc.fontSize(11).text('Datos del evento', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    field('Número de evento', params.event.code);
    field('Nombre', params.event.name);
    field('Municipio', params.event.municipalityName || 'N/A');
    if (params.event.municipalityCategory) {
      field('Categoría municipal', params.event.municipalityCategory);
    }
    doc.moveDown(0.8);

    doc.fontSize(11).text('Oferta económica aprobada', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    field('Código de oferta', params.quotation.code);
    field('Nombre', params.quotation.name);
    if (params.quotation.cliente) {
      field('Cliente', params.quotation.cliente);
    }
    if (params.quotation.ally?.name) {
      field('Aliado estratégico', params.quotation.ally.name);
    }
    if (params.quotation.quotationDate) {
      field('Fecha de cotización', dateCO(params.quotation.quotationDate));
    }
    if (params.quotation.validityDays) {
      field('Vigencia', `${params.quotation.validityDays} días`);
    }
    doc.moveDown(0.8);

    doc.fontSize(11).text('Detalle de la oferta', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    const startX = 50;
    const colWidths = [24, 200, 50, 80, 90];
    const headerRow = ['#', 'Descripción', 'Cant.', 'P/U', 'Total'];
    const rowY = doc.y;
    doc.font('Helvetica-Bold');
    headerRow.forEach((cell, index) => {
      const colX = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0);
      doc.text(cell, colX, rowY, { width: colWidths[index] });
    });
    doc.font('Helvetica');
    doc.moveDown(0.3);

    params.quotation.items.forEach((item, index) => {
      const itemY = doc.y;
      doc.text(String(index + 1), startX, itemY, { width: colWidths[0] });
      doc.text(item.description, startX + colWidths[0], itemY, {
        width: colWidths[1],
      });
      doc.text(String(item.quantity), startX + colWidths[0] + colWidths[1], itemY, {
        width: colWidths[2],
      });
      doc.text(
        money(item.unitPrice),
        startX + colWidths[0] + colWidths[1] + colWidths[2],
        itemY,
        { width: colWidths[3] },
      );
      doc.text(
        money(item.totalValue),
        startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        itemY,
        { width: colWidths[4] },
      );
      doc.moveDown(0.2);
    });

    doc.moveDown(0.8);
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`GRAN TOTAL: ${money(params.quotation.amount)}`, {
      align: 'right',
    });
    doc.font('Helvetica').fontSize(10);
    doc.moveDown(1.5);

    doc.fontSize(11).text('Aprobado por:', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    field('Aprobador', params.approver.fullName);
    field('Correo', params.approver.email);
    field('Fecha de aprobación', dateCO(params.approvedAt));
    doc.moveDown(1.5);
    doc.text('Firma: ______________________________', { align: 'center' });

    doc.end();
    return finished;
  }

  async generateMatrixExcel(eventId: string, res: Response): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { items: true, createdBy: true },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Matriz');

    sheet.columns = [
      { header: 'Ítem', key: 'name', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'P/U', key: 'unitPrice', width: 15 },
      { header: 'Base', key: 'baseValue', width: 15 },
      { header: 'IVA', key: 'ivaValue', width: 15 },
      { header: 'Imp. Consumo', key: 'consumptionTaxValue', width: 15 },
      { header: 'Fee', key: 'feeValue', width: 15 },
      { header: 'IVA Fee', key: 'feeIvaValue', width: 15 },
      { header: 'Total', key: 'totalValue', width: 15 },
    ];

    const items = event.items || [];
    items.forEach((item) => {
      sheet.addRow({
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        baseValue: Number(item.baseValue),
        ivaValue: Number(item.ivaValue),
        consumptionTaxValue: Number(item.consumptionTaxValue),
        feeValue: Number(item.feeValue),
        feeIvaValue: Number(item.feeIvaValue),
        totalValue: Number(item.totalValue),
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=matriz-${event.code}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
