import fs from "fs"; //fs: The built-in Node.js File System module
import csv from "csv-parser";

export function loadCsvRows(csvPath) { //loadCsvRows: Function to load CSV rows from a file
  return new Promise((resolve, reject) => { 
    const rows = []; 
    const headers = []; 

    fs.createReadStream(csvPath)  
      .pipe(csv())
      .on("headers", (h) => headers.push(...h))
      .on("data", (row) => rows.push(row))    // after reading each row, push it to rows array
      .on("end", () => resolve({ headers, rows })) // return headers and rows when done
      .on("error", reject); 
  });
}

//fs.createReadStream(csvPath): Instead of loading the entire file into memory at once 
//(which could crash the program with very large files),
//  it reads the file piece-by-piece as a "stream".