const express = require('express');
const { Client } = require('pg');
const app = express();

const PORT = process.env.PORT || 5000;

const client = new Client({
    connectionString: process.env.DB_URL || require('./local_keys/connection_key.json')["connectionString"],
    ssl: {
      rejectUnauthorized: false
    }
});
client.connect();

app.use(express.static('images'));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello from server.");
});

app.post('/register', (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    client.query(`INSERT INTO "User" (username, password) VALUES ('${username}', '${password}')`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        } 
        else {
            client.query(`SELECT id FROM "User" WHERE "User".username = '${username}'`, (err2, second_query_res) => {
                if (err2) {
                    res.status(500);
                    res.json({"error": err});
                    return;
                }
                res.status(200);
                res.json({"id": second_query_res.rows[0].id});
            });
        }
    });
    console.log(`register request user=${username} password=${password}`);
})

app.get('/test', (req, res) => {
    console.log(req.body);
    res.send("AAAAAAA");
})

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));