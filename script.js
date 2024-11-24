// File: package.json
{
  "name": "palmlove-social",
  "version": "1.0.0",
  "description": "PalmLove Social Media Platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "client": "cd client && npm start",
    "dev": "concurrently \"npm run start\" \"npm run client\""
  },
  "dependencies": {
    "express": "^4.17.1",
    "mongoose": "^6.0.12",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^8.5.1",
    "cors": "^2.8.5",
    "multer": "^1.4.3",
    "dotenv": "^10.0.0"
  }
}

// File: .env
MONGODB_URI=mongodb://localhost:27017/palmlove
JWT_SECRET=palmlove2022secret
PORT=5000

// File: server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Models
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: 'default-avatar.png'
    },
    bio: String,
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const postSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    image: String,
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));

// File: routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Create new user
        user = new User({
            username,
            email,
            password: await bcrypt.hash(password, 10)
        });

        await user.save();

        // Create token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Return token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// File: client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/register" component={Register} />
            <PrivateRoute exact path="/" component={Home} />
            <PrivateRoute exact path="/profile/:username" component={Profile} />
          </Switch>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;

// File: client/src/components/Home.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Post from './Post';
import CreatePost from './CreatePost';
import { useAuth } from '../context/AuthContext';

const Home = () => {
    const [posts, setPosts] = useState([]);
    const { token } = useAuth();

    useEffect(() => {
        const fetchPosts = async () => {
            const res = await axios.get('/api/posts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(res.data);
        };
        fetchPosts();
    }, [token]);

    return (
        <div className="container mx-auto px-4">
            <CreatePost setPosts={setPosts} />
            <div className="space-y-4">
                {posts.map(post => (
                    <Post key={post._id} post={post} />
                ))}
            </div>
        </div>
    );
};

export default Home;

// File: client/src/components/Post.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Post = ({ post }) => {
    const [likes, setLikes] = useState(post.likes);
    const [comments, setComments] = useState(post.comments);
    const { token } = useAuth();

    const handleLike = async () => {
        try {
            const res = await axios.post(`/api/posts/${post._id}/like`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLikes(res.data.likes);
        } catch (err) {
            console.error(err);
        }
    };

    const handleComment = async (content) => {
        try {
            const res = await axios.post(
                `/api/posts/${post._id}/comment`,
                { content },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setComments(res.data.comments);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-4">
                <img
                    src={post.user.profilePicture}
                    alt={post.user.username}
                    className="w-10 h-10 rounded-full mr-4"
                />
                <Link to={`/profile/${post.user.username}`}>
                    <h3 className="font-bold">{post.user.username}</h3>
                </Link>
            </div>
            
            {post.image && (
                <img
                    src={post.image}
                    alt="Post content"
                    className="w-full rounded-lg mb-4"
                />
            )}
            
            <p className="mb-4">{post.content}</p>
            
            <div className="flex items-center space-x-4">
                <button
                    onClick={handleLike}
                    className="flex items-center space-x-1"
                >
                    <span>❤️</span>
                    <span>{likes.length}</span>
                </button>
                
                <button className="flex items-center space-x-1">
                    <span>💬</span>
                    <span>{comments.length}</span>
                </button>
            </div>
        </div>
    );
};

export default Post;
