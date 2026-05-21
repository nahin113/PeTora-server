const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("PeTora Server is Running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI;

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
    // comment this line for deploy
    await client.connect();

    const db = client.db("petora");
    const petsCollection = db.collection("pets");
    const adoptionCollection = db.collection("adoptionRequests");

    app.post("/petsData", async (req, res) => {
      const petData = req.body;
      console.log(petData);
      const result = await petsCollection.insertOne(petData);
      res.json(result);
    });

    app.get("/petsData", async (req, res) => {
      const result = await petsCollection.find().toArray();
      res.json(result);
    });

    app.get("/myPets/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const query = { ownerEmail: email };

        const result = await petsCollection.find(query).toArray();

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching user pets:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch listings for this user" });
      }
    });

    app.delete("/petsData/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await petsCollection.deleteOne(query);

        res.status(200).json(result);
      } catch (error) {
        console.error("Error deleting pet document:", error);
        res.status(500).json({
          acknowledged: false,
          error: "Failed to delete the listing",
        });
      }
    });

    app.get("/petsData/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await petsCollection.findOne(query);

        if (!result) {
          return res.status(404).json({ error: "Pet not found" });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching pet details:", error);
        res.status(500).json({ error: "server error" });
      }
    });

app.post("/adoptionRequests", async (req, res) => {
  try {
    const requestData = req.body;

    const petRecord = await petsCollection.findOne({
      _id: new ObjectId(requestData.petId),
    });
    if (!petRecord) {
      return res.status(404).json({ error: "Target pet listing not found" });
    }
    if (petRecord.ownerEmail === requestData.requesterEmail) {
      return res.status(403).json({
        acknowledged: false,
        error:
          "Action denied. You cannot submit an adoption request for your own listing.",
      });
    }


    const existingRequest = await adoptionCollection.findOne({
      petId: requestData.petId,
      requesterEmail: requestData.requesterEmail,
    });

    if (existingRequest) {

      return res.status(409).json({
        acknowledged: false,
        isDuplicate: true, 
        message:
          "You have already submitted an adoption request for this companion.",
      });
    }

  
    const result = await adoptionCollection.insertOne(requestData);

    if (result.acknowledged) {
      await petsCollection.updateOne(
        { _id: new ObjectId(requestData.petId) },
        { $inc: { requestsCount: 1 } }
      );
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Backend request security error:", error);
    res
      .status(500)
      .json({ acknowledged: false, error: "Internal processing failure" });
  }
});


    app.get("/myRequests", async (req, res) => {
      try {
        const requesterEmail = req.query.email;
        if (!requesterEmail) {
          return res
            .status(400)
            .json({ error: "Missing identity query parameter" });
        }

    
        const query = { requesterEmail: requesterEmail };
        const results = await adoptionCollection.find(query).toArray();

        res.status(200).json(results);
      } catch (error) {
        console.error("Error", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    // comment this line for deployment
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
