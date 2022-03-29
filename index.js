const express = require('express');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
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

app.use(express.json());
app.use(fileUpload({
    createParentPath: true
}));
app.use(express.static(__dirname + '/public'));

// app.get('/', (req, res) => {
//     res.send("Hello from server.");
// });

app.get('/stranka', function(req, res) {
    res.sendFile(path.join(__dirname, '/public/upload.html'));
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

app.post('/reservations', (req, res) => {
    let user_id  = req.body.user_id ;
    let hotel_id  = req.body.hotel_id ;
    let date_from  = req.body.date_from;
    let date_to   = req.body.date_to;
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
            res.status(404);
            res.json({"error": err});
        }
        else {
            res.status(200);
            res.json({"list": query_res.rows});
        }
    });
});

app.get('/review/:id', (req, res) => {
    var review_id = parseInt(req.params.id);
    client.query(`SELECT * FROM "Reviews" WHERE "Reviews".id = ${review_id}`, (err, query_res) => {
        if (err) {
            res.status(404);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            res.status(200);
            res.json(query_res.rows[0]);
        } else {
            res.status(404);
            res.json({"error": "No review found"});
        }
    });
});

app.delete('/review/:id', (req, res) => {
    var review_id = parseInt(req.params.id);
    client.query(`DELETE FROM "Reviews" WHERE "Reviews".id = ${review_id} RETURNING id`, (err, query_res) => {
        if (err) {
            res.status(404);
            res.json({"error": err});
        }
        else if (query_res.rows[0]){
            res.status(200);
            res.json({"review_id":query_res.rows[0].id});
        } else {
            res.status(404);
            res.json({"error": "No review found"});
        }
    });
});


app.get('/hotel/:id', (req, res) => {
	var hotel_id = parseInt(req.params.id);
    client.query(`SELECT * FROM "Hotel" WHERE "Hotel".id = ${hotel_id}`, (err, query_res) => {
        if (err) {
            res.status(404);
            res.json({"error": err});
        }
        else {
            client.query(`SELECT * FROM "Reviews" WHERE "Reviews".hotel_id = ${hotel_id}`, (err_review, query_res_review) => {
                if (err_review) {
                    res.status(404);
                    res.json({"error": err_review});
                }
                else {
                    res.status(200);
                    query_res.rows[0]['reviews'] = query_res_review.rows;
                    res.json(query_res.rows[0]);
                }
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
            client.query(`SELECT username FROM "Users" WHERE "Users".id = ${user_id}`, (err_user, query_res_user) => {
                if (err_user) {
                    res.status(500);
                    res.json({"error": err_user});
                }
                else if (query_res_user.rows[0]){
                    let username = query_res_user.rows[0].username;
                    client.query(`INSERT INTO "Reviews" (user_id, hotel_id, text, stars, username) VALUES ('${user_id}', '${hotel_id}', '${text}', '${stars}', '${username}') RETURNING id`, (err_review, query_res_review) => {
                        if (err_review) {
                            res.status(401);
                            res.json({"error": err_review});
                        }
                        else {
                            console.log(`review inserted with text=${text} stars=${stars}`);
                            client.query(`UPDATE "Reservation" SET review_id='${query_res_review.rows[0].id}' WHERE "Reservation".id = ${reservation_id}`, (err_reserv, query_res_reserv) => {
                                if (err_reserv) {
                                    res.status(401);
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
    client.query(`SELECT * FROM "Reviews" WHERE "Reviews".id = ${review_id}`, (err, query_res) => {
        if (err) {
            res.status(500);
            res.json({"error": err});
        }
        else {
            if (query_res.rows[0]){
                let prev_text = query_res.rows[0].text;
                let prev_stars = query_res.rows[0].stars;
                if (prev_stars == stars && prev_text == text){
                    res.status(200);
                    res.json({"review_id": review_id});
                }
                else {
                    client.query(`UPDATE "Reviews" SET stars='${stars}', text='${text}' WHERE "Reviews".id = ${review_id}`, (err_review, query_res_review) => {
                        if (err_review) {
                            res.status(401);
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
                res.json({"error": "No such review"});
            }
        }
    });

});

const MAX_UPlOADED_FILE_SIZE = 10485760; // in bytes, 10MB
app.post('/story', async (req, res) => {
    try {
        if(!req.files) {
            res.status(413);
            res.json({"error": "No file in body."})
        } else if (req.files.photo.size > 10485760) {
            res.status(413);
            res.json({"error": `File too large. Maximum size is ${MAX_UPlOADED_FILE_SIZE}`});
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
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/story', (req, res) => {
    client.query(`SELECT "Stories".image_path FROM "Stories"`, (err, query_res) => {
        res.status(200);
        res.json(query_res.rows);
    })
});



app.get('/test', (req, res) => {
    console.log(req.body);
    res.send("AAAAAAA");
})

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));