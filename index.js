const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server Running...");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.c8viahs.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("snapSchoolDB");
    const users = database.collection("users");
    const classes = database.collection("classes");
    const selectedClasses = database.collection("myClasses");
    const paymentCollection = database.collection("payment");

    // jwt route
    app.post("/jwt", async (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "35d",
      });
      res.send({ token });
    });

    //middleware function for verifying token
    const verifyJWT = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
      }
      // bearer token
      const token = authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // Create User By Role
    app.post("/user", async (req, res) => {
      const body = req.body;
      const result = await users.insertOne(body);
      res.send(result);
    });

    // get a Admin user
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await users.findOne(filter);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //get a Instructor user
    app.get("/user/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await users.findOne(filter);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    //get a Student user
    app.get("/user/student/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await users.findOne(filter);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    // get all users
    app.get("/allUsers", verifyJWT, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    // set user role
    app.patch("/setUserRole/:email", async (req, res) => {
      const email = req.params.email;
      const role = req.body.role;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await users.updateOne(filter, updateDoc);
      res.send(result);
    });

    // set classes status - approve/deny
    app.patch("/classesStatus/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const status = req.query.status;
      const query = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: status,
        },
      };
      const result = classes.updateOne(query, updateStatus);
      res.send(result);
    });

    // send  feedback from admin to instructor
    app.post("/admin/feedback", verifyJWT, async (req, res) => {
      const feedback = req.body.feedback;
      const classId = req.body.classId;
      const filter = { _id: new ObjectId(classId) };
      const update = { $set: { feedback: feedback } };
      const result = await classes.updateOne(filter, update);
      res.send(result);
    });

    // All Instructor routes are here...
    // create add classes for students
    app.post("/addClass", async (req, res) => {
      const classesData = req.body;
      const result = await classes.insertOne(classesData);
      res.send(result);
    });

    //get all my classes data
    app.get("/allClasses", async (req, res) => {
      const result = await classes.find().toArray();
      res.send(result);
    });

    app.get("/showClasses/:email", async (req, res) => {
      const email = req.params.email
      const filter = { instructorEmail: email }
      const result = await classes.find(filter).toArray();
      res.send(result);
    });

    //get all my classes data
    app.get("/classInfo/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const result = await classes.find(filter).toArray();
      res.send(result);
    });

    //get all instructor data
    app.get("/allInstructors", async (req, res) => {
      const filter = { role: "instructor" };
      const result = await users.find(filter).toArray();
      res.send(result);
    });

    //get classes data when admin approved
    app.get("/approveClasses", async (req, res) => {
      const filter = { status: "approve" };
      const result = await classes.find(filter).toArray();
      res.send(result);
    });

    // All Student routes here..
    // set class by students
    app.post("/myClasses", async (req, res) => {
      const body = req.body;
      const result = await selectedClasses.insertOne(body);
      res.send(result);
    });

    // get all class data by students email
    app.get("/myClasses/:email", async (req, res) => {
      const stdEmail = req.params.email;
      const filter = { studentEmail: stdEmail };
      const result = await selectedClasses.find(filter).toArray();
      res.send(result);
    });

    // get payment history by students email
    app.get("/payment/:email", async (req, res) => {
      const stdEmail = req.params.email;
      const filter = { email: stdEmail };
      const result = await paymentCollection.find(filter).toArray();
      res.send(result);
    });

    //delete selected class
    app.delete("/myClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClasses.deleteOne(query);
      res.send(result);
    });

    // payment related api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const classId = req.body.classId;
      const currentSeats = req.body.currentSeats;
      const currentEnrolledStudent = req.body.currentEnrolledStudent;
      console.log(payment);
      filter = { _id: new ObjectId(classId) }
      const updateDoc = {
        $set: {
          availableSeats: currentSeats,
          totalEnrolled: currentEnrolledStudent
        },
      }
      const updateResult = await classes.updateOne(filter, updateDoc)
      const insertedResult = await paymentCollection.insertOne(payment);
      res.send({ updateResult, insertedResult });
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Snap School server running on port: ${port}`);
});
