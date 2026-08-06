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

  async generatePresupuestoFinalPdf(params: {
    event: {
      code: string;
      suffix: string;
      name: string;
      municipalityName: string | null;
      municipalityCategory: string | null;
    };
    quotation: {
      code: string;
      name: string;
      cliente: string | null;
      ally: { name: string } | null;
    };
    oferta: {
      code: string;
      name: string;
      currency: string;
      baseTotal: number;
      ivaTotal: number;
      impuestoConsumoTotal: number;
      feeTarifadoTotal: number;
      feeTercerosTotal: number;
      feeTotal: number;
      ivaFeeTotal: number;
      total: number;
      items: {
        description: string;
        quantity: number;
        unitPrice: number;
        baseValue: number;
        ivaValue: number;
        consumptionTaxValue: number;
        feeTarifadoValue: number;
        feeTercerosValue: number;
        feeIvaValue: number;
        totalValue: number;
      }[];
    };
    generatedBy: { fullName: string; email: string };
    generatedAt: Date;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 45, size: 'LETTER', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // ---- Constantes ----
    const PAGE_W = 612;
    const M = 45;
    const CW = PAGE_W - M * 2;
    const INK = '#111827';
    const MUTED = '#6b7280';
    const BORDER = '#d1d5db';
    const LIGHT = '#f3f4f6';
    const LIGHTER = '#fafafa';
    const SAFE_Y = 724;
    const FOOTER_Y = 736;

    const currency = params.oferta.currency || 'COP';
    const money = (value: number) => `$ ${Number(value).toLocaleString('es-CO')}`;
    const moneyCur = (value: number) => `$ ${Number(value).toLocaleString('es-CO')} ${currency}`;
    const dateCO = (value: Date) =>
      value.toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > SAFE_Y) {
        doc.addPage();
        return true;
      }
      return false;
    };

    const sectionTitle = (title: string) => {
      ensureSpace(34);
      doc.moveDown(0.8);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
      doc.text(title, M, doc.y);
      doc.moveDown(0.25);
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(1).stroke(BORDER);
      doc.moveDown(0.45);
    };

    const infoCard = (
      x: number,
      top: number,
      w: number,
      rows: [string, string][],
    ) => {
      const pad = 12;
      const gap = 8;
      const vw = w - pad * 2;
      doc.font('Helvetica').fontSize(9);
      const heights = rows.map(([, value]) => doc.heightOfString(value, { width: vw }));
      const h = pad * 2 + rows.reduce((acc, _, i) => acc + 9 + heights[i] + gap, 0);
      doc.roundedRect(x, top, w, h, 4).lineWidth(0.7).fillAndStroke('#ffffff', BORDER);
      let y = top + pad;
      rows.forEach(([key, value], i) => {
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(6.5);
        doc.text(key.toUpperCase(), x + pad, y);
        const vy = y + 10;
        doc.fillColor(INK).font('Helvetica').fontSize(9);
        doc.text(value, x + pad, vy, { width: vw });
        y = vy + heights[i] + gap;
      });
      return h;
    };

    const sideBySideCards = (
      left: [string, string][],
      right: [string, string][],
      gap = 10,
    ) => {
      const cardTop = doc.y;
      const w = CW / 2 - 5;
      const h = Math.max(
        infoCard(M, cardTop, w, left),
        infoCard(M + CW / 2 + 5, cardTop, w, right),
      );
      doc.y = cardTop + h + gap;
    };

    const tableHeader = (cols: { w: number; align: 'left' | 'right' | 'center' }[], labels: string[]) => {
      const headerY = doc.y;
      doc.rect(M, headerY, CW, 20).fill(LIGHT);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(7.5);
      let x = M;
      cols.forEach((col, index) => {
        doc.text(labels[index], x, headerY + 6, { width: col.w, align: col.align });
        x += col.w;
      });
      doc.moveTo(M, headerY + 20).lineTo(M + CW, headerY + 20).lineWidth(0.7).stroke(BORDER);
      doc.y = headerY + 20;
    };

    // ---- Encabezado ----
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
    doc.text('SIGEV — Sistema de Información para la Gestión de Eventos', 0, 40, {
      width: PAGE_W,
      align: 'center',
    });

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16);
    doc.text('PRESUPUESTO FINAL', M, 54, { width: CW * 0.6 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Documento definitivo consolidado', M, 76, { width: CW * 0.6 });

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12);
    doc.text(params.oferta.code, M, 56, { width: CW - 8, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Oferta Económica Definitiva', M, 78, { width: CW - 8, align: 'right' });

    doc.moveTo(M, 94).lineTo(M + CW, 94).lineWidth(1.2).stroke(INK);
    doc.moveTo(M, 96.5).lineTo(M + CW, 96.5).lineWidth(0.5).stroke(BORDER);
    doc.y = 112;

    // ---- Ficha de generación ----
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(
      `Generado el ${dateCO(params.generatedAt)}  ·  Documento estático e inmutable, no editable posteriormente.`,
      M,
      doc.y,
      { width: CW, align: 'center' },
    );
    doc.moveDown(0.3);

    // ---- Datos del evento ----
    sectionTitle('Datos del evento');
    const eventCode = params.event.code + (params.event.suffix ? `-${params.event.suffix}` : '');
    sideBySideCards(
      [
        ['Número de evento', eventCode],
        ['Nombre', params.event.name || '—'],
        ['Municipio', params.event.municipalityName || 'N/A'],
        ['Categoría municipal', params.event.municipalityCategory || '—'],
      ],
      [
        ['Oferta definitiva', params.oferta.code],
        ['Cotización de origen', params.quotation.code],
        ['Cliente', params.quotation.cliente || '—'],
        ['Aliado estratégico', params.quotation.ally?.name || '—'],
      ],
    );

    // ---- Detalle de la oferta ----
    sectionTitle('Detalle de la oferta económica');

    const cols = [
      { w: 18, align: 'center' as const },
      { w: 136, align: 'left' as const },
      { w: 26, align: 'center' as const },
      { w: 52, align: 'right' as const },
      { w: 52, align: 'right' as const },
      { w: 44, align: 'right' as const },
      { w: 44, align: 'right' as const },
      { w: 46, align: 'right' as const },
      { w: 46, align: 'right' as const },
      { w: 58, align: 'right' as const },
    ];
    const labels = ['#', 'Descripción', 'Cant.', 'P/U', 'Base', 'IVA', 'Imp. Consumo', 'Fee', 'IVA Fee', 'Total'];

    tableHeader(cols, labels);

    const rowCells = (item: {
      description: string;
      quantity: number;
      unitPrice: number;
      baseValue: number;
      ivaValue: number;
      consumptionTaxValue: number;
      feeTarifadoValue: number;
      feeTercerosValue: number;
      feeIvaValue: number;
      totalValue: number;
    }): string[] => [
      item.description,
      String(item.quantity),
      money(item.unitPrice),
      money(item.baseValue),
      money(item.ivaValue),
      money(item.consumptionTaxValue),
      money(item.feeTarifadoValue + item.feeTercerosValue),
      money(item.feeIvaValue),
      money(item.totalValue),
    ];

    const drawRow = (cells: string[], { bold = false, shade = false, totalRule = false } = {}) => {
      const descWidth = cols[1].w - 8;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
      const descHeight = doc.heightOfString(cells[1], { width: descWidth });
      const rowH = Math.max(20, descHeight + 10);
      if (ensureSpace(rowH)) {
        tableHeader(cols, labels);
      }
      const rowTop = doc.y;

      if (totalRule) {
        doc.moveTo(M, rowTop).lineTo(M + CW, rowTop).lineWidth(1.2).stroke(INK);
      }
      if (shade) {
        doc.rect(M, rowTop, CW, rowH).fill(LIGHTER);
      }
      doc.moveTo(M, rowTop + rowH).lineTo(M + CW, rowTop + rowH).lineWidth(0.5).stroke(BORDER);

      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
      doc.fillColor(INK);

      doc.text(cells[1], M + cols[0].w + 4, rowTop + 5, { width: descWidth });

      let x = M;
      cols.forEach((col, index) => {
        if (index === 1) {
          x += col.w;
          return;
        }
        doc.text(cells[index], x, rowTop + 6, { width: col.w, align: col.align });
        x += col.w;
      });
      doc.y = rowTop + rowH;
    };

    params.oferta.items.forEach((item, index) => {
      drawRow([`${index + 1}`, ...rowCells(item)], { shade: index % 2 === 0 });
    });

    // ---- Totales de la tabla ----
    if (params.oferta.items.length) {
      drawRow(
        [
          '',
          'TOTALES',
          '',
          '',
          money(params.oferta.baseTotal),
          money(params.oferta.ivaTotal),
          money(params.oferta.impuestoConsumoTotal),
          money(params.oferta.feeTarifadoTotal + params.oferta.feeTercerosTotal),
          money(params.oferta.ivaFeeTotal),
          money(params.oferta.total),
        ],
        { bold: true, totalRule: true },
      );
    }

    // ---- Resumen del presupuesto ----
    const summaryRows: [string, string][] = [
      ['Subtotal (Base)', moneyCur(params.oferta.baseTotal)],
      ['IVA', moneyCur(params.oferta.ivaTotal)],
      ['Impuesto al consumo', moneyCur(params.oferta.impuestoConsumoTotal)],
      ['Fee Técnico Administrativo', moneyCur(params.oferta.feeTarifadoTotal + params.oferta.feeTercerosTotal)],
      ['IVA del Fee', moneyCur(params.oferta.ivaFeeTotal)],
    ];

    const summaryH = summaryRows.length * 20;
    ensureSpace(summaryH + 44 + 40);
    sectionTitle('Resumen del presupuesto');

    for (const [label, value] of summaryRows) {
      const ry = doc.y;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
      doc.text(label, M, ry, { width: CW - 210 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
      doc.text(value, M, ry, { width: CW - 8, align: 'right' });
      doc.y = ry + 20;
    }

    // ---- Gran total ----
    ensureSpace(40);
    const gty = doc.y;
    doc.moveTo(M, gty).lineTo(M + CW, gty).lineWidth(1.2).stroke(INK);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
    doc.text('GRAN TOTAL — Oferta Económica Definitiva', M, gty + 10, { width: CW - 210 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
    doc.text(moneyCur(params.oferta.total), M, gty + 10, { width: CW - 8, align: 'right' });
    doc.moveTo(M, gty + 28).lineTo(M + CW, gty + 28).lineWidth(0.6).stroke(BORDER);
    doc.y = gty + 40;

    // ---- Generado por ----
    ensureSpace(190);
    sectionTitle('Generado por');
    sideBySideCards(
      [
        ['Responsable', params.generatedBy.fullName || '—'],
        ['Correo', params.generatedBy.email || '—'],
      ],
      [
        ['Fecha de generación', dateCO(params.generatedAt)],
        ['Estado', 'Definitiva'],
      ],
      6,
    );

    ensureSpace(56);
    const sigY = doc.y;
    doc.strokeColor(BORDER).lineWidth(0.8);
    doc.moveTo(M + 40, sigY).lineTo(M + CW - 40, sigY).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(params.generatedBy.fullName || 'Responsable', M + 40, sigY + 12, {
      width: CW - 80,
      align: 'center',
    });
    doc.fontSize(6.5);
    doc.text('Firma y nombre del responsable de la generación', M + 40, sigY + 24, {
      width: CW - 80,
      align: 'center',
    });
    doc.y = sigY + 40;

    // ---- Pie de página ----
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(M, FOOTER_Y - 6).lineTo(M + CW, FOOTER_Y - 6).lineWidth(0.6).stroke(BORDER);
      doc.fillColor(MUTED).font('Helvetica').fontSize(7);
      doc.text('SIGEV — Sistema de Información para la Gestión de Eventos', M, FOOTER_Y, {
        width: CW / 2,
      });
      doc.fillColor(MUTED).font('Helvetica').fontSize(7);
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, M, FOOTER_Y, {
        width: CW - M,
        align: 'right',
      });
    }

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
