// src/routes/invoices.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const PDFDocument = require('pdfkit');

const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// GET /invoices — list all invoices for logged-in tenant
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT t.id as tenant_id FROM tenants t JOIN users u ON u.email = t.email WHERE u.id = $1 LIMIT 1',
      [req.session.userId]
    );
    if (!r.rows.length) return res.json({ invoices: [] });
    const tenantId = r.rows[0].tenant_id;
    const inv = await pool.query(
      'SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    res.json({ invoices: inv.rows });
  } catch (err) {
    console.error('[INVOICES] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /invoices/:id/download — stream PDF
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT t.id as tenant_id FROM tenants t JOIN users u ON u.email = t.email WHERE u.id = $1 LIMIT 1',
      [req.session.userId]
    );
    if (!r.rows.length) return res.status(403).json({ error: 'Forbidden' });
    const tenantId = r.rows[0].tenant_id;

    const inv = await pool.query(
      'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = inv.rows[0];

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="syncora-invoice-' + invoice.invoice_number + '.pdf"');
    doc.pipe(res);

    // Header background
    doc.rect(0, 0, doc.page.width, 90).fill('#111827');
    doc.fontSize(28).fillColor('#25D366').font('Helvetica-Bold').text('Syncora', 50, 28);
    doc.fontSize(10).fillColor('#9ca3af').font('Helvetica').text('WhatsApp ↔ Slack Bridge', 50, 60);
    doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold').text('INVOICE', 0, 34, { align: 'right', width: doc.page.width - 50 });
    doc.fontSize(10).fillColor('#9ca3af').font('Helvetica').text('#' + invoice.invoice_number, 0, 58, { align: 'right', width: doc.page.width - 50 });

    let y = 115;

    // Invoice meta row
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('INVOICE DATE', 50, y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('STATUS', 350, y);
    y += 14;
    const invDate = new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.font('Helvetica').fontSize(11).fillColor('#111827').text(invDate, 50, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#25D366').text('PAID', 350, y);
    y += 40;

    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb');
    y += 20;

    // Billed to
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('BILLED TO', 50, y);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(invoice.company_name, 50, y);
    y += 18;
    doc.font('Helvetica').fontSize(11).fillColor('#4b5563').text(invoice.company_email, 50, y);
    y += 40;

    // Table header
    doc.rect(50, y, doc.page.width - 100, 28).fill('#f9fafb');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('DESCRIPTION', 60, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('PERIOD', 280, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('AMOUNT', 0, y + 9, { align: 'right', width: doc.page.width - 60 });
    y += 28;

    // Item row
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb');
    y += 14;
    const planLabel = invoice.plan.charAt(0).toUpperCase() + invoice.plan.slice(1);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Syncora ' + planLabel + ' Plan', 60, y);
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Monthly subscription', 60, y + 16);
    doc.font('Helvetica').fontSize(11).fillColor('#4b5563').text(invoice.billing_period || '', 280, y + 4);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(invoice.amount, 0, y + 4, { align: 'right', width: doc.page.width - 60 });
    y += 55;

    // Total
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb');
    y += 16;
    doc.rect(doc.page.width - 210, y, 160, 42).fill('#f0fdf4');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('TOTAL PAID', doc.page.width - 200, y + 7);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#16a34a').text(invoice.amount, doc.page.width - 200, y + 20);
    y += 70;

    // Footer
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb');
    y += 16;
    doc.font('Helvetica').fontSize(9).fillColor('#9ca3af')
      .text('Thank you for your business! Questions? Contact us at support@syncora.one', 50, y, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  } catch (err) {
    console.error('[INVOICES] Download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
