const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Enhanced CORS Configuration - Allow all origins for testing
app.use(cors({
    origin: '*', // Allow all origins for testing
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Fixed connection string with database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Carlease:car@lease123@cluster0.bkey1c1.mongodb.net/carlease?retryWrites=true&w=majority&appName=Cluster0';

console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('❌ DB Connection Error:', err);
    // Don't exit process, let it try to reconnect
});

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Schema Definition with proper validation
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
}, { 
    timestamps: true,
    strict: true // This ensures only defined fields are saved
});

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
            delete: 'DELETE /api/entries/:id',
            health: 'GET /health'
        },
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
        console.log('Fetching all entries...');
        const entries = await LeaseEntry.find().sort({ _id: -1 });
        console.log(`Found ${entries.length} entries`);
        res.json(entries);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).json({ 
            error: 'Failed to fetch entries',
            details: err.message 
        });
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
        res.status(500).json({ 
            error: 'Failed to fetch entry',
            details: err.message 
        });
    }
});

// Add New Entry
app.post('/api/entries', async (req, res) => {
    try {
        console.log('Received POST request with data:', req.body);
        
        // Validate required fields
        const requiredFields = ['date', 'carBrand', 'carNumber', 'ownerName', 'ownerMobile', 'cost', 'paidCost'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Count documents for serial number
        const count = await LeaseEntry.countDocuments();
        
        // Create new entry
        const newEntry = new LeaseEntry({
            serialNo: count + 1,
            ...req.body,
            // Ensure bakaya is calculated
            bakaya: req.body.bakaya || (parseFloat(req.body.cost) - parseFloat(req.body.paidCost))
        });

        console.log('Saving new entry:', newEntry);
        await newEntry.save();
        console.log('Entry saved successfully with ID:', newEntry._id);
        
        res.status(201).json({
            success: true,
            message: 'Entry created successfully',
            data: newEntry
        });
    } catch (err) {
        console.error('Error creating entry:', err);
        res.status(400).json({ 
            error: 'Failed to create entry',
            details: err.message 
        });
    }
});

// Update Existing Entry
app.put('/api/entries/:id', async (req, res) => {
    try {
        console.log('Received PUT request for ID:', req.params.id);
        console.log('Update data:', req.body);
        
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
        
        console.log('Entry updated successfully:', updatedEntry._id);
        res.json({
            success: true,
            message: 'Entry updated successfully',
            data: updatedEntry
        });
    } catch (err) {
        console.error('Error updating entry:', err);
        res.status(400).json({ 
            error: 'Failed to update entry',
            details: err.message 
        });
    }
});

// Delete Entry
app.delete('/api/entries/:id', async (req, res) => {
    try {
        const deletedEntry = await LeaseEntry.findByIdAndDelete(req.params.id);
        if (!deletedEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ 
            success: true,
            message: 'Entry deleted successfully',
            data: deletedEntry 
        });
    } catch (err) {
        console.error('Error deleting entry:', err);
        res.status(500).json({ 
            error: 'Failed to delete entry',
            details: err.message 
        });
    }
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: https://car-lease-manager.onrender.com/health`);
    console.log(`📋 API Endpoint: https://car-lease-manager.onrender.com/api/entries`);
});
