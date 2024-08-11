require("dotenv").config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
const cors = require("cors")
const bcrypt = require("bcrypt")
const app = express()
const port = process.env.PORT || 5000;

// middlewares
app.use(cors({
    origin: ["http://localhost:5173", "https://mhfins.vercel.app"], credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}))
app.use(express.json())
app.use(cookieParser())



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jt5df8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = "mongodb://localhost:27017";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        deprecationErrors: true,
    }
});

const db = client.db("mh_vocabulary")
const userColl = db.collection("users")

async function verifyJWT(req, res, next) {
    const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1]
    if (!token) {
        return res.status(401).send({ message: "unauthorize user" })
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "invalid token, Mr. User | forbidden access" })
        }
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        // auth related apis
        // register user
        app.post("/api/register", async (req, res) => {
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                return res.status(400).send({ message: "All fields are required" })
            }
            // check if user already exists
            const isExist = await userColl.findOne({ email })
            if (isExist) {
                return res.status(409).send({ message: "User already exists with this email" })
            }
            // hash password
            const hashedPassword = await hashPassword(password)
            // insert user in database
            const result = await userColl.insertOne({ name, email, password: hashedPassword })
            console.log(result)
            // generate token 
            const token = await generateToken(name, email, result?.insertedId?.toString())
            res
                .status(200)
                .cookie("token", token, cookieOptions)
                .send({ user: result, token })
        })
        // log in user
        app.post("/api/login", async (req, res) => {
            const { email, password } = req.body;
            // check if all credentials are provided
            if (!email) {
                return res.status(400).send({ message: "Email number required" })
            }
            // find the user in db
            const user = await userColl.findOne({ email })
            if (!user) {
                return res.status(404).send({ message: "Wrong credentials. User Not found" })
            } { result, token }
            // verify password
            const verifyPassword = await bcrypt.compare(password, user?.password);
            if (!verifyPassword) {
                return res.status(401).send({ message: "Wrong password" })
            }
            // crate token
            const token = await generateToken(user.name, user?.email, user?._id.toString())
            // prepare data to send---
            // remove password from user Object
            delete user?.password;
            res
                .status(200)
                .cookie("token", token, cookieOptions)
                .send({ user, token })
        })
        // Logout
        app.post('/api/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', cookieOptions)
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })
        // get current user
        app.get("/api/current-user", verifyJWT, async (req, res) => {
            const query = { email: req?.user?.email }
            const options = { projection: { password: 0 } }
            const user = await userColl.findOne(query, options)
            if (!user) {
                return res.status(404).send("User not found")
            }
            res.send(user)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


// utils
async function generateToken(name, email, _id) {
    const token = jwt.sign(
        { name, email, _id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    )
    return token
}
async function hashPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 10)
    return hashedPassword;
}

const cookieOptions = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: process.env.NODE_ENV === 'production' ? true : false
}

async function bcryptPinVerify(pin, hashedPin) {
    const isVerified = await bcrypt.compare(pin, hashedPin)
    return isVerified
}