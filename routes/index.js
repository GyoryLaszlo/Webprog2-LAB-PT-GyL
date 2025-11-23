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

module.exports = router;
