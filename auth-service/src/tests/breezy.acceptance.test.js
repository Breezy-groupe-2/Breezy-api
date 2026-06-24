const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const {
  app,
  authHeader,
  createPost,
  expectJsonError,
  loginUser,
  models,
  registerAndLogin,
  registerUser,
  setupAcceptanceDb,
  userPayload,
} = require('./helpers/api-test-utils');

setupAcceptanceDb();

describe.sequential('Breezy acceptance contract', () => {
  describe('Fx1 - user account creation with validation', () => {
    it('creates a user account, returns a JWT, and never leaks password fields', async () => {
      const payload = userPayload('register');
      const res = await registerUser(payload);
      const storedUser = await models.User.findOne({ email: payload.email });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({
        username: payload.username,
        email: payload.email,
        role: 'user',
      });
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(storedUser.passwordHash).not.toBe(payload.password);
      expect(await bcrypt.compare(payload.password, storedUser.passwordHash)).toBe(true);
    });

    it.each([
      ['short username', { username: 'ab' }, 'username'],
      ['invalid username characters', { username: 'bad name' }, 'username'],
      ['invalid email', { email: 'invalid-email' }, 'email'],
      ['short password', { password: 'short' }, 'password'],
      ['long password', { password: 'a'.repeat(129) }, 'password'],
    ])('rejects %s', async (_caseName, override, field) => {
      const res = await registerUser(userPayload('invalid', override));

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'Validation failed' });
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })])
      );
    });

    it('rejects duplicate email and duplicate username', async () => {
      const payload = userPayload('duplicate');
      await registerUser(payload);

      const duplicateEmail = await registerUser(userPayload('other', { email: payload.email }));
      const duplicateUsername = await registerUser(
        userPayload('another', { username: payload.username })
      );

      expectJsonError(duplicateEmail, 409);
      expectJsonError(duplicateUsername, 409);
    });
  });

  describe('Fx2 - secure authentication', () => {
    it('logs in with valid credentials and returns a signed JWT containing sub, role, and exp', async () => {
      const account = await registerAndLogin('login');
      const decoded = jwt.verify(account.token, process.env.JWT_SECRET);

      expect(account.loginRes.status).toBe(200);
      expect(decoded).toMatchObject({
        sub: account.user.id,
        role: 'user',
      });
      expect(decoded.exp).toEqual(expect.any(Number));
      expect(account.loginRes.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects unknown email, wrong password, missing token, malformed token, and expired token', async () => {
      const account = await registerAndLogin('secure');
      const expiredToken = jwt.sign(
        { sub: account.user.id, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      expect(
        (await loginUser({ email: 'nobody@example.com', password: 'Password123' })).status
      ).toBe(401);
      expect(
        (await loginUser({ email: account.payload.email, password: 'WrongPass123' })).status
      ).toBe(401);
      expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
      expect(
        (await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid')).status
      ).toBe(401);
      expect((await request(app).get('/api/v1/auth/me').set(authHeader(expiredToken))).status).toBe(
        401
      );
    });
  });

  describe('Fx3 - short post publishing', () => {
    it.each([
      ['1 character', 'a'],
      ['280 characters', 'a'.repeat(280)],
    ])('allows authenticated users to publish %s', async (_caseName, content) => {
      const account = await registerAndLogin('poster');
      const res = await createPost(account.token, content);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        content,
        likeCount: 0,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
    });

    it.each([
      ['empty content', ''],
      ['whitespace-only content', '   '],
      ['281 characters', 'a'.repeat(281)],
    ])('rejects %s', async (_caseName, content) => {
      const account = await registerAndLogin('postvalidation');
      const res = await createPost(account.token, content);

      expect(res.status).toBe(400);
    });

    it('requires authentication and lets only the author edit a post', async () => {
      const author = await registerAndLogin('author');
      const other = await registerAndLogin('other');
      const post = await createPost(author.token, 'Original content');

      const unauthenticated = await request(app)
        .post('/api/v1/posts')
        .send({ content: 'No token' });
      const forbidden = await request(app)
        .put(`/api/v1/posts/${post.body.id}`)
        .set(authHeader(other.token))
        .send({ content: 'Edited by somebody else' });
      const updated = await request(app)
        .put(`/api/v1/posts/${post.body.id}`)
        .set(authHeader(author.token))
        .send({ content: 'Edited by author' });

      expect(unauthenticated.status).toBe(401);
      expectJsonError(forbidden, 403);
      expect(updated.status).toBe(200);
      expect(updated.body.content).toBe('Edited by author');
    });
  });

  describe('Fx4 and Fx11 - profile post display', () => {
    it('lists only the selected user posts on their profile, newest first, with like counts', async () => {
      const owner = await registerAndLogin('profileposts');
      const other = await registerAndLogin('notprofileposts');
      await createPost(owner.token, 'Older profile post');
      await createPost(other.token, 'Other user post');
      await createPost(owner.token, 'Newer profile post');

      const res = await request(app)
        .get(`/api/v1/posts/user/${owner.user.id}`)
        .set(authHeader(owner.token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((post) => post.content)).toEqual([
        'Newer profile post',
        'Older profile post',
      ]);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          content: 'Newer profile post',
          likeCount: expect.any(Number),
          createdAt: expect.any(String),
        })
      );
    });

    it('returns an empty array for an unknown but valid user id', async () => {
      const account = await registerAndLogin('unknownprofileposts');
      const unknownUserId = new models.User()._id.toString();

      const res = await request(app)
        .get(`/api/v1/posts/user/${unknownUserId}`)
        .set(authHeader(account.token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('Fx5 - chronological feed from followed users', () => {
    it('returns followed users posts only, newest first', async () => {
      const reader = await registerAndLogin('reader');
      const followed = await registerAndLogin('followed');
      const stranger = await registerAndLogin('stranger');
      const follow = await request(app)
        .post(`/api/v1/users/${followed.user.id}/follow`)
        .set(authHeader(reader.token));

      await createPost(followed.token, 'Older followed post');
      await createPost(stranger.token, 'Stranger post');
      await createPost(followed.token, 'Newer followed post');

      const res = await request(app).get('/api/v1/feed').set(authHeader(reader.token));

      expect(follow.status).toBe(200);
      expect(res.status).toBe(200);
      expect(res.body.map((post) => post.content)).toEqual([
        'Newer followed post',
        'Older followed post',
      ]);
    });

    it('returns an empty feed when the user follows nobody', async () => {
      const reader = await registerAndLogin('emptyfeed');

      const res = await request(app).get('/api/v1/feed').set(authHeader(reader.token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('requires authentication to read the feed', async () => {
      const res = await request(app).get('/api/v1/feed');

      expect(res.status).toBe(401);
    });
  });

  describe('Fx6 - likes', () => {
    it('likes, rejects duplicate likes, unlikes, and keeps counts consistent', async () => {
      const author = await registerAndLogin('likeauthor');
      const liker = await registerAndLogin('liker');
      const post = await createPost(author.token, 'Post to like');

      const liked = await request(app)
        .post(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(liker.token));
      const duplicate = await request(app)
        .post(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(liker.token));
      const unliked = await request(app)
        .delete(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(liker.token));
      const unlikedAgain = await request(app)
        .delete(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(liker.token));

      expect(liked.status).toBe(200);
      expect(liked.body.likeCount).toBe(1);
      expectJsonError(duplicate, 409);
      expect(unliked.status).toBe(200);
      expect(unliked.body.likeCount).toBe(0);
      expect(unlikedAgain.status).toBe(200);
      expect(unlikedAgain.body.likeCount).toBe(0);
    });

    it('returns 404 for a missing post and 401 without authentication', async () => {
      const account = await registerAndLogin('like404');
      const missingPostId = new models.Post()._id;

      const missing = await request(app)
        .post(`/api/v1/posts/${missingPostId}/like`)
        .set(authHeader(account.token));
      const unauthenticated = await request(app).post(`/api/v1/posts/${missingPostId}/like`);

      expectJsonError(missing, 404);
      expect(unauthenticated.status).toBe(401);
    });

    it('rejects malformed post ids when liking or unliking', async () => {
      const account = await registerAndLogin('likeinvalidid');

      const like = await request(app)
        .post('/api/v1/posts/not-a-valid-object-id/like')
        .set(authHeader(account.token));
      const unlike = await request(app)
        .delete('/api/v1/posts/not-a-valid-object-id/like')
        .set(authHeader(account.token));

      expect(like.status).toBe(400);
      expect(unlike.status).toBe(400);
    });

    it('tracks counts correctly when two different users like and one unlikes', async () => {
      const author = await registerAndLogin('twolikeauthor');
      const likerOne = await registerAndLogin('likerone');
      const likerTwo = await registerAndLogin('likertwo');
      const post = await createPost(author.token, 'Post with two likers');

      const firstLike = await request(app)
        .post(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(likerOne.token));
      const secondLike = await request(app)
        .post(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(likerTwo.token));
      const firstUnlike = await request(app)
        .delete(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(likerOne.token));

      expect(firstLike.status).toBe(200);
      expect(firstLike.body.likeCount).toBe(1);
      expect(secondLike.status).toBe(200);
      expect(secondLike.body.likeCount).toBe(2);
      expect(firstUnlike.status).toBe(200);
      expect(firstUnlike.body.likeCount).toBe(1);
    });
  });

  describe('Fx7 - comments on posts', () => {
    it('creates and lists comments on a post in chronological order', async () => {
      const author = await registerAndLogin('commentauthor');
      const commenter = await registerAndLogin('commenter');
      const post = await createPost(author.token, 'Commented post');

      const first = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: 'First comment' });
      const second = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: 'Second comment' });
      const list = await request(app)
        .get(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(commenter.token));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(list.status).toBe(200);
      expect(list.body.map((comment) => comment.content)).toEqual([
        'First comment',
        'Second comment',
      ]);
    });

    it.each([
      ['empty comment', ''],
      ['281 character comment', 'a'.repeat(281)],
    ])('rejects %s', async (_caseName, content) => {
      const author = await registerAndLogin('commentvalidationauthor');
      const commenter = await registerAndLogin('commentvalidationuser');
      const post = await createPost(author.token, 'Comment validation post');

      const res = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content });

      expect(res.status).toBe(400);
    });
  });

  describe('Fx8 - replies to comments', () => {
    it('creates replies attached to the correct parent comment', async () => {
      const author = await registerAndLogin('replyauthor');
      const commenter = await registerAndLogin('replycommenter');
      const post = await createPost(author.token, 'Reply target post');
      const comment = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: 'Parent comment' });

      const reply = await request(app)
        .post(`/api/v1/comments/${comment.body.id}/replies`)
        .set(authHeader(author.token))
        .send({ content: 'Nested reply' });
      const list = await request(app)
        .get(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(author.token));

      expect(reply.status).toBe(201);
      expect(list.status).toBe(200);
      expect(list.body[0].replies).toEqual([
        expect.objectContaining({
          content: 'Nested reply',
          author: expect.any(Object),
        }),
      ]);
    });

    it('returns 404 when replying to a missing comment', async () => {
      const account = await registerAndLogin('missingreply');
      const missingCommentId = new models.Post()._id;

      const res = await request(app)
        .post(`/api/v1/comments/${missingCommentId}/replies`)
        .set(authHeader(account.token))
        .send({ content: 'Reply to nothing' });

      expectJsonError(res, 404);
    });
  });

  describe('Fx9 - follows and followers', () => {
    it('follows, prevents duplicate follows, unfollows, and updates follower lists', async () => {
      const follower = await registerAndLogin('follower');
      const target = await registerAndLogin('target');

      const follow = await request(app)
        .post(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      const duplicate = await request(app)
        .post(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      const followers = await request(app)
        .get(`/api/v1/users/${target.user.id}/followers`)
        .set(authHeader(target.token));
      const following = await request(app)
        .get(`/api/v1/users/${follower.user.id}/following`)
        .set(authHeader(follower.token));
      const unfollow = await request(app)
        .delete(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));

      expect(follow.status).toBe(200);
      expectJsonError(duplicate, 409);
      expect(followers.status).toBe(200);
      expect(followers.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: follower.user.id })])
      );
      expect(following.status).toBe(200);
      expect(following.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: target.user.id })])
      );
      expect(unfollow.status).toBe(200);
    });

    it('rejects following yourself and makes followed posts appear in the feed', async () => {
      const follower = await registerAndLogin('selffollower');
      const target = await registerAndLogin('feedtarget');
      await createPost(target.token, 'Visible after follow');

      const selfFollow = await request(app)
        .post(`/api/v1/users/${follower.user.id}/follow`)
        .set(authHeader(follower.token));
      await request(app)
        .post(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      const feed = await request(app).get('/api/v1/feed').set(authHeader(follower.token));

      expectJsonError(selfFollow, 400);
      expect(feed.status).toBe(200);
      expect(feed.body.map((post) => post.content)).toEqual(['Visible after follow']);
    });

    it('returns 404 for missing or malformed target and supports follow-unfollow-follow cycles', async () => {
      const follower = await registerAndLogin('cyclefollower');
      const target = await registerAndLogin('cycletarget');
      const missingUserId = new models.User()._id;
      const malformedId = 'not-a-valid-object-id';

      const missing = await request(app)
        .post(`/api/v1/users/${missingUserId}/follow`)
        .set(authHeader(follower.token));
      const malformed = await request(app)
        .post(`/api/v1/users/${malformedId}/follow`)
        .set(authHeader(follower.token));

      expectJsonError(missing, 404);
      expectJsonError(malformed, 404);

      const follow = await request(app)
        .post(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      expect(follow.status).toBe(200);

      const unfollow = await request(app)
        .delete(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      expect(unfollow.status).toBe(200);

      const refollow = await request(app)
        .post(`/api/v1/users/${target.user.id}/follow`)
        .set(authHeader(follower.token));
      expect(refollow.status).toBe(200);

      const followCount = await models.Follow.countDocuments({
        follower: follower.user.id,
        following: target.user.id,
      });
      expect(followCount).toBe(1);
    });
  });

  describe('Fx10 - basic user profile', () => {
    it('returns a public profile with basic info', async () => {
      const account = await registerAndLogin('profile');

      const res = await request(app)
        .get(`/api/v1/users/${account.user.id}`)
        .set(authHeader(account.token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          userId: account.user.id,
          bio: expect.any(String),
          avatarUrl: expect.any(String),
        })
      );
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('lets users update their own profile and validates profile input', async () => {
      const account = await registerAndLogin('profileupdate');

      const updated = await request(app)
        .put('/api/v1/users/me')
        .set(authHeader(account.token))
        .send({
          bio: 'Short bio for the Breezy profile.',
          avatarUrl: 'https://example.com/avatar.png',
        });
      const invalid = await request(app)
        .put('/api/v1/users/me')
        .set(authHeader(account.token))
        .send({
          bio: 'a'.repeat(161),
          avatarUrl: 'not-a-url',
        });

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        bio: 'Short bio for the Breezy profile.',
        avatarUrl: 'https://example.com/avatar.png',
      });
      expect(invalid.status).toBe(400);
    });

    it('returns public profile without authentication and never leaks sensitive fields', async () => {
      const account = await registerAndLogin('publicprofile');

      const res = await request(app).get(`/api/v1/users/${account.user.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          userId: account.user.id,
          bio: expect.any(String),
          avatarUrl: expect.any(String),
        })
      );
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('Fx21 - user suspension or banning', () => {
    it('blocks suspended users from logging in and using existing JWTs', async () => {
      const account = await registerAndLogin('suspended');
      await models.User.findByIdAndUpdate(account.user.id, { isActive: false });

      const loginRes = await loginUser({
        email: account.payload.email,
        password: account.payload.password,
      });
      const meRes = await request(app).get('/api/v1/auth/me').set(authHeader(account.token));

      expectJsonError(loginRes, 403);
      expectJsonError(meRes, 403);
    });

    it('allows moderators to suspend users and blocks regular users from moderation actions', async () => {
      const moderatorPayload = userPayload('moderator');
      const moderatorRegister = await registerUser(moderatorPayload);
      const regular = await registerAndLogin('regularmoderator');
      const target = await registerAndLogin('moderationtarget');
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      const forbidden = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(regular.token))
        .send({ status: 'suspended', reason: 'Rules violation' });
      const suspended = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'suspended', reason: 'Rules violation' });

      expectJsonError(forbidden, 403);
      expect(suspended.status).toBe(200);
      expect(suspended.body).toMatchObject({
        id: target.user.id,
        moderationStatus: 'suspended',
      });
    });

    it('blocks banned users from posting, liking, commenting, replying, following, and reading feed', async () => {
      const banned = await registerAndLogin('banned');
      const author = await registerAndLogin('banpostauthor');
      const post = await createPost(author.token, 'Post protected from banned user actions');
      const comment = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: 'Active user comment' });
      await models.User.findByIdAndUpdate(banned.user.id, { isActive: false });

      const postAttempt = await createPost(banned.token, 'Should not publish');
      const likeAttempt = await request(app)
        .post(`/api/v1/posts/${post.body.id}/like`)
        .set(authHeader(banned.token));
      const commentAttempt = await request(app)
        .post(`/api/v1/posts/${post.body.id}/comments`)
        .set(authHeader(banned.token))
        .send({ content: 'Should not comment' });
      const replyAttempt = await request(app)
        .post(`/api/v1/comments/${comment.body.id}/replies`)
        .set(authHeader(banned.token))
        .send({ content: 'Should not reply' });
      const followAttempt = await request(app)
        .post(`/api/v1/users/${author.user.id}/follow`)
        .set(authHeader(banned.token));
      const feedAttempt = await request(app).get('/api/v1/feed').set(authHeader(banned.token));

      expectJsonError(postAttempt, 403);
      expectJsonError(likeAttempt, 403);
      expectJsonError(commentAttempt, 403);
      expectJsonError(replyAttempt, 403);
      expectJsonError(followAttempt, 403);
      expectJsonError(feedAttempt, 403);
    });

    it('excludes suspended authors from the feed', async () => {
      const reader = await registerAndLogin('moderationfeedreader');
      const activeAuthor = await registerAndLogin('activeauthor');
      const suspendedAuthor = await registerAndLogin('suspendedauthor');
      const followActiveAuthor = await request(app)
        .post(`/api/v1/users/${activeAuthor.user.id}/follow`)
        .set(authHeader(reader.token));
      const followSuspendedAuthor = await request(app)
        .post(`/api/v1/users/${suspendedAuthor.user.id}/follow`)
        .set(authHeader(reader.token));
      await createPost(activeAuthor.token, 'Active author post');
      await createPost(suspendedAuthor.token, 'Suspended author post');
      await models.User.findByIdAndUpdate(suspendedAuthor.user.id, { isActive: false });

      const feed = await request(app).get('/api/v1/feed').set(authHeader(reader.token));

      expect(followActiveAuthor.status).toBe(200);
      expect(followSuspendedAuthor.status).toBe(200);
      expect(feed.status).toBe(200);
      expect(feed.body.map((post) => post.content)).toEqual(['Active author post']);
    });

    it('lets moderators suspend users with a duration and returns a future bannedUntil', async () => {
      const moderatorPayload = userPayload('suspenddurationmod');
      const moderatorRegister = await registerUser(moderatorPayload);
      const target = await registerAndLogin('suspenddurationtarget');
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      const suspended = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'suspended', durationHours: 24, reason: 'Temporary suspension' });

      expect(suspended.status).toBe(200);
      expect(suspended.body).toMatchObject({
        id: target.user.id,
        moderationStatus: 'suspended',
      });
      expect(new Date(suspended.body.bannedUntil).getTime()).toBeGreaterThan(Date.now());

      const storedTarget = await models.User.findById(target.user.id);
      expect(storedTarget.moderationStatus).toBe('suspended');
      expect(storedTarget.isActive).toBe(false);
      expect(storedTarget.bannedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('auto-reactivates an expired suspension on login and GET /api/v1/auth/me', async () => {
      const moderatorPayload = userPayload('expiremod');
      const moderatorRegister = await registerUser(moderatorPayload);
      const target = await registerAndLogin('expiretarget');
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'suspended', durationHours: 24, reason: 'Will expire' });

      expect((await loginUser({ email: target.payload.email, password: target.payload.password })).status).toBe(403);
      expect((await request(app).get('/api/v1/auth/me').set(authHeader(target.token))).status).toBe(403);

      await models.User.findByIdAndUpdate(target.user.id, {
        bannedUntil: new Date(Date.now() - 1000),
      });

      const reactivatedLogin = await loginUser({
        email: target.payload.email,
        password: target.payload.password,
      });
      const reactivatedMe = await request(app).get('/api/v1/auth/me').set(authHeader(target.token));

      expect(reactivatedLogin.status).toBe(200);
      expect(reactivatedMe.status).toBe(200);

      const storedTarget = await models.User.findById(target.user.id);
      expect(storedTarget.moderationStatus).toBe('active');
      expect(storedTarget.isActive).toBe(true);
      expect(storedTarget.bannedUntil).toBeNull();
    });

    it('blocks users moderated as banned from login and protected requests', async () => {
      const moderatorPayload = userPayload('banmod');
      const moderatorRegister = await registerUser(moderatorPayload);
      const target = await registerAndLogin('bantarget');
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      const banned = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'banned', reason: 'Permanent ban' });

      expect(banned.status).toBe(200);
      expect(banned.body).toMatchObject({
        id: target.user.id,
        moderationStatus: 'banned',
        bannedUntil: null,
      });

      expect((await loginUser({ email: target.payload.email, password: target.payload.password })).status).toBe(403);
      expect((await request(app).get('/api/v1/auth/me').set(authHeader(target.token))).status).toBe(403);
      expect((await createPost(target.token, 'Banned post attempt')).status).toBe(403);

      const storedTarget = await models.User.findById(target.user.id);
      expect(storedTarget.moderationStatus).toBe('banned');
      expect(storedTarget.isActive).toBe(false);
      expect(storedTarget.bannedUntil).toBeNull();
    });

    it('lets moderators reactivate users, clearing bannedUntil', async () => {
      const moderatorPayload = userPayload('unbanmod');
      const moderatorRegister = await registerUser(moderatorPayload);
      const target = await registerAndLogin('unbantarget');
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'suspended', durationHours: 24, reason: 'Pending review' });

      const unbanned = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'active', reason: 'Review complete' });

      expect(unbanned.status).toBe(200);
      expect(unbanned.body).toMatchObject({
        id: target.user.id,
        moderationStatus: 'active',
        bannedUntil: null,
      });

      const storedTarget = await models.User.findById(target.user.id);
      expect(storedTarget.moderationStatus).toBe('active');
      expect(storedTarget.isActive).toBe(true);
      expect(storedTarget.bannedUntil).toBeNull();
      expect(storedTarget.moderationHistory.some((entry) => entry.action === 'unban')).toBe(true);

      expect((await loginUser({ email: target.payload.email, password: target.payload.password })).status).toBe(200);
    });

    it('allows an expired-suspension moderator to keep moderating because checkActive reactivates before requireRole', async () => {
      const adminPayload = userPayload('adminreact');
      const adminRegister = await registerUser(adminPayload);
      const moderatorPayload = userPayload('modreact');
      const moderatorRegister = await registerUser(moderatorPayload);
      const target = await registerAndLogin('targetreact');
      await models.User.findByIdAndUpdate(adminRegister.body.user.id, { role: 'admin' });
      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, { role: 'moderator' });

      const adminLogin = await loginUser({ email: adminPayload.email, password: adminPayload.password });
      const moderatorLogin = await loginUser({
        email: moderatorPayload.email,
        password: moderatorPayload.password,
      });

      await request(app)
        .patch(`/api/v1/users/${moderatorRegister.body.user.id}/moderation`)
        .set(authHeader(adminLogin.body.token))
        .send({ status: 'suspended', durationHours: 24, reason: 'Moderator cooldown' });

      await models.User.findByIdAndUpdate(moderatorRegister.body.user.id, {
        bannedUntil: new Date(Date.now() - 1000),
      });

      const moderated = await request(app)
        .patch(`/api/v1/users/${target.user.id}/moderation`)
        .set(authHeader(moderatorLogin.body.token))
        .send({ status: 'suspended', durationHours: 1, reason: 'Moderated while reactivating' });

      expect(moderated.status).toBe(200);
      expect(moderated.body).toMatchObject({
        id: target.user.id,
        moderationStatus: 'suspended',
      });

      const storedModerator = await models.User.findById(moderatorRegister.body.user.id);
      expect(storedModerator.moderationStatus).toBe('active');
      expect(storedModerator.isActive).toBe(true);
      expect(storedModerator.bannedUntil).toBeNull();
    });
  });

  describe('Fx23 - custom theme', () => {
    it('saves user theme preferences and returns them on the current user endpoint', async () => {
      const account = await registerAndLogin('theme');

      const updated = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set(authHeader(account.token))
        .send({
          theme: {
            mode: 'dark',
            accentColor: '#1DA1F2',
          },
        });
      const me = await request(app).get('/api/v1/auth/me').set(authHeader(account.token));

      expect(updated.status).toBe(200);
      expect(updated.body.theme).toEqual({
        mode: 'dark',
        accentColor: '#1DA1F2',
      });
      expect(me.status).toBe(200);
      expect(me.body.preferences.theme).toEqual({
        mode: 'dark',
        accentColor: '#1DA1F2',
      });
    });

    it.each([
      ['unsupported mode', { theme: { mode: 'neon', accentColor: '#1DA1F2' } }],
      ['invalid accent color', { theme: { mode: 'light', accentColor: 'blue' } }],
    ])('rejects %s', async (_caseName, payload) => {
      const account = await registerAndLogin('invalidtheme');

      const res = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set(authHeader(account.token))
        .send(payload);

      expect(res.status).toBe(400);
    });
  });
});
