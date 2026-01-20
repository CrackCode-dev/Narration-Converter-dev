import fs from "fs";
import csv from "csv-parser";

export function loadCsvRows(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const headers = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("headers", (h) => headers.push(...h))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve({ headers, rows }))
      .on("error", reject);
  });
}
