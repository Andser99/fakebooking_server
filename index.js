const express = require('express');
const { Client } = require('pg');
const app = express();
const PORT = process.env.PORT || 5000;

const client = new Client({
    connectionString: process.env.DB_URL || require('./local_keys/connection_key.json')["connectionString"],
    ssl: false,
});
client.connect();

app.use(express.static('images'));

app.get('/register', (req, res) => {
    console.log(req.body);
    let username = req.body.username;
    let password = req.body.password;
    client.query(`INSERT INTO public.User(username, password) VALUES (${username}, ${password})`, (err, query_res) => {
        res.status(200);
        res.json({"username": username, "password": password});
    });
    console.log(`register request user=${username} password=${password}`);
})

app.get('/test', (req, res) => {
    console.log(req);
    res.send("AAAAAAA");
})

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));