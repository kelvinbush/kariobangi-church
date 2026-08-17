import { formatIsoDate, formatDateLong } from "./date";

// Print-ready HTML for the demographic directory PDF. Kept free of React so the
// same markup can be rendered and inspected outside the app.

export type DirectoryPerson = {
  id: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string;
  category: string;
  rawStatus: string | null;
  department: string | null;
  source: string;
  active: boolean;
  age?: number | null;
  registeredDate: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  sundayCount: number;
  totalPresentCount: number;
};

export type DirectorySection = {
  gender: string;
  category: string;
  title: string;
  rows: DirectoryPerson[];
};

export type DirectorySummary = {
  total: number;
  men: number;
  women: number;
  marriedMen: number;
  youthMen: number;
  marriedWomen: number;
  youthWomen: number;
  members: number;
  kids: number;
  visitors: number;
  children: number;
  neverAttended: number;
};

const SOURCE_LABELS: Record<string, string> = {
  member: "Member",
  kid: "Kid",
  visitor: "Visitor",
};

const SOURCE_COLORS: Record<string, string> = {
  member: "#525252",
  kid: "#154618",
  visitor: "#0D9762",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDirectoryReportHtml(opts: {
  sections: DirectorySection[];
  summary: DirectorySummary;
  filterSummaryText: string;
  today: string;
  autoPrint?: boolean;
  /** Sub-heading on the cover and the browser tab title. */
  reportTitle?: string;
  /** Column heading for the grouping each section represents. */
  groupNoun?: string;
}): string {
  const {
    sections,
    summary,
    filterSummaryText,
    today,
    autoPrint = true,
    reportTitle = "Membership, Kids & Visitor Demographic Directory",
    groupNoun = "Demographic Directory",
  } = opts;

  const summaryRow = (label: string, value: number, accent = false) => `
    <tr style="border-bottom: 1px dashed #e8e6e3;">
      <td style="padding: 6px 0; color: #525252; font-weight: 500;">${escapeHtml(label)}</td>
      <td style="padding: 6px 0; text-align: right; font-weight: 700; color: ${accent ? "#0D9762" : "#141414"};">${value}</td>
    </tr>`;

  const sectionHtml = sections
    .map((section) => {
      const rows = section.rows
        .map(
          (p, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? "#ffffff" : "#fbfbfa"};">
              <td style="padding: 6px 8px; color: #8b8884; text-align: right;">${idx + 1}</td>
              <td style="padding: 6px 8px; font-weight: 600; color: #141414;">${escapeHtml(p.name)}${
                // Age is only recorded for kids and some visitors — shown inline so
                // adult sections do not carry a mostly empty column.
                typeof p.age === "number"
                  ? ` <span style="font-size: 8px; font-weight: 400; color: #8b8884;">(${p.age} yrs)</span>`
                  : ""
              }${
                p.active ? "" : ` <span style="font-size: 8px; color: #b45309;">(inactive)</span>`
              }</td>
              <td style="padding: 6px 8px; color: #525252; white-space: nowrap;">${escapeHtml(p.contact || "—")}</td>
              <td style="padding: 6px 8px; color: #525252;">${escapeHtml(p.residence || "—")}</td>
              <td style="padding: 6px 8px; color: ${SOURCE_COLORS[p.source] ?? "#525252"}; font-weight: ${
                p.source === "member" ? 400 : 600
              };">${escapeHtml(SOURCE_LABELS[p.source] ?? p.source)}</td>
              <td style="padding: 6px 8px; color: #525252; white-space: nowrap;">${
                p.firstSeen ? escapeHtml(formatIsoDate(p.firstSeen)) : "—"
              }</td>
              <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${
                p.sundayCount === 0 ? "#a1a1a1" : "#141414"
              };">${p.sundayCount}</td>
              <td style="padding: 6px 8px; color: #525252; white-space: nowrap;">${
                p.lastSeen ? escapeHtml(formatIsoDate(p.lastSeen)) : "—"
              }</td>
            </tr>`
        )
        .join("");

      const totalSundays = section.rows.reduce((sum, p) => sum + p.sundayCount, 0);
      const avgSundays = section.rows.length ? (totalSundays / section.rows.length).toFixed(1) : "0";

      return `
        <div class="section">
          <div class="section-header">
            <span class="section-title">${escapeHtml(section.title)}</span>
            <span class="section-meta">${section.rows.length} ${
              section.rows.length === 1 ? "person" : "people"
            } · avg ${avgSundays} Sundays</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 28px; text-align: right;">#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Residence</th>
                <th>Source</th>
                <th>First Visit</th>
                <th style="text-align: center;">Sundays</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(groupNoun)} - ${escapeHtml(today)}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #141414;
            margin: 28px;
            background-color: #fff;
            line-height: 1.45;
          }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          .logo-cell-left { width: 70px; text-align: left; vertical-align: middle; }
          .logo-cell-right { width: 70px; text-align: right; vertical-align: middle; }
          .logo-img { width: 60px; height: 60px; object-fit: contain; }
          .title-cell-center { text-align: center; vertical-align: middle; padding: 0 10px; }
          .title-ministry { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; }
          .title-altar { font-size: 11px; font-weight: 600; color: #0D9762; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .title-report { font-size: 11px; font-weight: 500; color: #5d5a56; margin: 3px 0 0 0; }
          .title-date { font-size: 10px; color: #8b8884; margin: 2px 0 0 0; }
          .card {
            border: 1px solid #e8e6e3; padding: 18px; border-radius: 12px;
            background-color: #ffffff; margin-bottom: 22px;
          }
          .card-title {
            font-size: 12px; font-weight: 600; margin-bottom: 12px; text-transform: uppercase;
            letter-spacing: 0.5px; border-bottom: 1px solid #e8e6e3; padding-bottom: 6px;
          }
          .filters {
            font-size: 10px; color: #5d5a56; background-color: #f7f7f6; border: 1px solid #e8e6e3;
            border-radius: 8px; padding: 8px 12px; margin-bottom: 20px;
          }
          .section { margin-bottom: 22px; page-break-inside: avoid; }
          .section-header {
            display: flex; justify-content: space-between; align-items: baseline;
            border-left: 3px solid #0D9762; padding: 4px 0 4px 10px; margin-bottom: 8px;
            background-color: #f7fbf9;
          }
          .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
          .section-meta { font-size: 9px; color: #5d5a56; padding-right: 8px; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          .data-table thead th {
            text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.4px;
            color: #8b8884; border-bottom: 1.5px solid #141414; padding: 5px 8px; font-weight: 700;
          }
          .data-table tbody tr { border-bottom: 1px solid #f0efed; }
          .footer {
            margin-top: 26px; padding: 10px; border: 1px solid #e8e6e3; border-radius: 6px;
            font-size: 10px; color: #8b8884; text-align: center; font-style: italic;
          }
          @media print {
            body { margin: 14px; }
            .section { page-break-inside: avoid; }
            thead { display: table-header-group; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td class="logo-cell-left"><img src="/ministry-logo.png" class="logo-img" alt="Ministry Logo" /></td>
            <td class="title-cell-center">
              <div class="title-ministry">THE MINISTRY OF REPENTANCE AND HOLINESS</div>
              <div class="title-altar">Kariobangi Church — Protocol Department</div>
              <div class="title-report">${escapeHtml(reportTitle)}</div>
              <div class="title-date">Generated: ${escapeHtml(formatDateLong(today))}</div>
            </td>
            <td class="logo-cell-right"><img src="/convex.jpeg" class="logo-img" alt="Church Logo" /></td>
          </tr>
        </table>

        <div style="border-bottom: 2px solid #0D9762; margin-bottom: 20px;"></div>

        <div class="filters"><strong>Selection:</strong> ${escapeHtml(filterSummaryText)}</div>

        <div class="card">
          <div class="card-title">Directory Summary</div>
          <div style="display: grid; grid-template-columns: 1fr 1.6fr; gap: 26px;">
            <div style="display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #e8e6e3; padding-right: 18px;">
              <div style="font-size: 10px; font-weight: 600; color: #525252; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">People in this report</div>
              <div style="font-size: 40px; font-weight: 300; line-height: 1;">${summary.total}</div>
              <div style="font-size: 9px; color: #8b8884; margin-top: 8px;">${summary.members} members · ${summary.kids} kids · ${summary.visitors} visitors</div>
            </div>
            <div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                ${summaryRow("Married Men", summary.marriedMen)}
                ${summaryRow("Youth Men", summary.youthMen)}
                ${summaryRow("Married Women", summary.marriedWomen)}
                ${summaryRow("Youth Women", summary.youthWomen)}
                ${summaryRow("Children", summary.children)}
                ${summaryRow("Total Men", summary.men, true)}
                ${summaryRow("Total Women", summary.women, true)}
                ${summaryRow("Not yet marked on any Sunday", summary.neverAttended)}
              </table>
            </div>
          </div>
        </div>

        ${sectionHtml}

        <div class="footer">
          Report generated by the Kariobangi Church Attendance System on ${escapeHtml(
            formatDateLong(today)
          )}. "Sundays" counts the Sunday services where the person was marked present.
        </div>

        ${
          autoPrint
            ? `<script>
            window.addEventListener('load', () => {
              setTimeout(() => { window.print(); window.close(); }, 400);
            });
          </script>`
            : ""
        }
      </body>
    </html>
  `;
}
