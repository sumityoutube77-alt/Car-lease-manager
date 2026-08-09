const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Carlease:car@lease123@cluster0.bkey1c1.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.log('DB Connection Error:', err));

// Schema Definition
const leaseSchema = new mongoose.Schema({
    serialNo: Number,
    date: String,
    carBrand: String,
    carNumber: String,
    ownerName: String,
    ownerMobile: String,
    guarantor: String,
    guarantorMobile: String,
    cost: Number,
    paidCost: Number,
    bakaya: Number,
    documentTick: Boolean,
    trcTick: Boolean,
    rcTick: Boolean,
    insuranceTick: Boolean,
    numberPlateTick: Boolean,
    agreementTick: Boolean
});

const LeaseEntry = mongoose.model('LeaseEntry', leaseSchema);

// Home Route
app.get('/', (req, res) => {
    res.send('Haryana Car Lease Backend is Live & Running!');
});

// Get All Entries
app.get('/api/entries', async (req, res) => {
    try {
        const entries = await LeaseEntry.find().sort({ _id: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add New Entry
app.post('/api/entries', async (req, res) => {
    try {
        const count = await LeaseEntry.countDocuments();
        const newEntry = new LeaseEntry({
            serialNo: count + 1,
            ...req.body
        });
        await newEntry.save();
        res.status(201).json(newEntry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update / Edit Existing Entry
app.put('/api/entries/:id', async (req, res) => {
    try {
        const updatedEntry = await LeaseEntry.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedEntry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
