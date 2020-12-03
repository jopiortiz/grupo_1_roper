const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');
const { validationResult } = require('express-validator');
let db = require("../../database/models")
let {Op} = require('sequelize')

exports.showRegister = (req, res) => {
    res.render('users/register');
};

exports.showLogin = (req, res) => {
    res.render('users/login');
};

exports.processLogin = async (req, res) => {
    let usuarioLogueado = await db.Users.findAll({
        where: {
            email: {[Op.like]: req.body.email}
        }
    })
    usuarioLogueado = usuarioLogueado[0].email;
    req.session.usuario = usuarioLogueado;
    if(req.body.remember) {
        res.cookie("recordame", usuarioLogueado, { maxAge: 1000 * 60});
        res.send('bien!');
    } else {
        res.send(':(')
    }
    // código súper, súper en proceso
};

exports.processRegister = async (req, res) => {
    const errors = validationResult(req);
    if(errors.isEmpty()) {
        let passwordHash = bcrypt.hashSync(req.body.password, Math.floor(Math.random(1) * 10));
        let usuario = await db.Users.create({
            name: req.body.name,
            surname: req.body.surname,
            email: req.body.email,
            pw_hash: passwordHash,
            image: req.file.filename
        })
    res.redirect('users/login');
     } else { 
        res.render('users/register', {errors: errors.errors})
     }
};