const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
  }
  app.use(cors(corsOptions))
  app.use(express.json());

  
const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vksh2ow.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("mediConnectionDB").collection("users");
    const medicineCollection = client.db("mediConnectionDB").collection("medicine");
    const cartCollection = client.db("mediConnectionDB").collection("carts");
    const paymentCollection = client.db("mediConnectionDB").collection("payments");
    const advertiseCollection = client.db("mediConnectionDB").collection("advertise");

     // jwt related api
     app.post('/jwt', async (req, res) => {
       const user = req.body;
       console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
      res.send({ token });
    })

      // middlewares 
      const verifyToken = (req, res, next) => {
        console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }
  
       
       const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }
       const verifySeller = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isSeller = user?.role === 'seller';
        if (!isSeller) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

     // users related api
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      });

      app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
     
        const result = await userCollection.find().toArray();
        res.send(result);
      });

      app.patch('/users', async (req, res)=>{
        
        const user = req.body;
        console.log(user);
        const query = {email: user.email}
        const updatedDoc = {
          $set:{
            role: user.role
          },
        }
        const result = await userCollection.updateOne(query, updatedDoc)
        res.send(result)
      })

      app.get('/users/seller/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let seller = false;
        if (user) {
          seller = user?.role === 'seller';
        }
        res.send({ seller });
      })
      app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      })

      // medicine related api
      app.post('/medicine', verifyToken, verifySeller, async (req, res) => {
        const medicine = req.body;
        const result = await medicineCollection.insertOne(medicine);
        res.send(result);
      });

      
    app.get('/medicines',verifyToken, async(req, res) =>{
      const result = await medicineCollection.find().toArray();
      res.send(result);
  })

  app.get('/medicines/:email', verifyToken, verifySeller, async (req, res)=>{
    const email = req.params.email;
    if (req.params.email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const query = {sellerEmail: email}
    const result = await medicineCollection.find(query).toArray();
    res.send(result)
  })

  app.get('/medicine/:id', verifyToken, async (req,res)=>{
    const id = req.params.id;
    const query= {_id : new ObjectId(id)}
    const result = await medicineCollection.findOne(query);
    res.send(result)
  })

  app.get('/medicineCategory/:category',verifyToken,  async(req, res)=>{
    const category = req.params.category;
    const filter = {category: category};
    const result = await medicineCollection.find(filter).toArray();
    res.send(result);
  })

  // ask for advertise

  app.post('/advertise', verifyToken, verifySeller, async (req, res) => {
    const medicine = req.body;
    const query = { _id: medicine._id }
        const existingMedicine = await advertiseCollection.findOne(query);
        if (existingMedicine) {
          return res.send({ message: 'medicine already exists', insertedId: null })
        }
    const result = await advertiseCollection.insertOne(medicine);
    res.send(result);
  });

  // cart related api
     app.post('/carts', async (req, res) => {
          const cartItem = req.body;
          const result = await cartCollection.insertOne(cartItem);
          res.send(result);
        });

        app.get('/carts', async(req, res)=>{
          const result = await cartCollection.find().toArray();
        res.send(result);
        })

          app.get('/carts/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (req.params.email !== req.decoded.email) {
              return res.status(403).send({ message: 'forbidden access' });
            }
            // console.log(email);
           const query = { email: email };
          const result = await cartCollection.find(query).toArray();
          res.send(result);
        });

        app.patch('/carts/:id', async (req, res)=>{
          const id = req.params.id;
          const filter = {_id: new ObjectId(id)}
          const updatedDoc ={
            $inc:{
              quantity: 1
            }
          }
          const result = await cartCollection.updateOne(filter, updatedDoc)
          res.send(result)

        })
        app.patch('/myCart/:id', verifyToken, async (req, res)=>{
          const id = req.params.id;
          const filter = {_id: new ObjectId(id)}
          const item = await cartCollection.findOne(filter);
          if (item.quantity <= 1) {
            return 
          }
          const updatedDoc ={
            $inc:{
              quantity: -1
            }
          }
          const result = await cartCollection.updateOne(filter, updatedDoc)
          res.send(result)

        })

        app.delete('/carts/:id', async (req, res) => {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) }
          const result = await cartCollection.deleteOne(query);
          res.send(result);
        })
        app.delete('/cart/:email', async (req, res) => {
          const email = req.params.email;
          // console.log(email);
          const query = { email: email }
          const result = await cartCollection.deleteMany(query);
          res.send(result);
        })

        // payment intent

        app.post('/create-payment-intent', async (req, res) => {
          const { price } = req.body;
          const amount = parseInt(price * 100);
          console.log(amount, 'amount inside the intent')
    
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
          });
    
          res.send({
            clientSecret: paymentIntent.client_secret
          })
        });

        app.post('/payments', async (req, res) => {
          const payment = req.body;
          console.log(payment);
          const paymentResult = await paymentCollection.insertOne(payment);
         
          const query = {email: payment.email}
    
          const deleteResult = await cartCollection.deleteMany(query);
    
          res.send({ paymentResult, deleteResult });
        })

        app.get('/payments/:email', verifyToken, async (req, res) => {
          const query = { email: req.params.email }
          if (req.params.email !== req.decoded.email) {
            return res.status(403).send({ message: 'forbidden access' });
          }
          const result = await paymentCollection.find(query).toArray();
          res.send(result);
        })


        // seller-stats
        app.get("/seller-stats/:email", verifyToken, verifySeller, async (req, res)=>{
          const sellerEmail = req.params.email;
         
          const result = await paymentCollection.find().toArray()

          const filteredData =  result.map(order =>({
            ...order,
            cart: order.cart.filter(item => item.sellerEmail === sellerEmail)
          })).filter(order => order.cart.length > 0);
          res.send(filteredData)
        })

        app.get("/seller-total-stats/:email",verifyToken, verifySeller, async (req, res)=>{
          const email = req.params.email;

          const calculateTotalAmount = [
            { $unwind: '$cart' },
            { $match: { 'cart.sellerEmail': email } },
            {
              $group: {
                _id: null,
                totalAmount: {
                  $sum: {
                    $multiply: [
                      '$cart.unitPrice',
                      '$cart.quantity',
                      { $subtract: [1, { $divide: ['$cart.discount', 100] }] }
                    ]
                  }
                }
              }
            }
          ];

          const pipeline1 = [
            { $unwind: '$cart' },
            { $match: { 'cart.sellerEmail': email, status: 'pending' } },
            ...calculateTotalAmount
          ];
      
          const pipeline2 = [
            { $unwind: '$cart' },
            { $match: { 'cart.sellerEmail': email, status: 'paid' } },
            ...calculateTotalAmount
          ];

          const pipeline3 = [
            { $unwind: '$cart' },
            { $match: { 'cart.sellerEmail': email } },
            ...calculateTotalAmount
          ];

          const pipeline1Result = await paymentCollection.aggregate(pipeline1).toArray();
          const pipeline2Result = await paymentCollection.aggregate(pipeline2).toArray();
          const pipeline3Result = await paymentCollection.aggregate(pipeline3).toArray();

          const pendingAmount = pipeline1Result.length > 0 ? pipeline1Result[0].totalAmount : 0;
          const paidAmount = pipeline2Result.length > 0 ? pipeline2Result[0].totalAmount : 0;
          const totalAmount = pipeline3Result.length > 0 ? pipeline3Result[0].totalAmount : 0;
          res.send({totalAmount, paidAmount, pendingAmount})


        })

        app.get("/order-stats", async (req, res)=>{
          const result = await paymentCollection.aggregate([
                    {
                      $unwind: '$medicineIds'
                    },
                    {
                      $addFields: {
                        medicineIds: { $toObjectId: "$medicineIds"},
                      }
                    },
                    {
                      $lookup: {
                        from: 'medicine',
                        localField: 'medicineIds',
                        foreignField: '_id',
                        as: 'medicines'
                      }
                    },
                    {
                      $unwind: '$medicines'
                    },
                    
                   
          ]).toArray()
          res.send(result)
        })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



  app.get('/', (req, res) => {
    res.send('mediConnect server is running')
})

app.listen(port, () => {
    console.log(`MediConnect server on port ${port}`);
})