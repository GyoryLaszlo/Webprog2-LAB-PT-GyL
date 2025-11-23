
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "web2lab",
    multipleStatements: true
});

connection.connect((err) => {
    if (!err) console.log("Connected to Database");
    else console.log("Connection Failed: " + err);
});

module.exports = connection;