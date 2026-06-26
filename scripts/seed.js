const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

function isDocker() {
  if (process.platform === 'win32') return false;
  try {
    return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
  } catch {
    try {
      return fs.existsSync('/.dockerenv');
    } catch {
      return false;
    }
  }
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true, maxlength: 50 },
    bio: { type: String, maxlength: 160, default: '' },
    avatarUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    moderationStatus: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    bannedUntil: { type: Date, default: null },
    moderationHistory: [
      {
        action: { type: String, enum: ['suspend', 'ban', 'unban'], required: true },
        reason: { type: String, required: true },
        durationHours: { type: Number },
        bannedUntil: { type: Date },
        moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    preferences: {
      theme: {
        mode: { type: String, enum: ['light', 'dark'], default: 'dark' },
        accentColor: { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#1d9bf0' },
        _id: false
      },
      _id: false
    },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

// follow-service keeps its own user snapshots + follow edges in a separate DB.
const followUserSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true },
    avatarUrl: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 });

const postSchema = new mongoose.Schema(
  {
    content: { type: String, default: '', maxlength: 280, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, trim: true, default: null },
    repostOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null }
  },
  { timestamps: true }
);

postSchema.index(
  { author: 1, repostOf: 1 },
  { unique: true, partialFilterExpression: { repostOf: { $type: 'objectId' }, content: '' } }
);

const likeSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

likeSchema.index({ post: 1, user: 1 }, { unique: true });

const commentSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, maxlength: 280, trim: true },
    postId: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

commentSchema.index({ postId: 1, createdAt: -1 });

const replySchema = new mongoose.Schema(
  {
    content: { type: String, required: true, maxlength: 280, trim: true },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

replySchema.index({ commentId: 1, createdAt: -1 });

const reportSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['post'], required: true },
    reason: {
      type: String,
      enum: ['Spam', 'Harcèlement', 'Contenu inapproprié', 'Désinformation'],
      required: true
    },
    author: {
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      avatarUrl: { type: String },
      _id: false
    },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    onPostAuthor: {
      type: {
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        _id: false
      },
      default: undefined
    },
    reporter: {
      type: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        avatarUrl: { type: String },
        _id: false
      },
      required: true
    },
    count: { type: Number, default: 1, min: 1 },
    text: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'dismissed', 'actioned'], default: 'pending' }
  },
  { timestamps: true }
);

async function getConnectionString(uri) {
  if (!uri) return null;
  const match = uri.match(/@([^/]+)\//);
  if (!match) return uri;
  
  const hostAndPort = match[1];
  const [host] = hostAndPort.split(':');
  
  // Production Mode: Skip localhost translation for Docker environments
  // when explicitly running seed script inside containers
  if (process.env.SEED_DOCKER_MODE === 'true' || isDocker()) {
    // In production containers, connect directly to MongoDB service hostnames
    // (e.g., auth-db, post-follow-comment-db, profile-db) - these resolve via Docker network
    // The getConnectionString function should NOT translate hostname to localhost
    // in production mode, as container hostnames resolve perfectly in Docker network
    return uri;
  } else {
    // on host, translate to localhost with exposed database ports
    let localPort = '27017';
    if (host === 'post-follow-comment-db' || host === 'post-db') localPort = '27018';

    return uri.replace(hostAndPort, `localhost:${localPort}`);
  }
}

async function seed() {
  console.log('Starting database seeding...');

  // 1. Resolve connection strings
  const authUri = await getConnectionString(process.env.MONGODB_URI);
  const postUri = await getConnectionString(process.env.POST_SERVICE_MONGODB_URI);
  const commentUri = await getConnectionString(process.env.COMMENT_SERVICE_MONGODB_URI);
  const followUri = await getConnectionString(process.env.FOLLOW_SERVICE_MONGODB_URI);

  console.log('Connecting to databases...');
  const authConn = await mongoose.createConnection(authUri).asPromise();
  const postConn = await mongoose.createConnection(postUri).asPromise();
  const commentConn = await mongoose.createConnection(commentUri).asPromise();
  const followConn = await mongoose.createConnection(followUri).asPromise();
  console.log('Connected to all databases successfully.');

  // Define models on respective connections
  const User = authConn.model('User', userSchema);
  const Follow = authConn.model('Follow', followSchema);
  const Report = authConn.model('Report', reportSchema);
  // follow-service reads its own DB (snapshots + edges), not the auth DB.
  const FollowUser = followConn.model('User', followUserSnapshotSchema);
  const FollowEdge = followConn.model('Follow', followSchema);
  const Post = postConn.model('Post', postSchema);
  const Like = postConn.model('Like', likeSchema);
  const Comment = commentConn.model('Comment', commentSchema);
  const Reply = commentConn.model('Reply', replySchema);

  // 2. Clean old data
  console.log('Cleaning existing data...');
  await User.deleteMany({});
  await Follow.deleteMany({});
  await Report.deleteMany({});
  await Post.deleteMany({});
  await Like.deleteMany({});
  await Comment.deleteMany({});
  await Reply.deleteMany({});
  console.log('Cleaned all collections.');

  // 3. Define fixed IDs to link seed data correctly
  const aliceId = new mongoose.Types.ObjectId();
  const bobId = new mongoose.Types.ObjectId();
  const charlieId = new mongoose.Types.ObjectId();
  const davidId = new mongoose.Types.ObjectId();
  const eveId = new mongoose.Types.ObjectId();

  const passwordHash = bcrypt.hashSync('password123', 12);
  const reporter = (userId, username, displayName = username) => ({
    userId,
    username,
    displayName,
    avatarUrl: ''
  });

  // 4. Seed Users
  console.log('Seeding Users...');
  await User.create([
    {
      _id: aliceId,
      username: 'alice',
      displayName: 'Alice',
      bio: 'Breezy platform administrator. Here to keep the vibes light and breezy! 🌬️',
      email: 'alice@breezy.local',
      passwordHash,
      role: 'admin',
      isActive: true,
      following: [bobId]
    },
    {
      _id: bobId,
      username: 'bob',
      displayName: 'Bob',
      bio: 'Just another Breezy user exploring microservices and Docker containers! 🐳',
      email: 'bob@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: [aliceId, charlieId]
    },
    {
      _id: charlieId,
      username: 'charlie',
      displayName: 'Charlie',
      bio: 'Developer, designer, and social media minimalist.',
      email: 'charlie@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: [aliceId]
    },
    {
      _id: davidId,
      username: 'david',
      displayName: 'David',
      bio: 'Hey everyone, I am David. Looking for interesting conversations!',
      email: 'david@breezy.local',
      passwordHash,
      role: 'user',
      isActive: true,
      following: []
    },
    {
      _id: eveId,
      username: 'eve',
      displayName: 'Eve',
      bio: 'My account is currently suspended for violating guideline terms.',
      email: 'eve@breezy.local',
      passwordHash,
      role: 'user',
      isActive: false,
      moderationStatus: 'suspended',
      following: []
    }
  ]);
  console.log('Users seeded.');

  // 5. Seed Follows
  console.log('Seeding Follows...');
  await Follow.create([
    { follower: bobId, following: aliceId },
    { follower: bobId, following: charlieId },
    { follower: charlieId, following: aliceId },
    { follower: aliceId, following: bobId }
  ]);
  console.log('Follow relationships seeded.');

  // 7. Seed Posts
  console.log('Seeding Posts...');
  const post1 = await Post.create({
    content: 'Welcome to Breezy, the ultimate lightweight social network! 🚀 Keep it short and #breezy.',
    author: aliceId
  });
  await Post.create({
    content: 'As an administrator, please be mindful of other users. Check the swagger docs at /api-docs! #breezy #webdev',
    author: aliceId
  });
  const post3 = await Post.create({
    content: 'Loving the fast load times on Breezy! #microservices are doing the heavy lifting behind Nginx. #webdev',
    author: bobId
  });
  const post4 = await Post.create({
    content: 'Does anyone else love the clean #darkmode aesthetic? #design',
    author: charlieId
  });
  // Posts that will be reported for moderation (created so reports reference real content)
  const post5 = await Post.create({
    content: 'GAGNE 500€/JOUR depuis chez toi 💸💸 clique sur mon lien en bio, places limitées !!!',
    author: eveId
  });
  const post6 = await Post.create({
    content: "franchement t'es nul, arrête de poster, personne te lit de toute façon.",
    author: davidId
  });
  const post7 = await Post.create({
    content: "source : « mon cousin l'a dit ». donc c'est forcément vrai, arrêtez de vérifier.",
    author: bobId
  });
  console.log('Posts seeded.');

  // 8. Seed Likes
  console.log('Seeding Likes...');
  await Like.create([
    { post: post1._id, user: bobId },
    { post: post1._id, user: charlieId },
    { post: post3._id, user: aliceId },
    { post: post4._id, user: bobId }
  ]);
  console.log('Likes seeded.');

  // 9. Seed Comments
  console.log('Seeding Comments...');
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
  console.log('Comments seeded.');

  // 10. Seed Replies
  console.log('Seeding Replies...');
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
  console.log('Replies seeded.');

  // 11. Seed Moderation Reports (admin dashboard queue)
  console.log('Seeding Moderation Reports...');
  await Report.create([
    {
      kind: 'post',
      reason: 'Spam',
      author: { username: 'eve', displayName: 'Eve', avatarUrl: '' },
      postId: post5._id,
      reporter: reporter(aliceId, 'alice', 'Alice'),
      count: 4,
      text: 'GAGNE 500€/JOUR depuis chez toi 💸💸 clique sur mon lien en bio, places limitées !!!'
    },
    {
      kind: 'post',
      reason: 'Harcèlement',
      author: { username: 'david', displayName: 'David', avatarUrl: '' },
      postId: post6._id,
      onPostAuthor: { username: 'charlie', displayName: 'Charlie' },
      reporter: reporter(charlieId, 'charlie', 'Charlie'),
      count: 7,
      text: "franchement t'es nul, arrête de poster, personne te lit de toute façon."
    },
    {
      kind: 'post',
      reason: 'Désinformation',
      author: { username: 'bob', displayName: 'Bob', avatarUrl: '' },
      postId: post7._id,
      reporter: reporter(davidId, 'david', 'David'),
      count: 3,
      text: "source : « mon cousin l'a dit ». donc c'est forcément vrai, arrêtez de vérifier."
    }
  ]);
  console.log('Moderation reports seeded.');

  // 12. Seed follow-service DB (its own user snapshots + follow edges) so the
  //     chronological feed has data without anyone clicking "follow" first.
  console.log('Seeding follow-service snapshots and edges...');
  await FollowUser.deleteMany({});
  await FollowEdge.deleteMany({});
  const snapshot = (id, username, displayName, isActive = true) => ({
    _id: id,
    username,
    email: `${id}@internal.breezy.local`,
    displayName,
    avatarUrl: '',
    passwordHash: 'external-auth-user',
    role: 'user',
    isActive,
    following: []
  });
  await FollowUser.create([
    snapshot(aliceId, 'alice', 'Alice'),
    snapshot(bobId, 'bob', 'Bob'),
    snapshot(charlieId, 'charlie', 'Charlie'),
    snapshot(davidId, 'david', 'David'),
    snapshot(eveId, 'eve', 'Eve', false)
  ]);
  await FollowEdge.create([
    { follower: bobId, following: aliceId },
    { follower: bobId, following: charlieId },
    { follower: charlieId, following: aliceId },
    { follower: aliceId, following: bobId }
  ]);
  console.log('Follow-service data seeded.');

  // 13. Close Connections
  console.log('Closing connections...');
  await Promise.all([
    authConn.close(),
    postConn.close(),
    commentConn.close(),
    followConn.close()
  ]);

  console.log('Database seeding complete!');
}

seed().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
