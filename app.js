require('dotenv').config()
var express = require('express')
var app = express()
var port = process.env.PORT || 8080;
var mysql = require('mysql');
var requestify = require('requestify');
var jsSha256 = require("js-sha256");
var connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

function makeid(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < len; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

connection.connect()

app.all('/', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
 });

app.get('/', function(req, res) {
    res.redirect("https://isonlinev3.docs.apiary.io")
})

//STATUS PATH

app.get('/v1/status/get/:users', function(req, res) {
    let names = req.params.users.split(",");
    let command = 'SELECT `username`,`date` FROM users WHERE (';
    console.log(names);
    for (var i in names) {
        command += 'BINARY username = ? OR ';
    }

    command = command.slice(0, -4);
    command += ")";

    console.log(command);

    connection.query(command, names, function(err, rows, fields) {
        if (err) throw err
        
        let timestamp = Math.floor(new Date() / 1000);
        let users = [];
        
        for (var i in rows){
            let time = timestamp - rows[i].date;
            
            if (time < 180){ // 3 minutes
                time = "online";
            } else if (time < 1209600) { // Less than 2 weeks
                time = "offline";
            } else { // Longer than 2 weeks
                time = "unknown";
            }
            
            names = names.filter(e => e !== rows[i].username);
            
            users.push({name:rows[i].username, status:time});
        }
        
        for (var i in names){

            if (names[i] === "alwaysonline"){
                users.push({name:names[i], status:"online"});
            } else if (names[i] === "alwaysoffline"){
                users.push({name:names[i], status:"offline"});
            } else if (names[i] === "alwaysunknown"){
                users.push({name:names[i], status:"unknown"});
            } else{
                users.push({name:names[i], status:"notiouser"});
            }
        }
        
        res.json(users);
    })

})

app.get('/v1/status/set/:user/:userkey', function(req, res) {
    let command = "UPDATE users SET date = ? WHERE BINARY username = ? AND BINARY token = ? AND activated = 1;";

    console.log(command);

    connection.query(command, [Math.floor(new Date() / 1000), req.params.user, req.params.userkey], function(err, result) {
        if (result.changedRows != 1 || err) {
            res.json({
                success: false
            });
            console.log(err);
        } else {
            res.json({
                success: true
            });
        }
    })

})

// VERIFY PATH

app.get('/v1/verify/gettoken/:username/:passphrase', function(req, res) {
    let command = "INSERT INTO users (username, activated, date, token) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE token = ?, activated = 1";

    requestify.get('https://api.scratch.mit.edu/projects/274388698/comments?' + Math.random()).then(function(response) {
        // Get the response body
        
        let messages = response.getBody();
        let hash = jsSha256(req.params.passphrase);
        let verified = 0;
        for (var i in messages){
            if (messages[i].author.username === req.params.username && messages[i].content === hash){
                verified = 1;
                console.log("Verified")
                break;
            }
        }
        
        if (verified == 0){
            res.json({
                token: false
            });
            return;
        }
        let token = makeid(64);

        connection.query(command, [req.params.username, Math.floor(new Date() / 1000), token, token], function(err, result) {

            //console.log(err, result)

            if (err) {
                res.JSON({
                    token: false
                });
                //console.log(err);
            } else {
                res.json({
                    token: token
                });
            }
        })

    });

})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
