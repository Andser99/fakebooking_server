const { query } = require('express');
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
    let password_again = req.body.password_again;
    if (password_again != password) {
        res.status(400);
        res.json({"error": "Passwords don't match."});
    }
    else {
        client.query(`INSERT INTO "Users" (username, password) VALUES ('${username}', '${password}')`, (err, query_res) => {
            if (err) {
                res.status(401);
                res.json({"error": "Username taken."});
            } 
            else {
                client.query(`SELECT id FROM "Users" WHERE "Users".username = '${username}'`, (err2, second_query_res) => {
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
    }
});

app.post('/login', (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    client.query(`SELECT id, password FROM "Users" WHERE "Users".username = '${username}'`, (err, query_res) => {
        if (err) {
            res.status(404);
            res.json({"error": "user not found"});
        } 
        else if (query_res.rows[0].password == password) {
            res.status(200);
            res.json({"user_id": query_res.rows[0].id, "username": username});
        }
        else {
            res.status(401);
            res.json({"error": "Wrong password.", "username": username});
        }
    });
    console.log(`login request user=${username} password=${password}`);
});

app.post('/review', (req, res) => {
    let reservation_id = req.body.reservation_id;
    let stars = req.body.stars;
    let text = req.body.text || "";
    // Find the matching reservation
    client.query(`SELECT user_id, hotel_id FROM "Reservation" WHERE "Reservation".id = ${reservation_id}`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else {
            let user_id = query_res.rows[0].user_id;
            let hotel_id = query_res.rows[0].hotel_id;
            client.query(`SELECT username FROM "Users" WHERE "Users".id = ${user_id}`, (err_user, query_res_user) => {
                if (err_user) {
                    res.status(500);
                    res.json({"error": err_user});
                }
                else {
                    let username = query_res_user.rows[0].username;
                    client.query(`INSERT INTO "Reviews" (reservation_id, text, stars, username) VALUES ('${username}', '${password}')`, (err_review, query_res_review) => {
                        if (err_review) {
                            res.status(401);
                            res.json({"error": err_review});
                        }
                        else {
                            res.status(200);
                            res.send("OK");
                        }
                    });
                    console.log(`review inserted with text=${text} stars=${stars}`);
                    // TODO - UPDATE review_id on reservation by querying by reservation_id
                }
            });
        }
    });

});

app.get('/test', (req, res) => {
    console.log(req.body);
    res.send("AAAAAAA");
})

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));