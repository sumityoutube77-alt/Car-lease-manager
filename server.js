const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// DATABASE CONNECTION
// ============================================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Carlease:carlease123@cluster0.bkey1c1.mongodb.net/carlease?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔄 Connecting to MongoDB...');
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('❌ DB Connection Error:', err);
});

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected, attempting to reconnect...');
    setTimeout(() => {
        mongoose.connect(MONGO_URI).catch(err => {
            console.error('Reconnection failed:', err);
        });
    }, 5000);
});

// ============================================================
// SCHEMAS
// ============================================================

// User Schema
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetOTP: { type: String, default: '' },
    resetOTPExpiry: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

// Lease Entry Schema
const leaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    strict: true
});

const User = mongoose.model('User', userSchema);
const LeaseEntry = mongoose.model('LeaseEntry', leaseSchema);

// ============================================================
// JWT HELPER
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRY = '7d';

function generateToken(user) {
    return jwt.sign(
        { 
            userId: user._id, 
            username: user.username,
            email: user.email,
            fullName: user.fullName
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ============================================================
// AUTH ROUTES
// ============================================================

// 1. REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.username || req.body.email);

        const { fullName, email, username, password } = req.body;

        if (!fullName || !email || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            if (existingUser.email === email) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            fullName,
            email,
            username,
            password: hashedPassword
        });

        await user.save();

        console.log('✅ User registered:', username);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.username);

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = generateToken(user);

        console.log('✅ User logged in:', username);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

// 3. VERIFY TOKEN
app.get('/api/auth/verify', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            valid: true,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username
            }
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// 4. FORGOT PASSWORD - OTP Generate (Dashboard Par Show)
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetOTP = otp;
        user.resetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        console.log(`🔑 OTP for ${username}: ${otp}`);

        // OTP response mein bhejo - Dashboard par show hoga
        res.json({
            success: true,
            message: 'OTP generated successfully',
            otp: otp,
            username: user.username,
            fullName: user.fullName
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to generate OTP' });
    }
});

// 5. RESET PASSWORD - Verify OTP
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { username, otp, newPassword } = req.body;

        if (!username || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.resetOTP !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (user.resetOTPExpiry < new Date()) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.resetOTP = '';
        user.resetOTPExpiry = null;
        await user.save();

        console.log('✅ Password reset for:', username);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ============================================================
// LEASE ENTRY ROUTES (Protected)
// ============================================================

// GET All Entries (User-specific)
app.get('/api/entries', verifyToken, async (req, res) => {
    try {
        const entries = await LeaseEntry.find({ userId: req.user.userId }).sort({ _id: -1 });
        res.json(entries);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Single Entry
app.get('/api/entries/:id', verifyToken, async (req, res) => {
    try {
        const entry = await LeaseEntry.findOne({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json(entry);
    } catch (err) {
        console.error('Error fetching entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE Entry
app.post('/api/entries', verifyToken, async (req, res) => {
    try {
        console.log('📝 Creating entry for user:', req.user.username);

        const requiredFields = ['date', 'carBrand', 'carNumber', 'ownerName', 'ownerMobile', 'cost', 'paidCost'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        const count = await LeaseEntry.countDocuments({ userId: req.user.userId });

        const newEntry = new LeaseEntry({
            userId: req.user.userId,
            serialNo: count + 1,
            ...req.body,
            bakaya: (parseFloat(req.body.cost) || 0) - (parseFloat(req.body.paidCost) || 0)
        });

        await newEntry.save();
        console.log('✅ Entry created:', newEntry._id);

        res.status(201).json({
            success: true,
            message: 'Entry created successfully',
            data: newEntry
        });
    } catch (err) {
        console.error('Error creating entry:', err);
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Entry
app.put('/api/entries/:id', verifyToken, async (req, res) => {
    try {
        console.log('✏️ Updating entry for user:', req.user.username);

        const entry = await LeaseEntry.findOne({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });

        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const updatedData = {
            ...req.body,
            bakaya: (parseFloat(req.body.cost) || entry.cost) - (parseFloat(req.body.paidCost) || entry.paidCost)
        };

        const updatedEntry = await LeaseEntry.findByIdAndUpdate(
            req.params.id,
            updatedData,
            { new: true, runValidators: true }
        );

        console.log('✅ Entry updated:', updatedEntry._id);

        res.json({
            success: true,
            message: 'Entry updated successfully',
            data: updatedEntry
        });
    } catch (err) {
        console.error('Error updating entry:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE Entry
app.delete('/api/entries/:id', verifyToken, async (req, res) => {
    try {
        console.log('🗑️ Deleting entry for user:', req.user.username);

        const entry = await LeaseEntry.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });

        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        console.log('✅ Entry deleted:', req.params.id);

        res.json({
            success: true,
            message: 'Entry deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.json({
        status: dbState === 1 ? 'healthy' : 'unhealthy',
        mongodb: states[dbState] || 'unknown',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Haryana Car Lease Backend',
        status: 'running',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                verify: 'GET /api/auth/verify',
                forgot: 'POST /api/auth/forgot-password',
                reset: 'POST /api/auth/reset-password'
            },
            entries: {
                getAll: 'GET /api/entries',
                getOne: 'GET /api/entries/:id',
                create: 'POST /api/entries',
                update: 'PUT /api/entries/:id',
                delete: 'DELETE /api/entries/:id'
            },
            health: 'GET /health'
        }
    });
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📋 API Base: https://car-lease-manager.onrender.com`);
    console.log(`🔐 Auth: /api/auth/register, /api/auth/login`);
    console.log(`📊 Entries: /api/entries`);
});
