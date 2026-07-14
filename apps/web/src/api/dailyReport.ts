/** 드라이브 파일명: `{YYYY-MM-DD} {프로젝트명} 일일요약` */
export function dailyReportFileName(date: string, projectName: string): string {
  return `${date} ${projectName} 일일요약`;
}
