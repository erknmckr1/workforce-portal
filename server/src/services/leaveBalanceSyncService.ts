import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { Operator, LeaveBalanceLog } from "../models";

export interface UnmatchedRecord {
  name?: string;
  tc?: string;
  balance: number;
}

export interface LeaveBalanceSyncSummary {
  totalRows: number;
  updated: number;
  notFound: number;
  unchanged: number;
  matchedByTc?: number;
  matchedByName?: number;
  path?: string;
  unmatchedPreview?: UnmatchedRecord[];
}

/**
 * Converts Turkish characters to lower-case ASCII without punctuation
 */
export const toAscii = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

/**
 * Tokenizes a name into distinct ASCII words
 */
export const tokenizeName = (str: string): string[] => {
  if (!str) return [];
  return str
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
};

/**
 * Robust numeric parser for Turkish / English Excel numbers (handling "14,5", 14.5, negative balances)
 */
export const parseExcelBalance = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Resolves default paths for the Excel leave balance file
 */
export const getAvailableLocalLeavePath = (): string | null => {
  const userProfile = process.env.USERPROFILE || "C:\\Users\\ecakir";
  const candidatePaths = [
    process.env.LEAVE_EXCEL_PATH,
    path.join(userProfile, "Desktop", "YILLIK İZİN TAKİP 2026.xlsx"),
    path.join(userProfile, "Desktop", "yillik_izin_takip_2026.xlsx"),
    "C:\\Users\\ecakir\\Desktop\\YILLIK İZİN TAKİP 2026.xlsx",
    path.join(userProfile, "Desktop", "yillik_izin_takip_2025.xlsx"),
    "C:\\Users\\ecakir\\Desktop\\yillik_izin_takip_2025.xlsx",
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      // Ignore filesystem permission or network access errors and check next candidate
    }
  }

  return null;
};

/**
 * Helper to calculate Levenshtein distance for close typo matching (e.g. Beyazkilic vs Beyazkilinc)
 */
const levenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }

  return row[n];
};

/**
 * Synchronize leave balances from an XLSX workbook
 */
export const syncLeaveBalancesFromWorkbook = async (
  workbook: XLSX.WorkBook,
  sourcePath?: string
): Promise<LeaveBalanceSyncSummary> => {
  // 1. Build a Name -> TC lookup map from secondary sheets if available (e.g. 'KULLANIM DETAYI')
  const nameToTcMap = new Map<string, string>();
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    if (!rows || rows.length < 2) continue;

    // Look for header row having 'tc' and 'adı soyadı'
    let tcColIdx = -1;
    let nameColIdx = -1;

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = toAscii(String(row[c] || ""));
        if (val === "tc" || val === "tcno" || val === "tckimlikno") {
          tcColIdx = c;
        } else if (val === "adisoyadi" || val === "adsoyad" || val === "personel") {
          nameColIdx = c;
        }
      }
      if (tcColIdx !== -1 && nameColIdx !== -1) {
        // Headers identified at row r; populate map from subsequent rows
        for (let i = r + 1; i < rows.length; i++) {
          const dataRow = rows[i];
          if (!Array.isArray(dataRow)) continue;

          const rawTc = String(dataRow[tcColIdx] || "").trim().replace(/\D/g, "");
          const rawName = String(dataRow[nameColIdx] || "").trim();
          if (rawTc.length === 11 && rawName) {
            nameToTcMap.set(toAscii(rawName), rawTc);
          }
        }
        break;
      }
    }
  }

  // 2. Locate the primary leave balance sheet
  let targetSheetName = workbook.SheetNames[0];
  for (const sheetName of workbook.SheetNames) {
    const normalizedName = toAscii(sheetName);
    if (normalizedName === "tablo" || normalizedName.includes("izin") || normalizedName.includes("bakiye")) {
      targetSheetName = sheetName;
      break;
    }
  }

  const targetWorksheet = workbook.Sheets[targetSheetName];
  if (!targetWorksheet) {
    throw new Error("Excel dosyasında geçerli bir veri sayfası bulunamadı.");
  }

  // Read raw 2D array to dynamically identify headers
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(targetWorksheet, { header: 1 });
  if (!rawData || rawData.length === 0) {
    return { totalRows: 0, updated: 0, notFound: 0, unchanged: 0, path: sourcePath };
  }

  let headerRowIndex = 0;
  let colTc = -1;
  let colName = -1;
  let colBalance = -1;

  for (let r = 0; r < Math.min(10, rawData.length); r++) {
    const row = rawData[r];
    if (!Array.isArray(row)) continue;

    let hasBalance = false;
    let hasName = false;

    for (let c = 0; c < row.length; c++) {
      const cellText = toAscii(String(row[c] || ""));
      if (cellText === "tc" || cellText === "tcno" || cellText === "tckimlikno") {
        colTc = c;
      } else if (
        cellText === "adisoyadi" ||
        cellText === "adsoyad" ||
        cellText === "personel" ||
        cellText === "isimsoyisim"
      ) {
        colName = c;
        hasName = true;
      } else if (
        cellText === "kalanizin" ||
        cellText === "kalanizinler" ||
        cellText === "bakiyeizin" ||
        cellText === "kalanbakiye" ||
        cellText === "bakiye" ||
        cellText.includes("kalanizin")
      ) {
        colBalance = c;
        hasBalance = true;
      }
    }

    if (hasBalance && (hasName || colTc !== -1)) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback if header search was inconclusive
  if (colBalance === -1) {
    // Try standard sheet_to_json object conversion
    const objRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(targetWorksheet);
    if (objRows.length > 0) {
      const firstRow = objRows[0];
      for (const k of Object.keys(firstRow)) {
        const normKey = toAscii(k);
        if (normKey.includes("kalanizin") || normKey.includes("bakiye")) {
          colBalance = 999; // Marked as object-mode
          break;
        }
      }
    }
  }

  // 3. Pre-load active operators from the database
  const activeOperators = await Operator.findAll({
    where: { is_active: 1 },
    attributes: ["id_dec", "name", "surname", "tc_no", "leave_balance"]
  });

  const opByTc = new Map<string, Operator>();
  const opByExactAsciiName = new Map<string, Operator>();
  const operatorIndex: { op: Operator; tokens: string[]; cleanName: string }[] = [];

  for (const op of activeOperators) {
    const fullName = `${op.name || ""} ${op.surname || ""}`.trim();
    const cleanFull = toAscii(fullName);
    if (cleanFull) {
      opByExactAsciiName.set(cleanFull, op);
    }

    const tc = String(op.tc_no || "").trim().replace(/\D/g, "");
    if (tc.length === 11) {
      opByTc.set(tc, op);
    }

    const tokens = tokenizeName(fullName);
    if (tokens.length >= 2) {
      operatorIndex.push({ op, tokens, cleanName: cleanFull });
    }
  }

  let updateCount = 0;
  let notFoundCount = 0;
  let unchangedCount = 0;
  let matchedByTcCount = 0;
  let matchedByNameCount = 0;
  const unmatchedList: UnmatchedRecord[] = [];

  // 4. Process each row
  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!Array.isArray(row)) continue;

    const rawTc = colTc !== -1 ? String(row[colTc] || "").trim().replace(/\D/g, "") : "";
    const rawName = colName !== -1 ? String(row[colName] || "").trim() : "";
    const rawBalance = colBalance !== -1 ? row[colBalance] : undefined;

    // Skip empty rows
    if (!rawName && !rawTc) continue;
    if (rawBalance === undefined || rawBalance === null || String(rawBalance).trim() === "") continue;

    const balance = parseExcelBalance(rawBalance);
    const cleanName = toAscii(rawName);

    // If TC is not in this row, resolve from nameToTcMap
    const effectiveTc = rawTc.length === 11 ? rawTc : nameToTcMap.get(cleanName) || "";

    let matchedOp: Operator | null = null;
    let matchType = "";

    // Strategy A: Match by 11-digit TC
    if (effectiveTc && opByTc.has(effectiveTc)) {
      matchedOp = opByTc.get(effectiveTc)!;
      matchType = "TC";
    }

    // Strategy B: Match by exact ASCII full name
    if (!matchedOp && cleanName && opByExactAsciiName.has(cleanName)) {
      matchedOp = opByExactAsciiName.get(cleanName)!;
      matchType = "NAME_EXACT";
    }

    // Strategy C: Multi-surname / token containment
    // e.g. Excel has "Nilay Dursun Küçük", DB has "Nilay Dursun" OR vice versa
    if (!matchedOp && cleanName) {
      const excelTokens = tokenizeName(rawName);
      if (excelTokens.length >= 2) {
        for (const item of operatorIndex) {
          // All tokens in DB operator exist in Excel name (e.g. ['nilay', 'dursun'] in ['nilay', 'dursun', 'kucuk'])
          const dbInExcel = item.tokens.every((t) => excelTokens.includes(t));
          // Or all tokens in Excel exist in DB operator
          const excelInDb = excelTokens.every((t) => item.tokens.includes(t));

          if (dbInExcel || excelInDb) {
            matchedOp = item.op;
            matchType = "NAME_TOKENS";
            break;
          }
        }
      }
    }

    // Strategy D: Levenshtein distance typo tolerance (distance <= 2 for strings > 6 chars)
    if (!matchedOp && cleanName && cleanName.length > 6) {
      for (const item of operatorIndex) {
        if (Math.abs(item.cleanName.length - cleanName.length) <= 2) {
          const dist = levenshteinDistance(cleanName, item.cleanName);
          if (dist <= 2) {
            matchedOp = item.op;
            matchType = "NAME_FUZZY";
            break;
          }
        }
      }
    }

    // Process result
    if (matchedOp) {
      if (matchType === "TC") matchedByTcCount++;
      else matchedByNameCount++;

      const currentBalance = Number(matchedOp.leave_balance || 0);

      // Check if balance changed
      const isBalanceDifferent = Math.abs(currentBalance - balance) > 0.001;

      // Check if we can also populate missing TC in DB
      const canUpdateMissingTc =
        (!matchedOp.tc_no || String(matchedOp.tc_no).trim().length !== 11) &&
        effectiveTc.length === 11;

      if (isBalanceDifferent || canUpdateMissingTc) {
        const updatePayload: Record<string, unknown> = {};
        if (isBalanceDifferent) {
          updatePayload.leave_balance = balance;
        }
        if (canUpdateMissingTc) {
          updatePayload.tc_no = effectiveTc;
        }

        await matchedOp.update(updatePayload);

        // Record audit log for balance change
        if (isBalanceDifferent) {
          try {
            await LeaveBalanceLog.create({
              user_id: String(matchedOp.id_dec),
              leave_record_id: null,
              change_amount: balance - currentBalance,
              balance_after: balance,
              reason: sourcePath ? "Sunucu Excel Senkronizasyonu" : "Manuel Excel Yükleme"
            });
          } catch {
            // Ignore audit log error if table constraint differs
          }
          updateCount++;
        } else {
          unchangedCount++;
        }
      } else {
        unchangedCount++;
      }
    } else {
      notFoundCount++;
      if (unmatchedList.length < 50) {
        unmatchedList.push({
          name: rawName,
          tc: effectiveTc || undefined,
          balance
        });
      }
    }
  }

  const totalProcessed = updateCount + unchangedCount + notFoundCount;

  return {
    totalRows: totalProcessed,
    updated: updateCount,
    notFound: notFoundCount,
    unchanged: unchangedCount,
    matchedByTc: matchedByTcCount,
    matchedByName: matchedByNameCount,
    path: sourcePath,
    unmatchedPreview: unmatchedList
  };
};

/**
 * Synchronize leave balances from local file system
 */
export const syncLeaveBalancesFromLocalFile = async (): Promise<LeaveBalanceSyncSummary> => {
  const filePath = getAvailableLocalLeavePath();

  if (!filePath) {
    const configured = process.env.LEAVE_EXCEL_PATH || "C:\\Users\\ecakir\\Desktop\\YILLIK İZİN TAKİP 2026.xlsx";
    throw new Error(
      `Sunucu veya yerel diskte izin takip dosyası bulunamadı. Yapılandırılan yol: ${configured}. Lütfen dosyanın masaüstünde veya sunucu paylaşımında bulunduğundan emin olun.`
    );
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  return await syncLeaveBalancesFromWorkbook(workbook, filePath);
};

/**
 * Synchronize leave balances from an uploaded file buffer
 */
export const syncLeaveBalancesFromBuffer = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<LeaveBalanceSyncSummary> => {
  // Save an archive copy to Desktop/Yuklenen_Izin_Dosyalari if directory can be created
  try {
    const userProfile = process.env.USERPROFILE || "C:\\Users\\ecakir";
    const archiveDir = path.join(userProfile, "Desktop", "Yuklenen_Izin_Dosyalari");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = originalFilename ? path.basename(originalFilename) : "izinler.xlsx";
    const archivePath = path.join(archiveDir, `${timestamp}_${safeName}`);
    fs.writeFileSync(archivePath, buffer);
  } catch {
    // Continue even if archiving fails
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  return await syncLeaveBalancesFromWorkbook(workbook);
};
