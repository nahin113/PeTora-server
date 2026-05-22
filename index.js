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

    // app.delete("/petsData/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const query = { _id: new ObjectId(id) };

    //     const result = await petsCollection.deleteOne(query);

    //     res.status(200).json(result);
    //   } catch (error) {
    //     console.error("Error deleting pet document:", error);
    //     res.status(500).json({
    //       acknowledged: false,
    //       error: "Failed to delete the listing",
    //     });
    //   }
    // });

    app.delete("/petsData/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await petsCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          await adoptionCollection.updateMany(
            { petId: id },
            { $set: { status: "Removed" } }
          );
        }

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
          return res
            .status(404)
            .json({ error: "Target pet listing not found" });
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

    app.get("/petsData", async (req, res) => {
      try {
        const { search, species } = req.query;
        let query = {};

        if (search) {
          query.name = { $regex: search, $options: "i" };
        }

        if (species && species !== "all") {
          const speciesList = species.split(",");
          query.species = {
            $in: speciesList.map((s) => new RegExp(`^${s}$`, "i")),
          };
        }

        const petsCollection = database.collection("pets");
        const petsData = await petsCollection
          .find(query)
          .sort(sortCriteria)
          .toArray();

        res.status(200).json(petsData);
      } catch (error) {
        console.error("Failed to query pet profiles from database:", error);
        res
          .status(500)
          .json({ error: "Internal database query exception error" });
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

    app.patch("/adoptionRequests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        const query = { _id: new ObjectId(id) };

        const adoptionRequest = await adoptionCollection.findOne(query);

        if (!adoptionRequest) {
          return res.status(404).json({ error: "Adoption request not found" });
        }

        const updateDoc = { $set: { status: status } };
        const result = await adoptionCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0 && status === "Approved") {
          const petId = adoptionRequest.petId;

          const petQuery = ObjectId.isValid(petId)
            ? { _id: new ObjectId(petId) }
            : { _id: petId };

          await petsCollection.updateOne(petQuery, {
            $set: { status: "Adopted" },
          });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Failed to update request status" });
      }
    });

    app.get("/adoptionRequests/pet/:petId", async (req, res) => {
      try {
        const petId = req.params.petId;
        const query = { petId: petId };
        const result = await adoptionCollection.find(query).toArray();
        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching pet requests:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch requests for this pet" });
      }
    });

    app.put("/petsData/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        delete updatedData._id;

        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedData };

        const result = await petsCollection.updateOne(query, updateDoc);
        res.status(200).json(result);
      } catch (error) {
        console.error("Error updating pet profile:", error);
        res.status(500).json({ error: "Failed to update pet data" });
      }
    });

    app.delete("/adoptionRequests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await adoptionCollection.deleteOne(query);

        res.status(200).json(result);
      } catch (error) {
        console.error("Error deleting adoption request:", error);
        res.status(500).json({ error: "Failed to delete request" });
      }
    });

    app.patch("/petsData/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedData,
        };
        const result = await petsCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          const cascadeUpdateFields = {};
          if (updatedData.name) cascadeUpdateFields.petName = updatedData.name;
          if (updatedData.imageUrl)
            cascadeUpdateFields.petImage = updatedData.imageUrl;
          if (updatedData.breed)
            cascadeUpdateFields.petBreed = updatedData.breed;
          if (updatedData.age) cascadeUpdateFields.petAge = updatedData.age;
          if (updatedData.gender)
            cascadeUpdateFields.petGender = updatedData.gender;
          if (updatedData.adoptionFee)
            cascadeUpdateFields.adoptionFee = updatedData.adoptionFee;

          if (Object.keys(cascadeUpdateFields).length > 0) {
            await adoptionCollection.updateMany(
              {
                $or: [{ petId: id }, { petId: new ObjectId(id) }],
              },
              {
                $set: cascadeUpdateFields,
              }
            );
          }
        }

        res.send(result);
      } catch (error) {
        console.error("Error updating pet and matching requests:", error);
        res.status(500).send({
          acknowledged: false,
          message: "Internal Server Error",
          error: error.message,
        });
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
