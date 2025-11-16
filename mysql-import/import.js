// import.js
const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
  // 1) DB kapcsolat beállítása
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'web2lab'
  });

  // Helper: TSV fájl beolvasása
  async function readTsv(path) {
    const raw = await fs.promises.readFile(path, 'utf8');
    return raw
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0);
  }

  // 2) processzor.txt betöltése
  const procLines = await readTsv('processzor.txt');
  // első sor: fejléc -> skip
  for (let i = 1; i < procLines.length; i++) {
    const cols = procLines[i].split('\t');
    const [id, gyarto, tipus] = cols;

    await conn.execute(
      'INSERT INTO processzor (id, gyarto, tipus) VALUES (?, ?, ?)',
      [Number(id), gyarto, tipus]
    );
  }
  console.log('processzor kész');

  // 3) oprendszer.txt betöltése
  const osLines = await readTsv('oprendszer.txt');
  for (let i = 1; i < osLines.length; i++) {
    const cols = osLines[i].split('\t');
    const [id, nev] = cols;

    await conn.execute(
      'INSERT INTO oprendszer (id, nev) VALUES (?, ?)',
      [Number(id), nev]
    );
  }
  console.log('oprendszer kész');

  // 4) gep.txt betöltése
  const gepLines = await readTsv('gep.txt');
  for (let i = 1; i < gepLines.length; i++) {
    const cols = gepLines[i].split('\t');

    const [
      gyarto,
      tipus,
      kijelzo,
      memoria,
      merevlemez,
      videovezerlo,
      ar,
      processzorid,
      oprendszerid,
      db
    ] = cols;

    await conn.execute(
      `INSERT INTO gep
       (gyarto, tipus, kijelzo, memoria, merevlemez, videovezerlo, ar,
        processzorid, oprendszerid, db)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gyarto,
        tipus,
        kijelzo.replace(',', '.'), // ha DECIMAL a mező és vessző van benne
        Number(memoria),
        Number(merevlemez),
        videovezerlo,
        Number(ar),
        Number(processzorid),
        Number(oprendszerid),
        Number(db)
      ]
    );
  }
  console.log('gep kész');

  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});