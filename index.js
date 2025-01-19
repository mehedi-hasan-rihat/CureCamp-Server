require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = 5000;
const cors = require("cors");
app.use(express.json());
app.use(cookieParser());
const stripe = require("stripe")(process.env.stripe_key);

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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const participantCollection = CureCampDB.collection("participants");

    // For add many data in a time by POSTMAN
    app.post("/add-db", async (req, res) => {
      const data = req.body;
      const response = await reviewCollection.insertMany(data);
      res.send({ response });
    });

    // get specific camp
    app.get("/camp-details/:id", async (req, res) => {
      const { id } = req.params;

      const campainData = await campainCollection.findOne({
        _id: new ObjectId(id),
      });
      console.log(campainData);
      res.send(campainData);
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

    // add a Campain
    app.post("/add-camp", async (req, res) => {
      const campainData = req.body;
      console.log(campainData);
      const response = await campainCollection.insertOne(campainData);
      res.send(response);
    });

    // get all camps
    app.get("/campains", async (req, res) => {
      const { search, sortBy } = req.query;
      console.log(search, sortBy, 4);
      let query = {};
      if (search) {
        query = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { date: { $regex: search, $options: "i" } },
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
      const campainData = await campainCollection
        .find(query)
        .sort(sortOptions)
        .toArray();
      res.send(campainData);
    });

    // update a campain
    app.patch("/update-camp/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      console.log(data);
      const updateDoc = { $set: data };

      const response = await campainCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(response);
    });

    // delete a camp
    app.delete("/delete-camp/:id", async (req, res) => {
      const { id } = req.params;
      const response = await campainCollection.deleteOne({
        _id: new ObjectId(id),
      });
      console.log(response);
      res.send(response);
    });

    // get review data
    app.get("/reviews", async (req, res) => {
      const reviewData = await reviewCollection.find().toArray();
      res.send(reviewData);
    });

    // Register a campain
    app.post("/register-campain", async (req, res) => {
      const participant = req.body;
      const registerData = {
        ...participant,
        "payment-status": "unpaid",
        "confirmation-status": "Pending",
      };
      console.log(registerData);
      const response = await participantCollection.insertOne(registerData);
      await campainCollection.updateOne(
        { _id: new ObjectId(participant.campainId) },
        { $inc: { participantCount: 1 } }
      );
      res.send(response);
    });

    // delete a registered camp
    app.delete("/delete-reg-camp/:id", async (req, res) => {
      const { id } = req.params;
      const response = await participantCollection.deleteOne({
        _id: new ObjectId(id),
      });
      console.log(response);
      res.send(response);
    });

    //for Manage Registered Camps
    app.get("/manage-registered-camps", async (req, res) => {
      const result = await participantCollection
        .aggregate([
          {
            $addFields: {
              campainId: {
                $toObjectId: "$campainId",
              },
            },
          },
          {
            $lookup: {
              from: "campains",
              localField: "campainId",
              foreignField: "_id",
              as: "camps",
            },
          },
          {
            $unwind: "$camps",
          },
          {
            $addFields: {
              campName: "$camps.campName",
              campFees: "$camps.campFees",
            },
          },
          {
            $project: {
              participantName: 1,
              "payment-status": 1,
              "confirmation-status": 1,
              campName: 1,
              campFees: 1,
              campainId : 1
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // get registration camp by email
    app.get("/analytics-registered-camps/:email", async (req, res) => {
      const { email } = req.params;
      const query = { participantEmail: email };
      const result = await participantCollection
        .aggregate([
          {
            $match: query,
          },
          {
            $addFields: {
              campainId: {
                $toObjectId: "$campainId",
              },
            },
          },
          {
            $lookup: {
              from: "campains",
              localField: "campainId",
              foreignField: "_id",
              as: "camps",
            },
          },
          {
            $unwind: "$camps",
          },
          {
            $addFields: {
              campName: "$camps.campName",
              campFees: "$camps.campFees",
              participantCount: "$camps.participantCount",
              campDate: "$camps.date",
            },
          },
          {
            $project: {
              participantName: 1,
              "payment-status": 1,
              "confirmation-status": 1,
              campName: 1,
              campFees: 1,
              participantCount: 1,
              campDate: 1,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    app.patch("/update-confirmation-status/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body.e;
      console.log(data);
      const updateDoc = {
        $set: {
          "confirmation-status": data,
        },
      };

      const response = await participantCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      console.log(data, updateDoc);
      res.send(response);
    });

    app.post("/payment-intent", async (req, res) => {
      const { campId } = req.body;
      const camp = await campainCollection.findOne({
        _id: new ObjectId(campId),
      });
      if (!camp) return res.status(400).send({ message: "Campain Not Found" });
      const totalPrice = camp?.campFees * 100;
      const {client_secret} = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
      });
    
      res.send({ clientSecret : client_secret });
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
