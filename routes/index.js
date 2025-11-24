var express = require('express');
var router = express.Router();

const connection = require('../database');

router.get('/database', function(req, res, next) {
  const query = `
  SELECT 
    gep.id,
    gep.gyarto AS "Brand",
    gep.tipus AS "Típus",
    gep.kijelzo,
    gep.memoria,
    gep.merevlemez,
    gep.videovezerlo,
    gep.ar,
    processzor.gyarto AS "gyártó",
    processzor.tipus AS cpu_tipus,
    oprendszer.nev AS oprendszer
  FROM gep
  INNER JOIN processzor ON gep.processzorid = processzor.id
  INNER JOIN oprendszer ON gep.oprendszerid = oprendszer.id
  ORDER BY gep.id;
`;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Adatbázis hiba /database:", err);
      return res.status(500).send("Adatbázis lekérési hiba");
    }

    const isAuth  = req.isAuthenticated ? req.isAuthenticated() : false;
    const isAdmin = isAuth && req.user && req.user.isAdmin == 1;
    const username = isAuth && req.user ? req.user.username : "";

    res.render('database', {
      title: 'Gépek listája',
      rows: results,         // <-- ITT ADJUK ÁT!
      isAuth,
      isAdmin,
      username
    });
  });
});

// Kapcsolat oldal megjelenítés
router.get('/contact', (req, res) => {
  res.render("contact", {
    layout: "layout",
    title: "Kapcsolat",
    messageSent: false,
    isAuth: req.isAuthenticated ? req.isAuthenticated() : false,
    isAdmin: req.user && req.user.isAdmin == 1,
    username: req.user ? req.user.username : ""
  });
});

// Üzenet mentése
router.post('/contact', (req, res, next) => {
    const { nev, email, telefon, uzenet } = req.body;

    // VALIDÁCIÓ: üres mezők ellenőrzése
    if (!nev || !email || !uzenet) {
        return res.render('contact', {
            layout: "layout",
            title: "Kapcsolat",
            contactError: true,
            contactSuccess: false,
            errorMessage: "A név, email és üzenet mező kitöltése kötelező!"
        });
    }

    const sql = `
        INSERT INTO uzenetek (nev, email, telefon, uzenet)
        VALUES (?, ?, ?, ?)
    `;

    connection.query(sql, [nev, email, telefon, uzenet], (err, result) => {
        if (err) {
            console.error("Kapcsolat mentési hiba:", err);
            // Itt egyszerűen visszadobjuk a főoldalt hibaüzenettel
            return res.render('contact', {
                title: 'Web2 Labor',
                isAuth: req.isAuthenticated ? req.isAuthenticated() : false,
                isAdmin: req.user && req.user.isAdmin == 1,
                username: req.user ? req.user.username : "",
                contactError: true,
                contactSuccess: false
            });
        }

        // Sikeres mentés után visszatöltjük a főoldalt siker üzenettel
        res.render('contact', {
            title: 'Web2 Labor',
            isAuth: req.isAuthenticated ? req.isAuthenticated() : false,
            isAdmin: req.user && req.user.isAdmin == 1,
            username: req.user ? req.user.username : "",
            contactError: false,
            contactSuccess: true
        });
    });
});

module.exports = router;
