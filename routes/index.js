var express = require('express');
var router = express.Router();


router.get('/database', function(req, res, next) {
  res.render('database', { title: 'ReNew' });
});

module.exports = router;