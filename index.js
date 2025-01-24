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
    origin: ["http://localhost:5174", "http://localhost:5173","https://curecamp.netlify.app"],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  const tokenBearer = req.headers.authorization;
  if (!tokenBearer) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = tokenBearer.split(" ")[1];
  // console.log(token);
  jwt.verify(token, process.env.SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

app.post("/jwt", async (req, res) => {
  const email = req.body;

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
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const CureCampDB = client.db("CureCamp");
    const campainCollection = CureCampDB.collection("campains");
    const reviewCollection = CureCampDB.collection("reviews");
    const participantCollection = CureCampDB.collection("participants");
    const paymentCollection = CureCampDB.collection("payments");
    const userCollection = CureCampDB.collection("users");

    // For add many data in a time by POSTMAN
    app.post("/add-db", async (req, res) => {
      const data = req.body;
      const response = await reviewCollection.insertMany(data);
      res.send({ response });
    });

    // save Users
    app.post("/users" , async (req, res) => {
      const data = req.body;

      const isExist = await userCollection.findOne({email:data.email})
     
      if(isExist) {
        res.send({message : "user Exist"})
    return
      }
   
      const response = await userCollection.insertOne({
        ...data,
        role: "user",
      });
      res.send(response);
    });

    // get user
    app.get("/users/:email", verifyToken , async (req, res) => {
      const { email } = req.params;
      const response = await userCollection.findOne({ email });
      res.send(response);
    });

    // update userData
    app.put("/users/:email", verifyToken , async (req, res) => {
      const { email } = req.params;
      const data = req.body;
      const response = await userCollection.updateOne(
        { email },
        {
          $set: {
            name: data.name,
            location: data.location,
            number: data.number,
          },
        }
      );
      res.send(response);
    });

    // get specific camp
    app.get("/camp-details/:id", async (req, res) => {
      const { id } = req.params;

      const campainData = await campainCollection.findOne({
        _id: new ObjectId(id),
      });
    
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
    app.post("/add-camp",verifyToken , async (req, res) => {
      const campainData = req.body;
    
      const response = await campainCollection.insertOne(campainData);
      res.send(response);
    });

    // get all camps
    app.get("/campains", async (req, res) => {
      const { search, sortBy } = req.query;
    
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

    app.get("/campains/:page", async (req, res) => {
      const { page } = req.params;
      const { search } = req.query;
      
      let query = {};
      if (search) {
        query = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { date: { $regex: search, $options: "i" } },
            { time: { $regex: search, $options: "i" } },
            { "Healthcare Professional": { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ],
        };
      }
      const campainData = await campainCollection
        .find(query)
        .skip((page - 1) * 10)
        .limit(10)
        .toArray();
     
      const totalData = await campainCollection.countDocuments(query);
      res.send({ result: campainData, totalData });
    });

    // update a campain
    app.patch("/update-camp/:id",verifyToken , async (req, res) => {
      const { id } = req.params;
      const data = req.body;
 
      const updateDoc = { $set: data };

      const response = await campainCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(response);
    });

    // delete a camp
    app.delete("/delete-camp/:id",verifyToken , async (req, res) => {
      const { id } = req.params;
      const response = await campainCollection.deleteOne({
        _id: new ObjectId(id),
      });
    
      res.send(response);
    });

    // get review data
    app.get("/reviews", async (req, res) => {
      const reviewRes = await reviewCollection.find().toArray();
      res.send(reviewRes);
    });

    // add review data
    app.post("/reviews",verifyToken , async (req, res) => {
      const data = req.body;
 
      const reviewRes = await reviewCollection.insertOne(data);
      res.send(reviewRes);
    });

    // Register a campain
    app.post("/register-campain",verifyToken , async (req, res) => {
      const participant = req.body;
      const registerData = {
        ...participant,
        "payment-status": "unpaid",
        "confirmation-status": "Pending",
      };
      
      const response = await participantCollection.insertOne(registerData);
      await campainCollection.updateOne(
        { _id: new ObjectId(participant.campainId) },
        { $inc: { participantCount: 1 } }
      );
      res.send(response);
    });

    // delete a registered camp
    app.delete("/delete-reg-camp/:id", verifyToken ,async (req, res) => {
      const { id } = req.params;
      const response = await participantCollection.deleteOne({
        _id: new ObjectId(id),
      });
      
      res.send(response);
    });

    //for Manage Registered Camps
    app.get("/manage-registered-camps",verifyToken , async (req, res) => {
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
              campainId: 1,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    app.get("/manage-registered-camps-pagination/:page",verifyToken , async (req, res) => {
      const { page } = req.params;
      const { search } = req.query;
    
      let query = {};
      if (search) {
        query = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { campFees: { $regex: search, $options: "i" } },
            { participantName: { $regex: search, $options: "i" } },
            { "confirmation-status": { $regex: search, $options: "i" } },
            { "payment-status": { $regex: search, $options: "i" } },
          ],
        };
      }

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
              campainId: 1,
            },
          },
          {
            $match: query,
          },
        ])
        .skip((page - 1) * 10)
        .limit(10)
        .toArray();

      const totalData = await participantCollection.countDocuments(query);
      res.send({ result, totalData });
    });

    // get registration camp by email
    app.get("/registered-camps/:email",verifyToken , async (req, res) => {
      const { email } = req.params;
      const { page } = req.query;
      const query = { participantEmail: email };
      const { search } = req.query;
     
      let filter = {};
      if (search) {
        filter = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { campFees: { $eq: [{$toInt : search}] } },
            { "confirmation-status": { $regex: search, $options: "i" } },
            { "payment-status": { $regex: search, $options: "i" } },
          ],
        };
      }
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
              campId: "$camps._id",
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
              campId: 1,
            },
          },
          {
            $match : filter
          }
        ])
        .skip((page - 1) * 10)
        .limit(10)
        .toArray();
      const totalData = await participantCollection.countDocuments(query);
      res.send({ result, totalData });
    });

    app.get("/analytics-registered-camps/:email",verifyToken , async (req, res) => {
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
              campId: "$camps._id",
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
              campId: 1,
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // update confirmation status
    app.patch("/update-confirmation-status/:id",verifyToken , async (req, res) => {
      const { id } = req.params;
      const data = req.body.e;
      
      const updateDoc = {
        $set: {
          "confirmation-status": data,
        },
      };

      const response = await participantCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.send(response);
    });

    // payment intant
    app.post("/payment-intent", verifyToken ,async (req, res) => {
      const { campId } = req.body;
      
      const camp = await campainCollection.findOne({
        _id: new ObjectId(campId),
      });
      if (!camp) return res.status(400).send({ message: "Campain Not Found" });
      const totalPrice = camp?.campFees * 100;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
      });

      res.send({ clientSecret: client_secret });
    });

    // save payments
    app.post("/payments",verifyToken , async (req, res) => {
      const paymentData = req.body;
    
      const response = await paymentCollection.insertOne({
        ...paymentData,
        paymentOn: new Date(),
      });
      const updRes = await participantCollection.updateOne(
        { _id: new ObjectId(paymentData.participantId) },
        { $set: { "payment-status": "paid" } }
      );
     
      res.send(response);
    });

    // get payment history
    app.get("/payments/:email",verifyToken , async (req, res) => {
      const { email } = req.params;
      const { page } = req.query;
      const { search } = req.query;
 
      let filter = {};
      if (search) {
        filter = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { campFees: { $regex: search, $options: "i" } },
            { "confirmation-status": { $regex: search, $options: "i" } },
            { "payment-status": { $regex: search, $options: "i" } },
          ],
        };
      }
      const query = { participantEmail: email };
      const result = await paymentCollection
        .aggregate([
          {
            $match: query,
          },
          {
            $addFields: {
              participantId: {
                $toObjectId: "$participantId",
              },
            },
          },
          {
            $lookup: {
              from: "participants",
              localField: "participantId",
              foreignField: "_id",
              as: "participant",
            },
          },
          {
            $unwind: "$participant",
          },
          {
            $addFields: {
              campId: {
                $toObjectId: "$participant.campainId",
              },
              "confirmation-status": "$participant.confirmation-status",
              "payment-status": "$participant.payment-status",
            },
          },
          {
            $project: {
              campId: 1,
              "confirmation-status": 1,
              "payment-status": 1,
              tnxId: 1,
            },
          },
          {
            $lookup: {
              from: "campains",
              localField: "campId",
              foreignField: "_id",
              as: "camp",
            },
          },
          {
            $unwind: "$camp",
          },
          {
            $addFields: {
              campName: "$camp.campName",
              campFees: "$camp.campFees",
            },
          },
          {
            $project: {
              camp: 0,
              campId: 0,
            },
          }, {
            $match : filter
          }
        ])
        .skip((page - 1) * 10)
        .limit(10)
        .toArray();
      const totalData = await paymentCollection.countDocuments(query);
      res.send({ result, totalData });
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
