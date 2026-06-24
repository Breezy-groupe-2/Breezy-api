#!/usr/bin/env node
/**
 * End-to-end acceptance checks for the mandatory features (Fx1–Fx11).
 * Runs against the running API gateway (default http://localhost:3010).
 *
 *   npm run test:fx
 *   FX_BASE_URL=http://localhost:3010 node scripts/fx-acceptance.js
 *
 * It registers throwaway users (suffixed with a timestamp) so it can be run
 * repeatedly without colliding with existing data. Exit code is non-zero if any
 * check fails.
 */

const BASE =
  process.env.FX_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010';

let passed = 0;
let failed = 0;

const check = (name, ok, detail = '') => {
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
};

const section = (title) => console.log(`\n${title}`);

async function main() {
  console.log(`Breezy acceptance — Fx1..Fx11 against ${BASE}`);

  // Fail fast if the gateway is unreachable.
  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error(`\n⛔ Gateway unreachable at ${BASE}. Is the stack running? (npm run dev)`);
    process.exit(2);
  }

  const suffix = Date.now().toString(36);
  const alice = {
    username: `fxalice_${suffix}`,
    email: `fxalice_${suffix}@test.local`,
    password: 'Password123',
  };
  const bob = {
    username: `fxbob_${suffix}`,
    email: `fxbob_${suffix}@test.local`,
    password: 'Password123',
  };

  // ── Fx1: account creation with validation ───────────────────────────────
  section('Fx1 — Création de comptes + validation');
  const badReg = await api('POST', '/api/v1/auth/register', {
    body: { username: 'x', email: 'not-an-email', password: '123' },
  });
  check('register rejette une entrée invalide (400)', badReg.status === 400, `status=${badReg.status}`);
  const regA = await api('POST', '/api/v1/auth/register', { body: alice });
  check('register crée un compte (201 + token)', regA.status === 201 && Boolean(regA.data?.token), `status=${regA.status}`);
  const dupReg = await api('POST', '/api/v1/auth/register', { body: alice });
  check('register rejette un doublon (409)', dupReg.status === 409, `status=${dupReg.status}`);

  // ── Fx2: secure authentication ──────────────────────────────────────────
  section('Fx2 — Authentification sécurisée');
  const badLogin = await api('POST', '/api/v1/auth/login', {
    body: { email: alice.email, password: 'WrongPassword' },
  });
  check('login rejette un mauvais mot de passe (401)', badLogin.status === 401, `status=${badLogin.status}`);
  const loginA = await api('POST', '/api/v1/auth/login', {
    body: { email: alice.email, password: alice.password },
  });
  check('login renvoie un JWT', loginA.status === 200 && Boolean(loginA.data?.token), `status=${loginA.status}`);
  const tokenA = loginA.data?.token;
  const meRes = await api('GET', '/api/v1/auth/me', { token: tokenA });
  check('/auth/me renvoie l’utilisateur courant', meRes.status === 200 && meRes.data?.username === alice.username);
  const noAuth = await api('GET', '/api/v1/auth/me');
  check('route protégée refuse sans token (401)', noAuth.status === 401, `status=${noAuth.status}`);

  // ── Fx10: profile with basic info ───────────────────────────────────────
  section('Fx10 — Profil avec infos de base (nom, bio, photo)');
  const profA = await api('GET', `/api/v1/users/${alice.username}`, { token: tokenA });
  check(
    'le profil expose displayName / bio / avatarUrl',
    profA.status === 200 && 'displayName' in (profA.data || {}) && 'bio' in (profA.data || {}) && 'avatarUrl' in (profA.data || {})
  );
  const upd = await api('PUT', '/api/v1/users/me', {
    token: tokenA,
    body: { displayName: 'FX Alice', bio: 'Bio de test' },
  });
  check('mise à jour du profil (displayName + bio)', upd.status === 200 && upd.data?.displayName === 'FX Alice' && upd.data?.bio === 'Bio de test');

  // ── Fx3: publish short post (280 chars) ─────────────────────────────────
  section('Fx3 — Publication de messages courts (280 car.)');
  const tooLong = await api('POST', '/api/v1/posts', { token: tokenA, body: { content: 'a'.repeat(281) } });
  check('rejette un post > 280 caractères (400)', tooLong.status === 400, `status=${tooLong.status}`);
  const post = await api('POST', '/api/v1/posts', { token: tokenA, body: { content: `Mon premier post #fxtest ${suffix}` } });
  check('publie un post court (201)', post.status === 201 && Boolean(post.data?.id), `status=${post.status}`);
  const postId = post.data?.id;
  check('le post porte un auteur (objet)', post.data?.author?.username === alice.username);

  // ── Fx4 / Fx11: posts on profile ────────────────────────────────────────
  section('Fx4 / Fx11 — Messages affichés sur le profil');
  const ownPosts = await api('GET', '/api/v1/posts/me', { token: tokenA });
  check('GET /posts/me contient le post', Array.isArray(ownPosts.data) && ownPosts.data.some((p) => p.id === postId));
  const byUser = await api('GET', `/api/v1/posts/user/${alice.username}`, { token: tokenA });
  check('GET /posts/user/:username contient le post', Array.isArray(byUser.data) && byUser.data.some((p) => p.id === postId));

  // ── Fx6: like a post ────────────────────────────────────────────────────
  section('Fx6 — Liker un post');
  const like = await api('POST', `/api/v1/posts/${postId}/like`, { token: tokenA });
  check('like → likeCount = 1', like.status === 200 && like.data?.likeCount === 1, `status=${like.status}`);
  const afterLike = await api('GET', `/api/v1/posts/${postId}`, { token: tokenA });
  check('isLiked = true après like', afterLike.data?.isLiked === true && afterLike.data?.likeCount === 1);
  const unlike = await api('DELETE', `/api/v1/posts/${postId}/like`, { token: tokenA });
  check('unlike → likeCount = 0', unlike.status === 200 && unlike.data?.likeCount === 0);

  // ── Fx7: comment on a post ──────────────────────────────────────────────
  section('Fx7 — Répondre à un post (commentaire)');
  const comment = await api('POST', `/api/v1/posts/${postId}/comments`, { token: tokenA, body: { content: 'Un commentaire' } });
  check('commentaire créé (201)', comment.status === 201 && Boolean(comment.data?.id), `status=${comment.status}`);
  const commentId = comment.data?.id;
  const afterComment = await api('GET', `/api/v1/posts/${postId}`, { token: tokenA });
  check('commentsCount incrémenté à 1', afterComment.data?.commentsCount === 1, `count=${afterComment.data?.commentsCount}`);
  const comments = await api('GET', `/api/v1/posts/${postId}/comments`, { token: tokenA });
  check('la liste des commentaires contient l’auteur', Array.isArray(comments.data) && comments.data.some((c) => c.id === commentId && c.author?.username === alice.username));

  // ── Fx8: reply to a comment ─────────────────────────────────────────────
  section('Fx8 — Répondre à un commentaire');
  const reply = await api('POST', `/api/v1/comments/${commentId}/replies`, { token: tokenA, body: { content: 'Une réponse' } });
  check('réponse créée (201)', reply.status === 201 && Boolean(reply.data?.id), `status=${reply.status}`);
  const replies = await api('GET', `/api/v1/comments/${commentId}/replies`, { token: tokenA });
  check('la liste des réponses contient la réponse', Array.isArray(replies.data) && replies.data.some((r) => r.id === reply.data?.id));
  const threadWithReply = await api('GET', `/api/v1/posts/${postId}/comments`, { token: tokenA });
  const thread = Array.isArray(threadWithReply.data) ? threadWithReply.data : [];
  const parentInThread = thread.find((c) => c.id === commentId);
  check('la réponse apparaît imbriquée dans le commentaire', Boolean(parentInThread?.replies?.some((r) => r.id === reply.data?.id)));
  const countWithReply = await api('GET', `/api/v1/posts/${postId}`, { token: tokenA });
  check('commentsCount inclut la réponse (= 2)', countWithReply.data?.commentsCount === 2, `count=${countWithReply.data?.commentsCount}`);

  // ── Likes de commentaires / réponses (persistés) ────────────────────────
  section('Likes de commentaires / réponses');
  const likeC = await api('POST', `/api/v1/comments/${commentId}/like`, { token: tokenA });
  check('like commentaire → likeCount 1', likeC.status === 200 && likeC.data?.likeCount === 1, `status=${likeC.status}`);
  const likeR = await api('POST', `/api/v1/comments/${reply.data?.id}/like`, { token: tokenA });
  check('like réponse → likeCount 1', likeR.status === 200 && likeR.data?.likeCount === 1, `status=${likeR.status}`);
  const persisted = await api('GET', `/api/v1/posts/${postId}/comments`, { token: tokenA });
  const pComment = (Array.isArray(persisted.data) ? persisted.data : []).find((c) => c.id === commentId);
  check('like commentaire persiste (isLiked + likeCount)', pComment?.isLiked === true && pComment?.likeCount === 1);
  const pReply = pComment?.replies?.find((r) => r.id === reply.data?.id);
  check('like réponse persiste (isLiked + likeCount)', pReply?.isLiked === true && pReply?.likeCount === 1);
  const unlikeC = await api('DELETE', `/api/v1/comments/${commentId}/like`, { token: tokenA });
  check('unlike commentaire → likeCount 0', unlikeC.status === 200 && unlikeC.data?.likeCount === 0);

  // ── Suppression commentaire / réponse (Fx7 / Fx8) ───────────────────────
  section('Suppression de commentaires / réponses');
  const otherReg = await api('POST', '/api/v1/auth/register', {
    body: { username: `fxmallory_${suffix}`, email: `fxmallory_${suffix}@test.local`, password: 'Password123' },
  });
  const delForbidden = await api('DELETE', `/api/v1/comments/${commentId}/replies/${reply.data?.id}`, { token: otherReg.data?.token });
  check('un autre utilisateur ne peut pas supprimer (403)', delForbidden.status === 403, `status=${delForbidden.status}`);
  const delReply = await api('DELETE', `/api/v1/comments/${commentId}/replies/${reply.data?.id}`, { token: tokenA });
  check('l’auteur supprime sa réponse (204)', delReply.status === 204, `status=${delReply.status}`);
  const repliesAfter = await api('GET', `/api/v1/comments/${commentId}/replies`, { token: tokenA });
  check('la réponse a disparu', Array.isArray(repliesAfter.data) && !repliesAfter.data.some((r) => r.id === reply.data?.id));
  const delComment = await api('DELETE', `/api/v1/posts/${postId}/comments/${commentId}`, { token: tokenA });
  check('l’auteur supprime son commentaire (204)', delComment.status === 204, `status=${delComment.status}`);
  const afterDelete = await api('GET', `/api/v1/posts/${postId}`, { token: tokenA });
  check('commentsCount redescend à 0', afterDelete.data?.commentsCount === 0, `count=${afterDelete.data?.commentsCount}`);

  // ── Fx9: follow / followers ─────────────────────────────────────────────
  section('Fx9 — Suivre / être suivi');
  const regB = await api('POST', '/api/v1/auth/register', { body: bob });
  const tokenB = regB.data?.token;
  const follow = await api('POST', `/api/v1/users/${bob.username}/follow`, { token: tokenA });
  check('follow (200)', follow.status === 200, `status=${follow.status}`);
  const profB = await api('GET', `/api/v1/users/${bob.username}`, { token: tokenA });
  check('followersCount du suivi mis à jour (= 1)', profB.data?.followersCount === 1, `count=${profB.data?.followersCount}`);
  const followingA = await api('GET', `/api/v1/users/${alice.username}/following`, { token: tokenA });
  check('la liste following contient bob', Array.isArray(followingA.data) && followingA.data.some((u) => u.username === bob.username));
  const followersB = await api('GET', `/api/v1/users/${bob.username}/followers`, { token: tokenA });
  check('la liste followers de bob contient alice', Array.isArray(followersB.data) && followersB.data.some((u) => u.username === alice.username));

  // ── Fx5: chronological feed of followed users ───────────────────────────
  section('Fx5 — Flux chronologique des suivis');
  const bPost1 = await api('POST', '/api/v1/posts', { token: tokenB, body: { content: `Bob post 1 ${suffix}` } });
  await sleep(20);
  const bPost2 = await api('POST', '/api/v1/posts', { token: tokenB, body: { content: `Bob post 2 ${suffix}` } });
  const feed = await api('GET', '/api/v1/feed', { token: tokenA });
  const feedIds = Array.isArray(feed.data) ? feed.data.map((p) => p.id) : [];
  check('le feed contient les posts du suivi', feedIds.includes(bPost1.data?.id) && feedIds.includes(bPost2.data?.id));
  check(
    'le feed est chronologique (plus récent en premier)',
    feedIds.indexOf(bPost2.data?.id) !== -1 && feedIds.indexOf(bPost2.data?.id) < feedIds.indexOf(bPost1.data?.id)
  );
  const unfollow = await api('DELETE', `/api/v1/users/${bob.username}/follow`, { token: tokenA });
  check('unfollow (200)', unfollow.status === 200);
  const feedAfter = await api('GET', '/api/v1/feed', { token: tokenA });
  const feedAfterIds = Array.isArray(feedAfter.data) ? feedAfter.data.map((p) => p.id) : [];
  check('après unfollow, les posts disparaissent du feed', !feedAfterIds.includes(bPost1.data?.id));

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`Résultat : ${passed}/${passed + failed} checks réussis${failed ? ` — ${failed} échec(s)` : ' ✅'}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n⛔ Erreur inattendue pendant les tests :', err);
  process.exit(2);
});
