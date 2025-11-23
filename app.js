const express = require('express');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const crypto = require('crypto');
const bodyParser = require("body-parser");

var indexRouter = require('./routes/index');

// Itt húzzuk be a külső adatbázis kapcsolatot
const connection = require('./database');

const app = express();

// --- 1. BEÁLLÍTÁSOK (Sorrend FONTOS!) ---

app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");

app.use('/', indexRouter);

// Body parserek (hogy tudjuk olvasni a POST adatokat)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Beállítása (Használja a behúzott 'connection'-t)
app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: new MySQLStore({}, connection), // Itt adjuk át a meglévő kapcsolatot
    resave: false,
    saveUninitialized: false, // Csak akkor mentünk, ha van login
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 nap
    }
}));

// --- 2. PASSPORT INITIALIZE (Ezeknek a Route-ok ELŐTT kell lenniük!) ---
app.use(passport.initialize());
app.use(passport.session());

// Debug log (hogy lásd a konzolon, mi történik)
app.use((req, res, next) => {
    console.log("\nKérés: " + req.url);
    //console.log("Session:", req.session);
    //console.log("User:", req.user);
    next();
});

// --- 3. SEGÉDFÜGGVÉNYEK ---

function genPassword(password) {
    return crypto.createHash('sha512').update(password).digest('hex');
}

function validPassword(password, hash) {
    return hash === crypto.createHash('sha512').update(password).digest('hex');
}

function isAuth(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.redirect('/notAuthorized');
    }
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin == 1) {
        next();
    } else {
        res.redirect('/notAuthorizedAdmin');
    }
}

// --- 4. PASSPORT STRATÉGIA ---

const customFields = {
    usernameField: 'uname',
    passwordField: 'pw',
};

const verifyCallback = (username, password, done) => {
    connection.query('SELECT * FROM users WHERE username = ? ', [username], function(error, results, fields) {
        if (error) return done(error);
        if (results.length == 0) return done(null, false);

        const isValid = validPassword(password, results[0].hash);
        
        // Fontos: itt definiáljuk, mi kerüljön a user objektumba
        const user = { id: results[0].id, username: results[0].username, isAdmin: results[0].isAdmin, hash: results[0].hash };
        
        if (isValid) {
            return done(null, user);
        } else {
            return done(null, false);
        }
    });
};

const strategy = new LocalStrategy(customFields, verifyCallback);
passport.use(strategy);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(function(userId, done) {
    connection.query('SELECT * FROM users where id = ?', [userId], function(error, results) {
        done(null, results[0]);
    });
});

// --- 5. ÚTVONALAK (ROUTES) ---

// Főoldal
app.get('/', (req, res, next) => {
    let auth = false;
    let username = "";
    let admin = false;

    if (req.isAuthenticated()) {
        auth = true;
        username = req.user.username;
    }
    if (req.isAuthenticated() && req.user.isAdmin == 1) {
        admin = true;
    }

    res.render("index", {
        title: "Web2 Labor", // Ez hiányzott korábban az index.ejs-hez
        isAuth: auth, 
        isAdmin: admin, 
        username: username
   });
});

// Csak akkor engedjük megnyitni, ha 'isAuth' (be van lépve)
app.get('/messages', isAuth, (req, res, next) => {
    // Itt rendereld le az üzenetek oldalt, vagy amit szeretnél
    res.render("messages", {
        username: req.user.username,
        isAuth: true,
        isAdmin: (req.user.isAdmin == 1)
    });
});

app.get('/admin', isAdmin, (req, res, next) => {
    // Itt rendereld le az üzenetek oldalt, vagy amit szeretnél
    res.render("admin", {
        username: req.user.username,
        isAuth:true,
        isAdmin: (req.user.isAdmin == 1)
    });
});

// --- LOGIN ROUTE (JSON válasz a Modalnak) ---
// app.js - Javított /login route
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ success: false, message: "Szerver hiba" });
        if (!user) return res.json({ success: false, message: "Hibás adatok!" });

        req.login(user, (err) => {
            if (err) return res.status(500).json({ success: false, message: "Belépési hiba" });

            // --- A JAVÍTÁS: ---
            // Kényszerítjük a session mentést, és csak UTÁNA küldjük a választ
            req.session.save(function() {
                return res.json({ success: true });
            });
        });
    })(req, res, next);
});
// --- REGISZTRÁCIÓ (MODALHOZ - JSON VÁLASZ) ---
// Ez kezeli a felugró ablakos regisztrációt és az azonnali beléptetést
app.post('/register', (req, res, next) => {
    const username = req.body.uname;
    const password = req.body.pw;

    // 1. Ellenőrizzük, létezik-e
    connection.query('SELECT * FROM users WHERE username = ?', [username], function(error, results) {
        if (error) return res.status(500).json({ success: false, message: "Adatbázis hiba." });

        if (results.length > 0) {
            // Ha foglalt, JSON-t küldünk vissza
            return res.json({ success: false, message: "Ez a felhasználónév már foglalt!" });
        } else {
            // 2. Ha szabad, mentjük
            const hash = genPassword(password);
            
            connection.query('INSERT INTO users (username, hash, isAdmin) VALUES (?, ?, 0)', [username, hash], function(error, results) {
                if (error) return res.status(500).json({ success: false, message: "Hiba a mentéskor." });

                // 3. AZONNALI BELÉPTETÉS (Session mentése)
                const user = {
                    id: results.insertId,
                    username: username,
                    isAdmin: 0
                };

                req.login(user, function(err) {
                    if (err) return res.json({ success: false, message: "Regisztráció sikeres, de a belépés nem." });
                    
                    // Minden oké -> Küldjük a sikert a Frontend JS-nek
                    return res.json({ success: true });
                });
            });
        }
    });
});

// Védett útvonal
app.get('/protected-route', isAuth, (req, res, next) => {
    let admin = false;
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true;
    
    res.render("protected", {
        isAdmin: admin, username: req.user.username
   });
});

// Nem engedélyezett üzenet
app.get('/notAuthorized', (req, res, next) => {
    res.send('<h1>Nem vagy bejelentkezve!</h1><p><a href="/login">Jelentkezz be itt</a> vagy a főoldalon.</p>');
});

// Admin útvonal
app.get('/admin-route', isAdmin, (req, res, next) => {
    res.render("admin", {
        userName: req.user.username
   });
});

app.get('/notAuthorizedAdmin', (req, res, next) => {
    res.send('<h1>Nincs Admin jogosultságod!</h1><p><a href="/">Vissza a főoldalra</a></p>');
});

// Kijelentkezés
app.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// --- EXPORT ---
module.exports = app;