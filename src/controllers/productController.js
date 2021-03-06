const fs = require('fs');
const { validationResult } = require('express-validator');
let db = require("../database/models")
const toThousand = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

exports.obtenerProductos = async (req, res) => {
    try {
        let id = req.params.id;
        let search = await db.Productos.findByPk(id, {
            include: ['categoria', 'condicion', 'color', 'talle', 'users']
        })
        let title = search.nombre
        let confirmar = search.users[0].id;
        return res.render('products/listado', {productoEspecifico: search, title, confirmar});
    } catch(error) {
        console.log(error);
    }
};

exports.listarProductos = async (req, res) => {
    try {
        const productos = await db.Productos.findAll({
            include:['categoria', 'condicion', 'color', 'talle', 'users']
        })
        return res.render('products/list', {homeProductos: productos});
    } catch(error) {
        console.log(error);
    }
}

exports.listarProductosCategoria = async (req, res) => {
    // Obtenemos el ID de la categoria
    let categoria;
    switch (req.params.categoria) {
        case 'unisex':
            categoria = 1
            break;
        case 'hombre':
            categoria = 2
            break;
        case 'mujer':
            categoria = 3
            break;
        default:
            return res.redirect('/productos');
    }
    
    try {
        // Ejecutamos la query.
        const productos = await db.Productos.findAll({
            include:['categoria', 'condicion', 'color', 'talle', 'users'],
            where: {
                categoria_id: categoria
            }
        })

        // Si no hay resultados, lo mando a la lista entera de productos.
        if (!productos) {
            return res.redirect('/productos')     
        } else {
            return res.render('products/list', { homeProductos: productos });
        }
    } catch(error) {
        console.log(error);
    }
}


exports.crearProducto = (req, res) => {
    if(req.session.usuario) {
        return res.render('products/create');
    } else {
        return res.redirect('/user/login')
    }
};

exports.generarProducto = async (req, res) => {
    // Si no inició sesion...
    if(!req.session.usuario) {
        return res.redirect('/user/login')
    }

    // Chequeamos que los valores que envió en el form sean válidos
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        res.render('products/create', {errors: errors.errors});
    } else {
        try {
            const { nombre, precio, cantidad, genero, condicion, color, talle } = req.body;
            const newProducto = await db.Productos.create({
                nombre: nombre,
                precio: precio,
                cantidad: cantidad,
                categoria_id: genero,
                condicion_id: condicion,
                color_id: color,
                talle_id: talle,
                image: req.file.filename
            })
    
            // Vinculamos el ID del producto con el del usuario en la tabla `product_user`
            await newProducto.addUsers(req.session.usuario.id);
    
            // Lo devuelvo a la lista de productos.
            return res.redirect('/productos');
        } catch(error) {
            console.log(error);
        }  
    }
};
    
exports.eliminarProducto = async (req, res) => {
    // Si no inició sesion...
    if(!req.session.usuario) {
        return res.redirect('/user/login')
    }

    // Buscamos el producto existente en la DB
    const productoEncontrado = await db.Productos.findByPk(req.params.id)

    // Bucamos el path donde se encuentra la imagen
    const path = './public/images/productos/' + productoEncontrado.image;

    try {
        // Borramos el registro en la DB
        const producto = await db.Productos.findByPk(req.params.id, { include: ['users'] })

        // Verifico que el producto pertenezca al usuario logueado.
        if (producto.users[0].id === req.session.usuario.id) {
            // Borramos los registros en la tabla `product_user`
            await producto.removeUsers(req.session.usuario.id);

            // Borramos los registros en la tabla `product`
            await producto.destroy();

            // La borramos usando la path que averiguamos previamente
            fs.unlink(path, (err) => {
                if(err) {
                    console.error(err);
                    return;
                }
            });
        }

        // Lo devuelvo a la lista de productos.
        return res.redirect('/productos');
    } catch (error) {
        console.error(error)
        return;
    }
};

exports.editarProducto = async (req, res) => {
    // Si no inició sesion...
    if(!req.session.usuario) {
        return res.redirect('/user/login')
    }
    const id = req.params.id;
    
    const producto = await db.Productos.findByPk(id, {
        include: ['categoria', 'condicion', 'color', 'talle', 'users'],
        where: {
            '$users.id$': req.session.usuario.id
        }
    })
    let check = producto.users[0].id;
    if(!req.session.usuario) {
        return res.redirect('/user/login')
    }
    if(check != req.session.usuario.id) {
        res.send('Este producto no te pertenece!')
    }
    
    return await res.render('products/edit', {productoEditar: producto, toThousand});    
    
};

exports.modificarProducto = async (req, res) => {
    // Si no inició sesion...
    if(!req.session.usuario) {
        return res.redirect('/user/login')
    }
    
    // Chequeamos que los valores que envió en el form sean válidos
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const id = req.params.id;
        const producto = await db.Productos.findByPk(id, {
            include: ['categoria', 'condicion', 'color', 'talle', 'users'],
            where: {
                '$users.id$': req.session.usuario.id
            }
        })
        let check = producto.users[0].id;
        if(!req.session.usuario) {
            return res.redirect('/user/login')
        }
        if(check != req.session.usuario.id) {
            res.send('Este producto no te pertenece!')
        }
        
        return await res.render('products/edit', {productoEditar: producto, errors: errors.errors[0].msg}); 
    }
    
    // Busco la info. del producto
    const id = req.params.id;
    const productoCambiado = await db.Productos.findByPk(id, {
        include: ['categoria', 'condicion', 'color', 'talle', 'users']
    });

    // Guardamos el nombre del archivo anterior, para borrar la imagen que tenia el producto anteriormente.
    const anteriorImagen = productoCambiado.image;

    // Si el usuario subió una imagen, significa que quiere cambiarla...
    let nuevaImagen;
    if (typeof req.file !== 'undefined') {
        nuevaImagen = req.file.filename;
    } else {
        // Llegado a este punto, el usuario NO subió una imagen. Por ende, dejo la que estaba antes.
        nuevaImagen = productoCambiado.image;
    }
    
    // Verifico que el producto pertenezca al usuario logueado.
    if (productoCambiado.users[0].id === req.session.usuario.id) {
        await productoCambiado.update({
            nombre: req.body.nombre,
            precio: req.body.precio,
            cantidad: req.body.cantidad,
            categoria_id: req.body.genero,
            condicion_id: req.body.condicion,
            color_id: req.body.color,
            talle_id: req.body.talle,
            image: nuevaImagen
        }).then(() => {
            if (anteriorImagen !== nuevaImagen) {
                // Borramos la foto del producto que tenia antes.
                fs.unlink('./public/images/productos/' + anteriorImagen, (err) => {
                    if(err) {
                        console.error(err);
                        return;
                    }
                });
            }
        });
    }
    
    // Lo devuelvo a la lista de productos.
    return res.redirect('/productos');
};