const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server Running...");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
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

    // get all users
    app.get("/allUsers", async (req, res) => {
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
