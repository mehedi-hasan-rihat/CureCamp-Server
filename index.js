require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = 5000;
const cors = require("cors");
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5174", "http://localhost:5173"],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  const tokenBearer = req.headers.authorization;
  if (!tokenBearer) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = tokenBearer.split(" ")[1];
  jwt.verify(token, process.env.SECRET, (error, decoded) => {
    if (error) {
      return res.status(402).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

app.post("/jwt", async (req, res) => {
  const email = req.body;
  console.log(email);
  const token = jwt.sign(email, process.env.SECRET, {
    expiresIn: "1h",
  });
  res.send({ token });
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.sqw4h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const CureCampDB = client.db("CureCamp");
    const campainCollection = CureCampDB.collection("campains");
    const reviewCollection = CureCampDB.collection("reviews");

    // For add many data in a time by POSTMAN
    app.post("/add-db", async (req, res) => {
      const data = req.body;
      const response = await reviewCollection.insertMany(data);
      console.log(response);
      res.send({ response });
    });

    // get Popular Campain
    app.get("/popular-campain", async (req, res) => {
      const campainData = await campainCollection
        .find()
        .sort({ participantCount: -1 })
        .limit(6)
        .toArray();
      res.send(campainData);
    });

    // get all camps
    app.get("/campains", async (req, res) => {
      const { search, sortBy } = req.query;
      console.log(sortBy);
      let query = {};
      if (search) {
        query = {
          $or: [
            { campName: { $regex: search, $options: "i" } }, 
            { description: { $regex: search, $options: "i" }
           },
           { date: { $regex: search, $options: "i" },
          }
          ],
        };
      }

      let sortOptions = {};
      if (sortBy === "Registerd_Member") {
        sortOptions = { participantCount: -1 };
      } else if (sortBy === "Camp_Fees") {
        sortOptions = { campFees: 1 };
      } else if (sortBy === "Camp_Name") {
        sortOptions = { campName: 1 };
      }
      const campainData = await campainCollection.find(query).sort(sortOptions).toArray();
      console.log(sortOptions);
      res.send(campainData);
    });

    // get review data
    app.get("/reviews", async (req, res) => {
      const reviewData = await reviewCollection.find().toArray();
      res.send(reviewData);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
