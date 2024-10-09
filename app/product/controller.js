const path = require('path');
const fs = require('fs');
const Product = require('./model');
const config = require('../config');
const Category = require('../category/model');
const Tags = require('../tag/model');
// const multer = require('multer');
// const config = require('../config');
// const Product = require('../')



const store = async (req, res, next) => {
    try{
        let payload = req.body;

        //relasi category
        if(payload.category){
            let category = await Category.findOne({name: {$regex: payload.category, $options: 'i'}});
            if(category){
                payload= {...payload, category: category._id};
            }else{
                delete payload.category;
            }
        }

        // Relasi tags
        if (payload.tags && payload.tags.length > 0) {
            let tags = await Tags.find({ name: { $in: payload.tags } });
            if (tags.length > 0) {
                payload = { ...payload, tags: tags.map(tags => tags._id) };
            } else {
                delete payload.tags;
            }
        }
        //jika yang disimpan berbentuk array, model.js juga harus berbentuk array


        if(req.file){
            let tmp_path = req.file.path;
            let originalExt = req.file.originalname.split('.')[req.file.originalname.split('.').length - 1];
            let filename = req.file.filename + '.' + originalExt;
            let target_path = path.resolve(config.rootpath, `public/images/products/${filename}`);

            const src = fs.createReadStream(tmp_path);
            const dest = fs.createWriteStream(target_path);
            src.pipe(dest);

            src.on('end', async () => {
                try{
                    let product = new Product({...payload, image_url: filename})
                    await product.save();
                    return res.json(product);

                }catch(err){
                    fs.unlinkSync(target_path);
                    if(err && err.name === 'ValidationError'){
                        return res.json({
                            error: 1,
                            message: err.message,
                            fields: err.errors
                        })
                    }

                    next(err);
                }
            });

            src.on('error', async (err) => {
                next(err);
            });
        }else{
            let product = new Product(payload)
            await product.save();
            return res.json(product);
        }
    }catch(err){
        if(err && err.name === 'ValidationError'){
            return res.json({
                error: 1,
                message: err.message,
                fields: err.errors
            })
        }

        next(err);
    }
}

const index = async (req, res, next) => {
    try {
        let{skip = 0, limit=10, q= '', category = '', tags = []} = req.query;
        
        let criteria ={};

        if (q.length) {
            criteria = {
                ...criteria,
                name: { $regex: `${q}`, $options: 'i' } 
            }
        }
        if(category.length){
            let categoryResult = await Category.findOne({name: {$regex: `${category}`, $options: 'i'}});
            
            if(categoryResult){
                criteria= {...criteria, category: categoryResult._id};
            }
        }

        if (tags.length) {
            let tagsResult = await Tags.find({name: {$in: tags }});
            if(tagsResult.length){
                criteria = { ...criteria, tags: {$in: tagsResult.map(tags => tags._id)}};
            }
            
      
        }
        
        let count = await Product.find().countDocuments();
        const products = await Product.find(criteria)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('category')
        .populate('tags');
        return res.json({
            data: products,
            count
        });
    } catch (error) {
        next(error);
    }
}

const indexbyId = async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await Product.findById(productId)
        .populate('category')
        .populate('tags');;
        if (product) {
            return res.json(product);
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        res.status(500).send(error);
    }
}


const update = async (req, res, next) => {
    try {
        let payload = req.body;
        let { id } = req.params;

        // Relasi Category
        if (payload.category) {
            let category = await Category.findOne({ name: { $regex: payload.category, $options: 'i' } });
            if (category) {
                payload = { ...payload, category: category._id };
            } else {
                delete payload.category;
            }
        }

        // Relasi tags
        if (payload.tags && payload.tags.length > 0) {
            let tags = await Tags.find({ name: { $in: payload.tags } });
            if (tags.length > 0) {
                payload = { ...payload, tags: tags.map(tags => tags._id) };
            } else {
                delete payload.tags;
            }
        }
        
        // Jika gambar ada akan di upload
        if (req.file) {
            let tmp_path = req.file.path;
            let originalExt = req.file.originalname.split('.')[req.file.originalname.split('.').length - 1];
            let filename = req.file.filename + '.' + originalExt;
            let target_path = path.resolve(config.rootpath, `public/images/products/${filename}`);

            const src = fs.createReadStream(tmp_path);
            const dest = fs.createWriteStream(target_path);
            src.pipe(dest);

            src.on('end', async () => {
                try {
                    let imgProduct = await Product.findById(id);
                    let currentImg = `${config.rootpath}/public/images/products/${imgProduct.image_url}`;

                    // Hapus Gambar jka ada
                    if (fs.existsSync(currentImg)) {
                        fs.unlinkSync(currentImg);
                    }

                    // Update gambar baru product
                    payload.image_url = filename;
                    let product = await Product.findByIdAndUpdate(id, payload, {
                        new: true,
                        runValidators: true
                    });
                    return res.json(product);

                } catch (err) {
                    fs.unlinkSync(target_path); // Hapus file yang di upload jika error
                    if (err && err.name === 'ValidationError') {
                        return res.status(400).json({
                            error: 1,
                            message: err.message,
                            fields: err.errors
                        });
                    }
                    next(err); 
                }
            });

            src.on('error', (err) => {
                next(err); 
            });

        } else {
            // jika tdak ada gambar langsung update product
            let product = await Product.findByIdAndUpdate(id, payload, {
                new: true,
                runValidators: true
            });
            return res.json(product);
        }

    } catch (err) {
        if (err && err.name === 'ValidationError') {
            return res.status(400).json({
                error: 1,
                message: err.message,
                fields: err.errors
            });
        }
        next(err);
    }
};

const destroy = async (req, res) => {
    const { id } = req.params;
    try {
        let imgproduct = await Product.findById(id);
        let currentImg = `${config.rootpath}/public/images/products/${imgproduct.image_url}`;
        
        if (fs.existsSync(currentImg)) {
            fs.unlinkSync(currentImg);
        }
        
        const product = await Product.findByIdAndDelete(id);
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


module.exports = {
    index,
    indexbyId,
    store,
    update,
    destroy
}