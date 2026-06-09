import fs from "fs";
import * as XLSX from "xlsx";
import { Operator } from "../models";

export interface LeaveBalanceSyncSummary {
  totalRows: number;
  updated: number;
  notFound: number;
  unchanged: number;
  path?: string;
}

const DEFAULT_LEAVE_EXCEL_PATH =
  "C:\\Users\\ecakir\\Desktop\\yillik_izin_takip_2025.xlsx";

const getCellValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

const parseExcelBalance = (value: unknown) => {
  const normalized = String(value || "0").replace(",", ".");
  const parsed = parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const getLeaveExcelPath = () =>
  process.env.LEAVE_EXCEL_PATH || DEFAULT_LEAVE_EXCEL_PATH;

export const syncLeaveBalancesFromLocalFile =
  async (): Promise<LeaveBalanceSyncSummary> => {
    const filePath = getLeaveExcelPath();

    if (!fs.existsSync(filePath)) {
      throw new Error(`Belirtilen konumda dosya bulunamadı: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    let updateCount = 0;
    let notFoundCount = 0;
    let unchangedCount = 0;

    for (const row of rows) {
      const excelTc = String(getCellValue(row, ["TC NO", "TCNO", "TC"])).trim();
      const excelBalance = parseExcelBalance(
        getCellValue(row, [
          "KALAN İZİN",
          "KALAN IZIN",
          "KALAN Ä°ZÄ°N",
          "KALAN_IZIN",
        ]),
      );

      if (!excelTc) continue;

      const operator = await Operator.findOne({ where: { tc_no: excelTc } });

      if (operator) {
        if (Number(operator.leave_balance) !== excelBalance) {
          await operator.update({ leave_balance: excelBalance });
          updateCount++;
        } else {
          unchangedCount++;
        }
      } else {
        notFoundCount++;
      }
    }

    return {
      totalRows: rows.length,
      updated: updateCount,
      notFound: notFoundCount,
      unchanged: unchangedCount,
      path: filePath,
    };
  };
