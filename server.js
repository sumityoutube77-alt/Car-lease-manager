const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: ['https://e77-alt.github.io', 'http://localhost:3000', 'https://your-frontend-domain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Carlease:car@lease123@cluster0.bkey1c1.mongodb.net/carlease?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
    console.error('❌ DB Connection Error:', err);
    process.exit(1);
});

// Schema Definition with validation
const leaseSchema = new mongoose.Schema({
    serialNo: { type: Number, default: 0 },
    date: { type: String, required: true },
    carBrand: { type: String, required: true },
    carNumber: { type: String, required: true },
    ownerName: { type: String, required: true },
    ownerMobile: { type: String, required: true },
    guarantor: { type: String, default: '' },
    guarantorMobile: { type: String, default: '' },
    cost: { type: Number, required: true, min: 0 },
    paidCost: { type: Number, required: true, min: 0 },
    bakaya: { type: Number, default: 0 },
    documentTick: { type: Boolean, default: false },
    trcTick: { type: Boolean, default: false },
    rcTick: { type: Boolean, default: false },
    insuranceTick: { type: Boolean, default: false },
    numberPlateTick: { type: Boolean, default: false },
    agreementTick: { type: Boolean, default: false }
}, { timestamps: true });

const LeaseEntry = mongoose.model('LeaseEntry', leaseSchema);

// Home Route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Haryana Car Lease Backend is Live & Running!',
        status: 'active',
        endpoints: {
            getAll: 'GET /api/entries',
            create: 'POST /api/entries',
            update: 'PUT /api/entries/:id',
            delete: 'DELETE /api/entries/:id'
        }
    });
});

// Health Check Route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Get All Entries
app.get('/api/entries', async (req, res) => {
    try {
        const entries = await LeaseEntry.find().sort({ _id: -1 });
        res.json(entries);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Single Entry
app.get('/api/entries/:id', async (req, res) => {
    try {
        const entry = await LeaseEntry.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json(entry);
    } catch (err) {
        console.error('Error fetching entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add New Entry
app.post('/api/entries', async (req, res) => {
    try {
        // Validate required fields
        const requiredFields = ['date', 'carBrand', 'carNumber', 'ownerName', 'ownerMobile', 'cost', 'paidCost'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }

        // Count documents for serial number
        const count = await LeaseEntry.countDocuments();
        
        // Create new entry with calculated fields
        const newEntryData = {
            serialNo: count + 1,
            ...req.body,
            // Ensure bakaya is calculated if not provided
            bakaya: req.body.bakaya || (parseFloat(req.body.cost) - parseFloat(req.body.paidCost))
        };

        const newEntry = new LeaseEntry(newEntryData);
        await newEntry.save();
        
        res.status(201).json({
            message: 'Entry created successfully',
            data: newEntry
        });
    } catch (err) {
        console.error('Error creating entry:', err);
        res.status(400).json({ error: err.message });
    }
});

// Update Existing Entry
app.put('/api/entries/:id', async (req, res) => {
    try {
        const entryId = req.params.id;
        
        // Check if entry exists
        const existingEntry = await LeaseEntry.findById(entryId);
        if (!existingEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Update entry with new data
        const updatedData = {
            ...req.body,
            // Recalculate bakaya if cost or paidCost is updated
            bakaya: req.body.bakaya || (parseFloat(req.body.cost || existingEntry.cost) - parseFloat(req.body.paidCost || existingEntry.paidCost))
        };

        const updatedEntry = await LeaseEntry.findByIdAndUpdate(
            entryId,
            updatedData,
            { new: true, runValidators: true }
        );
        
        res.json({
            message: 'Entry updated successfully',
            data: updatedEntry
        });
    } catch (err) {
        console.error('Error updating entry:', err);
        res.status(400).json({ error: err.message });
    }
});

// Delete Entry
app.delete('/api/entries/:id', async (req, res) => {
    try {
        const deletedEntry = await LeaseEntry.findByIdAndDelete(req.params.id);
        if (!deletedEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ message: 'Entry deleted successfully', data: deletedEntry });
    } catch (err) {
        console.error('Error deleting entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
