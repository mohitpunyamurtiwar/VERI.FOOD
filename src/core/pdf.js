export function downloadReport(onFallback) {
  // The report is generated from the same semantic, accessible HTML shown in-app.
  // Browser print's "Save as PDF" gives the user a real, locally generated PDF
  // without sending label photos or report data to a third-party service.
  const report = document.querySelector('#report-section');
  if (!report || report.classList.contains('hidden')) {
    onFallback?.('Analyze a label before creating its report.');
    return;
  }
  document.querySelector('#compare')?.classList.toggle('print-include', !document.querySelector('#compare').classList.contains('hidden'));
  window.print();
}
