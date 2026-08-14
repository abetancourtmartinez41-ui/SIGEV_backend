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
      .text('SIGEV — Sistema Integrado de Gestión de Eventos', {
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
      status: string;
      startDate: Date | null;
      dependency: string | null;
      hamlet: string | null;
      schemaType: string;
      attendees: number | null;
      days: number | null;
      municipalityName: string | null;
      municipalityCategory: string | null;
      department: string | null;
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

    const esquemaLabel = (schemaType: string) =>
      schemaType === 'cotizacion' ? 'Cotización' : schemaType === 'detalle' ? 'Detalle' : schemaType || '—';

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

    const fieldGrid = (rows: [[string, string], [string, string]][]) => {
      const colGap = 24;
      const colW = (CW - colGap) / 2;
      const cellGap = 8;
      const labelH = 11;
      rows.forEach(([left, right]) => {
        const y0 = doc.y;
        const drawCell = (x: number, w: number, [key, value]: [string, string]) => {
          doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7);
          doc.text(key.toUpperCase(), x, y0, { width: w });
          doc.fillColor(INK).font('Helvetica').fontSize(8.5);
          const valueH = doc.heightOfString(value, { width: w });
          doc.text(value, x, y0 + labelH, { width: w });
          return labelH + valueH;
        };
        const leftH = drawCell(M, colW, left);
        const rightH = drawCell(M + colW + colGap, colW, right);
        doc.y = y0 + Math.max(leftH, rightH) + cellGap;
      });
    };

    const tableHeader = (cols: { w: number; align: 'left' | 'right' | 'center' }[], labels: string[]) => {
      const headerY = doc.y;
      doc.rect(M, headerY, CW, 20).fill(LIGHT);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(7.5);
      let x = M;
      cols.forEach((col, index) => {
        const isLast = index === cols.length - 1;
        doc.text(labels[index], x, headerY + 7, {
          width: isLast ? col.w - 2 : col.w,
          align: col.align,
        });
        x += col.w;
      });
      doc.moveTo(M, headerY + 20).lineTo(M + CW, headerY + 20).lineWidth(0.7).stroke(BORDER);
      doc.y = headerY + 20;
    };

    // ---- Encabezado ----
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
    doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', 0, 40, {
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
    const municipioLabel = params.event.municipalityName
      ? params.event.department
        ? `${params.event.municipalityName} (${params.event.department})`
        : params.event.municipalityName
      : '—';
    fieldGrid([
      [
        ['Número de evento', eventCode],
        ['Oferta definitiva', params.oferta.code],
      ],
      [
        ['Estado', params.event.status || '—'],
        ['Cotización de origen', params.quotation.code],
      ],
      [
        ['Fecha de ejecución', params.event.startDate ? dateCO(params.event.startDate) : '—'],
        ['Aliado estratégico', params.quotation.ally?.name || '—'],
      ],
      [
        ['Cliente (solicitante)', params.event.name || '—'],
        ['Municipio', municipioLabel],
      ],
      [
        ['Dependencia', params.event.dependency || '—'],
        ['Categoría municipal', params.event.municipalityCategory || '—'],
      ],
      [
        ['Vereda', params.event.hamlet || '—'],
        ['Esquema', esquemaLabel(params.event.schemaType)],
      ],
      [
        ['Asistentes', params.event.attendees != null ? String(params.event.attendees) : '—'],
        ['Días', params.event.days != null ? String(params.event.days) : '—'],
      ],
    ]);

    // ---- Detalle de la oferta ----
    sectionTitle('Detalles de la oferta económica');

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
    const labels = ['#', 'Descripción', 'Cant.', 'P/U', 'Base', 'IVA', 'INC', 'FEE', 'IVA FEE', 'Total'];

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
        const isLast = index === cols.length - 1;
        doc.text(cells[index], x, rowTop + 6, {
          width: isLast ? col.w - 2 : col.w,
          align: col.align,
        });
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
      ['Impuesto a consumo (INC)', moneyCur(params.oferta.impuestoConsumoTotal)],
      ['FEE Técnico Administrativo', moneyCur(params.oferta.feeTarifadoTotal + params.oferta.feeTercerosTotal)],
      ['IVA del FEE', moneyCur(params.oferta.ivaFeeTotal)],
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
        ['', ''],
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
      doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', M, FOOTER_Y, {
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
      { header: 'INC', key: 'consumptionTaxValue', width: 15 },
      { header: 'FEE', key: 'feeValue', width: 15 },
      { header: 'IVA FEE', key: 'feeIvaValue', width: 15 },
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

  // ------------------------------------------------------------------------
  // Reconocimiento de pagos por evento
  // ------------------------------------------------------------------------

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private money(value: number, currency = 'COP'): string {
    return `$ ${Number(value).toLocaleString('es-CO')} ${currency}`;
  }

  private dateCO(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  }

  private async loadEventPaymentData(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        ofertaEconomica: true,
        payments: {
          include: {
            paymentItems: true,
            createdBy: { select: { fullName: true } },
            attachments: { select: { originalName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const paidByItem = new Map<string, number>();
    let totalPaid = 0;
    for (const payment of event.payments) {
      if (payment.status === 'Anulado') continue;
      totalPaid += Number(payment.amount);
      for (const pi of payment.paymentItems) {
        const current = paidByItem.get(pi.itemId) ?? 0;
        paidByItem.set(pi.itemId, current + Number(pi.amount));
      }
    }

    return {
      event: {
        code: event.code,
        suffix: event.suffix,
        name: event.name,
        status: event.status,
        municipalityName: event.municipalityName,
        startDate: event.startDate,
      },
      oferta: event.ofertaEconomica
        ? {
            code: event.ofertaEconomica.code,
            name: event.ofertaEconomica.name,
            currency: event.ofertaEconomica.currency,
            total: Number(event.ofertaEconomica.total),
          }
        : null,
      items: event.items.map((item) => {
        const paid = paidByItem.get(item.id) ?? 0;
        return {
          id: item.id,
          name: item.name,
          totalValue: Number(item.totalValue),
          paid: this.round2(paid),
          pending: this.round2(Math.max(0, Number(item.totalValue) - paid)),
        };
      }),
      payments: event.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        esAdicional: p.esAdicional,
        status: p.status,
        createdByFullName: p.createdBy?.fullName ?? '',
        itemsCount: p.paymentItems.length,
        attachments: p.attachments.map((a) => a.originalName),
      })),
      totalPaid: this.round2(totalPaid),
    };
  }

  private drawPdfTable(
    doc: PDFDocument,
    opts: {
      columns: { header: string; width: number; align?: 'left' | 'right' | 'center' }[];
      rows: (string | number)[][];
      startY: number;
      fontSize?: number;
      footer?: (string | number)[] | null;
    },
  ): number {
    const M = 45;
    const CW = 612 - M * 2;
    const SAFE_Y = 724;
    const fontSize = opts.fontSize ?? 7.5;
    let y = opts.startY;

    const drawHeader = () => {
      doc.rect(M, y, CW, 18).fill('#f3f4f6');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(fontSize);
      let x = M;
      opts.columns.forEach((col, index) => {
        const isLast = index === opts.columns.length - 1;
        doc.text(col.header, x + 3, y + 6, {
          width: isLast ? col.width - 6 : col.width - 3,
          align: col.align ?? 'left',
        });
        x += col.width;
      });
      doc.moveTo(M, y + 18).lineTo(M + CW, y + 18).lineWidth(0.7).stroke('#d1d5db');
      y += 18;
    };

    drawHeader();

    const rowHeight = (row: (string | number)[]) => {
      const descWidth = opts.columns[0].width - 8;
      const descHeight = doc.heightOfString(String(row[0]), { width: descWidth });
      return Math.max(16, descHeight + 10);
    };

    const drawRow = (row: (string | number)[], shade = false, bold = false) => {
      const h = rowHeight(row);
      if (y + h > SAFE_Y) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      const rowTop = y;
      if (shade) doc.rect(M, rowTop, CW, h).fill('#fafafa');
      doc.moveTo(M, rowTop + h).lineTo(M + CW, rowTop + h).lineWidth(0.5).stroke('#d1d5db');
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor('#111827');
      doc.text(String(row[0]), M + 4, rowTop + 5, { width: opts.columns[0].width - 8 });
      let x = M;
      opts.columns.forEach((col, index) => {
        if (index === 0) {
          x += col.width;
          return;
        }
        const isLast = index === opts.columns.length - 1;
        doc.text(String(row[index]), x + 2, rowTop + 5, {
          width: isLast ? col.width - 4 : col.width - 2,
          align: col.align ?? 'left',
        });
        x += col.width;
      });
      y = rowTop + h;
    };

    opts.rows.forEach((row, index) => drawRow(row, index % 2 === 0));
    if (opts.footer) drawRow(opts.footer, false, true);
    return y;
  }

  async generatePaymentReconocimientoPdf(eventId: string, res: Response): Promise<void> {
    const data = await this.loadEventPaymentData(eventId);
    const doc = new PDFDocument({ margin: 45, size: 'LETTER', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reconocimiento-pagos-${data.event.code}.pdf`);
    doc.pipe(res);

    const PAGE_W = 612;
    const M = 45;
    const CW = PAGE_W - M * 2;
    const INK = '#111827';
    const MUTED = '#6b7280';
    const SAFE_Y = 724;
    const FOOTER_Y = 736;
    const eventCode = data.event.code + (data.event.suffix ? `-${data.event.suffix}` : '');
    const currency = data.oferta?.currency ?? 'COP';

    const sectionTitle = (title: string) => {
      if (doc.y + 34 > SAFE_Y) doc.addPage();
      doc.moveDown(0.8);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
      doc.text(title, M, doc.y);
      doc.moveDown(0.25);
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(1).stroke('#d1d5db');
      doc.moveDown(0.45);
    };

    const field = (key: string, value: string) => {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
      doc.text(key.toUpperCase(), M, doc.y);
      doc.fillColor(INK).font('Helvetica').fontSize(9);
      const h = doc.heightOfString(value, { width: CW });
      doc.text(value, M, doc.y + 10, { width: CW });
      doc.y += h + 8;
    };

    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
    doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', 0, 40, { width: PAGE_W, align: 'center' });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16);
    doc.text('RECONOCIMIENTO DE PAGOS', M, 54);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Detalle de pagos, ítems cubiertos y soportes del evento', M, 76);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12);
    doc.text(eventCode, M, 56, { width: CW - 8, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Evento', M, 78, { width: CW - 8, align: 'right' });
    doc.moveTo(M, 94).lineTo(M + CW, 94).lineWidth(1.2).stroke(INK);
    doc.moveTo(M, 96.5).lineTo(M + CW, 96.5).lineWidth(0.5).stroke('#d1d5db');
    doc.y = 112;

    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(
      `Generado el ${this.dateCO(new Date())}  ·  Documento informativo de la ejecución financiera del evento.`,
      M, doc.y, { width: CW, align: 'center' },
    );
    doc.moveDown(0.6);

    sectionTitle('Datos del evento');
    field('Nombre', data.event.name);
    field('Estado', data.event.status);
    field('Municipio', data.event.municipalityName ?? '—');
    field('Fecha de ejecución', this.dateCO(data.event.startDate));
    field('Oferta económica', data.oferta ? `${data.oferta.code} — ${this.money(data.oferta.total, currency)}` : 'Sin oferta definitiva');

    sectionTitle('Ítems del evento');
    const itemRows = data.items.map((item) => {
      const pct = item.totalValue > 0 ? (item.paid / item.totalValue) * 100 : 0;
      return [
        item.name,
        this.money(item.totalValue, currency),
        this.money(item.paid, currency),
        this.money(item.pending, currency),
        `${pct.toFixed(2)}%`,
      ];
    });
    this.drawPdfTable(doc, {
      columns: [
        { header: 'Ítem', width: 250 },
        { header: 'Valor', width: 92, align: 'right' },
        { header: 'Pagado', width: 92, align: 'right' },
        { header: 'Pendiente', width: 92, align: 'right' },
        { header: '%', width: 46, align: 'right' },
      ],
      rows: itemRows,
      startY: doc.y + 6,
      footer: [
        'TOTALES',
        this.money(data.items.reduce((s, i) => s + i.totalValue, 0), currency),
        this.money(data.totalPaid, currency),
        this.money(data.items.reduce((s, i) => s + i.pending, 0), currency),
        '',
      ],
    });

    doc.y += 14;
    sectionTitle('Pagos registrados');
    const paymentRows = data.payments.map((p) => {
      const itemsLabel =
        p.method === 'prorrateo'
          ? 'Todos los ítems'
          : `${p.itemsCount} ítem${p.itemsCount !== 1 ? 's' : ''}`;
      const adicional = p.esAdicional ? ' (adicional)' : '';
      const modalidad = `${p.method === 'por_item' ? 'Por ítem' : p.method === 'prorrateo' ? 'Prorrateo' : '—'}${adicional}`;
      return [
        modalidad,
        itemsLabel,
        this.money(p.amount, currency),
        p.status,
        p.createdByFullName,
      ];
    });
    this.drawPdfTable(doc, {
      columns: [
        { header: 'Modalidad', width: 96 },
        { header: 'Ítems', width: 70 },
        { header: 'Monto', width: 90, align: 'right' },
        { header: 'Estado', width: 80 },
        { header: 'Responsable', width: 90 },
      ],
      rows: paymentRows,
      startY: doc.y + 6,
      footer: [
        'TOTALES',
        '',
        this.money(data.totalPaid, currency),
        '',
        '',
      ],
    });

    const paymentsWithSupport = data.payments.filter((p) => p.attachments.length > 0);
    if (paymentsWithSupport.length > 0) {
      doc.y += 14;
      sectionTitle('Soportes documentales');
      doc.font('Helvetica').fontSize(8.5).fillColor(INK);
      for (const p of paymentsWithSupport) {
        doc.text(`• Pago ${this.money(p.amount, currency)}: ${p.attachments.join(', ')}`, M, doc.y, { width: CW });
        doc.moveDown(0.4);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(M, FOOTER_Y - 6).lineTo(M + CW, FOOTER_Y - 6).lineWidth(0.6).stroke('#d1d5db');
      doc.fillColor(MUTED).font('Helvetica').fontSize(7);
      doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', M, FOOTER_Y, { width: CW / 2 });
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, M, FOOTER_Y, { width: CW - M, align: 'right' });
    }

    doc.end();
  }

  async generatePaymentReconocimientoExcel(eventId: string, res: Response): Promise<void> {
    const data = await this.loadEventPaymentData(eventId);
    const workbook = new ExcelJS.Workbook();
    const currency = data.oferta?.currency ?? 'COP';

    const wsItems = workbook.addWorksheet('Reconocimiento por evento');
    wsItems.columns = [
      { width: 45 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 },
    ];
    const money = (value: number) => Number(value);
    const title = wsItems.addRow(['Reconocimiento de pagos del evento']);
    wsItems.mergeCells(1, 1, 1, 5);
    title.font = { bold: true, size: 14 };
    const meta = wsItems.addRow([`${data.event.code}${data.event.suffix ? `-${data.event.suffix}` : ''} · ${data.event.name}`]);
    wsItems.mergeCells(2, 1, 2, 5);
    meta.font = { size: 10, color: { argb: 'FF6B7280' } };
    wsItems.addRow([]);
    wsItems.addRow(['Ítem', 'Valor', 'Pagado', 'Pendiente', '% Pagado']);
    data.items.forEach((item) => {
      const pct = item.totalValue > 0 ? (item.paid / item.totalValue) * 100 : 0;
      wsItems.addRow([item.name, money(item.totalValue), money(item.paid), money(item.pending), Number(pct.toFixed(2))]);
    });
    wsItems.addRow([
      'TOTALES',
      money(data.items.reduce((s, i) => s + i.totalValue, 0)),
      money(data.totalPaid),
      money(data.items.reduce((s, i) => s + i.pending, 0)),
      data.totalPaid > 0 ? Number(((data.totalPaid / Math.max(1, data.items.reduce((s, i) => s + i.totalValue, 0))) * 100).toFixed(2)) : 0,
    ]);
    const headerRowItems = 5;
    for (let c = 2; c <= 4; c++) wsItems.getCell(headerRowItems, c).numFmt = '"$"#,##0.00';
    for (let r = headerRowItems + 1; r <= wsItems.rowCount; r++) {
      for (let c = 2; c <= 4; c++) wsItems.getCell(r, c).numFmt = '"$"#,##0.00';
      wsItems.getCell(r, 5).numFmt = '0.00"%"';
    }
    wsItems.getRow(headerRowItems).font = { bold: true };
    wsItems.getRow(wsItems.rowCount).font = { bold: true };

    const wsPayments = workbook.addWorksheet('Pagos');
    wsPayments.columns = [
      { width: 16 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 40 },
    ];
    const titleP = wsPayments.addRow(['Pagos registrados del evento']);
    wsPayments.mergeCells(1, 1, 1, 6);
    titleP.font = { bold: true, size: 14 };
    wsPayments.addRow([]);
    wsPayments.addRow(['Modalidad', 'Ítems', 'Monto', 'Estado', 'Responsable', 'Soportes']);
    data.payments.forEach((p) => {
      const itemsLabel = p.method === 'prorrateo' ? 'Todos los ítems' : `${p.itemsCount} ítem${p.itemsCount !== 1 ? 's' : ''}`;
      wsPayments.addRow([
        p.method === 'por_item' ? 'Por ítem' : p.method === 'prorrateo' ? 'Prorrateo' : '—',
        itemsLabel,
        money(p.amount),
        p.status,
        p.createdByFullName,
        p.attachments.join(', '),
      ]);
    });
    wsPayments.addRow([
      'TOTALES', '',
      money(data.totalPaid),
      '', '',
    ]);
    const headerRowP = 3;
    for (let r = headerRowP + 1; r <= wsPayments.rowCount; r++) {
      wsPayments.getCell(r, 3).numFmt = '"$"#,##0.00';
    }
    wsPayments.getRow(headerRowP).font = { bold: true };
    wsPayments.getRow(wsPayments.rowCount).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reconocimiento-pagos-${data.event.code}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ------------------------------------------------------------------------
  // Ejecución por recurso disponible
  // ------------------------------------------------------------------------

  private async loadResourcePaymentData(disbursementId: string) {
    const resource = await this.prisma.disbursement.findUnique({
      where: { id: disbursementId },
    });
    if (!resource) throw new NotFoundException('Recurso disponible no encontrado');

    const events = await this.prisma.event.findMany({
      where: { disbursementId, deletedAt: null },
      select: { id: true, code: true, suffix: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    const ofertas = await this.prisma.ofertaEconomica.findMany({
      where: { eventId: { in: events.map((e) => e.id) }, isActive: true },
      select: { eventId: true, total: true },
    });
    const payments = await this.prisma.payment.findMany({
      where: { disbursementId, status: { not: 'Anulado' } },
      select: { eventId: true, amount: true },
    });

    const budgetByEvent = new Map(ofertas.map((o) => [o.eventId, Number(o.total)]));
    const paidByEvent = new Map<string, number>();
    let totalPaid = 0;
    for (const payment of payments) {
      totalPaid += Number(payment.amount);
      paidByEvent.set(payment.eventId, (paidByEvent.get(payment.eventId) ?? 0) + Number(payment.amount));
    }

    const valorRef = Number(resource.amount);
    const totalParticipation = events.reduce((sum, e) => sum + (budgetByEvent.get(e.id) ?? 0), 0);
    const rows = events.map((e) => {
      const monto = budgetByEvent.get(e.id) ?? 0;
      const pagado = paidByEvent.get(e.id) ?? 0;
      return {
        id: e.id,
        code: e.code,
        suffix: e.suffix,
        name: e.name,
        monto: this.round2(monto),
        pagado: this.round2(pagado),
        pendiente: this.round2(Math.max(0, monto - pagado)),
      };
    });

    return {
      resource: {
        code: resource.code,
        name: resource.name,
        amount: valorRef,
        year: resource.year,
        fechaInicio: resource.fechaInicio,
        fechaFin: resource.fechaFin,
      },
      events: rows,
      totalPaid: this.round2(totalPaid),
      totalParticipation: this.round2(totalParticipation),
      disponible: this.round2(Math.max(0, valorRef - totalPaid)),
      pctEjecucion: valorRef > 0 ? this.round2((totalPaid / valorRef) * 100) : 0,
      pctParticipacion: valorRef > 0 ? this.round2((totalParticipation / valorRef) * 100) : 0,
    };
  }

  async generateResourcePaymentPdf(disbursementId: string, res: Response): Promise<void> {
    const data = await this.loadResourcePaymentData(disbursementId);
    const doc = new PDFDocument({ margin: 45, size: 'LETTER', bufferPages: true });
    const slug = (data.resource.code ?? data.resource.name).replace(/[^a-zA-Z0-9_-]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ejecucion-recurso-${slug}.pdf`);
    doc.pipe(res);

    const PAGE_W = 612;
    const M = 45;
    const CW = PAGE_W - M * 2;
    const INK = '#111827';
    const MUTED = '#6b7280';
    const SAFE_Y = 724;
    const FOOTER_Y = 736;

    const sectionTitle = (title: string) => {
      if (doc.y + 34 > SAFE_Y) doc.addPage();
      doc.moveDown(0.8);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
      doc.text(title, M, doc.y);
      doc.moveDown(0.25);
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(1).stroke('#d1d5db');
      doc.moveDown(0.45);
    };

    const field = (key: string, value: string) => {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
      doc.text(key.toUpperCase(), M, doc.y);
      doc.fillColor(INK).font('Helvetica').fontSize(9);
      const h = doc.heightOfString(value, { width: CW });
      doc.text(value, M, doc.y + 10, { width: CW });
      doc.y += h + 8;
    };

    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
    doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', 0, 40, { width: PAGE_W, align: 'center' });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16);
    doc.text('EJECUCIÓN DEL RECURSO DISPONIBLE', M, 54);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Indicadores de ejecución y participación sobre el Valor REF', M, 76);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12);
    doc.text(data.resource.code ?? data.resource.name, M, 56, { width: CW - 8, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
    doc.text('Recurso disponible', M, 78, { width: CW - 8, align: 'right' });
    doc.moveTo(M, 94).lineTo(M + CW, 94).lineWidth(1.2).stroke(INK);
    doc.moveTo(M, 96.5).lineTo(M + CW, 96.5).lineWidth(0.5).stroke('#d1d5db');
    doc.y = 112;

    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(
      `Generado el ${this.dateCO(new Date())}  ·  Vigencia ${this.dateCO(data.resource.fechaInicio)} a ${this.dateCO(data.resource.fechaFin)}`,
      M, doc.y, { width: CW, align: 'center' },
    );
    doc.moveDown(0.6);

    sectionTitle('Datos del recurso');
    field('Nombre', data.resource.name);
    field('Valor REF', this.money(data.resource.amount));

    sectionTitle('Indicadores (límite 100%)');
    const indicator = (label: string, value: string, pct: number, color: string) => {
      const y0 = doc.y;
      doc.roundedRect(M, y0, CW, 52, 4).lineWidth(0.7).stroke('#d1d5db');
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7);
      doc.text(label.toUpperCase(), M + 10, y0 + 10);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
      doc.text(value, M + 10, y0 + 22);
      doc.fillColor(color).font('Helvetica-Bold').fontSize(9);
      doc.text(pct.toFixed(2) + '%', M + 10, y0 + 38);
      doc.y = y0 + 62;
    };
    const half = CW / 2 - 5;
    indicator('Valor REF', this.money(data.resource.amount), 0, INK);
    doc.y = doc.y - 62;
    doc.x = M + CW / 2 + 5;
    indicator('Ejecutado', this.money(data.totalPaid), data.pctEjecucion, '#22c55e');
    doc.x = M;
    indicator('Disponible', this.money(data.disponible), 0, INK);
    doc.y = doc.y - 62;
    doc.x = M + CW / 2 + 5;
    indicator('% Ejecución', `${data.pctEjecucion.toFixed(2)}%`, data.pctEjecucion, '#22c55e');
    doc.x = M;
    indicator('Participación de eventos', `${data.pctParticipacion.toFixed(2)}%`, data.pctParticipacion, '#6366f1');
    doc.y = doc.y - 62;
    doc.x = M + CW / 2 + 5;
    indicator('Total eventos asociados', String(data.events.length), 0, INK);
    doc.x = M;

    doc.y += 10;
    sectionTitle('Detalle por evento');
    const rows = data.events.map((e) => {
      const eventCode = e.code + (e.suffix ? `-${e.suffix}` : '');
      return [
        `${eventCode} · ${e.name}`,
        this.money(e.monto),
        this.money(e.pagado),
        this.money(e.pendiente),
      ];
    });
    this.drawPdfTable(doc, {
      columns: [
        { header: 'Evento', width: 250 },
        { header: 'Monto', width: 78, align: 'right' },
        { header: 'Pagado', width: 78, align: 'right' },
        { header: 'Pendiente', width: 78, align: 'right' },
      ],
      rows,
      startY: doc.y + 6,
      footer: [
        'TOTALES',
        this.money(data.totalParticipation),
        this.money(data.totalPaid),
        this.money(data.events.reduce((s, e) => s + e.pendiente, 0)),
      ],
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(M, FOOTER_Y - 6).lineTo(M + CW, FOOTER_Y - 6).lineWidth(0.6).stroke('#d1d5db');
      doc.fillColor(MUTED).font('Helvetica').fontSize(7);
      doc.text('SIGEV — Sistema Integrado de Gestión de Eventos', M, FOOTER_Y, { width: CW / 2 });
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, M, FOOTER_Y, { width: CW - M, align: 'right' });
    }

    doc.end();
  }

  async generateResourcePaymentExcel(disbursementId: string, res: Response): Promise<void> {
    const data = await this.loadResourcePaymentData(disbursementId);
    const workbook = new ExcelJS.Workbook();

    const wsInd = workbook.addWorksheet('Indicadores');
    wsInd.columns = [{ width: 30 }, { width: 18 }, { width: 16 }];
    const title = wsInd.addRow(['Ejecución del recurso disponible']);
    wsInd.mergeCells(1, 1, 1, 3);
    title.font = { bold: true, size: 14 };
    wsInd.addRow([]);
    wsInd.addRow(['Indicador', 'Valor', 'Porcentaje']);
    wsInd.addRow(['Valor REF', Number(data.resource.amount), '']);
    wsInd.addRow(['Ejecutado', Number(data.totalPaid), Number(data.pctEjecucion.toFixed(2))]);
    wsInd.addRow(['Disponible', Number(data.disponible), '']);
    wsInd.addRow(['Participación de eventos', Number(data.totalParticipation), Number(data.pctParticipacion.toFixed(2))]);
    const indHeader = 3;
    for (let r = indHeader + 1; r <= wsInd.rowCount; r++) wsInd.getCell(r, 2).numFmt = '"$"#,##0.00';
    for (let r = indHeader + 1; r <= wsInd.rowCount; r++) {
      const pctCell = wsInd.getCell(r, 3);
      if (typeof pctCell.value === 'number') pctCell.numFmt = '0.00"%"';
    }
    wsInd.getRow(indHeader).font = { bold: true };

    const wsEvents = workbook.addWorksheet('Por evento');
    wsEvents.columns = [
      { width: 18 }, { width: 40 }, { width: 16 }, { width: 16 }, { width: 16 },
    ];
    const titleE = wsEvents.addRow(['Detalle por evento']);
    wsEvents.mergeCells(1, 1, 1, 5);
    titleE.font = { bold: true, size: 14 };
    wsEvents.addRow([]);
    wsEvents.addRow(['Evento', 'Nombre', 'Monto', 'Pagado', 'Pendiente']);
    data.events.forEach((e) => {
      const code = e.code + (e.suffix ? `-${e.suffix}` : '');
      wsEvents.addRow([code, e.name, Number(e.monto), Number(e.pagado), Number(e.pendiente)]);
    });
    wsEvents.addRow([
      'TOTALES', '',
      Number(data.totalParticipation),
      Number(data.totalPaid),
      Number(data.events.reduce((s, e) => s + e.pendiente, 0)),
    ]);
    const evHeader = 3;
    for (let r = evHeader + 1; r <= wsEvents.rowCount; r++) {
      for (const c of [3, 4, 5]) wsEvents.getCell(r, c).numFmt = '"$"#,##0.00';
    }
    wsEvents.getRow(evHeader).font = { bold: true };
    wsEvents.getRow(wsEvents.rowCount).font = { bold: true };

    const slug = (data.resource.code ?? data.resource.name).replace(/[^a-zA-Z0-9_-]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ejecucion-recurso-${slug}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
