import PDFDocument from "pdfkit";

// Renders the court-ready election record. Called only for elections whose
// status is already CLOSED, so the tally passed in is frozen (BE-04/BE-12).
export function buildValgprotokollPdf({ org, election, candidates }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Valgprotokoll", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#555").text("Election Record — SikkerValg E2E-V Ledger", { align: "center" });
    doc.moveDown(1.5);
    doc.fillColor("#000");

    doc.fontSize(11);
    row(doc, "Organization", `${org.name} (Org.nr ${org.orgNumber})`);
    row(doc, "Election", election.name);
    row(doc, "Election type", election.type || "—");
    row(doc, "Election ID", String(election._id));
    row(doc, "Closed at", election.closedAt ? new Date(election.closedAt).toISOString() : "—");
    row(doc, "Total ballots cast", String(election.tally?.totalBallots ?? 0));
    row(doc, "Ledger head hash", election.ledgerHead || "—");
    doc.moveDown(1);

    doc.fontSize(13).text("Results", { underline: true });
    doc.moveDown(0.5);

    const results = election.tally?.results || [];
    const colX = [50, 320, 420];
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Option", colX[0], doc.y, { continued: false, width: 260 });
    doc.text("Weighted total", colX[1], doc.y - doc.currentLineHeight(), { width: 90 });
    doc.text("Ballots", colX[2], doc.y - doc.currentLineHeight(), { width: 80 });
    doc.font("Helvetica");
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#999").stroke();
    doc.moveDown(0.3);

    results.forEach((r) => {
      const y = doc.y;
      doc.text(r.name, colX[0], y, { width: 260 });
      doc.text(String(r.weight), colX[1], y, { width: 90 });
      doc.text(String(r.count), colX[2], y, { width: 80 });
      doc.moveDown(0.4);
    });

    if (election.tally?.deAnonRiskAdjusted?.length) {
      doc.moveDown(0.8);
      doc.fontSize(9).fillColor("#a00").text(
        `Anonymity safeguard applied: the following bucket(s) contained a single fractional-weight ` +
          `ballot and were rounded to a full 1.0 weight to prevent voter identification: ` +
          `${election.tally.deAnonRiskAdjusted.join(", ")}.`,
        { width: 495 }
      );
      doc.fillColor("#000");
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor("#555").text(
      "This document is cryptographically signed. The signature and the SHA-256 hash of this exact " +
        "file are available via the platform's public audit API and can be independently verified " +
        "against the published public key without contacting SikkerValg.",
      { width: 495 }
    );
    doc.fillColor("#000");

    doc.end();
  });
}

function row(doc, label, value) {
  const y = doc.y;
  doc.font("Helvetica-Bold").text(label + ":", 50, y, { width: 150, continued: false });
  doc.font("Helvetica").text(value, 200, y, { width: 345 });
  doc.moveDown(0.2);
}
