const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const port = process.env.PORT || 6001;
const { MongoClient, ServerApiVersion } = require('mongodb');

// middlewire
const corsOptions = {
  origin: ['http://localhost:5173',
    'http://localhost:5174',
    'https://product-list-935c1.web.app',
    'https://product-list-935c1.firebaseapp.com'],
  credentials: true,
  optionSuccessStatus: 2000
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// verify token middlewire
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorize access" })
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err)
        return res.status(401).send({ message: "unauthorize access" })
      }
      req.user = decoded
      next()
    })
  }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.psgygfs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// cookie options
const cookieOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const dataBase = client.db('productList');
    const productCollection = dataBase.collection('products')

    // jwt function starts
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '100d'
      })

      res.cookie("token", token, cookieOption)
        .send({ success: true })
    })

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { ...cookieOption, maxAge: 0 })
        .send({ success: true })
    })
    // jwt function ends

    app.get('/products', verifyToken, async (req, res) => {
      // for pagination
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      // for sorting and filtering
      const sortPrice = req.query.sortPrice;
      const sortDate = req.query.sortDate;
      const filterBrand = req.query.filterBrand;
      const filterCategory = req.query.filterCategory;
      const minPrice = parseInt(req.query.minPrice);
      const maxPrice = parseInt(req.query.maxPrice);
      const searchQuery = req.query.search;
      let query = {
        productName: { $regex: searchQuery, $options: 'i' }
      };
      if (filterBrand) {
        query = { ...query, brandName: filterBrand }
      }

      if (filterCategory) {
        query = { ...query, category: filterCategory }
      }

      if (minPrice && maxPrice) {
        query = { ...query, price: { $gte: minPrice, $lte: maxPrice } };
      }

      let options = {};
      if (sortPrice) {
        options = { sort: { price: sortPrice === "asc" ? 1 : -1 } }
      }

      let options1 = {};
      if (sortDate) {
        options1 = { sort: { creationDateTime: sortDate === "asc" ? 1 : -1 } }
      }

      const finalOptions = { ...options, ...options1 };

      const result = await productCollection
        .find(query, finalOptions)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    })

    // save product in database
    app.post('/add-product', verifyToken, async(req, res) => {
      const productData = req.body;
      const result = await productCollection.insertOne(productData);
      res.send(result);
    })

    // for data count
    app.get('/products-count', verifyToken, async (req, res) => {
      const filterBrand = req.query.filterBrand;
      const searchQuery = req.query.search;
      const minPrice = parseInt(req.query.minPrice);
      const maxPrice = parseInt(req.query.maxPrice);
      const filterCategory = req.query.filterCategory;

      let query = {
        productName: { $regex: searchQuery, $options: 'i' }
      };

      if (minPrice && maxPrice) {
        query = { ...query, price: { $gte: minPrice, $lte: maxPrice } };
      }

      if (filterBrand) query = { brandName: filterBrand }

      if (filterCategory) {
        query = { ...query, category: filterCategory }
      }
      const count = await productCollection.countDocuments(query);
      res.send({ count });
    })

    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running');
})

app.listen(port, () => {
  console.log(`server is running on port ${port}`)
})