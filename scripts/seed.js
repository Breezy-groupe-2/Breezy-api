const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

function isDocker() {
  if (process.platform === 'win32') return false;
  try {
    return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
  } catch (err) {
    try {
      return fs.existsSync('/.dockerenv');
    } catch (e) {
      return false;
    }
  }
}

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  moderationStatus: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  bio: { type: String, maxlength: 160, default: '' },
  avatar: { type: String, default: '' }
}, { timestamps: true });

const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  content: { type: String, required: true, maxlength: 280 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const likeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true, maxlength: 280 },
  postId: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const replySchema = new mongoose.Schema({
  content: { type: String, required: true, maxlength: 280 },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

async function getConnectionString(uri) {
  if (!uri) return null;
  const match = uri.match(/@([^/]+)\//);
  if (!match) return uri;
  
  const hostAndPort = match[1];
  const [host] = hostAndPort.split(':');
  
  if (isDocker()) {
    return uri; // inside docker, hostnames resolve perfectly
  } else {
    // on host, translate to localhost with exposed database ports
    let localPort = '27017';
    if (host === 'post-db') localPort = '27018';
    else if (host === 'comment-db') localPort = '27019';
    else if (host === 'profile-db') localPort = '27020';
    
    return uri.replace(hostAndPort, `localhost:${localPort}`);
  }
}

async function seed() {
  console.log('🌱 Starting database seeding...');

  // 1. Resolve connection strings
  const authUri = await getConnectionString(process.env.MONGODB_URI);
  const profileUri = await getConnectionString(process.env.PROFILE_SERVICE_MONGODB_URI);
  const postUri = await getConnectionString(process.env.POST_SERVICE_MONGODB_URI);
  const commentUri = await getConnectionString(process.env.COMMENT_SERVICE_MONGODB_URI);

  console.log('🔌 Connecting to databases...');
  const authConn = await mongoose.createConnection(authUri).asPromise();
  const profileConn = await mongoose.createConnection(profileUri).asPromise();
  const postConn = await mongoose.createConnection(postUri).asPromise();
  const commentConn = await mongoose.createConnection(commentUri).asPromise();
  console.log('✅ Connected to all databases successfully.');

  // Define models on respective connections
  const User = authConn.model('User', userSchema);
  const Follow = authConn.model('Follow', followSchema);
  const Profile = profileConn.model('Profile', profileSchema);
  const Post = postConn.model('Post', postSchema);
  const Like = postConn.model('Like', likeSchema);
  const Comment = commentConn.model('Comment', commentSchema);
  const Reply = commentConn.model('Reply', replySchema);

  // 2. Clean old data
  console.log('🧹 Cleaning existing data...');
  await User.deleteMany({});
  await Follow.deleteMany({});
  await Profile.deleteMany({});
  await Post.deleteMany({});
  await Like.deleteMany({});
  await Comment.deleteMany({});
  await Reply.deleteMany({});
  console.log('✅ Cleaned all collections.');

  // 3. Define fixed IDs to link seed data correctly
  const aliceId = new mongoose.Types.ObjectId();
  const bobId = new mongoose.Types.ObjectId();
  const charlieId = new mongoose.Types.ObjectId();
  const davidId = new mongoose.Types.ObjectId();
  const eveId = new mongoose.Types.ObjectId();

  const passwordHash = bcrypt.hashSync('password123', 12);

  // 4. Seed Users
  console.log('👤 Seeding Users...');
  await User.create([
    {
      _id: aliceId,
      username: 'alice',
      email: 'alice@breezy.local',
      passwordHash,
      role: 'admin',
      isActive: true,
      following: [bobId]
    },
    {
      _id: bobId,
      username: 'bob',
      email: 'bob@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: [aliceId, charlieId]
    },
    {
      _id: charlieId,
      username: 'charlie',
      email: 'charlie@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: [aliceId]
    },
    {
      _id: davidId,
      username: 'david',
      email: 'david@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: []
    },
    {
      _id: eveId,
      username: 'eve',
      email: 'eve@breezy.local',
      passwordHash,
      role: 'user',
      isActive: false,
      moderationStatus: 'suspended',
      following: []
    }
  ]);
  console.log('✅ Users seeded.');

  // 5. Seed Follows
  console.log('🤝 Seeding Follows...');
  await Follow.create([
    { follower: bobId, following: aliceId },
    { follower: bobId, following: charlieId },
    { follower: charlieId, following: aliceId },
    { follower: aliceId, following: bobId }
  ]);
  console.log('✅ Follow relationships seeded.');

  // 6. Seed Profiles
  console.log('📝 Seeding Profiles...');
  await Profile.create([
    {
      userId: aliceId,
      bio: 'Breezy platform administrator. Here to keep the vibes light and breezy! 🌬️',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=alice'
    },
    {
      userId: bobId,
      bio: 'Just another Breezy user exploring microservices and Docker containers! 🐳',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=bob'
    },
    {
      userId: charlieId,
      bio: 'Developer, designer, and social media minimalist. Loving the lightweight experience.',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=charlie'
    },
    {
      userId: davidId,
      bio: 'Hey everyone, I am David. Looking for interesting conversations!',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=david'
    },
    {
      userId: eveId,
      bio: 'My account is currently suspended for violating guideline terms.',
      avatar: ''
    }
  ]);
  console.log('✅ Profiles seeded.');

  // 7. Seed Posts
  console.log('📮 Seeding Posts...');
  const post1 = await Post.create({
    content: 'Welcome to Breezy, the ultimate lightweight social network! 🚀 Keep your posts short, friendly, and breezy.',
    author: aliceId
  });
  const post2 = await Post.create({
    content: 'As an administrator, please be mindful of other users. Be sure to check out the API Gateway swagger docs at /api-docs!',
    author: aliceId
  });
  const post3 = await Post.create({
    content: 'Loving the fast load times on Breezy! Microservices are really doing the heavy lifting here behind Nginx.',
    author: bobId
  });
  const post4 = await Post.create({
    content: 'Does anyone else love the clean dark mode aesthetic?',
    author: charlieId
  });
  console.log('✅ Posts seeded.');

  // 8. Seed Likes
  console.log('❤️ Seeding Likes...');
  await Like.create([
    { post: post1._id, user: bobId },
    { post: post1._id, user: charlieId },
    { post: post3._id, user: aliceId },
    { post: post4._id, user: bobId }
  ]);
  console.log('✅ Likes seeded.');

  // 9. Seed Comments
  console.log('💬 Seeding Comments...');
  const comment1 = await Comment.create({
    content: 'This feels incredibly fast! Great job on optimization.',
    postId: post1._id.toString(),
    author: bobId
  });
  const comment2 = await Comment.create({
    content: 'Agreed, the responsive UI mockup was awesome too.',
    postId: post1._id.toString(),
    author: charlieId
  });
  console.log('✅ Comments seeded.');

  // 10. Seed Replies
  console.log('🗣️ Seeding Replies...');
  await Reply.create([
    {
      content: 'Thanks, Bob! We are optimized for low-resource environments.',
      commentId: comment1._id,
      author: aliceId
    },
    {
      content: 'Thanks, Charlie! We appreciate the feedback.',
      commentId: comment2._id,
      author: aliceId
    }
  ]);
  console.log('✅ Replies seeded.');

  // 11. Close Connections
  console.log('🔌 Closing connections...');
  await Promise.all([
    authConn.close(),
    profileConn.close(),
    postConn.close(),
    commentConn.close()
  ]);

  console.log('🎉 Database seeding complete!');
}

seed().catch(err => {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
});
