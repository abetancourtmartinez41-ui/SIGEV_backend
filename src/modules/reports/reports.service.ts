import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
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
