const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const { Client } = require('pg');
const app = express();
const { ExpressPeerServer } = require('peer');


const PORT = process.env.PORT || 5000;

const client = new Client({
    connectionString: process.env.DB_URL || require('./local_keys/connection_key.json')["connectionString"],
    ssl: {
      rejectUnauthorized: false
    }
});
client.connect();

app.use(express.json());
app.use(fileUpload({
    createParentPath: true
}));
app.use(express.static(__dirname + '/public'));
console.log(__dirname);

app.get('/', (req, res) => {
    res.send("Hello from server.");
});

app.get('/stranka', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/upload.html'));
  });

app.post('/register', (req, res) => {
    let query = {
        "username": req.body.username || "", 
        "password": req.body.password || "", 
        "password_again": req.body.password_again || ""
    };
    let missing_fields = [];
    for (let x in query){
        if (query[x] == ""){
            missing_fields.push(x)
        }
    }
    if (missing_fields.length != 0){
        res.status(400);
        res.json({
            "error": "Missing fields",
            "fields": missing_fields
          });
    } else if (query.password_again != query.password) {
        res.status(400);
        res.json({"error": "Passwords don't match."});
    } 
    else {
        client.query(`INSERT INTO "User" (username, password) VALUES ('${query.username}', '${query.password}') RETURNING id`, (err, query_res) => {
            if (err) {
                res.status(401);
                res.json({
                    "error": "Duplicate username",
                    "username": query.username
                  });
            } 
            else {
                res.status(200);
                res.json({"user_id": query_res.rows[0].id});
            }
        });
        console.log(`register request user=${query.username} password=${query.password}`);
    }
});

app.post('/login', (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    client.query(`SELECT id, password FROM "User" WHERE "User".username = '${username}'`, (err, query_res) => {
        if (err) {
            res.status(401);
            res.json({"error": err});
        } 
        if (query_res.rows[0]){
            if (query_res.rows[0].password == password) {
                res.status(200);
                res.json({"user_id": query_res.rows[0].id});
            }
            else {
                res.status(401);
                res.json({"error": "Wrong password.", "username": username});
            }
        } else {
            res.status(404);
            res.json({
                "error": "User not found",
                "username": username
            });
        }
    });
    console.log(`login request user=${username} password=${password}`);
});

app.post('/reservations', (req, res) => {
    let user_id  = req.body.user_id ;
    let hotel_id  = req.body.hotel_id ;
    let date_from  = req.body.date_from;
    let date_to   = req.body.date_to;
    if (new Date(date_from) > new Date(date_to)){
        res.status(400);
        res.json({
            "error": "Wrong dates"
          });
    } else {
        client.query(`INSERT INTO "Reservation" (user_id, hotel_id, reserved_from, reserved_to, review_id) VALUES ('${user_id}', '${hotel_id}', '${date_from}', '${date_to}', NULL) RETURNING id;`, (err, query_res) => {
            if (err) {
                res.status(401);
                res.json({"error": err});
            }
            else {
                res.status(200);
                res.json({"reservation_id": query_res.rows[0].id});
            }
        });
    }
});

app.get('/reservations', (req, res) => {
    let user_id  = req.body.user_id ;
    client.query(`SELECT * FROM "Reservation" WHERE "Reservation".user_id = ${user_id}`, (err, query_res) => {
        if (err) {
            res.status(404);
            res.json({"error": err});
        }
        else {
            res.status(200);
            res.json({"list": query_res.rows});
        }
    });
});

app.get('/hotels', (req, res) => {
    client.query(`SELECT * FROM "Hotel"`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            res.status(200);
            res.json({"list": query_res.rows});
        } else {
            res.status(404);
            res.json({
                "error": "No hotels found"
              })
        }
    });
});

app.get('/review/:id', (req, res) => {
    var review_id = parseInt(req.params.id);
    client.query(`SELECT * FROM "Review" WHERE "Review".id = ${review_id}`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            res.status(200);
            res.json(query_res.rows[0]);
        } else {
            res.status(404);
            res.json({"error": "No review with such id found"});
        }
    });
});

app.delete('/review/:id', (req, res) => {
    var review_id = parseInt(req.params.id);
    client.query(`UPDATE "Reservation" SET review_id = NULL WHERE review_id = ${review_id}`, (err_1, query_res_1) => {
        if (err_1) {
            res.status(500);
            res.json({"error": err_1});
        }
        else {
            client.query(`DELETE FROM "Review" WHERE "Review".id = ${review_id} RETURNING id`, (err, query_res) => {
                if (err) {
                    res.status(500);
                    res.json({"error": err});
                }
                else if (query_res.rows[0]){
                    res.status(200);
                    res.json({"review_id":query_res.rows[0].id});
                } else {
                    res.status(404);
                    res.json({"error": "No review with such id found"});
                }
            });
        }
    });
});


app.get('/hotel/:id', (req, res) => {
	var hotel_id = parseInt(req.params.id);
    client.query(`SELECT * FROM "Hotel" WHERE "Hotel".id = ${hotel_id}`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            client.query(`SELECT * FROM "Review" WHERE "Review".hotel_id = ${hotel_id}`, (err_review, query_res_review) => {
                if (err_review) {
                    res.status(500);
                    res.json({"error": err_review});
                }
                else {
                    res.status(200);
                    query_res.rows[0]['reviews'] = query_res_review.rows;
                    res.json(query_res.rows[0]);
                }
            });
        }
        else {
            res.status(404);
            res.json({
                "error": "No hotel found"
              });
        }
    });

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
        else if (query_res.rows[0]){
            let user_id = query_res.rows[0].user_id;
            let hotel_id = query_res.rows[0].hotel_id;
            client.query(`SELECT username FROM "User" WHERE "User".id = ${user_id}`, (err_user, query_res_user) => {
                if (err_user) {
                    res.status(500);
                    res.json({"error": err_user});
                }
                else if (query_res_user.rows[0]){
                    let username = query_res_user.rows[0].username;
                    client.query(`INSERT INTO "Review" (user_id, hotel_id, text, stars, username) VALUES ('${user_id}', '${hotel_id}', '${text}', '${stars}', '${username}') RETURNING id`, (err_review, query_res_review) => {
                        if (err_review) {
                            res.status(500);
                            res.json({"error": err_review});
                        }
                        else {
                            console.log(`review inserted with text=${text} stars=${stars}`);
                            client.query(`UPDATE "Reservation" SET review_id='${query_res_review.rows[0].id}' WHERE "Reservation".id = ${reservation_id}`, (err_reserv, query_res_reserv) => {
                                if (err_reserv) {
                                    res.status(500);
                                    res.json({"error": err_reserv});
                                }
                                else{
                                    res.status(200);
                                    res.json({"review_id": query_res_review.rows[0].id});
                                }
                            });
                        }
                    });
                } else {
                    res.status(404);
                    res.json({"error": "No user found"});
                }
            });
        } else {
            res.status(404);
            res.json({"error": "No reservation found"});
        }
    });

});

app.put('/review', (req, res) => {
    let review_id = req.body.review_id;
    let stars = req.body.stars;
    let text = req.body.text || "";
    // Find the matching reservation
    client.query(`SELECT * FROM "Review" WHERE "Review".id = ${review_id}`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            let prev_text = query_res.rows[0].text;
            let prev_stars = query_res.rows[0].stars;
            if (prev_stars == stars && prev_text == text){
                res.status(200);
                res.json({"review_id": review_id});
            }
            else {
                client.query(`UPDATE "Review" SET stars='${stars}', text='${text}' WHERE "Review".id = ${review_id}`, (err_review, query_res_review) => {
                    if (err_review) {
                        res.status(500);
                        res.json({"error": err_review});
                    }
                    else{
                        res.status(200);
                        res.json({"review_id": review_id});
                    }
                });
            }
        } else {
            res.status(404);
            res.json({"error": "No review with such id found"});
        }
    });

});

const MAX_UPlOADED_FILE_SIZE = 10485760; // in bytes, 10MB
app.post('/story', async (req, res) => {
    try {
        if(!req.files) {
            res.status(400);
            res.json({"error": "No file in body."})
        } else if (req.files.photo.size > 10485760) {
            res.status(413);
            res.json({"error": `File too large. Maximum size is ${MAX_UPlOADED_FILE_SIZE}b`});
        } else {
            let date =  Date.now().toString();
            let imagePath = '/images/' + date + "_" + req.body.username + "." + req.files.photo.name.split('.')[1];
            client.query(`INSERT INTO "Stories" (image_path, username, created_at) VALUES ('${imagePath}', '${req.body.username}', to_timestamp('${date}'))`, (err, query_res) => {
                if (err) {
                    res.status(500);
                    res.send(err);
                } else {
                    console.log(`File ${imagePath} - uploaded`);
                    let story = req.files.photo;
            
                    //Move image to folder
                    story.mv('.' + '/public' + imagePath);
        
                    //send response
                    res.status(200);
                    res.json({message: 'File uploaded.'});
                }
            });
        }
    } catch (err_serv) {
        console.log(err_serv)
        res.status(500).send(err_serv);
    }
});

app.get('/story', (req, res) => {
    client.query(`SELECT "Stories".image_path FROM "Stories"`, (err, query_res) => {
        if (err){
            res.status(500);
            res.send(err);
        }
        else if (query_res.rows[0]){
            res.status(200);
            res.json(query_res.rows);
        } else {
            res.status(404);
            res.json({"error": "No images found"})
        }
    })
});



app.get('/test', (req, res) => {
    console.log(req.body);
    res.send("AAAAAAA");
})
var server = require('http').createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs'
});

app.use('/myapp', peerServer);
const listener = server.listen(PORT, () => console.log(`Listening on ${ PORT }`));